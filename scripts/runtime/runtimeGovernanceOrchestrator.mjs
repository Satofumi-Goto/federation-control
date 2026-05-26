#!/usr/bin/env node
/**
 * Runtime Governance Orchestrator
 *
 * Autonomous governance lifecycle:
 *   monitor → drift → self-repair → governance decision →
 *   safe apply → deploy → deploy verify → health propagation →
 *   federation orchestration
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateAllPolicies, POLICY_STATES } from './runtimePolicyEngine.mjs';
import { runPressureEngine } from './runtimeGovernancePressureEngine.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const SNAPSHOT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-snapshot.json');
const TIMELINE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-governance-timeline.json');
const HEALTH_GRAPH_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-federation-health-graph.json');

function run(cmd) {
  try {
    return { ok: true, output: execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 60000 }).trim() };
  } catch (e) {
    return { ok: false, output: e.stderr?.trim() ?? e.message };
  }
}

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function appendTimeline(event) {
  const timeline = loadJson(TIMELINE_PATH) ?? [];
  timeline.push({ ...event, timestamp: new Date().toISOString() });
  const trimmed = timeline.slice(-200);
  saveJson(TIMELINE_PATH, trimmed);
}

function main() {
  console.log('[governance] Runtime Governance Orchestrator');
  console.log('='.repeat(60));

  // Phase 1: Self-Repair (includes monitor + drift + repair cycle)
  console.log('\n[governance] Phase 1: Self-Repair Cycle');
  const repairResult = run('node scripts/runtime/runtimeSelfRepairOrchestrator.mjs');
  const repairOk = repairResult.ok;
  let repairReport = {};
  try {
    const lines = repairResult.output.split('\n');
    const jsonStart = lines.findIndex(l => l.trim() === '{');
    if (jsonStart >= 0) {
      repairReport = JSON.parse(lines.slice(jsonStart).join('\n'));
    }
  } catch { /* parse failed */ }
  console.log(`  Self-repair: ${repairOk ? 'PASS' : 'FAIL'}`);
  console.log(`  Repair decision: ${repairReport.decision ?? 'unknown'}`);

  appendTimeline({ type: 'repair_cycle', decision: repairReport.decision, ok: repairOk });

  // Phase 2: Policy Evaluation
  console.log('\n[governance] Phase 2: Policy Evaluation');
  const policyResult = evaluateAllPolicies();
  console.log(`  Operational Mode: ${policyResult.operationalMode}`);
  for (const [domain, state] of Object.entries(policyResult.policies)) {
    const icon = state === 'allowed' ? '●' : state === 'guarded' ? '◐' : state === 'restricted' ? '○' : '✕';
    console.log(`    ${icon} ${domain}: ${state}`);
  }

  appendTimeline({ type: 'policy_evaluation', mode: policyResult.operationalMode, policies: policyResult.policies });

  // Phase 3: Governance Pressure
  console.log('\n[governance] Phase 3: Governance Pressure');
  const pressureResult = runPressureEngine();
  console.log(`  Pressure: ${pressureResult.pressure}/100 (${pressureResult.level})`);

  appendTimeline({ type: 'pressure_evaluation', pressure: pressureResult.pressure, level: pressureResult.level });

  // Phase 4: Governance Decision
  console.log('\n[governance] Phase 4: Governance Decision');
  const deployAllowed = policyResult.policies.deploy === POLICY_STATES.ALLOWED;
  const repairAllowed = policyResult.policies.repair === POLICY_STATES.ALLOWED || policyResult.policies.repair === POLICY_STATES.GUARDED;
  const pressureSafe = pressureResult.level === 'nominal' || pressureResult.level === 'low';
  const snapshotHealthy = repairReport.ok === true;

  let governanceDecision;
  if (snapshotHealthy && deployAllowed && pressureSafe) {
    governanceDecision = 'autonomous_proceed';
  } else if (snapshotHealthy && !pressureSafe) {
    governanceDecision = 'guarded_proceed';
  } else if (!snapshotHealthy && repairAllowed) {
    governanceDecision = 'repair_first';
  } else {
    governanceDecision = 'hold';
  }
  console.log(`  Decision: ${governanceDecision}`);

  appendTimeline({ type: 'governance_decision', decision: governanceDecision });

  // Phase 5: Deploy Safety Gate
  console.log('\n[governance] Phase 5: Deploy Safety');
  let deploySafe = false;
  if (governanceDecision === 'autonomous_proceed') {
    deploySafe = true;
    console.log('  Deploy: SAFE (all gates green)');
  } else if (governanceDecision === 'guarded_proceed') {
    deploySafe = true;
    console.log('  Deploy: GUARDED (pressure elevated but healthy)');
  } else {
    console.log(`  Deploy: BLOCKED (${governanceDecision})`);
  }

  // Phase 6: Verification
  console.log('\n[governance] Phase 6: Post-Governance Verification');
  const autoVerify = run('node scripts/runtime/runtimeAutoVerificationPipeline.mjs');
  const verifyOk = autoVerify.ok;
  console.log(`  Auto-verify: ${verifyOk ? 'ALL PASS' : 'SOME FAILED'}`);

  appendTimeline({ type: 'verification', ok: verifyOk });

  // Phase 7: Health Propagation
  console.log('\n[governance] Phase 7: Health Propagation');
  const healthGraph = loadJson(HEALTH_GRAPH_PATH);
  if (healthGraph) {
    console.log(`  Governance pressure: ${healthGraph.governancePressure}/100`);
    console.log(`  Dependency health: ${healthGraph.dependencyHealth}`);
    for (const node of healthGraph.nodes ?? []) {
      console.log(`    ${node.id}: ${node.health} (pressure=${node.pressure})`);
    }
  }

  appendTimeline({ type: 'health_propagation', healthGraph: healthGraph ? { pressure: healthGraph.governancePressure, level: healthGraph.governanceLevel } : null });

  // Phase 8: Update operational snapshot with governance data
  const snapshot = loadJson(SNAPSHOT_PATH) ?? {};
  snapshot.governanceMode = policyResult.operationalMode;
  snapshot.governanceDecision = governanceDecision;
  snapshot.governancePressure = pressureResult.pressure;
  snapshot.governancePressureLevel = pressureResult.level;
  snapshot.deploySafe = deploySafe;
  snapshot.timestamp = new Date().toISOString();
  saveJson(SNAPSHOT_PATH, snapshot);

  // Final Report
  const report = {
    ok: verifyOk && (governanceDecision === 'autonomous_proceed' || governanceDecision === 'guarded_proceed'),
    governanceDecision,
    operationalMode: policyResult.operationalMode,
    policies: policyResult.policies,
    pressure: { score: pressureResult.pressure, level: pressureResult.level },
    repair: { ok: repairOk, decision: repairReport.decision },
    verification: verifyOk,
    deploySafe,
    healthGraph: healthGraph ? { pressure: healthGraph.governancePressure, level: healthGraph.governanceLevel, nodes: healthGraph.nodes?.length } : null,
    timestamp: new Date().toISOString(),
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[governance] Result: ${report.ok ? 'AUTONOMOUS-READY' : 'GOVERNANCE HOLD'}`);
  console.log(`[governance] Mode: ${policyResult.operationalMode}`);
  console.log(`[governance] Decision: ${governanceDecision}`);
  console.log(`[governance] Pressure: ${pressureResult.pressure}/100 (${pressureResult.level})`);
  console.log('\n' + JSON.stringify(report, null, 2));
}

main();
