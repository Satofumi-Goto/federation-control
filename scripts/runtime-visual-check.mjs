import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  ensureGrafanaLogin,
  resolveGrafanaAuthEnv,
} from './lib/grafana-github-oauth-login.mjs';
import { loadRuntimeTopology, resolveRuntimeCenterHref } from './lib/runtime-topology.mjs';

const { grafanaUrl } = resolveGrafanaAuthEnv();
const outDir = path.resolve(process.env.VISUAL_CHECK_OUT || 'artifacts/runtime-visual-check');

const routesPath = path.resolve('grafana/runtime-workspace-routes.json');
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));
const topology = loadRuntimeTopology();
const runtimeCenterHref = resolveRuntimeCenterHref(routes, topology);
const row3Expectations = [
  { key: 'fleetOperation', host: 'fleet-operations-console.base44.app' },
  { key: 'serviceHub', host: 'service-hub-console.base44.app' },
  { key: 'lifeTransaction', host: 'life-transaction-console.base44.app' },
  { key: 'urbanOperation', host: 'urban-operation-console.base44.app' },
];

const targets = [{ name: 'runtime-router', path: '/d/sa8ljn4/runtime', checkRow3: true }];

async function checkRuntimeRouter(page) {
  const discoveryLabel = routes.row1?.discoveryLabel ?? '入力統合';
  const row3Title = routes.row3?.title ?? 'Operational Systems';
  const row4Title = routes.row4?.title ?? 'System Artifacts';
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
      viewerPath: Boolean(href?.includes('/viewer/')),
      notFederationViewer: !href?.includes('federation-viewer'),
      notRootAppOnly: !href?.match(/^https:\/\/[^/]+\/?\?runtime_embed=grafana$/),
    };
  }

  const discoveryVisible = await page.getByText(discoveryLabel, { exact: true }).count();
  const row3TitleVisible = await page.getByText(row3Title, { exact: true }).count();
  const row4TitleVisible = await page.getByText(row4Title, { exact: true }).count();
  const row3SectionPlus = await page
    .locator('.section-header')
    .filter({ hasText: row3Title })
    .locator('details.section-add summary')
    .count();
  const row4SectionPlus = await page
    .locator('.section-header')
    .filter({ hasText: row4Title })
    .locator('details.section-add summary')
    .count();
  const discoveryHref = await page
    .locator(`a[href="${routes.row1.discovery}"]`)
    .first()
    .getAttribute('href')
    .catch(() => null);
  const needsHref = await page
    .locator(`a[href="${routes.row1.needsTranslation}"]`)
    .first()
    .getAttribute('href')
    .catch(() => null);
  const obsidianGraphVisible = await page.getByText('Obsidian Knowledge Graph', { exact: true }).count();
  const federationGraphVisible = await page.getByText('Runtime Federation Graph', { exact: true }).count();
  const legacyOpArchVisible = await page.getByText('運行制御アーキテクチャ', { exact: true }).count();
  const federationAddVisible = await page.getByText('Federation Add', { exact: true }).count();
  const federationConnectPlus = await page.locator('.federation-add-panel details summary').count();

  const themeAdaptive =
    html.includes('--background-primary') &&
    (html.includes('Obsidian Knowledge Graph') || html.includes('Runtime Federation Graph'));
  const noNavyDemo =
    !html.includes('#0b1220') &&
    !html.includes('#02060c') &&
    !html.includes('linear-gradient(180deg,#0b1220');
  const htmlRenderedNotEscaped =
    !html.includes('&lt;svg') &&
    !html.includes('&lt;style') &&
    !html.includes('&lt;div') &&
    (await page.locator('img[alt="Obsidian Knowledge Graph"], img[alt="Runtime Federation Graph"]').count()) >
      0;

  return {
    discoveryRenamed: discoveryVisible > 0,
    row3SectionTitle: row3TitleVisible > 0,
    row4SectionTitle: row4TitleVisible > 0,
    row3SectionPlus: row3SectionPlus > 0,
    row4SectionPlus: row4SectionPlus > 0,
    federationAddVisible: federationAddVisible > 0,
    federationConnectPresent: federationAddVisible > 0 && federationConnectPlus > 0,
    obsidianGraphVisible: obsidianGraphVisible > 0,
    federationGraphVisible: federationGraphVisible > 0,
    legacyOpArchRemoved: legacyOpArchVisible === 0,
    themeAdaptive,
    noNavyDemo,
    htmlRenderedNotEscaped,
    row3Checks,
    row3AllOk: Object.values(row3Checks).every(
      (c) =>
        c.present &&
        c.sameTab &&
        c.runtimeEmbed &&
        c.viewerPath &&
        c.notFederationViewer &&
        c.notRootAppOnly &&
        c.href?.includes('runtime_embed=grafana')
    ),
    noFederationViewerInHtml: !html.includes('runtime-fleet-federation-viewer'),
    topologyLinks: {
      discoveryHref,
      needsHref,
      runtimeCenterHref,
      discoveryConnected: discoveryHref === routes.row1.discovery,
      needsConnected: needsHref === routes.row1.needsTranslation,
      noIntegratedSurfaceDeadLink: !html.includes('go-integrated-surface/integrated-control-surface'),
    },
    topologyOk:
      discoveryHref === routes.row1.discovery &&
      needsHref === routes.row1.needsTranslation &&
      legacyOpArchVisible === 0 &&
      !html.includes('go-integrated-surface/integrated-control-surface'),
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
    htmlRenderedNotEscaped: false,
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
          manifest.htmlRenderedNotEscaped = routerCheck.htmlRenderedNotEscaped;
          manifest.iframePresent = false;
          manifest.federationViewerBanner = false;
        }
        const topLevelLogin =
          /log in|login|サインイン/i.test(bodyText) &&
          !/Runtime|Operational Systems|連携探索|自システム/i.test(bodyText);
        const ok =
          manifest.oauthLoginSuccess &&
          !topLevelLogin &&
          (!target.checkRow3 ||
            (routerCheck.row3AllOk &&
              routerCheck.discoveryRenamed &&
              routerCheck.row3SectionTitle &&
              routerCheck.row4SectionTitle &&
              routerCheck.row3SectionPlus &&
              routerCheck.row4SectionPlus &&
              routerCheck.obsidianGraphVisible &&
              routerCheck.federationGraphVisible &&
              routerCheck.legacyOpArchRemoved &&
              routerCheck.noFederationViewerInHtml &&
              routerCheck.themeAdaptive &&
              routerCheck.noNavyDemo &&
              routerCheck.htmlRenderedNotEscaped &&
              routerCheck.topologyOk));
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
