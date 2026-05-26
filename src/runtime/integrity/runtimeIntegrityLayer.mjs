/**
 * Runtime Integrity Layer
 *
 * Validates structural integrity of:
 *   - Runtime Registry
 *   - topology consistency
 *   - dependency graph
 *   - state history
 *   - repair graph
 *   - runtime_data checksum (JSON parseability)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DATA_ROOT = path.resolve(REPO_ROOT, 'runtime_data');

function tryLoadJson(p) {
  try { return { ok: true, data: JSON.parse(fs.readFileSync(p, 'utf8')) }; }
  catch (e) { return { ok: false, error: e.message }; }
}

function checksum(p) {
  if (!fs.existsSync(p)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 12);
}

function checkRegistryIntegrity() {
  const registryPath = path.resolve(REPO_ROOT, 'src/runtime/registry/runtimeRegistryData.json');
  const result = tryLoadJson(registryPath);
  if (!result.ok) return { domain: 'registry', ok: false, detail: result.error };
  const cards = Array.isArray(result.data) ? result.data : result.data?.cards ?? [];
  const orphans = cards.filter(c => !c.target && !c.dashboardUrl);
  return {
    domain: 'registry',
    ok: cards.length > 0,
    cardCount: cards.length,
    orphanCards: orphans.length,
    checksum: checksum(registryPath),
  };
}

function checkTopologyIntegrity() {
  const routes = tryLoadJson(path.resolve(REPO_ROOT, 'grafana/runtime-topology-routes.json'));
  const workspace = tryLoadJson(path.resolve(REPO_ROOT, 'grafana/runtime-workspace-routes.json'));
  if (!routes.ok) return { domain: 'topology', ok: false, detail: 'routes: ' + routes.error };
  if (!workspace.ok) return { domain: 'topology', ok: false, detail: 'workspace: ' + workspace.error };
  return { domain: 'topology', ok: true, routeCount: (routes.data?.routes ?? []).length };
}

function checkDependencyGraphIntegrity() {
  const twin = tryLoadJson(path.resolve(DATA_ROOT, 'runtime-operational-digital-twin-graph.json'));
  if (!twin.ok) return { domain: 'dependency-graph', ok: false, detail: twin.error };
  const nodes = twin.data?.nodes ?? [];
  const deps = twin.data?.dependencies ?? [];
  const nodeIds = new Set(nodes.map(n => n.id));
  const orphanDeps = deps.filter(d => !nodeIds.has(d.from) || !nodeIds.has(d.to));
  return {
    domain: 'dependency-graph',
    ok: orphanDeps.length === 0,
    nodeCount: nodes.length,
    depCount: deps.length,
    orphanDeps: orphanDeps.length,
  };
}

function checkStateHistoryIntegrity() {
  const history = tryLoadJson(path.resolve(DATA_ROOT, 'state/runtime-state-history.json'));
  if (!history.ok) return { domain: 'state-history', ok: true, detail: 'no history (acceptable)' };
  const entries = history.data?.entries ?? [];
  const hasDuplicateTimestamps = entries.length !== new Set(entries.map(e => e.timestamp)).size;
  return {
    domain: 'state-history',
    ok: !hasDuplicateTimestamps && entries.length <= 100,
    entryCount: entries.length,
    duplicates: hasDuplicateTimestamps,
  };
}

function checkRepairGraphIntegrity() {
  const graph = tryLoadJson(path.resolve(DATA_ROOT, 'repair/runtime-repair-graph.json'));
  if (!graph.ok) return { domain: 'repair-graph', ok: true, detail: 'no graph (acceptable)' };
  const nodes = graph.data?.nodes ?? [];
  const edges = graph.data?.edges ?? [];
  const nodeIds = new Set(nodes.map(n => n.id));
  const orphanEdges = edges.filter(e => !nodeIds.has(e.from) && !nodeIds.has(e.to));
  return {
    domain: 'repair-graph',
    ok: orphanEdges.length === 0,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    orphanEdges: orphanEdges.length,
  };
}

function checkRuntimeDataChecksums() {
  const criticalFiles = [
    'runtimeRegistryData.json',
    'runtime-orchestration-state.json',
    'runtime-invocation-lock-state.json',
    'runtime-federation-health-graph.json',
    'runtime-operational-digital-twin-graph.json',
  ];
  const results = [];
  let allOk = true;
  for (const f of criticalFiles) {
    const fp = path.resolve(DATA_ROOT, f);
    const loaded = tryLoadJson(fp);
    if (!loaded.ok && fs.existsSync(fp)) { allOk = false; }
    results.push({ file: f, exists: fs.existsSync(fp), parseable: loaded.ok, checksum: checksum(fp) });
  }
  return { domain: 'data-checksums', ok: allOk, files: results };
}

export function checkIntegrity() {
  const checks = [
    checkRegistryIntegrity(),
    checkTopologyIntegrity(),
    checkDependencyGraphIntegrity(),
    checkStateHistoryIntegrity(),
    checkRepairGraphIntegrity(),
    checkRuntimeDataChecksums(),
  ];

  const passed = checks.filter(c => c.ok).length;
  const total = checks.length;
  const integrityScore = Math.round((passed / total) * 100);
  const corrupted = checks.filter(c => !c.ok).map(c => c.domain);

  const result = {
    timestamp: new Date().toISOString(),
    integrityScore,
    passed,
    total,
    corrupted,
    orphanStates: checks.filter(c => c.orphanCards > 0 || c.orphanDeps > 0 || c.orphanEdges > 0).map(c => c.domain),
    checks,
  };

  fs.mkdirSync(path.resolve(DATA_ROOT, 'stability'), { recursive: true });
  fs.writeFileSync(
    path.resolve(DATA_ROOT, 'stability/runtime-integrity-result.json'),
    JSON.stringify(result, null, 2) + '\n',
  );
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  console.log('[integrity] Checking runtime integrity...');
  const r = checkIntegrity();
  console.log(`[integrity] Score: ${r.integrityScore}/100 (${r.passed}/${r.total})`);
  if (r.corrupted.length > 0) console.log(`[integrity] Corrupted: ${r.corrupted.join(', ')}`);
  else console.log('[integrity] No corruption detected');
}
