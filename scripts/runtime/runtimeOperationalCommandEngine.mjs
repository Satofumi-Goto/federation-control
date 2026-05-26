#!/usr/bin/env node
/**
 * Runtime Operational Command Engine
 *
 * Coordinates Runtime operational commands, cross-runtime authority,
 * emergency control, dispatch, recovery, repair, and governance escalation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const AUTHORITY_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-command-authority-graph.json');
const TIMELINE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-command-timeline.json');
const SERVICE_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-service-state.json');
const ENV_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-environment-state.json');
const SUPERVISOR_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-trigger-supervisor-state.json');
const GOVERNANCE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-evolution-governance-result.json');
const RESULT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-command-result.json');

function loadJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function saveJson(p, d) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n', 'utf8'); }

function evaluateCommandAuthority(authority) {
  if (!authority) return { operational: false, issue: 'Authority graph missing' };
  const nodes = authority.nodes ?? [];
  const platformCmd = nodes.find(n => n.id === 'platform-command');
  return {
    operational: !!platformCmd,
    nodes: nodes.length,
    levels: [...new Set(nodes.map(n => n.level))].length,
    controlFlows: authority.controlAuthority?.length ?? 0,
    escalationPaths: authority.escalationAuthority?.length ?? 0,
  };
}

function coordinateCrossRuntimeAuthority(authority) {
  const escalation = authority?.escalationAuthority ?? [];
  const autoEscalations = escalation.filter(e => e.auto);
  const manualEscalations = escalation.filter(e => !e.auto);
  return {
    totalPaths: escalation.length,
    autoEscalations: autoEscalations.length,
    manualEscalations: manualEscalations.length,
    paths: escalation.map(e => ({ from: e.from, to: e.to, trigger: e.trigger, auto: e.auto })),
  };
}

function evaluateEmergencyControl(authority, serviceState, envState) {
  const emergency = authority?.emergencyAuthority ?? {};
  const thresholds = emergency.activationThreshold ?? {};
  const pressure = envState?.pressure?.composite ?? 0;
  const crashes = serviceState?.crash?.crashCount ?? 0;
  const failures = serviceState?.recovery?.recoveryCount ?? 0;

  const activated = pressure > (thresholds.pressure ?? 80) ||
    crashes > (thresholds.crashes ?? 3) ||
    failures > (thresholds.consecutiveFailures ?? 5);

  return {
    controller: emergency.controller ?? null,
    activated,
    pressure,
    crashes,
    overrideTargets: emergency.overrideTargets?.length ?? 0,
    protectedTargets: emergency.protectedTargets?.length ?? 0,
  };
}

function evaluateDispatchAuthority(authority, supervisor) {
  const deploy = authority?.deployAuthority ?? {};
  const totalExec = supervisor?.totalExecutions ?? 0;
  const blocked = supervisor?.totalBlocked ?? 0;
  return {
    approver: deploy.approver ?? null,
    executor: deploy.executor ?? null,
    requiresApproval: deploy.requiresApproval ?? true,
    executionsTotal: totalExec,
    executionsBlocked: blocked,
    throughputEfficiency: (totalExec + blocked) > 0 ? Math.round((totalExec / (totalExec + blocked)) * 100) : 100,
  };
}

function evaluateRecoveryAuthority(authority, serviceState) {
  const repair = authority?.repairAuthority ?? {};
  const recoveries = serviceState?.recovery?.recoveryCount ?? 0;
  const crashes = serviceState?.crash?.crashCount ?? 0;
  return {
    detector: repair.detector ?? null,
    executor: repair.executor ?? null,
    escalation: repair.escalation ?? null,
    maxAutonomousCycles: repair.maxAutonomousCycles ?? 3,
    currentRecoveries: recoveries,
    currentCrashes: crashes,
    withinLimits: recoveries <= (repair.maxAutonomousCycles ?? 3),
  };
}

function evaluateRepairAuthority(authority) {
  const repair = authority?.repairAuthority ?? {};
  return {
    configured: !!repair.executor,
    executor: repair.executor ?? null,
    maxCycles: repair.maxAutonomousCycles ?? 3,
  };
}

function evaluateGovernanceEscalation(governance) {
  return {
    safetyLocksEnforced: governance?.summary?.safetyLocks?.allEnforced ?? true,
    registryCanonical: governance?.registryCanonical ?? true,
    blocked: governance?.summary?.blocked ?? 0,
    escalationNeeded: (governance?.summary?.blocked ?? 0) > 0,
  };
}

function recordTimelineEvent(timeline, type, detail) {
  const now = new Date().toISOString();
  timeline.events = timeline.events ?? [];
  timeline.events.push({ type, detail, timestamp: now });
  if (timeline.events.length > 200) timeline.events = timeline.events.slice(-200);
  timeline.counters = timeline.counters ?? {};
  timeline.counters.commandsIssued = (timeline.counters.commandsIssued ?? 0) + 1;
  timeline.lastEvent = now;
  timeline.lastUpdated = now;
}

export function runOperationalCommand() {
  const now = new Date().toISOString();

  const authority = loadJson(AUTHORITY_PATH);
  const timeline = loadJson(TIMELINE_PATH) ?? { events: [], counters: {} };
  const serviceState = loadJson(SERVICE_STATE_PATH);
  const envState = loadJson(ENV_STATE_PATH);
  const supervisor = loadJson(SUPERVISOR_PATH);
  const governance = loadJson(GOVERNANCE_PATH);

  const commandAuth = evaluateCommandAuthority(authority);
  const crossRuntime = coordinateCrossRuntimeAuthority(authority);
  const emergency = evaluateEmergencyControl(authority, serviceState, envState);
  const dispatch = evaluateDispatchAuthority(authority, supervisor);
  const recovery = evaluateRecoveryAuthority(authority, serviceState);
  const repair = evaluateRepairAuthority(authority);
  const govEscalation = evaluateGovernanceEscalation(governance);

  recordTimelineEvent(timeline, 'command-evaluation', `authority=${commandAuth.operational}, emergency=${emergency.activated}`);
  saveJson(TIMELINE_PATH, timeline);

  const result = {
    command: { authority: commandAuth, crossRuntime, emergency, dispatch, recovery, repair, governanceEscalation: govEscalation },
    summary: {
      authorityOperational: commandAuth.operational,
      emergencyActivated: emergency.activated,
      governanceEnforced: govEscalation.safetyLocksEnforced,
      registryCanonical: govEscalation.registryCanonical,
      dispatchEfficiency: dispatch.throughputEfficiency,
      recoveryWithinLimits: recovery.withinLimits,
    },
    timestamp: now,
  };

  saveJson(RESULT_PATH, result);
  return result;
}

if (process.argv[1]?.endsWith('runtimeOperationalCommandEngine.mjs')) {
  console.log('[command] Runtime Operational Command Engine');
  console.log('='.repeat(55));

  const r = runOperationalCommand();

  console.log(`\n  Authority: ${r.summary.authorityOperational ? 'OPERATIONAL' : 'NOT OPERATIONAL'} (${r.command.authority.nodes} nodes, ${r.command.authority.levels} levels)`);
  console.log(`  Cross-runtime: ${r.command.crossRuntime.totalPaths} paths (${r.command.crossRuntime.autoEscalations} auto)`);
  console.log(`  Emergency: ${r.summary.emergencyActivated ? 'ACTIVATED' : 'standby'} (pressure=${r.command.emergency.pressure})`);
  console.log(`  Dispatch: efficiency ${r.summary.dispatchEfficiency}%`);
  console.log(`  Recovery: ${r.summary.recoveryWithinLimits ? 'within limits' : 'EXCEEDED'} (${r.command.recovery.currentRecoveries} recoveries)`);
  console.log(`  Governance: ${r.summary.governanceEnforced ? 'enforced' : 'NOT ENFORCED'}`);
  console.log(`  Registry: ${r.summary.registryCanonical ? 'canonical' : 'NOT CANONICAL'}`);

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[command] ${r.summary.authorityOperational && r.summary.governanceEnforced ? 'COMMAND OPERATIONAL' : 'COMMAND NEEDS ATTENTION'}`);
  console.log('\n' + JSON.stringify({ ok: true, ...r }, null, 2));
}
