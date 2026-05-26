#!/usr/bin/env node
/**
 * Runtime Loop Supervisor
 *
 * Prevents runaway execution, infinite repair loops, repeated deploy
 * loops, and runtime storm conditions. Throttles execution pressure.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { countSince, detectStorm, emit, EVENT_TYPES } from './runtimeEventBus.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const ORCHESTRATION_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-orchestration-state.json');

export const LIMITS = {
  maxRepairAttempts: 5,
  maxDeployAttempts: 3,
  maxRollbackAttempts: 2,
  maxDriftRetries: 10,
  maxRuntimePressure: 85,
  maxEventsPerHour: 60,
  stormThreshold: 20,
  stormWindowMs: 5 * 60 * 1000,
  cooldownMs: 2 * 60 * 1000,
};

export const SUPERVISOR_DECISIONS = {
  PROCEED: 'proceed',
  THROTTLE: 'throttle',
  COOLDOWN: 'cooldown',
  HALT: 'halt',
  MANUAL_REVIEW: 'manual_review_required',
};

export const EXTENDED_OP_MODES = {
  NORMAL: 'normal',
  GUARDED: 'guarded',
  REPAIR: 'repair',
  ROLLBACK: 'rollback',
  RESTRICTED: 'restricted',
  EMERGENCY: 'emergency',
  AUTONOMOUS: 'autonomous',
  SUPERVISED: 'supervised',
};

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * Evaluate loop safety. Returns { decision, reasons, limits }.
 */
