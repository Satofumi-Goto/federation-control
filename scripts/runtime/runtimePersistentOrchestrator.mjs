#!/usr/bin/env node
/**
 * Runtime Persistent Orchestrator
 *
 * Single-tick orchestration cycle:
 *   supervisor check → monitor → drift → repair → governance →
 *   payload check → executor trigger → result collection →
 *   event propagation → state update
 *
 * Designed to be called repeatedly (cron, watcher, or manual).
 * Each invocation is one tick of the orchestration loop.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { emit, EVENT_TYPES, summary as eventSummary, detectStorm } from './runtimeEventBus.mjs';
import { evaluateLoopSafety, updateOrchestrationState, SUPERVISOR_DECISIONS, EXTENDED_OP_MODES } from './runtimeLoopSupervisor.mjs';
import { evaluateAllPolicies } from './runtimePolicyEngine.mjs';
import { runPressureEngine } from './runtimeGovernancePressureEngine.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const ORCHESTRATION_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-orchestration-state.json');
const SNAPSHOT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-snapshot.json');

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

function main() {
  console.log('[orchestrator] Runtime Persistent Orchestrator');
  console.log('='.repeat(60));

  const tickStart = new Date().toISOString();

  // Phase 1: Loop supervisor check
  console.log('\n[orchestrator] Phase 1: Supervisor Check');
  const supervisor = evaluateLoopSafety();
  console.log(`  Decision: ${supervisor.decision}`);
  console.log(`  Mode: ${supervisor.recommendedMode}`);

  if (supervisor.decision === SUPERVISOR_DECISIONS.HALT) {
    console.log('  HALTED — loop supervisor blocked execution');
    emit(EVENT_TYPES.BLOCKED, { reason: 'supervisor-halt', violations: supervisor.violations });
    updateOrchestrationState(supervisor);
    const report = { ok: false, mode: 'halted', supervisor, timestamp: tickStart };
    console.log('\n' + JSON.stringify(report, null, 2));
    return;
  }

  if (supervisor.decision === SUPERVISOR_DECISIONS.MANUAL_REVIEW) {
    console.log('  MANUAL REVIEW required — supervisor detected multiple violations');
    emit(EVENT_TYPES.BLOCKED, { reason: 'manual-review', violations: supervisor.violations });
    updateOrchestrationState(supervisor);
    const report = { ok: false, mode: 'manual-review', supervisor, timestamp: tickStart };
    console.log('\n' + JSON.stringify(report, null, 2));
    return;
  }

  emit(EVENT_TYPES.LOOP_TICK, { decision: supervisor.decision, mode: supervisor.recommendedMode });

  // Phase 2: Monitor
  console.log('\n[orchestrator] Phase 2: Runtime Monitor');
  const monitorResult = run('node scripts/runtime/runtimeContinuousMonitor.mjs');
  const snapshot = loadJson(SNAPSHOT_PATH);
  const monitorState = snapshot?.state ?? 'unknown';
  console.log(`  State: ${monitorState}`);

  // Phase 3: Drift detection
  console.log('\n[orchestrator] Phase 3: Drift Detection');
  const driftResult = run('node scripts/runtime/runtimeDriftMonitor.mjs');
  let driftState = 'healthy';
  let driftCount = 0;
  try {
    const lines = driftResult.output.split('\n');
    const jsonStart = lines.findIndex(l => l.trim() === '{');
    if (jsonStart >= 0) {
      const parsed = JSON.parse(lines.slice(jsonStart).join('\n'));
      driftState = parsed.state ?? 'healthy';
      driftCount = parsed.driftCount ?? 0;
    }
  } catch { /* parse failed */ }
  console.log(`  Drift state: ${driftState} (${driftCount} drifts)`);
  if (driftCount > 0) emit(EVENT_TYPES.DRIFT, { state: driftState, count: driftCount });

  // Phase 4: Self-repair
  console.log('\n[orchestrator] Phase 4: Self-Repair');
  let repairDecision = 'no_action';
  if (supervisor.decision !== SUPERVISOR_DECISIONS.THROTTLE) {
    const repairResult = run('node scripts/runtime/runtimeSelfRepairOrchestrator.mjs');
    try {
      const lines = repairResult.output.split('\n');
      const jsonStart = lines.findIndex(l => l.trim() === '{');
      if (jsonStart >= 0) {
        const parsed = JSON.parse(lines.slice(jsonStart).join('\n'));
        repairDecision = parsed.decision ?? 'no_action';
      }
    } catch { /* parse failed */ }
    console.log(`  Repair decision: ${repairDecision}`);
    if (repairDecision !== 'no_action') emit(EVENT_TYPES.REPAIRED, { decision: repairDecision });
  } else {
    console.log('  Skipped — throttled by supervisor');
    emit(EVENT_TYPES.THROTTLED, { phase: 'self-repair' });
  }

  // Phase 5: Governance
  console.log('\n[orchestrator] Phase 5: Governance');
  const policies = evaluateAllPolicies();
  console.log(`  Mode: ${policies.operationalMode}`);

  // Phase 6: Pressure
  console.log('\n[orchestrator] Phase 6: Pressure');
  const pressure = runPressureEngine();
  console.log(`  Pressure: ${pressure.pressure}/100 (${pressure.level})`);
  if (pressure.pressure > 60) emit(EVENT_TYPES.PRESSURE_SPIKE, { pressure: pressure.pressure, level: pressure.level });

  // Phase 7: Payload check
  console.log('\n[orchestrator] Phase 7: Payload Check');
  const payloadPath = path.resolve(REPO_ROOT, '.cursor/tasks/runtime-bridge-payload.json');
  const payload = loadJson(payloadPath);
  const hasPayload = !!payload?.instructionId;
  console.log(`  Payload: ${hasPayload ? payload.instructionId : 'none'}`);

  // Phase 8: Auto verification
  console.log('\n[orchestrator] Phase 8: Auto Verification');
  const verifyResult = run('node scripts/runtime/runtimeAutoVerificationPipeline.mjs');
  const verifyOk = verifyResult.ok;
  console.log(`  Verification: ${verifyOk ? 'ALL PASS' : 'SOME FAILED'}`);
  if (!verifyOk) emit(EVENT_TYPES.FAILED, { phase: 'verification' });

  // Phase 9: Storm detection
  console.log('\n[orchestrator] Phase 9: Storm Detection');
  const storm = detectStorm();
  console.log(`  Storm: ${storm.detected ? 'DETECTED' : 'clear'} (${storm.recentTotal} recent events)`);
  if (storm.detected) emit(EVENT_TYPES.STORM_DETECTED, { storms: storm.storms });

  // Phase 10: Update orchestration state
  const orchState = loadJson(ORCHESTRATION_PATH) ?? {};
  const activeMode = supervisor.recommendedMode;
  const previousMode = orchState.activeMode;

  if (previousMode && previousMode !== activeMode) {
    emit(EVENT_TYPES.MODE_CHANGE, { from: previousMode, to: activeMode });
  }

  const updatedState = {
    activeMode,
    activeHealth: monitorState,
    activeQueue: [],
    activeRepairState: repairDecision,
    activeDeployState: snapshot?.deploySafe ? 'ready' : 'blocked',
    governanceState: policies.operationalMode,
    driftState,
    pressureScore: pressure.pressure,
    recoveryState: repairDecision === 'no_action' ? null : 'in-progress',
    supervisorDecision: supervisor.decision,
    supervisorCounters: supervisor.counters,
    violations: supervisor.violations.length,
    stormDetected: storm.detected,
    loopCount: (orchState.loopCount ?? 0) + 1,
    lastLoopTime: tickStart,
    timestamp: new Date().toISOString(),
  };
  saveJson(ORCHESTRATION_PATH, updatedState);

  // Event summary
  const evSummary = eventSummary();

  // Final report
  const allHealthy = verifyOk && monitorState === 'healthy' && driftCount === 0;
  const report = {
    ok: allHealthy && supervisor.decision === SUPERVISOR_DECISIONS.PROCEED,
    tick: updatedState.loopCount,
    activeMode,
    health: monitorState,
    driftState,
    driftCount,
    repairDecision,
    governance: policies.operationalMode,
    pressure: { score: pressure.pressure, level: pressure.level },
    supervisor: { decision: supervisor.decision, violations: supervisor.violations.length },
    verification: verifyOk,
    storm: storm.detected,
    hasPayload,
    events: { total: evSummary.total, types: Object.keys(evSummary.types).length },
    timestamp: new Date().toISOString(),
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[orchestrator] Tick #${updatedState.loopCount}`);
  console.log(`[orchestrator] Mode: ${activeMode}`);
  console.log(`[orchestrator] Health: ${monitorState}`);
  console.log(`[orchestrator] Pressure: ${pressure.pressure}/100`);
  console.log(`[orchestrator] Supervisor: ${supervisor.decision}`);
  console.log(`[orchestrator] Result: ${report.ok ? 'AUTONOMOUS-OPERATIONAL' : 'NEEDS ATTENTION'}`);
  console.log('\n' + JSON.stringify(report, null, 2));
}

main();
