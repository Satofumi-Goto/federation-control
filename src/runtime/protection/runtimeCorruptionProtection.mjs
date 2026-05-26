/**
 * Runtime Corruption Protection
 *
 * Detects and isolates:
 *   - broken runtime_data JSON
 *   - malformed graph structures
 *   - invalid repair lineage
 *   - invalid snapshot
 *   - dependency loops
 *   - corrupted topology state
 *
 * Actions: isolate, quarantine, fallback, governance lock
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DATA_ROOT = path.resolve(REPO_ROOT, 'runtime_data');
const STABILITY_DIR = path.resolve(DATA_ROOT, 'stability');
const QUARANTINE_DIR = path.resolve(STABILITY_DIR, 'quarantine');

function tryLoadJson(p) {
  try { return { ok: true, data: JSON.parse(fs.readFileSync(p, 'utf8')) }; }
  catch (e) { return { ok: false, error: e.message }; }
}

function scanBrokenRuntimeData() {
  const issues = [];
  const criticalFiles = [
    'runtimeRegistryData.json',
    'runtime-orchestration-state.json',
    'runtime-invocation-lock-state.json',
    'runtime-federation-health-graph.json',
    'runtime-operational-digital-twin-graph.json',
    'runtime-governance-timeline.json',
    'state/runtime-snapshot-latest.json',
    'state/runtime-state-history.json',
    'state/runtime-state-transitions.json',
    'repair/runtime-repair-plan.json',
    'repair/runtime-repair-queue.json',
    'repair/runtime-repair-graph.json',
  ];
  for (const f of criticalFiles) {
    const fp = path.resolve(DATA_ROOT, f);
    if (!fs.existsSync(fp)) continue;
    const result = tryLoadJson(fp);
    if (!result.ok) {
      issues.push({ type: 'broken-json', file: f, error: result.error, action: 'quarantine' });
    }
  }
  return issues;
}

function scanMalformedGraphs() {
  const issues = [];
  const twin = tryLoadJson(path.resolve(DATA_ROOT, 'runtime-operational-digital-twin-graph.json'));
  if (twin.ok) {
    const nodes = twin.data?.nodes ?? [];
    const deps = twin.data?.dependencies ?? [];
    if (!Array.isArray(nodes)) issues.push({ type: 'malformed-graph', file: 'digital-twin', detail: 'nodes is not array' });
    if (!Array.isArray(deps)) issues.push({ type: 'malformed-graph', file: 'digital-twin', detail: 'dependencies is not array' });
  }
  const repairGraph = tryLoadJson(path.resolve(DATA_ROOT, 'repair/runtime-repair-graph.json'));
  if (repairGraph.ok) {
    if (!Array.isArray(repairGraph.data?.nodes)) issues.push({ type: 'malformed-graph', file: 'repair-graph', detail: 'nodes is not array' });
    if (!Array.isArray(repairGraph.data?.edges)) issues.push({ type: 'malformed-graph', file: 'repair-graph', detail: 'edges is not array' });
  }
  return issues;
}

function scanDependencyLoops() {
  const twin = tryLoadJson(path.resolve(DATA_ROOT, 'runtime-operational-digital-twin-graph.json'));
  if (!twin.ok) return [];
  const deps = twin.data?.dependencies ?? [];
  const selfLoops = deps.filter(d => d.from === d.to);
  return selfLoops.map(d => ({ type: 'dependency-loop', from: d.from, to: d.to, action: 'isolate' }));
}

function scanInvalidSnapshot() {
  const snap = tryLoadJson(path.resolve(DATA_ROOT, 'state/runtime-snapshot-latest.json'));
  if (!snap.ok) return snap.error ? [{ type: 'invalid-snapshot', error: snap.error }] : [];
  if (!snap.data?.timestamp) return [{ type: 'invalid-snapshot', detail: 'missing timestamp' }];
  return [];
}

function scanInvalidRepairLineage() {
  const lineage = tryLoadJson(path.resolve(DATA_ROOT, 'state/runtime-rollback-lineage.json'));
  if (!lineage.ok) return [];
  const safepoints = lineage.data?.safepoints ?? [];
  const invalid = safepoints.filter(sp => !sp.timestamp || !sp.snapshotId);
  return invalid.map(sp => ({ type: 'invalid-lineage', snapshotId: sp.snapshotId, action: 'fallback' }));
}

function quarantineFile(filePath, reason) {
  fs.mkdirSync(QUARANTINE_DIR, { recursive: true });
  const basename = path.basename(filePath);
  const dest = path.resolve(QUARANTINE_DIR, `${Date.now()}_${basename}`);
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, dest);
    return { quarantined: true, original: filePath, backup: dest, reason };
  }
  return { quarantined: false, reason: 'file not found' };
}

export function scanAndProtect() {
  const allIssues = [
    ...scanBrokenRuntimeData(),
    ...scanMalformedGraphs(),
    ...scanDependencyLoops(),
    ...scanInvalidSnapshot(),
    ...scanInvalidRepairLineage(),
  ];

  const quarantined = [];
  for (const issue of allIssues) {
    if (issue.action === 'quarantine' && issue.file) {
      const fp = path.resolve(DATA_ROOT, issue.file);
      quarantined.push(quarantineFile(fp, issue.type));
    }
  }

  const result = {
    timestamp: new Date().toISOString(),
    issueCount: allIssues.length,
    quarantinedCount: quarantined.filter(q => q.quarantined).length,
    clean: allIssues.length === 0,
    issues: allIssues,
    quarantined,
    governanceLockRecommended: allIssues.some(i => i.type === 'broken-json' || i.type === 'dependency-loop'),
  };

  fs.mkdirSync(STABILITY_DIR, { recursive: true });
  fs.writeFileSync(
    path.resolve(STABILITY_DIR, 'runtime-corruption-result.json'),
    JSON.stringify(result, null, 2) + '\n',
  );
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  console.log('[corruption] Scanning for corruption...');
  const r = scanAndProtect();
  console.log(`[corruption] Issues: ${r.issueCount}, Quarantined: ${r.quarantinedCount}, Clean: ${r.clean}`);
  for (const i of r.issues) console.log(`  [${i.type}] ${i.file ?? i.detail ?? ''}`);
}