export function evaluateLoopSafety() {
  const reasons = [];
  const violations = [];
  const oneHour = 60 * 60 * 1000;

  // Repair loop detection
  const repairCount = countSince(EVENT_TYPES.REPAIRED, oneHour);
  if (repairCount >= LIMITS.maxRepairAttempts) {
    violations.push({ limit: 'maxRepairAttempts', value: repairCount, max: LIMITS.maxRepairAttempts });
    reasons.push(`Repair attempts (${repairCount}) exceed limit (${LIMITS.maxRepairAttempts})`);
  }

  // Deploy loop detection
  const deployCount = countSince(EVENT_TYPES.DEPLOYED, oneHour);
  if (deployCount >= LIMITS.maxDeployAttempts) {
    violations.push({ limit: 'maxDeployAttempts', value: deployCount, max: LIMITS.maxDeployAttempts });
    reasons.push(`Deploy attempts (${deployCount}) exceed limit (${LIMITS.maxDeployAttempts})`);
  }

  // Rollback loop detection
  const rollbackCount = countSince(EVENT_TYPES.ROLLBACK, oneHour);
  if (rollbackCount >= LIMITS.maxRollbackAttempts) {
    violations.push({ limit: 'maxRollbackAttempts', value: rollbackCount, max: LIMITS.maxRollbackAttempts });
    reasons.push(`Rollback attempts (${rollbackCount}) exceed limit (${LIMITS.maxRollbackAttempts})`);
  }

  // Drift retry detection
  const driftCount = countSince(EVENT_TYPES.DRIFT, oneHour);
  if (driftCount >= LIMITS.maxDriftRetries) {
    violations.push({ limit: 'maxDriftRetries', value: driftCount, max: LIMITS.maxDriftRetries });
    reasons.push(`Drift retries (${driftCount}) exceed limit (${LIMITS.maxDriftRetries})`);
  }

  // Runtime pressure
  const snapshot = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-snapshot.json'));
  const pressure = snapshot?.governancePressure ?? 0;
  if (pressure >= LIMITS.maxRuntimePressure) {
    violations.push({ limit: 'maxRuntimePressure', value: pressure, max: LIMITS.maxRuntimePressure });
    reasons.push(`Governance pressure (${pressure}) exceeds limit (${LIMITS.maxRuntimePressure})`);
  }

  // Event rate limiting
  const totalEvents = countSince(null, oneHour);
  if (totalEvents >= LIMITS.maxEventsPerHour) {
    violations.push({ limit: 'maxEventsPerHour', value: totalEvents, max: LIMITS.maxEventsPerHour });
    reasons.push(`Event rate (${totalEvents}/hr) exceeds limit (${LIMITS.maxEventsPerHour})`);
  }

  // Storm detection
  const storm = detectStorm(LIMITS.stormWindowMs, LIMITS.stormThreshold);
  if (storm.detected) {
    violations.push({ limit: 'stormThreshold', value: storm.storms });
    reasons.push(`Event storm detected: ${storm.storms.map(s => `${s.type}=${s.count}`).join(', ')}`);
  }

  // Decision
  let decision;
  if (violations.some(v => v.limit === 'maxRollbackAttempts' || v.limit === 'stormThreshold')) {
    decision = SUPERVISOR_DECISIONS.HALT;
  } else if (violations.length >= 2) {
    decision = SUPERVISOR_DECISIONS.MANUAL_REVIEW;
  } else if (violations.length === 1) {
    decision = SUPERVISOR_DECISIONS.THROTTLE;
  } else if (pressure > 50) {
    decision = SUPERVISOR_DECISIONS.COOLDOWN;
    reasons.push(`Elevated pressure (${pressure}) — applying cooldown`);
  } else {
    decision = SUPERVISOR_DECISIONS.PROCEED;
  }

  // Derive operational mode
  let recommendedMode;
  switch (decision) {
    case SUPERVISOR_DECISIONS.HALT: recommendedMode = EXTENDED_OP_MODES.EMERGENCY; break;
    case SUPERVISOR_DECISIONS.MANUAL_REVIEW: recommendedMode = EXTENDED_OP_MODES.SUPERVISED; break;
    case SUPERVISOR_DECISIONS.THROTTLE: recommendedMode = EXTENDED_OP_MODES.GUARDED; break;
    case SUPERVISOR_DECISIONS.COOLDOWN: recommendedMode = EXTENDED_OP_MODES.GUARDED; break;
    default: recommendedMode = EXTENDED_OP_MODES.AUTONOMOUS; break;
  }

  return {
    decision,
    recommendedMode,
    violations,
    reasons,
    counters: { repair: repairCount, deploy: deployCount, rollback: rollbackCount, drift: driftCount, totalEvents, pressure },
    storm,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Update orchestration state with supervisor results.
 */
export function updateOrchestrationState(supervisorResult) {
  const current = loadJson(ORCHESTRATION_PATH) ?? {};
  const updated = {
    ...current,
    supervisorDecision: supervisorResult.decision,
    activeMode: supervisorResult.recommendedMode,
    supervisorCounters: supervisorResult.counters,
    violations: supervisorResult.violations.length,
    stormDetected: supervisorResult.storm.detected,
    timestamp: new Date().toISOString(),
  };
  saveJson(ORCHESTRATION_PATH, updated);
  return updated;
}

if (process.argv[1]?.endsWith('runtimeLoopSupervisor.mjs')) {
  console.log('[supervisor] Runtime Loop Supervisor');
  console.log('='.repeat(55));

  const result = evaluateLoopSafety();

  console.log(`\n  Decision: ${result.decision}`);
  console.log(`  Recommended mode: ${result.recommendedMode}`);
  console.log('\n  Counters:');
  for (const [k, v] of Object.entries(result.counters)) {
    console.log(`    ${k}: ${v}`);
  }

  if (result.violations.length > 0) {
    console.log(`\n  Violations (${result.violations.length}):`);
    for (const v of result.violations) console.log(`    ✕ ${v.limit}: ${v.value}/${v.max ?? '?'}`);
  }

  if (result.reasons.length > 0) {
    console.log(`\n  Reasons:`);
    for (const r of result.reasons) console.log(`    - ${r}`);
  }

  console.log(`\n  Storm: ${result.storm.detected ? 'DETECTED' : 'clear'}`);

  const orchState = updateOrchestrationState(result);

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[supervisor] ${result.decision.toUpperCase()}`);
  console.log('\n' + JSON.stringify(result, null, 2));
}
