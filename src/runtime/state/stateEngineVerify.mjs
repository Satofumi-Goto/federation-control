/**
 * State Engine Verification
 *
 * Validates all 7 State Engine components:
 *   1. Snapshot capture
 *   2. State memory append + diff
 *   3. Drift timeline recording
 *   4. Repair history recording
 *   5. Rollback lineage update
 *   6. State transition evaluation
 *   7. Memory graph build
 *   8. No secrets in output
 *   9. JSON integrity
 *  10. History size limits
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureSnapshot, loadLatestSnapshot } from './runtimeSnapshotEngine.mjs';
import { appendSnapshot, getHistorySummary } from './federationStateMemory.mjs';
import { recordDriftEvent, getDriftSummary } from './driftTimelineEngine.mjs';
import { recordRepairEntry, getRepairSummary } from './repairHistoryEngine.mjs';
import { updateLineage, getRollbackReadiness } from './rollbackLineageEngine.mjs';
import { evaluateState, recordTransition, getCurrentState, STATES } from './stateTransitionEvaluator.mjs';
import { buildMemoryGraph } from './federationMemoryGraph.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const STATE_DIR = path.resolve(REPO_ROOT, 'runtime_data/state');

const SECRET_PATTERNS = [
  /CURSOR_API_KEY/i, /REMOTE_MCP_AUTH_TOKEN/i, /Bearer\s+\S{20,}/i,
  /crsr_[a-zA-Z0-9]{10,}/i, /sk-[a-zA-Z0-9]{20,}/i,
];

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    const result = fn();
    if (result) { passed++; console.log(`    PASS: ${name}`); }
    else { failed++; console.log(`    FAIL: ${name}`); }
  } catch (e) {
    failed++;
    console.log(`    FAIL: ${name} — ${e.message}`);
  }
}

console.log('[state-verify] Federation State Engine Verification');
console.log('============================================================\n');

// 1. Snapshot
console.log('  Snapshot Engine:');
let snapshot = null;
check('Snapshot capture', () => {
  snapshot = captureSnapshot();
  return snapshot && snapshot.id && snapshot.timestamp && snapshot.commitSha;
});
check('Snapshot has governance', () => snapshot?.governance?.mode != null);
check('Snapshot has execution', () => snapshot?.execution?.mode != null);
check('Snapshot has health', () => snapshot?.health?.overallLevel != null);
check('Snapshot has drift', () => snapshot?.drift?.state != null);
check('Snapshot has verification', () => snapshot?.verification?.topology != null);

// 2. State Memory
console.log('\n  State Memory:');
check('Memory append', () => {
  const history = appendSnapshot(snapshot);
  return history.entries.length > 0;
});
check('History summary', () => {
  const summary = getHistorySummary();
  return summary.totalEntries > 0 && summary.newestTimestamp != null;
});

// 3. Drift Timeline
console.log('\n  Drift Timeline:');
check('Drift event recording', () => {
  recordDriftEvent(snapshot);
  return true;
});
check('Drift summary', () => {
  const summary = getDriftSummary();
  return typeof summary.totalEvents === 'number';
});

// 4. Repair History
console.log('\n  Repair History:');
check('Repair entry recording', () => {
  const entry = recordRepairEntry(snapshot);
  return entry && entry.id;
});
check('Repair summary', () => {
  const summary = getRepairSummary();
  return summary.totalEntries > 0;
});

// 5. Rollback Lineage
console.log('\n  Rollback Lineage:');
check('Lineage update', () => {
  const lineage = updateLineage();
  return lineage && Array.isArray(lineage.safepoints);
});
check('Rollback readiness', () => {
  const readiness = getRollbackReadiness();
  return readiness.recommendation != null;
});

// 6. State Transition
console.log('\n  State Transition:');
check('State evaluation', () => {
  const state = evaluateState(snapshot);
  return state && STATES[state.id] != null;
});
check('Transition recording', () => {
  const result = recordTransition(snapshot);
  return result && (result.changed !== undefined || result.current !== undefined);
});
check('Current state', () => {
  const state = getCurrentState();
  return state.id && state.label;
});

// 7. Memory Graph
console.log('\n  Memory Graph:');
check('Graph build', () => {
  const graph = buildMemoryGraph();
  return graph.nodes.length > 0 && graph.edges.length > 0;
});
check('Graph has state engine core', () => {
  const graph = JSON.parse(fs.readFileSync(path.resolve(STATE_DIR, 'federation-memory-graph.json'), 'utf8'));
  return graph.nodes.some(n => n.id === 'state-engine');
});

// 8. No secrets
console.log('\n  Security:');
check('No secrets in snapshot', () => {
  const raw = JSON.stringify(snapshot);
  return !SECRET_PATTERNS.some(p => p.test(raw));
});
check('No secrets in state files', () => {
  const files = fs.readdirSync(STATE_DIR).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const content = fs.readFileSync(path.resolve(STATE_DIR, f), 'utf8');
    if (SECRET_PATTERNS.some(p => p.test(content))) return false;
  }
  return true;
});

// 9. JSON integrity
console.log('\n  Integrity:');
check('All state JSON files parseable', () => {
  const files = fs.readdirSync(STATE_DIR).filter(f => f.endsWith('.json'));
  for (const f of files) {
    JSON.parse(fs.readFileSync(path.resolve(STATE_DIR, f), 'utf8'));
  }
  return files.length > 0;
});

// 10. Size limits
check('History within size limit', () => {
  const summary = getHistorySummary();
  return summary.totalEntries <= summary.maxEntries;
});

console.log(`\n============================================================`);
console.log(`[state-verify] ${passed}/${passed + failed} checks passed — ${failed === 0 ? 'ALL PASS' : `${failed} FAILED`}\n`);

console.log(JSON.stringify({
  ok: failed === 0,
  passed,
  total: passed + failed,
  timestamp: new Date().toISOString(),
}, null, 2));

process.exit(failed > 0 ? 1 : 0);
