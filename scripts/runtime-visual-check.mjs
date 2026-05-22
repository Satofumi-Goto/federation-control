import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const grafanaUrl = (process.env.GRAFANA_URL || '').replace(/\/$/, '');
const grafanaUser = process.env.GRAFANA_USER || '';
const grafanaPassword = process.env.GRAFANA_PASSWORD || '';
const outDir = path.resolve(process.env.VISUAL_CHECK_OUT || 'artifacts/runtime-visual-check');

const targets = [
  { name: 'runtime-router', path: '/d/sa8ljn4/runtime' },
  { name: 'fleet-operational-surface', path: '/d/component-propagation-board/component-propagation-federation-board' },
  { name: 'service-hub-operational-surface', path: '/d/runtime-service-hub-console/service-hub-console' },
  { name: 'life-transaction-operational-surface', path: '/d/runtime-life-ledger-surface/life-transaction-operational-surface' },
  { name: 'urban-operation-operational-surface', path: '/d/go-operational-planning/operational-planning' },
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
    console.error(manifest.error);
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
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
        await page.waitForTimeout(2500);
        const bodyText = await page.locator('body').innerText();
        const blocked =
          /base44\.app/i.test(bodyText) ||
          /log in|login|サインイン|Sign in/i.test(bodyText) && !/Operational App Surface/i.test(bodyText);
        await page.screenshot({ path: file, fullPage: true });
        manifest.results.push({
          name: target.name,
          url,
          screenshot: path.basename(file),
          ok: !blocked,
          blocked,
        });
        console.log(`${blocked ? 'WARN' : 'OK'} ${target.name} -> ${file}`);
      } catch (err) {
        manifest.results.push({
          name: target.name,
          url,
          ok: false,
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
    console.error(`Visual check: ${failed.length} target(s) failed or blocked`);
    process.exit(1);
  }
  console.log('Visual check passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
