#!/usr/bin/env node
/**
 * Runtime Autonomous Coordination Engine
 *
 * Automatically coordinates Runtime execution, recovery, congestion
 * balancing, emergency response, governance sync, and deploy sequencing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const SERVICE_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-service-state.json');
const ENV_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-environment-state.json');
const SUPERVISOR_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-trigger-supervisor-state.json');
const GOVERNANCE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-evolution-governance-result.json');
const AUTHORITY_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-command-authority-graph.json');
const TIMELINE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-command-timeline.json');
const RESULT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-autonomous-coordination-result.json');

function loadJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function saveJson(p, d) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n', 'utf8'); }

function coordinateExecution(supervisor, envState) {
  const total = supervisor?.totalExecutions ?? 0;
  const blocked = supervisor?.totalBlocked ?? 0;
  const queuePressure = envState?.pressure?.queue ?? 0;
  const actions = [];

  if (blocked > total && total > 0) actions.push({ action: 'relax-throttling', reason: 'More blocked than executed', priority: 'medium' });
  if (queuePressure > 60) actions.push({ action: 'queue-scale', reason: `Queue pressure ${queuePressure}%`, priority: 'high' });

  return { total, blocked, queuePressure, actions, autonomous: true };
}

function coordinateRecovery(serviceState) {
  const recoveries = serviceState?.recovery?.recoveryCount ?? 0;
  const crashes = serviceState?.crash?.crashCount ?? 0;
  const actions = [];

  if (crashes > 0 && recoveries === 0) actions.push({ action: 'initiate-recovery', reason: `${crashes} crashes, 0 recoveries`, priority: 'critical' });
  if (recoveries > 5) actions.push({ action: 'analyze-root-cause', reason: `${recoveries} recoveries — recurring issue`, priority: 'high' });

  return { recoveries, crashes, actions, autonomous: true };
}

function coordinateCongestion(envState) {
  const pressure = envState?.pressure ?? {};
  const composite = pressure.composite ?? 0;
  const actions = [];

  if (composite > 70) actions.push({ action: 'pressure-relief', reason: `Composite pressure ${composite}%`, priority: 'high' });
  if ((pressure.memory ?? 0) > 80) actions.push({ action: 'memory-relief', reason: `Memory pressure ${pressure.memory}%`, priority: 'high' });
  if ((pressure.deploy ?? 0) > 60) actions.push({ action: 'deploy-throttle', reason: `Deploy pressure ${pressure.deploy}%`, priority: 'medium' });

  return { composite, pressures: pressure, actions, autonomous: true };
}

function coordinateEmergencyResponse(serviceState, envState, authority) {
  const thresholds = authority?.emergencyAuthority?.activationThreshold ?? {};
  const crashes = serviceState?.crash?.crashCount ?? 0;
  const pressure = envState?.pressure?.composite ?? 0;
  const actions = [];

  const activated = crashes > (thresholds.crashes ?? 3) || pressure > (thresholds.pressure ?? 80);
  if (activated) {
    actions.push({ action: 'emergency-escalation', reason: 'Emergency thresholds breached', priority: 'critical' });
    actions.push({ action: 'isolate-propagation', reason: 'Prevent cascade failure', priority: 'critical' });
  }

  return { activated, crashes, pressure, actions, autonomous: activated };
}

function coordinateGovernanceSync(governance) {
  const locked = governance?.summary?.safetyLocks?.allEnforced ?? true;
  const canonical = governance?.registryCanonical ?? true;
  const blocked = governance?.summary?.blocked ?? 0;
  const actions = [];

  if (!locked) actions.push({ action: 'enforce-safety-locks', reason: 'Safety locks not enforced', priority: 'critical' });
  if (!canonical) actions.push({ action: 'restore-registry', reason: 'Registry not canonical', priority: 'critical' });
  if (blocked > 0) actions.push({ action: 'review-blocked-proposals', reason: `${blocked} proposals blocked`, priority: 'medium' });

  return { safetyLocked: locked, registryCanonical: canonical, blocked, actions, autonomous: true };
}

function coordinateDeploySequencing(supervisor, envState) {
  const paused = supervisor?.paused ?? false;
  const failures = supervisor?.consecutiveFailures ?? 0;
  const deployPressure = envState?.pressure?.deploy ?? 0;
  const actions = [];

  if (paused) actions.push({ action: 'evaluate-resume', reason: 'Deploy paused', priority: 'medium' });
  if (failures > 2) actions.push({ action: 'backoff-deploy', reason: `${failures} consecutive failures`, priority: 'high' });
  if (deployPressure > 50) actions.push({ action: 'sequence-deploys', reason: `Deploy pressure ${deployPressure}%`, priority: 'medium' });

  return { paused, failures, deployPressure, actions, autonomous: true };
}

export function runAutonomousCoordination() {
  const now = new Date().toISOString();

  const serviceState = loadJson(SERVICE_STATE_PATH);
  const envState = loadJson(ENV_STATE_PATH);
  const supervisor = loadJson(SUPERVISOR_PATH);
  const governance = loadJson(GOVERNANCE_PATH);
  const authority = loadJson(AUTHORITY_PATH);
  const timeline = loadJson(TIMELINE_PATH) ?? { events: [], counters: {} };

  const execution = coordinateExecution(supervisor, envState);
  const recovery = coordinateRecovery(serviceState);
  const congestion = coordinateCongestion(envState);
  const emergency = coordinateEmergencyResponse(serviceState, envState, authority);
  const govSync = coordinateGovernanceSync(governance);
  const deploy = coordinateDeploySequencing(supervisor, envState);

  const allActions = [
    ...execution.actions, ...recovery.actions, ...congestion.actions,
    ...emergency.actions, ...govSync.actions, ...deploy.actions,
  ];

  timeline.events = timeline.events ?? [];
  timeline.events.push({ type: 'autonomous-coordination', detail: `${allActions.length} actions`, timestamp: now });
  if (timeline.events.length > 200) timeline.events = timeline.events.slice(-200);
  timeline.counters.coordinationEvents = (timeline.counters.coordinationEvents ?? 0) + 1;
  timeline.lastUpdated = now;
  saveJson(TIMELINE_PATH, timeline);

  const result = {
    coordination: { execution, recovery, congestion, emergency, governanceSync: govSync, deploy },
    actions: allActions,
    summary: {
      totalActions: allActions.length,
      criticalActions: allActions.filter(a => a.priority === 'critical').length,
      highActions: allActions.filter(a => a.priority === 'high').length,
      emergencyActivated: emergency.activated,
      governanceSynced: govSync.safetyLocked && govSync.registryCanonical,
      autonomousMode: true,
    },
    timestamp: now,
  };

  saveJson(RESULT_PATH, result);
  return result;
}

if (process.argv[1]?.endsWith('runtimeAutonomousCoordinationEngine.mjs')) {
  console.log('[coordination] Runtime Autonomous Coordination Engine');
  console.log('='.repeat(55));

  const r = runAutonomousCoordination();

  console.log(`\n  Execution: ${r.coordination.execution.total} exec, ${r.coordination.execution.blocked} blocked`);
  console.log(`  Recovery: ${r.coordination.recovery.recoveries} recoveries, ${r.coordination.recovery.crashes} crashes`);
  console.log(`  Congestion: composite ${r.coordination.congestion.composite}%`);
  console.log(`  Emergency: ${r.summary.emergencyActivated ? 'ACTIVATED' : 'standby'}`);
  console.log(`  Governance: ${r.summary.governanceSynced ? 'synced' : 'NEEDS SYNC'}`);
  console.log(`  Deploy: ${r.coordination.deploy.paused ? 'PAUSED' : 'active'}, ${r.coordination.deploy.failures} failures`);

  if (r.actions.length > 0) {
    console.log(`\n  Actions (${r.summary.totalActions}):`);
    for (const a of r.actions) console.log(`    [${a.priority.toUpperCase()}] ${a.action}: ${a.reason}`);
  } else {
    console.log('\n  (no coordination actions needed)');
  }

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[coordination] ${r.summary.criticalActions === 0 ? 'COORDINATION STABLE' : 'COORDINATION ACTION REQUIRED'}`);
  console.log('\n' + JSON.stringify({ ok: true, ...r }, null, 2));
}
