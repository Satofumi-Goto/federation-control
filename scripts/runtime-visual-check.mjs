import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const grafanaUrl = (process.env.GRAFANA_URL || '').replace(/\/$/, '');
const grafanaUser = process.env.GRAFANA_USER || '';
const grafanaPassword = process.env.GRAFANA_PASSWORD || '';
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

async function loginIfNeeded(page) {
  if (!grafanaUser || !grafanaPassword) return false;
  await page.goto(`${grafanaUrl}/login`, { waitUntil: 'networkidle', timeout: 120000 });
  const userField = page.locator('input[name="user"], input[name="username"], input#username');
  const passField = page.locator('input[name="password"], input#password');
  if ((await userField.count()) === 0) return false;
  await userField.first().fill(grafanaUser);
  await passField.first().fill(grafanaPassword);
  await page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("ログイン")').first().click();
  await page.waitForLoadState('networkidle', { timeout: 120000 });
  return true;
}

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
    return {
      iframePresent: false,
      iframeLoaded: false,
      loginRedirect: false,
      blank: true,
      pluginPanelMissing: pluginMissing > 0,
    };
  }
  const frameEl = iframe.first();
  const src = await frameEl.getAttribute('src');
  const hasEmbed = src?.includes('runtime_embed=grafana');
  const box = await frameEl.boundingBox();
  const blank = !box || box.height < 80;
  let loginRedirect = false;
  let iframeLoaded = false;
  let popupDetected = false;
  let viewerBannerVisible = false;
  try {
    const frame = page.frameLocator(`iframe[src*="${target.base44Host}"]`);
    await frame.locator('body').waitFor({ state: 'attached', timeout: 45000 });
    iframeLoaded = true;
    const text = (await frame.locator('body').innerText({ timeout: 15000 }).catch(() => '')) || '';
    viewerBannerVisible = await frame
      .locator('.federation-viewer-banner')
      .isVisible()
      .catch(() => /Federation Viewer|read-only/i.test(text));
    loginRedirect =
      /log in to continue|sign in to continue|redirecting to login|サインインして続行/i.test(text) &&
      !/Federation Viewer|federation-viewer|read-only/i.test(text);
  } catch {
    iframeLoaded = false;
  }
  const pages = page.context().pages();
  popupDetected = pages.length > 1;
  return {
    iframePresent: true,
    iframeLoaded,
    hasEmbed,
    loginRedirect,
    blank,
    popupDetected,
    viewerBannerVisible,
    pluginPanelMissing: false,
    src: src?.slice(0, 120),
  };
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = {
    capturedAt: new Date().toISOString(),
    grafanaUrl,
    auth: Boolean(grafanaUser && grafanaPassword),
    results: [],
  };

  if (!grafanaUrl) {
    manifest.error = 'GRAFANA_URL is required';
    fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    await loginIfNeeded(page);
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
          !topLevelLogin &&
          (!target.checkIframe ||
            (iframeCheck.iframePresent &&
              iframeCheck.hasEmbed &&
              iframeCheck.iframeLoaded &&
              !iframeCheck.loginRedirect &&
              !iframeCheck.blank &&
              !iframeCheck.popupDetected &&
              !iframeCheck.pluginPanelMissing &&
              iframeCheck.viewerBannerVisible));
        await page.screenshot({ path: file, fullPage: true });
        manifest.results.push({
          name: target.name,
          url,
          screenshot: path.basename(file),
          ok,
          iframeCheck,
          topLevelLogin,
        });
        console.log(`${ok ? 'OK' : 'WARN'} ${target.name}`);
      } catch (err) {
        manifest.results.push({ name: target.name, url, ok: false, error: err.message });
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
