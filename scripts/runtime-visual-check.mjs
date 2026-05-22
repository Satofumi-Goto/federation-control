import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  ensureGrafanaLogin,
  resolveGrafanaAuthEnv,
} from './lib/grafana-github-oauth-login.mjs';

const { grafanaUrl } = resolveGrafanaAuthEnv();
const outDir = path.resolve(process.env.VISUAL_CHECK_OUT || 'artifacts/runtime-visual-check');

const targets = [
  { name: 'runtime-router', path: '/d/sa8ljn4/runtime', checkIframe: false },
  {
    name: 'fleet-federation-viewer',
    path: '/d/runtime-fleet-federation-viewer/fleet-federation-viewer',
    checkIframe: true,
    base44Host: 'fleet-operations-console.base44.app',
  },
  {
    name: 'service-hub-federation-viewer',
    path: '/d/runtime-service-hub-federation-viewer/service-hub-federation-viewer',
    checkIframe: true,
    base44Host: 'service-hub-console.base44.app',
  },
  {
    name: 'life-federation-viewer',
    path: '/d/runtime-life-federation-viewer/life-federation-viewer',
    checkIframe: true,
    base44Host: 'life-ledger-link.base44.app',
  },
  {
    name: 'urban-federation-viewer',
    path: '/d/runtime-urban-federation-viewer/urban-federation-viewer',
    checkIframe: true,
    base44Host: 'urban-operation-console.base44.app',
  },
];

function runtimeIframeLocator(page, base44Host) {
  return page.locator(`iframe[src*="${base44Host}"]`);
}

