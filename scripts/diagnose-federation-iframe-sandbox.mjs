/**
 * Inspect Grafana nmcclain-iframe-panel DOM: sandbox, allow, in-frame session/bootstrap.
 * Env: GRAFANA_URL, GRAFANA_GITHUB_USER, GRAFANA_GITHUB_PASSWORD (GitHub OAuth)
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  ensureGrafanaLogin,
  resolveGrafanaAuthEnv,
} from './lib/grafana-github-oauth-login.mjs';

const { grafanaUrl } = resolveGrafanaAuthEnv();
const outDir = path.resolve(process.env.DIAGNOSTIC_OUT || 'artifacts/federation-iframe-sandbox');

const target = {
  name: 'fleet-federation-viewer',
  path: '/d/runtime-fleet-federation-viewer/fleet-federation-viewer',
  base44Host: 'fleet-operations-console.base44.app',
};

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const authEnv = resolveGrafanaAuthEnv();
  const report = {
    capturedAt: new Date().toISOString(),
    grafanaUrl,
    authMode: authEnv.hasGitHubOAuth ? 'github-oauth' : authEnv.hasLegacyLogin ? 'legacy-password' : 'none',
    oauthLoginSuccess: false,
    loginMethod: 'none',
    loginError: null,
    iframePresent: false,
    federationViewerBanner: false,
    runtimeEmbedDetected: false,
    pluginSourceAudit: {
      pluginId: 'nmcclain-iframe-panel',
      version: '1.0.1',
      sandboxAttributeInPluginSource: false,
      note: 'Upstream IframePanel.tsx renders <iframe src=...> with no sandbox attribute.',
    },
    iframeDom: null,
    inFrame: null,
    consoleErrors: [],
  };

  if (!grafanaUrl) {
    report.error = 'GRAFANA_URL required';
    fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

  try {
    const loginResult = await ensureGrafanaLogin(context);
    report.oauthLoginSuccess = loginResult.oauthLoginSuccess;
    report.loginMethod = loginResult.loginMethod;
    report.loginError = loginResult.error || null;

    if (!loginResult.oauthLoginSuccess) {
      report.error = loginResult.error || 'Grafana login failed';
      fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
      process.exit(1);
    }

    const page = loginResult.page;
    page.on('console', (msg) => {
      if (msg.type() === 'error') report.consoleErrors.push(msg.text().slice(0, 200));
    });

    const url = `${grafanaUrl}${target.path}?kiosk`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(5000);

    const iframe = page.locator(`iframe[src*="${target.base44Host}"]`).first();
    if ((await iframe.count()) === 0) {
      report.iframeDom = { present: false };
      report.iframePresent = false;
    } else {
      const src = (await iframe.getAttribute('src')) || '';
      report.iframePresent = true;
      report.runtimeEmbedDetected = src.includes('runtime_embed=grafana');
      report.iframeDom = {
        present: true,
        src: src.slice(0, 160),
        sandbox: await iframe.getAttribute('sandbox'),
        allow: await iframe.getAttribute('allow'),
        referrerPolicy: await iframe.getAttribute('referrerpolicy'),
        title: await iframe.getAttribute('title'),
        box: await iframe.boundingBox(),
      };

      const frame = page.frameLocator(`iframe[src*="${target.base44Host}"]`);
      report.inFrame = await frame
        .locator('body')
        .evaluate(() => {
          let storageFlag = null;
          let storageError = null;
          try {
            storageFlag = sessionStorage.getItem('federationViewerSession');
          } catch (e) {
            storageError = e?.message || String(e);
          }
          return {
            href: location.href,
            referrer: document.referrer,
            embedded: window.self !== window.top,
            runtimeEmbedAttr: document.documentElement.getAttribute('data-runtime-embed'),
            classes: document.documentElement.className,
            windowRuntimeFlag: Boolean(window.__FEDERATION_VIEWER_RUNTIME__),
            federationViewerSession: storageFlag,
            sessionStorageError: storageError,
            rootChildCount: document.getElementById('root')?.childElementCount ?? 0,
            bannerPresent: Boolean(document.querySelector('.federation-viewer-banner')),
            bannerText: document.querySelector('.federation-viewer-banner')?.textContent?.trim(),
            bodyTextLength: (document.body?.innerText || '').length,
          };
        })
        .catch((err) => ({ evaluateError: err.message }));

      report.federationViewerBanner = Boolean(report.inFrame?.bannerPresent);
      report.runtimeEmbedDetected =
        report.runtimeEmbedDetected || report.inFrame?.runtimeEmbedAttr === 'grafana';

      await page.screenshot({ path: path.join(outDir, 'dashboard.png'), fullPage: true });
      try {
        await iframe.screenshot({ path: path.join(outDir, 'iframe.png') });
      } catch {
        /* ignore */
      }
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
