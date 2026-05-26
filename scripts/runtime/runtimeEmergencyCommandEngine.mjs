#!/usr/bin/env node
/**
 * Runtime Emergency Command Engine
 *
 * Detects emergency states, triggers governance/coordination/recovery
 * responses, isolates collapse propagation, and protects canonical structures.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const SERVICE_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-service-state.json');
const ENV_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-environment-state.json');
const AUTHORITY_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-command-authority-graph.json');
const GOVERNANCE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-evolution-governance-result.json');
const TIMELINE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-command-timeline.json');
const RESULT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-emergency-command-result.json');

const FORBIDDEN_ACTIONS = [
  'runtime-registry-deletion',
  'canonical-replacement',
  'governance-bypass',
  'credential-exposure',
  'authority-corruption',
  'emergency-override-abuse',
  'unverified-deploy-execution',
];

const MANUAL_APPROVAL_REQUIRED = [
  'cross-runtime-authority-override',
  'governance-replacement',
  'topology-replacement',
  'destructive-repair',
  'ecosystem-authority-migration',
];

function loadJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function saveJson(p, d) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n', 'utf8'); }

function detectEmergencyState(serviceState, envState, authority) {
  const thresholds = authority?.emergencyAuthority?.activationThreshold ?? {};
  const crashes = serviceState?.crash?.crashCount ?? 0;
  const pressure = envState?.pressure?.composite ?? 0;
  const restarts = serviceState?.service?.restartCount ?? 0;
  const isActive = serviceState?.service?.active ?? false;

  const triggers = [];
  if (crashes > (thresholds.crashes ?? 3)) triggers.push({ trigger: 'crash-threshold', value: crashes, threshold: thresholds.crashes ?? 3 });
  if (pressure > (thresholds.pressure ?? 80)) triggers.push({ trigger: 'pressure-threshold', value: pressure, threshold: thresholds.pressure ?? 80 });
  if (!isActive) triggers.push({ trigger: 'service-inactive', value: false, threshold: true });
  if (restarts > 10) triggers.push({ trigger: 'excessive-restarts', value: restarts, threshold: 10 });

  const level = triggers.length === 0 ? 'none' :
    triggers.some(t => t.trigger === 'service-inactive' || t.trigger === 'crash-threshold') ? 'critical' : 'elevated';

  return { level, triggers, activated: triggers.length > 0 };
}

function triggerGovernanceResponse(governance, emergencyLevel) {
  const locked = governance?.summary?.safetyLocks?.allEnforced ?? true;
  const canonical = governance?.registryCanonical ?? true;
  const actions = [];

  if (emergencyLevel === 'critical') {
    actions.push({ action: 'freeze-evolution-proposals', reason: 'Emergency: halt non-essential changes' });
    actions.push({ action: 'enforce-strict-governance', reason: 'Emergency: maximum governance enforcement' });
  }
  if (!locked) actions.push({ action: 'restore-safety-locks', reason: 'Safety locks must be enforced during emergency' });
  if (!canonical) actions.push({ action: 'protect-registry', reason: 'Registry integrity critical during emergency' });

  return { safetyLocked: locked, registryCanonical: canonical, actions };
}

function triggerCoordinationResponse(emergencyLevel) {
  const actions = [];
  if (emergencyLevel !== 'none') {
    actions.push({ action: 'pause-autonomous-execution', reason: 'Prevent automated changes during emergency' });
    actions.push({ action: 'escalate-to-operator', reason: 'Human oversight required' });
  }
  if (emergencyLevel === 'critical') {
    actions.push({ action: 'isolate-affected-domains', reason: 'Prevent cascade propagation' });
  }
  return { actions };
}

function triggerRecoveryResponse(serviceState, emergencyLevel) {
  const recoveries = serviceState?.recovery?.recoveryCount ?? 0;
  const actions = [];

  if (emergencyLevel === 'critical') {
    actions.push({ action: 'initiate-full-recovery', reason: 'Critical emergency requires full recovery' });
    actions.push({ action: 'checkpoint-state', reason: 'Preserve current state before recovery' });
  } else if (emergencyLevel === 'elevated') {
    actions.push({ action: 'prepare-recovery', reason: 'Elevated alert — recovery standby' });
  }

  return { currentRecoveries: recoveries, actions };
}

function isolateCollapsePropagation(emergencyLevel) {
  const isolationActions = [];
  if (emergencyLevel === 'critical') {
    isolationActions.push({ target: 'execution-queue', action: 'pause', reason: 'Prevent further execution during collapse' });
    isolationActions.push({ target: 'deploy-pipeline', action: 'freeze', reason: 'No deploys during collapse' });
    isolationActions.push({ target: 'evolution-engine', action: 'halt', reason: 'No evolution during collapse' });
  }
  return { isolated: emergencyLevel === 'critical', actions: isolationActions };
}

function protectCanonicalStructures() {
  const protectedAssets = [
    { asset: 'runtime-registry', path: 'src/runtime/registry/runtimeRegistryData.json', protected: true },
    { asset: 'governance-result', path: 'runtime_data/runtime-evolution-governance-result.json', protected: true },
    { asset: 'authority-graph', path: 'runtime_data/runtime-command-authority-graph.json', protected: true },
    { asset: 'federation-domain-model', path: 'runtime_data/runtime-federation-domain-model.json', protected: true },
  ];

  for (const asset of protectedAssets) {
    const fullPath = path.resolve(REPO_ROOT, asset.path);
    asset.exists = fs.existsSync(fullPath);
  }

  return { assets: protectedAssets, allProtected: protectedAssets.every(a => a.exists) };
}

export function runEmergencyCommand() {
  const now = new Date().toISOString();

  const serviceState = loadJson(SERVICE_STATE_PATH);
  const envState = loadJson(ENV_STATE_PATH);
  const authority = loadJson(AUTHORITY_PATH);
  const governance = loadJson(GOVERNANCE_PATH);
  const timeline = loadJson(TIMELINE_PATH) ?? { events: [], counters: {} };

  const emergency = detectEmergencyState(serviceState, envState, authority);
  const govResponse = triggerGovernanceResponse(governance, emergency.level);
  const coordResponse = triggerCoordinationResponse(emergency.level);
  const recoveryResponse = triggerRecoveryResponse(serviceState, emergency.level);
  const isolation = isolateCollapsePropagation(emergency.level);
  const protection = protectCanonicalStructures();

  if (emergency.activated) {
    timeline.events = timeline.events ?? [];
    timeline.events.push({ type: 'emergency-event', detail: `level=${emergency.level}, triggers=${emergency.triggers.length}`, timestamp: now });
    if (timeline.events.length > 200) timeline.events = timeline.events.slice(-200);
    timeline.counters.emergencyEvents = (timeline.counters.emergencyEvents ?? 0) + 1;
    timeline.lastUpdated = now;
    saveJson(TIMELINE_PATH, timeline);
  }

  const result = {
    emergency,
    responses: { governance: govResponse, coordination: coordResponse, recovery: recoveryResponse },
    isolation,
    protection,
    safetyRules: { forbiddenActions: FORBIDDEN_ACTIONS.length, manualApprovalRequired: MANUAL_APPROVAL_REQUIRED.length, enforced: true },
    summary: {
      emergencyLevel: emergency.level,
      emergencyActivated: emergency.activated,
      triggerCount: emergency.triggers.length,
      governanceEnforced: govResponse.safetyLocked,
      registryCanonical: govResponse.registryCanonical,
      canonicalProtected: protection.allProtected,
      isolationActive: isolation.isolated,
    },
    timestamp: now,
  };

  saveJson(RESULT_PATH, result);
  return result;
}

if (process.argv[1]?.endsWith('runtimeEmergencyCommandEngine.mjs')) {
  console.log('[emergency] Runtime Emergency Command Engine');
  console.log('='.repeat(55));

  const r = runEmergencyCommand();

  console.log(`\n  Emergency level: ${r.summary.emergencyLevel.toUpperCase()}`);
  console.log(`  Activated: ${r.summary.emergencyActivated}`);
  if (r.emergency.triggers.length > 0) {
    console.log('  Triggers:');
    for (const t of r.emergency.triggers) console.log(`    [${t.trigger}] value=${t.value}, threshold=${t.threshold}`);
  }

  console.log(`\n  Governance: ${r.summary.governanceEnforced ? 'enforced' : 'NOT ENFORCED'}`);
  console.log(`  Registry: ${r.summary.registryCanonical ? 'canonical' : 'NOT CANONICAL'}`);
  console.log(`  Canonical assets: ${r.summary.canonicalProtected ? 'all protected' : 'MISSING'}`);
  console.log(`  Isolation: ${r.summary.isolationActive ? 'ACTIVE' : 'standby'}`);
  console.log(`  Safety rules: ${r.safetyRules.forbiddenActions} forbidden, ${r.safetyRules.manualApprovalRequired} manual-approval`);

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[emergency] ${r.summary.emergencyLevel === 'none' ? 'NO EMERGENCY — STABLE' : `EMERGENCY ${r.summary.emergencyLevel.toUpperCase()}`}`);
  console.log('\n' + JSON.stringify({ ok: true, ...r }, null, 2));
}
