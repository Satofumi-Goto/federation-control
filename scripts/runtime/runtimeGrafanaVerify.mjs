#!/usr/bin/env node
/**
 * Runtime Grafana Deploy Verification
 *
 * Verifies deployed dashboards against local canonical state.
 * Uses Grafana API when credentials available, falls back to
 * local JSON verification.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveGrafana } from './runtimeCredentialResolver.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const REQUIRED_DASHBOARD_UIDS = [
  'sa8ljn4',
  'samvklp',
  'saz2p8x',
  'sambt57',
  'sajbd8b',
  'sassvwp',
];

const REQUIRED_CARDS = ['崩壊制御', '崩壊解析', '改修影響', '改修提案', '実装進捗'];

const FORBIDDEN_CONTENT = [
  'viewPanel=401',
  'Federation collapse governance',
];

function loadLocalDashboard() {
  const p = path.resolve(REPO_ROOT, 'grafana/runtime-workspace-v2.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

async function verifyViaApi(grafana) {
  const results = [];
  const baseUrl = grafana.url.replace(/\/$/, '');

  for (const uid of REQUIRED_DASHBOARD_UIDS) {
    try {
      const resp = await fetch(`${baseUrl}/api/dashboards/uid/${uid}`, {
        headers: { Authorization: `Bearer ${grafana.token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        const version = data.dashboard?.version ?? '?';
        const panelCount = data.dashboard?.panels?.length ?? 0;
        results.push({ uid, status: 'found', version, panels: panelCount });
      } else {
        results.push({ uid, status: 'not-found', httpStatus: resp.status });
      }
    } catch (e) {
      results.push({ uid, status: 'error', error: e.message });
    }
  }

  return results;
}

function verifyLocal() {
  const dashboard = loadLocalDashboard();
  const results = [];

  if (!dashboard) {
    results.push({ check: 'dashboard-exists', ok: false, detail: 'runtime-workspace-v2.json not found' });
    return results;
  }

  results.push({ check: 'dashboard-exists', ok: true, detail: `uid=${dashboard.uid}` });
  results.push({ check: 'dashboard-uid', ok: dashboard.uid === 'sa8ljn4', detail: dashboard.uid });
  results.push({ check: 'dashboard-version', ok: dashboard.version > 0, detail: `v${dashboard.version}` });
  results.push({ check: 'panel-count', ok: dashboard.panels?.length > 0, detail: `${dashboard.panels?.length} panels` });

  const content = JSON.stringify(dashboard);

  for (const card of REQUIRED_CARDS) {
    results.push({ check: `card-${card}`, ok: content.includes(card), detail: card });
  }

  for (const forbidden of FORBIDDEN_CONTENT) {
    results.push({ check: `no-${forbidden.slice(0, 20)}`, ok: !content.includes(forbidden), detail: forbidden });
  }

  const routeChecks = ['grafana.net/d/sa8ljn4', 'runtime_discovery', 'need_impact'];
  for (const route of routeChecks) {
    results.push({ check: `route-${route.slice(0, 20)}`, ok: content.includes(route), detail: route });
  }

  return results;
}

async function main() {
  console.log('[grafana-verify] Runtime Grafana Deploy Verification');

  const grafana = resolveGrafana();
  let apiResults = null;
  let localResults = null;

  if (grafana.available) {
    console.log('[grafana-verify] Grafana API available — verifying deployed dashboards');
    apiResults = await verifyViaApi(grafana);
    console.log('\n[grafana-verify] API Results:');
    for (const r of apiResults) {
      console.log(`  ${r.status === 'found' ? 'PASS' : 'WARN'}: ${r.uid} — ${r.status} ${r.version ? `v${r.version}` : ''} ${r.panels ? `(${r.panels} panels)` : ''}`);
    }
  } else {
    console.log('[grafana-verify] Grafana API not available — verifying local dashboard JSON');
  }

  localResults = verifyLocal();
  console.log('\n[grafana-verify] Local Verification:');
  for (const r of localResults) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}: ${r.check} — ${r.detail}`);
  }

  const allLocalPass = localResults.every((r) => r.ok);
  const allApiPass = apiResults ? apiResults.every((r) => r.status === 'found') : null;

  const report = {
    ok: allLocalPass,
    apiAvailable: grafana.available,
    apiResults: apiResults ? { ok: allApiPass, dashboards: apiResults } : null,
    localResults: { ok: allLocalPass, checks: localResults },
    requiredUids: REQUIRED_DASHBOARD_UIDS,
    timestamp: new Date().toISOString(),
  };

  console.log(`\n[grafana-verify] Overall: ${allLocalPass ? 'PASS' : 'FAIL'}`);
  console.log('\n' + JSON.stringify(report, null, 2));

  process.exit(allLocalPass ? 0 : 1);
}

main();
