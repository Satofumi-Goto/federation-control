/**
 * Static Runtime topology link verification for /d/sa8ljn4/runtime workspace.
 * Run: node scripts/verify-runtime-topology-links.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  collectDashboardPathsFromRepo,
  extractHrefsFromHtml,
  loadRuntimeTopology,
  loadRuntimeWorkspaceRoutes,
  resolveOperationalArchitectureHref,
  resolveRuntimeCenterHref,
} from './lib/runtime-topology.mjs';

import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routes = loadRuntimeWorkspaceRoutes();
const topology = loadRuntimeTopology();
const dashboardPaths = collectDashboardPathsFromRepo();
const issues = [];
const warnings = [];

function fail(code, message) {
  issues.push({ code, message });
}

function warn(code, message) {
  warnings.push({ code, message });
}

function assertEqual(actual, expected, code, label) {
  if (actual !== expected) {
    fail(code, `${label}: expected ${expected}, got ${actual}`);
  }
}

const forbiddenUiLabels = [
  '自システム',
  '崩壊制御アーキテクチャ',
  '機能アーキテクチャ図',
  'シーケンス図',
  'Growing Runtime Knowledge Graph',
  'Runtime Federation Memory',
  '崩壊制御 Runtime',
  '運行制御アーキテクチャ',
];

const requiredUiLabels = [
  'Operational Systems',
  'System Artifacts',
  'Obsidian Knowledge Graph',
  'Runtime Federation Graph',
  'Federation Add',
  'Collapse Control Architecture',
  'Functional Topology',
  'Federation Sequence',
];

// --- Canonical route sync (routes.json ↔ topology) ---
const center = resolveRuntimeCenterHref(routes, topology);
assertEqual(
  routes.runtimeTopPath,
  topology.runtimeCenter.grafana,
  'runtime-center-mismatch',
  'runtimeTopPath vs topology.runtimeCenter.grafana',
);

assertEqual(
  routes.row1.discovery,
  topology.headerNavigation.discovery.path,
  'discovery-path',
  'row1.discovery',
);

assertEqual(
  routes.row1.needsTranslation,
  topology.headerNavigation.needsTranslation.path,
  'needs-path',
  'row1.needsTranslation',
);

const opArchHref = resolveOperationalArchitectureHref(routes, topology);
if (routes.row2.runtimePanel !== center) {
  fail(
    'operational-architecture-not-runtime-center',
    `row2.runtimePanel must be Runtime center (${center}), got ${routes.row2.runtimePanel}`,
  );
}

// --- Built dashboard href and stale UI audit ---
const v2Path = path.join(repoRoot, 'grafana/runtime-workspace-v2.json');
if (!fs.existsSync(v2Path)) {
  fail('missing-v2', 'Run node scripts/build-runtime-workspace-v2.mjs first');
} else {
  const rawDashboard = fs.readFileSync(v2Path, 'utf8');
  const dash = JSON.parse(rawDashboard);

  for (const label of forbiddenUiLabels) {
    if (rawDashboard.includes(label)) {
      fail('stale-ui-label', `runtime-workspace-v2.json still contains stale UI label: ${label}`);
    }
  }

  for (const label of requiredUiLabels) {
    if (!rawDashboard.includes(label)) {
      fail('missing-required-ui-label', `runtime-workspace-v2.json missing required UI label: ${label}`);
    }
  }

  if (dash.version < 32) {
    fail('stale-dashboard-version', `runtime-workspace-v2.json version must be regenerated above 31, got ${dash.version}`);
  }

  const hrefs = new Set();
  for (const panel of dash.panels ?? []) {
    const content = panel.options?.content ?? '';
    for (const h of extractHrefsFromHtml(content)) hrefs.add(h);
  }
  for (const link of dash.links ?? []) {
    if (link.url) hrefs.add(link.url);
  }

  const allowedAppRoutes = new Set([
    topology.headerNavigation.discovery.path,
    topology.headerNavigation.needsTranslation.path,
    topology.worldRoutes.calendar.path,
    topology.worldRoutes.map.path,
    topology.runtimeCenter.logical,
    center,
    routes.row1.alignment,
    routes.row2.obsidianGraph,
    opArchHref,
    ...Object.values(routes.row3 ?? {}).filter((u) => typeof u === 'string' && u.startsWith('http')),
    ...Object.values(routes.row4 ?? {}),
    topology.headerNavigation.discovery.dashboardFallback,
    topology.headerNavigation.needsTranslation.dashboardFallback,
  ]);

  for (const forbidden of topology.row2Panels?.operationalArchitecture?.forbiddenTargets ?? []) {
    if (hrefs.has(forbidden)) {
      fail('forbidden-op-arch-target', `stale card still links to ${forbidden}`);
    }
  }

  for (const href of hrefs) {
    if (href.startsWith('http')) continue;
    if (allowedAppRoutes.has(href)) continue;
    if (dashboardPaths.has(href)) continue;
    if (href.startsWith('/d/') && [...dashboardPaths].some((p) => href.startsWith(p.split('/').slice(0, 3).join('/')))) {
      continue;
    }
    for (const pat of topology.forbiddenPatterns ?? []) {
      if (href.includes(pat)) {
        fail('forbidden-pattern', `href ${href} matches forbidden ${pat}`);
      }
    }
    if (href === '/' && href !== center) {
      warn('root-href', 'Bare "/" href in workspace; prefer runtime center Grafana path');
    }
    if (!href.startsWith('http') && !allowedAppRoutes.has(href) && !dashboardPaths.has(href)) {
      warn('unlisted-href', `href not in topology allowlist: ${href}`);
    }
  }

  const panel201 = (dash.panels ?? []).find((p) => p.id === 201);
  if (panel201) {
    const content = panel201.options?.content ?? '';
    if (!content.includes('Obsidian Knowledge Graph')) {
      fail('panel-201-label', 'Panel 201 must be Obsidian Knowledge Graph');
    }
  }

  const panel202 = (dash.panels ?? []).find((p) => p.id === 202);
  if (panel202) {
    const content = panel202.options?.content ?? '';
    if (!content.includes('Runtime Federation Graph')) {
      fail('panel-202-label', 'Panel 202 must be Runtime Federation Graph');
    }
    if (!content.includes(`href="${center}"`)) {
      fail('panel-202-href', `Panel 202 must link to Runtime center ${center}`);
    }
  }

  const panel300 = (dash.panels ?? []).find((p) => p.id === 300);
  if (panel300) {
    const content = panel300.options?.content ?? '';
    if (!content.includes('Operational Systems')) {
      fail('panel-300-label', 'Panel 300 must be Operational Systems');
    }
  }

  const panel350 = (dash.panels ?? []).find((p) => p.id === 350);
  if (panel350) {
    const content = panel350.options?.content ?? '';
    if (!content.includes('System Artifacts')) {
      fail('panel-350-label', 'Panel 350 must be System Artifacts');
    }
  }

  const panel100 = (dash.panels ?? []).find((p) => p.id === 100);
  if (panel100) {
    const c = panel100.options?.content ?? '';
    if (!c.includes(topology.headerNavigation.discovery.path)) {
      fail('header-discovery', 'Header missing 連携探索 href');
    }
    if (!c.includes(topology.headerNavigation.needsTranslation.path)) {
      fail('header-needs', 'Header missing Needs翻訳 href');
    }
  }
}

// --- Remnant scan in source scripts ---
const sourceFilesToScan = [
  'scripts/build-runtime-workspace-v2.mjs',
  'scripts/runtime-visual-check.mjs',
  'scripts/lib/runtime-federation-brain-panels.mjs',
  'scripts/lib/federation-connect-panel.mjs',
  'grafana/runtime-workspace-routes.json',
];
for (const relPath of sourceFilesToScan) {
  const p = path.join(repoRoot, relPath);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, 'utf8');
  for (const label of forbiddenUiLabels) {
    if (src.includes(label)) {
      fail('stale-source-label', `${relPath} still contains stale UI label: ${label}`);
    }
  }
}

// --- Report ---
const report = {
  ok: issues.length === 0,
  runtimeCenter: center,
  discovery: routes.row1.discovery,
  needsTranslation: routes.row1.needsTranslation,
  operationalArchitecture: opArchHref,
  calendar: topology.worldRoutes.calendar.path,
  map: topology.worldRoutes.map.path,
  issues,
  warnings,
};

const outDir = path.join(repoRoot, 'artifacts/runtime-topology-verify');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify(report, null, 2));
process.exit(issues.length === 0 ? 0 : 1);