async function checkFederationViewerIframe(page, target) {
  const iframe = runtimeIframeLocator(page, target.base44Host);
  const count = await iframe.count();
  if (count === 0) {
    const pluginMissing = await page
      .locator('text=/plugin not found|Panel plugin not found|nmcclain-iframe-panel/i')
      .count();
    const status401 = await page.locator('text=/401|unauthorized/i').count();
    return {
      iframePresent: false,
      iframeLoaded: false,
      loginRedirect: false,
      blank: true,
      pluginPanelMissing: pluginMissing > 0,
      http401Hint: status401 > 0,
      federationViewerBanner: false,
      runtimeEmbedDetected: false,
    };
  }
  const frameEl = iframe.first();
  const src = await frameEl.getAttribute('src');
  const sandboxAttr = await frameEl.getAttribute('sandbox');
  const allowAttr = await frameEl.getAttribute('allow');
  const hasEmbed = src?.includes('runtime_embed=grafana');
  const box = await frameEl.boundingBox();
  let loginRedirect = false;
  let iframeLoaded = false;
  let popupDetected = false;
  let viewerBannerVisible = false;
  let rootHeight = 0;
  let operationalVisible = false;
  let embedState = null;
  try {
    const frame = page.frameLocator(`iframe[src*="${target.base44Host}"]`);
    await frame.locator('body').waitFor({ state: 'attached', timeout: 45000 });
    iframeLoaded = true;
    embedState = await frame.locator('body').evaluate(() => {
      let federationViewerSession = null;
      let sessionStorageError = null;
      try {
        federationViewerSession = sessionStorage.getItem('federationViewerSession');
      } catch (e) {
        sessionStorageError = e?.message || String(e);
      }
      return {
        federationViewerSession,
        sessionStorageError,
        windowRuntimeFlag: Boolean(window.__FEDERATION_VIEWER_RUNTIME__),
        dataRuntimeEmbed: document.documentElement.getAttribute('data-runtime-embed'),
        bannerPresent: Boolean(document.querySelector('.federation-viewer-banner')),
        bodyTextLength: (document.body?.innerText || '').length,
        rootChildren: document.getElementById('root')?.childElementCount ?? 0,
      };
    });
    const rootBox = await frame.locator('#root').boundingBox().catch(() => null);
    rootHeight = rootBox?.height ?? 0;
    const shellBox = await frame.locator('.federation-viewer-root').boundingBox().catch(() => null);
    if (!rootHeight && shellBox?.height) rootHeight = shellBox.height;
    operationalVisible = await frame
      .locator('[data-federation-viewer-shell]')
      .isVisible()
      .catch(() => false);
    const text = (await frame.locator('body').innerText({ timeout: 15000 }).catch(() => '')) || '';
    viewerBannerVisible =
      embedState?.bannerPresent ||
      (await frame
        .locator('.federation-viewer-banner')
        .isVisible()
        .catch(() => false)) ||
      /Federation Viewer|read-only/i.test(text);
    loginRedirect =
      /log in to continue|sign in to continue|redirecting to login|サインインして続行/i.test(text) &&
      !/Federation Viewer|federation-viewer|read-only/i.test(text);
  } catch {
    iframeLoaded = false;
  }
  const blank =
    !box ||
    box.height < 120 ||
    (iframeLoaded && rootHeight < 120) ||
    (iframeLoaded && !viewerBannerVisible);
  const pages = page.context().pages();
  popupDetected = pages.length > 1;
  return {
    iframePresent: true,
    iframeLoaded,
    hasEmbed,
    runtimeEmbedDetected: Boolean(hasEmbed),
    loginRedirect,
    blank,
    popupDetected,
    viewerBannerVisible,
    federationViewerBanner: viewerBannerVisible,
    rootHeight,
    operationalVisible,
    iframeBoxHeight: box?.height ?? 0,
    pluginPanelMissing: false,
    sandbox: sandboxAttr,
    allow: allowAttr,
    sandboxRestrictsStorage:
      Boolean(sandboxAttr) &&
      !sandboxAttr.includes('allow-same-origin') &&
      !sandboxAttr.includes('allow-scripts'),
    embedState,
    src: src?.slice(0, 120),
  };
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const authEnv = resolveGrafanaAuthEnv();
  const manifest = {
    capturedAt: new Date().toISOString(),
    grafanaUrl,
    authMode: authEnv.hasGitHubOAuth ? 'github-oauth' : authEnv.hasLegacyLogin ? 'legacy-password' : 'none',
    oauthLoginSuccess: false,
    loginMethod: 'none',
    loginError: null,
    iframePresent: false,
    federationViewerBanner: false,
    runtimeEmbedDetected: false,
    results: [],
  };

  if (!grafanaUrl) {
    manifest.error = 'GRAFANA_URL is required';
    fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

  try {
    const loginResult = await ensureGrafanaLogin(context);
    manifest.oauthLoginSuccess = loginResult.oauthLoginSuccess;
    manifest.loginMethod = loginResult.loginMethod;
    manifest.loginError = loginResult.error || null;

    if (!loginResult.oauthLoginSuccess) {
      console.error('Grafana login failed:', loginResult.error || loginResult.loginMethod);
      fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
      process.exit(1);
    }

    const page = loginResult.page;
    console.log(`Grafana login OK (${loginResult.loginMethod})`);

    for (const target of targets) {
      const url = `${grafanaUrl}${target.path}?kiosk`;
      const file = path.join(outDir, `${target.name}.png`);
      const iframeFile = path.join(outDir, `${target.name}-iframe.png`);
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
        await page.waitForTimeout(4000);
        const bodyText = await page.locator('body').innerText();
        let iframeCheck = {};
        if (target.checkIframe) {
          iframeCheck = await checkFederationViewerIframe(page, target);
          manifest.iframePresent = manifest.iframePresent || iframeCheck.iframePresent;
          manifest.federationViewerBanner =
            manifest.federationViewerBanner || iframeCheck.federationViewerBanner;
          manifest.runtimeEmbedDetected =
            manifest.runtimeEmbedDetected || iframeCheck.runtimeEmbedDetected;
          if (iframeCheck.iframePresent) {
            try {
              await runtimeIframeLocator(page, target.base44Host).first().screenshot({
                path: iframeFile,
              });
              iframeCheck.screenshot = path.basename(iframeFile);
            } catch {
              iframeCheck.screenshot = null;
            }
          }
        }
        const topLevelLogin =
          !target.checkIframe &&
          /log in|login|サインイン/i.test(bodyText) &&
          !/Runtime Federation/i.test(bodyText);
        const ok =
          manifest.oauthLoginSuccess &&
          !topLevelLogin &&
          (!target.checkIframe ||
            (iframeCheck.iframePresent &&
              iframeCheck.runtimeEmbedDetected &&
              iframeCheck.iframeLoaded &&
              !iframeCheck.loginRedirect &&
              !iframeCheck.blank &&
              !iframeCheck.popupDetected &&
              !iframeCheck.pluginPanelMissing &&
              iframeCheck.federationViewerBanner));
        await page.screenshot({ path: file, fullPage: true });
        manifest.results.push({
          name: target.name,
          url,
          screenshot: path.basename(file),
          ok,
          oauthLoginSuccess: manifest.oauthLoginSuccess,
          iframePresent: iframeCheck.iframePresent ?? false,
          federationViewerBanner: iframeCheck.federationViewerBanner ?? false,
          runtimeEmbedDetected: iframeCheck.runtimeEmbedDetected ?? false,
          iframeCheck,
          topLevelLogin,
        });
        console.log(`${ok ? 'OK' : 'WARN'} ${target.name}`);
      } catch (err) {
        manifest.results.push({
          name: target.name,
          url,
          ok: false,
          oauthLoginSuccess: manifest.oauthLoginSuccess,
          error: err.message,
        });
        console.error(`FAIL ${target.name}:`, err.message);
      }
    }
  } finally {
    await browser.close();
  }

  const failed = manifest.results.filter((r) => !r.ok);
  manifest.summary = {
    total: manifest.results.length,
    passed: manifest.results.length - failed.length,
    failed: failed.length,
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  if (failed.length > 0) {
    console.error(`Visual check: ${failed.length} failed`);
    process.exit(1);
  }
  console.log('Visual check passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
