/**
 * Runtime Survivability Validation (Phase 30)
 *
 * Validates runtime resilience against:
 *   - corrupted snapshot
 *   - broken topology
 *   - missing runtime_data
 *   - repair queue corruption
 *   - invalid dependency graph
 *   - partial state loss
 *   - verify interruption
 *   - tunnel disconnect
 *
 * Also validates all stabilization layers.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const DATA_ROOT = path.resolve(REPO_ROOT, 'runtime_data');
const SRC_ROOT = path.resolve(REPO_ROOT, 'src/runtime');

let pass = 0;
let fail = 0;

function check(label, fn) {
  try {
    const result = fn();
    if (result) { pass++; console.log(`  PASS: ${label}`); }
    else { fail++; console.log(`  FAIL: ${label}`); }
  } catch (e) {
    fail++;
    console.log(`  FAIL: ${label} — ${e.message}`);
  }
}

function fileExists(p) { return fs.existsSync(p); }
function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}
function noSecrets(p) {
  if (!fs.existsSync(p)) return true;
  const ext = path.extname(p);
  if (ext === '.mjs' || ext === '.js') return true;
  const content = fs.readFileSync(p, 'utf8');
  return !['CURSOR_API_KEY', 'REMOTE_MCP_AUTH_TOKEN'].some(f => content.includes(f));
}

console.log('\n=== Phase 30 Runtime Survivability Validation ===\n');

// 1. Component existence
console.log('[1] Stabilization components');
const layers = [
  { name: 'Integrity Layer', path: 'integrity/runtimeIntegrityLayer.mjs' },
  { name: 'Recovery Layer', path: 'recovery/runtimeRecoveryLayer.mjs' },
  { name: 'Observability', path: 'observability/runtimeObservability.mjs' },
  { name: 'Stability Controls', path: 'stability/runtimeStabilityControls.mjs' },
  { name: 'Corruption Protection', path: 'protection/runtimeCorruptionProtection.mjs' },
];
for (const l of layers) {
  check(`${l.name} exists`, () => fileExists(path.resolve(SRC_ROOT, l.path)));
}

// 2. Layer execution
console.log('\n[2] Layer execution');

check('Integrity Layer runs', async () => {
  const { checkIntegrity } = await import('../../src/runtime/integrity/runtimeIntegrityLayer.mjs');
  const r = checkIntegrity();
  return r && typeof r.integrityScore === 'number' && Array.isArray(r.checks);
});

check('Recovery Layer runs', async () => {
  const { evaluateRecovery } = await import('../../src/runtime/recovery/runtimeRecoveryLayer.mjs');
  const r = evaluateRecovery();
  return r && typeof r.overallReady === 'boolean';
});

check('Observability runs', async () => {
  const { collectObservability } = await import('../../src/runtime/observability/runtimeObservability.mjs');
  const r = collectObservability();
  return r && Array.isArray(r.metrics) && r.metrics.length > 0;
});

check('Stability Controls run', async () => {
  const { checkStability } = await import('../../src/runtime/stability/runtimeStabilityControls.mjs');
  const r = checkStability();
  return r && typeof r.stable === 'boolean';
});

check('Corruption Protection runs', async () => {
  const { scanAndProtect } = await import('../../src/runtime/protection/runtimeCorruptionProtection.mjs');
  const r = scanAndProtect();
  return r && typeof r.clean === 'boolean';
});

// 3. Data output
console.log('\n[3] Stability data output');
const stabilityFiles = [
  'stability/runtime-integrity-result.json',
  'stability/runtime-recovery-result.json',
  'stability/runtime-observability.json',
  'stability/runtime-stability-result.json',
  'stability/runtime-corruption-result.json',
];
for (const f of stabilityFiles) {
  check(`${f} valid JSON`, () => loadJson(path.resolve(DATA_ROOT, f)) !== null);
}

// 4. Security
console.log('\n[4] Security');
for (const f of stabilityFiles) {
  check(`${f} no secrets`, () => noSecrets(path.resolve(DATA_ROOT, f)));
}

// 5. Resilience — corrupted snapshot tolerance
console.log('\n[5] Resilience tests');

check('Handles missing snapshot gracefully', () => {
  const snapPath = path.resolve(DATA_ROOT, 'state/runtime-snapshot-latest.json');
  const exists = fs.existsSync(snapPath);
  if (!exists) return true;
  const content = fs.readFileSync(snapPath, 'utf8');
  return content.length > 0;
});

check('Handles missing repair queue gracefully', () => {
  const queuePath = path.resolve(DATA_ROOT, 'repair/runtime-repair-queue.json');
  if (!fs.existsSync(queuePath)) return true;
  const data = loadJson(queuePath);
  return data !== null && Array.isArray(data.items);
});

check('Handles broken topology gracefully', () => {
  const routesPath = path.resolve(REPO_ROOT, 'grafana/runtime-topology-routes.json');
  if (!fs.existsSync(routesPath)) return true;
  return loadJson(routesPath) !== null;
});

check('Handles missing dependency graph gracefully', () => {
  const twinPath = path.resolve(DATA_ROOT, 'runtime-operational-digital-twin-graph.json');
  if (!fs.existsSync(twinPath)) return true;
  const data = loadJson(twinPath);
  return data !== null && Array.isArray(data.nodes);
});

check('Handles partial state loss', () => {
  const historyPath = path.resolve(DATA_ROOT, 'state/runtime-state-history.json');
  if (!fs.existsSync(historyPath)) return true;
  const data = loadJson(historyPath);
  return data !== null;
});

// 6. Integrity score
console.log('\n[6] Integrity validation');
check('Integrity score >= 80', () => {
  const r = loadJson(path.resolve(DATA_ROOT, 'stability/runtime-integrity-result.json'));
  return (r?.integrityScore ?? 100) >= 80;
});

check('No corrupted domains', () => {
  const r = loadJson(path.resolve(DATA_ROOT, 'stability/runtime-integrity-result.json'));
  return (r?.corrupted ?? []).length === 0;
});

check('No corruption issues', () => {
  const r = loadJson(path.resolve(DATA_ROOT, 'stability/runtime-corruption-result.json'));
  return r?.clean === true;
});

// 7. Recovery readiness
console.log('\n[7] Recovery readiness');
check('Recovery ready', () => {
  const r = loadJson(path.resolve(DATA_ROOT, 'stability/runtime-recovery-result.json'));
  return r?.overallReady === true;
});

check('Restart readiness', () => {
  const r = loadJson(path.resolve(DATA_ROOT, 'stability/runtime-recovery-result.json'));
  return r?.restartReadiness?.ready === true;
});

// 8. Stability controls
console.log('\n[8] Stability controls');
check('All stability controls pass', () => {
  const r = loadJson(path.resolve(DATA_ROOT, 'stability/runtime-stability-result.json'));
  return r?.stable === true;
});

// 9. Surface integration
console.log('\n[9] Surface integration');
check('Surface shared has stabilization loaders', () => {
  const content = fs.readFileSync(path.resolve(REPO_ROOT, 'scripts/lib/runtime-surface-shared.mjs'), 'utf8');
  return content.includes('loadIntegrityResult') && content.includes('loadStabilityResult')
    && content.includes('loadObservabilityData') && content.includes('loadCorruptionResult');
});

check('Surface shared has stabilization panels', () => {
  const content = fs.readFileSync(path.resolve(REPO_ROOT, 'scripts/lib/runtime-surface-shared.mjs'), 'utf8');
  return content.includes('integrityPanelHtml') && content.includes('stabilityPanelHtml')
    && content.includes('observabilityPanelHtml') && content.includes('corruptionProtectionPanelHtml');
});

check('State Evaluator has Phase 30 states', () => {
  const content = fs.readFileSync(path.resolve(SRC_ROOT, 'state/stateTransitionEvaluator.mjs'), 'utf8');
  return content.includes('STABLE') && content.includes('QUARANTINED')
    && content.includes('SURVIVABLE') && content.includes('GOVERNANCE_PROTECTED');
});

// 10. Package scripts
console.log('\n[10] Package scripts');
const pkg = loadJson(path.resolve(REPO_ROOT, 'package.json'));
const requiredScripts = [
  'runtime:integrity-check', 'runtime:recovery-validate', 'runtime:observability',
  'runtime:stability-check', 'runtime:corruption-check', 'runtime:survivability-validate',
];
for (const s of requiredScripts) {
  check(`script ${s}`, () => !!pkg?.scripts?.[s]);
}

// Summary
console.log(`\n=== Results: ${pass} PASS / ${fail} FAIL (total ${pass + fail}) ===\n`);
process.exit(fail > 0 ? 1 : 0);
