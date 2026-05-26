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

assertEqual(
  routes.row1.alignment,
  topology.headerNavigation.alignment.path,
  'alignment-path',
  'row1.alignment',
);

const governance = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'grafana/federation-governance-routes.json'), 'utf8'),
);

const opArchHref = resolveOperationalArchitectureHref(routes, topology);
if (routes.row2.runtimePanel !== center) {
  fail(
    'operational-architecture-not-runtime-center',
    `row2.runtimePanel must be Runtime center (${center}), got ${routes.row2.runtimePanel}`,
  );
}

// --- Built dashboard href audit ---
const v2Path = path.join(repoRoot, 'grafana/runtime-workspace-v2.json');
if (!fs.existsSync(v2Path)) {
  fail('missing-v2', 'Run node scripts/build-runtime-workspace-v2.mjs first');
} else {
  const dash = JSON.parse(fs.readFileSync(v2Path, 'utf8'));
  const hrefs = new Set();
  let allContent = '';
  for (const panel of dash.panels ?? []) {
    const content = panel.options?.content ?? '';
    allContent += content;
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
    routes.row2.runtimeFederationGraph ?? center,
    ...Object.values(routes.row3 ?? {}).filter((u) => typeof u === 'string' && u.startsWith('http')),
    ...Object.values(routes.row4 ?? {}),
    topology.headerNavigation.discovery.dashboardFallback,
    topology.headerNavigation.needsTranslation.dashboardFallback,
  ]);

  for (const forbidden of topology.forbiddenUiPaths ?? []) {
    const localHrefs = [...hrefs].filter((h) => !h.startsWith('http'));
    if (localHrefs.some((h) => h === forbidden || h.startsWith(forbidden + '?') || h.startsWith(forbidden + '#'))) {
      fail('forbidden-ui-path', `Workspace must not link to deprecated UI path ${forbidden}`);
    }
  }

  for (const forbidden of topology.row2Panels?.operationalArchitecture?.forbiddenTargets ?? []) {
    if (hrefs.has(forbidden)) {
      fail('forbidden-op-arch-target', `運行制御アーキテクチャ card still links to ${forbidden}`);
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
    if (href.startsWith('#')) continue;
    if (!href.startsWith('http') && !allowedAppRoutes.has(href) && !dashboardPaths.has(href)) {
      warn('unlisted-href', `href not in topology allowlist: ${href}`);
    }
  }

  const panel201 = (dash.panels ?? []).find((p) => p.id === 201);
  if (panel201) {
    const c = panel201.options?.content ?? '';
    if (!c.includes('Obsidian Knowledge Graph')) {
      fail('panel-201-label', 'Panel 201 must be Obsidian Knowledge Graph');
    }
    if (!c.includes('Obsidian · Knowledge role')) {
      fail('panel-201-role', 'Panel 201 must declare Obsidian knowledge role (not Runtime Memory UI)');
    }
    if (c.includes('Runtime Federation Memory') || c.includes('Growth:')) {
      fail('panel-201-memory-ui', 'Panel 201 must not use Runtime Memory style UI');
    }
    if (!c.includes(routes.row2.obsidianGraph)) {
      fail('panel-201-href', 'Panel 201 must link to Obsidian graph dashboard');
    }
    if (c.includes('運行制御アーキテクチャ')) {
      fail('panel-201-legacy', 'Panel 201 still contains 運行制御アーキテクチャ');
    }
  }

  const panel202 = (dash.panels ?? []).find((p) => p.id === 202);
  if (panel202) {
    const c = panel202.options?.content ?? '';
    if (!c.includes('Federation Graph')) {
      fail('panel-202-label', 'Panel 202 must be Federation Graph (live state)');
    }
    if (!c.includes('Federation Health')) {
      fail('panel-202-live', 'Panel 202 must show live federation metrics');
    }
    const fedGraphHref = routes.row2.runtimeFederationGraph ?? center;
    if (!c.includes(`href="${fedGraphHref}"`)) {
      fail('panel-202-href', `Panel 202 must link to ${fedGraphHref}`);
    }
    if (c.includes('運行制御アーキテクチャ') || c.includes('崩壊制御 Runtime')) {
      fail('panel-202-legacy', 'Panel 202 still contains 運行制御アーキテクチャ static panel');
    }
  }

  const row3Title = routes.row3?.title ?? 'Operational Systems';
  const row4Title = routes.row4?.title ?? 'System Artifacts';

  const panel300 = (dash.panels ?? []).find((p) => p.id === 300);
  if (panel300) {
    const c = panel300.options?.content ?? '';
    if (!c.includes(row3Title)) {
      fail('row3-title', `Panel 300 missing section title ${row3Title}`);
    }
    if (!c.includes('section-header') || !c.includes('justify-content:space-between')) {
      fail('row3-header-layout', 'Panel 300 missing section-header flex layout');
    }
    if (c.includes('<details')) {
      fail('row3-details-poc', 'Panel 300 must not use <details> PoC');
    }
    if (!c.includes('fed-overlay-systems')) {
      fail('row3-overlay', 'Panel 300 + must open systems onboarding overlay');
    }
    if (c.includes('/federation/intake') || c.includes('/federation/sync-plan')) {
      fail('row3-federation-route', 'Panel 300 + must not link to federation governance routes');
    }
    if (c.includes('自システム')) {
      fail('row3-legacy-title', 'Panel 300 still contains 自システム');
    }
  }

  const panel350 = (dash.panels ?? []).find((p) => p.id === 350);
  if (panel350) {
    const c = panel350.options?.content ?? '';
    if (!c.includes(row4Title)) {
      fail('row4-title', `Panel 350 missing section title ${row4Title}`);
    }
    if (!c.includes('section-header') || !c.includes('justify-content:space-between')) {
      fail('row4-header-layout', 'Panel 350 missing section-header flex layout');
    }
    if (c.includes('<details')) {
      fail('row4-details-poc', 'Panel 350 must not use <details> PoC');
    }
    if (!c.includes('fed-overlay-artifacts')) {
      fail('row4-overlay', 'Panel 350 + must open artifact create overlay');
    }
    if (c.includes('/federation/sync-plan') || c.includes('/federation/intake')) {
      fail('row4-federation-route', 'Panel 350 + must not link to federation governance routes');
    }
    if (c.includes('各種図面') || c.includes('成果物系')) {
      fail('row4-legacy-title', 'Panel 350 still contains legacy row4 title');
    }
  } else {
    fail('row4-header-panel', 'Missing panel 350 (System Artifacts section header)');
  }

  const artifactPanel = (dash.panels ?? []).find((p) => p.id === 401);
  if (artifactPanel) {
    const c = artifactPanel.options?.content ?? '';
    if (!c.includes('Collapse Control')) {
      fail('row4-artifact-labels', 'Row4 cards missing English artifact labels');
    }
    if (!c.includes('↔')) {
      fail('row4-artifact-links', 'Row4 cards missing federation cross-links');
    }
  }

  if (!allContent.includes('Federated') || !allContent.includes('Read-only')) {
    fail('viewer-badges', 'Operational Systems cards missing viewer mode badges');
  }

  for (const [key, url] of Object.entries(routes.row3 ?? {})) {
    if (typeof url !== 'string' || !url.startsWith('http')) continue;
    if (!url.includes('runtime_embed=grafana')) {
      fail('row3-viewer-embed', `row3.${key} missing runtime_embed=grafana viewer session`);
    }
    if (!url.includes('/viewer/')) {
      fail('row3-viewer-path', `row3.${key} must use /viewer/* path (no app-root login)`);
    }
    const pathOnly = url.replace(/^https?:\/\/[^/]+/, '');
    if (pathOnly === '/' || pathOnly === '' || /^\/\?/.test(pathOnly)) {
      fail('row3-login-root', `row3.${key} must not point to Base44 app root`);
    }
  }

  const panel203 = (dash.panels ?? []).find((p) => p.id === 203);
  if (panel203) {
    const c = panel203.options?.content ?? '';
    if (!c.includes('Federation Add')) {
      fail('panel-203-title', 'Panel 203 must be named Federation Add');
    }
    if (!c.includes('Scoped federation onboarding') && !c.includes('Scoped onboarding')) {
      fail('panel-203-role', 'Panel 203 must declare scoped federation onboarding');
    }
    if (!c.includes('fed-overlay-federation-add')) {
      fail('panel-203-overlay', 'Panel 203 must link to Federation Add overlay');
    }
  }

  // Header icons
  const panel100 = (dash.panels ?? []).find((p) => p.id === 100);
  if (panel100) {
    const c = panel100.options?.content ?? '';
    if (!c.includes(topology.headerNavigation.discovery.path)) {
      fail(
        'header-discovery',
        `Header missing ${topology.headerNavigation.discovery.label} href (${topology.headerNavigation.discovery.path})`,
      );
    }
    if (!c.includes(topology.headerNavigation.needsTranslation.path)) {
      fail(
        'header-needs',
        `Header missing ${topology.headerNavigation.needsTranslation.label} href (${topology.headerNavigation.needsTranslation.path})`,
      );
    }
    if (!c.includes(topology.headerNavigation.alignment.path)) {
      fail(
        'header-alignment',
        `Header missing ${topology.headerNavigation.alignment.label} href (${topology.headerNavigation.alignment.path})`,
      );
    }
  }
}

// --- Remnant scan in scripts (canonical build only) ---
const buildSrc = fs.readFileSync(
  path.join(repoRoot, 'scripts/build-runtime-workspace-v2.mjs'),
  'utf8',
);
if (buildSrc.includes('go-integrated-surface/integrated-control-surface')) {
  fail('build-dead-op-arch', 'build script still references integrated-control-surface for op arch');
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
