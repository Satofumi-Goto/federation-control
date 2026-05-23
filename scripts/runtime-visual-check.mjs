import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  ensureGrafanaLogin,
  resolveGrafanaAuthEnv,
} from './lib/grafana-github-oauth-login.mjs';

const { grafanaUrl } = resolveGrafanaAuthEnv();
const outDir = path.resolve(process.env.VISUAL_CHECK_OUT || 'artifacts/runtime-visual-check');

const routesPath = path.resolve('grafana/runtime-workspace-routes.json');
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));

const row3Expectations = [
  { key: 'fleetOperation', host: 'fleet-operations-console.base44.app' },
  { key: 'serviceHub', host: 'service-hub-console.base44.app' },
  { key: 'lifeTransaction', host: 'life-ledger-link.base44.app' },
  { key: 'urbanOperation', host: 'urban-operation-console.base44.app' },
];

const targets = [{ name: 'runtime-router', path: '/d/sa8ljn4/runtime', checkRow3: true }];

async function checkRuntimeRouter(page) {
  const discoveryLabel = routes.row1?.discoveryLabel ?? '連携探索';
  const row3Title = routes.row3?.title ?? '自システム';
  const html = await page.content();
  const row3Checks = {};

  for (const { key, host } of row3Expectations) {
    const expectedUrl = routes.row3[key];
    const anchor = page.locator(`a[href*="${host}"]`).first();
    const count = await anchor.count();
    const href = count ? await anchor.getAttribute('href') : null;
    const targetAttr = count ? await anchor.getAttribute('target') : null;
    row3Checks[key] = {
      href,
      expectedUrl,
      present: count > 0,
      sameTab: targetAttr !== '_blank',
      runtimeEmbed: Boolean(href?.includes('runtime_embed=grafana')),
      notFederationViewer: !href?.includes('federation-viewer'),
    };
  }

  const discoveryVisible = await page.getByText(discoveryLabel, { exact: true }).count();
  const row3TitleVisible = await page.getByText(row3Title, { exact: true }).count();
  const federationConnectPlus = await page.locator('#rt-fc-open').count();

  const themeAdaptive =
    html.includes('rt-surface') &&
    html.includes('--background-primary') &&
    html.includes('rt-card');
  const noNavyDemo =
    !html.includes('#0b1220') &&
    !html.includes('#02060c') &&
    !html.includes('linear-gradient(180deg,#0b1220');

  return {
    discoveryRenamed: discoveryVisible > 0,
    row3SectionTitle: row3TitleVisible > 0,
    federationConnectPresent: federationConnectPlus > 0,
    themeAdaptive,
    noNavyDemo,
    row3Checks,
    row3AllOk: Object.values(row3Checks).every(
      (c) =>
        c.present &&
        c.sameTab &&
        c.runtimeEmbed &&
        c.notFederationViewer &&
        c.href?.includes('runtime_embed=grafana')
    ),
    noFederationViewerInHtml: !html.includes('runtime-fleet-federation-viewer'),
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
    row3SameTabNavigation: false,
    discoveryRenamed: false,
    themeAdaptive: false,
    noNavyDemo: false,
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
      const url = `${grafanaUrl}${target.path}`;
      const file = path.join(outDir, `${target.name}.png`);
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
        await page.waitForTimeout(3000);
        const bodyText = await page.locator('body').innerText();
        let routerCheck = {};
        if (target.checkRow3) {
          routerCheck = await checkRuntimeRouter(page);
          manifest.discoveryRenamed = routerCheck.discoveryRenamed;
          manifest.row3SameTabNavigation = routerCheck.row3AllOk;
          manifest.runtimeEmbedDetected = routerCheck.row3AllOk;
          manifest.themeAdaptive = routerCheck.themeAdaptive;
          manifest.noNavyDemo = routerCheck.noNavyDemo;
          manifest.iframePresent = false;
          manifest.federationViewerBanner = false;
        }
        const topLevelLogin =
          /log in|login|サインイン/i.test(bodyText) &&
          !/Runtime|自システム|連携探索/i.test(bodyText);
        const ok =
          manifest.oauthLoginSuccess &&
          !topLevelLogin &&
          (!target.checkRow3 ||
            (routerCheck.row3AllOk &&
              routerCheck.discoveryRenamed &&
              routerCheck.row3SectionTitle &&
              routerCheck.noFederationViewerInHtml &&
              routerCheck.themeAdaptive &&
              routerCheck.noNavyDemo));
        await page.screenshot({ path: file, fullPage: true });
        manifest.results.push({
          name: target.name,
          url,
          screenshot: path.basename(file),
          ok,
          oauthLoginSuccess: manifest.oauthLoginSuccess,
          iframePresent: false,
          federationViewerBanner: false,
          runtimeEmbedDetected: manifest.runtimeEmbedDetected,
          routerCheck,
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
