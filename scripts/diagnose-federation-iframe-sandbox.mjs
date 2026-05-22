/**
 * Inspect Grafana nmcclain-iframe-panel DOM: sandbox, allow, in-frame session/bootstrap.
 * Env: GRAFANA_URL, GRAFANA_USER, GRAFANA_PASSWORD, DIAGNOSTIC_OUT
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const grafanaUrl = (process.env.GRAFANA_URL || '').replace(/\/$/, '');
const grafanaUser = process.env.GRAFANA_USER || '';
const grafanaPassword = process.env.GRAFANA_PASSWORD || '';
const outDir = path.resolve(process.env.DIAGNOSTIC_OUT || 'artifacts/federation-iframe-sandbox');

const target = {
  name: 'fleet-federation-viewer',
  path: '/d/runtime-fleet-federation-viewer/fleet-federation-viewer',
  base44Host: 'fleet-operations-console.base44.app',
};

async function loginIfNeeded(page) {
  if (!grafanaUser || !grafanaPassword) return false;
  await page.goto(`${grafanaUrl}/login`, { waitUntil: 'networkidle', timeout: 120000 });
  const userField = page.locator('input[name="user"], input[name="username"], input#username');
  if ((await userField.count()) === 0) return false;
  await userField.first().fill(grafanaUser);
  await page.locator('input[name="password"], input#password').first().fill(grafanaPassword);
  await page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("ログイン")').first().click();
  await page.waitForLoadState('networkidle', { timeout: 120000 });
  return true;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const report = {
    capturedAt: new Date().toISOString(),
    grafanaUrl,
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
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', (msg) => {
    if (msg.type() === 'error') report.consoleErrors.push(msg.text().slice(0, 200));
  });

  try {
    await loginIfNeeded(page);
    const url = `${grafanaUrl}${target.path}?kiosk`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(5000);

    const iframe = page.locator(`iframe[src*="${target.base44Host}"]`).first();
    if ((await iframe.count()) === 0) {
      report.iframeDom = { present: false };
    } else {
      report.iframeDom = {
        present: true,
        src: (await iframe.getAttribute('src'))?.slice(0, 160),
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
