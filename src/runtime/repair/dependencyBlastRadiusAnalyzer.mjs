/**
 * Dependency Blast Radius Analyzer
 *
 * Analyzes which runtime domains, dashboards, MCP tools,
 * execution paths, and governance surfaces are affected
 * when a repair targets specific domains.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DATA_ROOT = path.resolve(REPO_ROOT, 'runtime_data');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function loadTwin() { return loadJson(path.resolve(DATA_ROOT, 'runtime-operational-digital-twin-graph.json')); }
function loadToolManifest() { return loadJson(path.resolve(DATA_ROOT, 'runtime-tool-manifest.json')); }

const DASHBOARD_MAP = {
  'core': ['collapse-control', 'implement-progress'],
  'governance': ['collapse-control', 'repair-proposal'],
  'execution': ['implement-progress', 'repair-impact'],
  'repair': ['repair-impact', 'repair-proposal'],
  'fleet': ['collapse-analysis'],
  'urban': ['collapse-analysis'],
  'service-hub': ['collapse-analysis'],
  'life-tx': ['collapse-analysis'],
  'seneschal': ['collapse-control'],
  'infrastructure': ['collapse-analysis', 'collapse-control'],
  'mobility': ['collapse-analysis'],
  'energy': ['collapse-analysis'],
  'logistics': ['collapse-analysis'],
  'emergency': ['collapse-control'],
};

export function analyzeBlastRadius(targetDomains = []) {
  const twin = loadTwin() ?? {};
  const nodes = twin.nodes ?? [];
  const deps = twin.dependencies ?? [];
  const manifest = loadToolManifest();

  const directlyAffected = new Set(targetDomains);
  const secondaryAffected = new Set();

  for (const d of deps) {
    if (directlyAffected.has(d.from)) secondaryAffected.add(d.to);
    if (directlyAffected.has(d.to)) secondaryAffected.add(d.from);
  }
  for (const d of directlyAffected) secondaryAffected.delete(d);

  const tertiaryAffected = new Set();
  for (const d of deps) {
    if (secondaryAffected.has(d.from) && !directlyAffected.has(d.to)) tertiaryAffected.add(d.to);
  }
  for (const d of directlyAffected) tertiaryAffected.delete(d);
  for (const d of secondaryAffected) tertiaryAffected.delete(d);

  const allAffected = new Set([...directlyAffected, ...secondaryAffected]);
  const affectedDashboards = new Set();
  for (const d of allAffected) {
    for (const db of DASHBOARD_MAP[d] ?? []) affectedDashboards.add(db);
  }

  const totalDomains = nodes.length || 1;
  const impactRatio = allAffected.size / totalDomains;
  const blastRadiusScore = Math.min(100, Math.round(impactRatio * 100));

  const unstableDeps = deps.filter(d =>
    (allAffected.has(d.from) || allAffected.has(d.to)) && d.healthy === false
  );

  const cascadeRisk = blastRadiusScore > 60 ? 'high'
    : blastRadiusScore > 30 ? 'medium' : 'low';

  const affectedTools = (manifest?.tools ?? []).filter(t => {
    const toolDomains = t.scope?.domains ?? [];
    return toolDomains.some(d => allAffected.has(d));
  }).map(t => t.name ?? t.id);

  const result = {
    timestamp: new Date().toISOString(),
    targetDomains,
    blastRadiusScore,
    cascadingCollapseRisk: cascadeRisk,
    directlyAffected: [...directlyAffected],
    secondaryAffected: [...secondaryAffected],
    tertiaryAffected: [...tertiaryAffected],
    totalAffectedDomains: allAffected.size,
    totalDomains,
    affectedDashboards: [...affectedDashboards],
    affectedMcpTools: affectedTools,
    unstableDependencies: unstableDeps.map(d => ({ from: d.from, to: d.to, type: d.type })),
    executionPaths: deps
      .filter(d => allAffected.has(d.from) && d.type === 'execution')
      .map(d => ({ from: d.from, to: d.to })),
  };

  fs.mkdirSync(path.resolve(DATA_ROOT, 'repair'), { recursive: true });
  fs.writeFileSync(
    path.resolve(DATA_ROOT, 'repair/runtime-blast-radius.json'),
    JSON.stringify(result, null, 2) + '\n',
  );
  return result;
}

// ── CLI ──
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    const plan = loadJson(path.resolve(DATA_ROOT, 'repair/runtime-repair-plan.json'));
    const domains = [...new Set((plan?.proposals ?? []).flatMap(p => p.targetDomains))];
    console.log(`[blast-radius] Auto-detected targets: ${domains.join(', ') || 'none'}`);
    const result = analyzeBlastRadius(domains);
    console.log(`[blast-radius] Score: ${result.blastRadiusScore}, Cascade risk: ${result.cascadingCollapseRisk}`);
    console.log(`[blast-radius] Affected: ${result.totalAffectedDomains}/${result.totalDomains} domains`);
  } else {
    const result = analyzeBlastRadius(targets);
    console.log(`[blast-radius] Score: ${result.blastRadiusScore}`);
  }
}
