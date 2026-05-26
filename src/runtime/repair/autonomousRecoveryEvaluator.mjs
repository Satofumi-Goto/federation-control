/**
 * Autonomous Recovery Evaluator
 *
 * Post-repair evaluation comparing topology verify, semantic verify,
 * runtime state, dependency stability, governance integrity,
 * and drift reduction.
 *
 * Results: recovered | partially-recovered | unstable | rollback-recommended
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DATA_ROOT = path.resolve(REPO_ROOT, 'runtime_data');
const STATE_DIR = path.resolve(DATA_ROOT, 'state');
const REPAIR_DIR = path.resolve(DATA_ROOT, 'repair');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function checkTopologyVerify() {
  const snap = loadJson(path.resolve(STATE_DIR, 'runtime-snapshot-latest.json'));
  return snap?.verification?.topology?.ok === true;
}

function checkSemanticVerify() {
  const snap = loadJson(path.resolve(STATE_DIR, 'runtime-snapshot-latest.json'));
  return snap?.verification?.semantic?.ok === true;
}

function checkRuntimeState() {
  const transitions = loadJson(path.resolve(STATE_DIR, 'runtime-state-transitions.json'));
  const current = transitions?.currentState ?? 'HEALTHY';
  const healthyStates = ['HEALTHY', 'RECOVERING'];
  return { state: current, healthy: healthyStates.includes(current) };
}

function checkDependencyStability() {
  const twin = loadJson(path.resolve(DATA_ROOT, 'runtime-operational-digital-twin-graph.json'));
  const deps = twin?.dependencies ?? [];
  const broken = deps.filter(d => d.healthy === false).length;
  const total = deps.length || 1;
  return { broken, total, ratio: broken / total, stable: broken / total < 0.15 };
}

function checkGovernanceIntegrity() {
  const snap = loadJson(path.resolve(STATE_DIR, 'runtime-snapshot-latest.json'));
  const gov = snap?.governance ?? {};
  return {
    violations: gov.violations ?? 0,
    locked: gov.lockDecision === 'blocked',
    intact: (gov.violations ?? 0) === 0 && gov.lockDecision !== 'blocked',
  };
}

function checkDriftReduction() {
  const timeline = loadJson(path.resolve(STATE_DIR, 'runtime-drift-timeline.json'));
  const events = timeline?.events ?? [];
  const active = events.filter(e => e.status === 'active' || !e.resolvedAt).length;
  return { activeDrifts: active, reduced: active === 0 };
}

export function evaluateRecovery() {
  const topologyOk = checkTopologyVerify();
  const semanticOk = checkSemanticVerify();
  const runtimeState = checkRuntimeState();
  const depStability = checkDependencyStability();
  const govIntegrity = checkGovernanceIntegrity();
  const driftReduction = checkDriftReduction();

  const checks = [
    { name: 'トポロジー検証', pass: topologyOk },
    { name: 'セマンティック検証', pass: semanticOk },
    { name: 'ランタイム状態', pass: runtimeState.healthy },
    { name: '依存関係安定性', pass: depStability.stable },
    { name: 'ガバナンス整合性', pass: govIntegrity.intact },
    { name: 'ドリフト低減', pass: driftReduction.reduced },
  ];

  const passCount = checks.filter(c => c.pass).length;
  const total = checks.length;

  let verdict;
  if (passCount === total) verdict = 'recovered';
  else if (passCount >= total - 1) verdict = 'partially-recovered';
  else if (passCount >= total - 3) verdict = 'unstable';
  else verdict = 'rollback-recommended';

  const VERDICT_LABELS = {
    'recovered': '完全復旧',
    'partially-recovered': '部分復旧',
    'unstable': '不安定',
    'rollback-recommended': 'ロールバック推奨',
  };

  const result = {
    timestamp: new Date().toISOString(),
    verdict,
    verdictLabel: VERDICT_LABELS[verdict],
    passCount,
    totalChecks: total,
    checks,
    detail: {
      topology: topologyOk,
      semantic: semanticOk,
      runtimeState: runtimeState.state,
      brokenDependencies: depStability.broken,
      totalDependencies: depStability.total,
      governanceViolations: govIntegrity.violations,
      governanceLocked: govIntegrity.locked,
      activeDrifts: driftReduction.activeDrifts,
    },
  };

  fs.mkdirSync(REPAIR_DIR, { recursive: true });
  fs.writeFileSync(
    path.resolve(REPAIR_DIR, 'runtime-recovery-evaluation.json'),
    JSON.stringify(result, null, 2) + '\n',
  );
  return result;
}

// ── CLI ──
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  console.log('[recovery-evaluator] Evaluating recovery...');
  const result = evaluateRecovery();
  console.log(`[recovery-evaluator] Verdict: ${result.verdictLabel} (${result.passCount}/${result.totalChecks} checks passed)`);
  for (const c of result.checks) {
    console.log(`  ${c.pass ? 'PASS' : 'FAIL'}: ${c.name}`);
  }
}
