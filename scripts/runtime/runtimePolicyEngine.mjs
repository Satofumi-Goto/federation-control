#!/usr/bin/env node
/**
 * Runtime Policy Engine
 *
 * Evaluates governance policies across deploy, repair, rollback,
 * registry mutation, topology mutation, federation propagation,
 * and Runtime card creation domains.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const SNAPSHOT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-snapshot.json');
const AUDIT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-repair-audit-log.json');

export const POLICY_STATES = {
  ALLOWED: 'allowed',
  GUARDED: 'guarded',
  RESTRICTED: 'restricted',
  BLOCKED: 'blocked',
  EMERGENCY: 'emergency',
};

export const OP_MODES = {
  NORMAL: 'normal',
  GUARDED: 'guarded',
  REPAIR: 'repair',
  ROLLBACK: 'rollback',
  RESTRICTED: 'restricted',
  EMERGENCY: 'emergency',
};

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function deriveOperationalMode(snapshot, auditLog) {
  if (!snapshot) return OP_MODES.RESTRICTED;

  const recentEntries = (auditLog ?? []).slice(-5);
  const recentFailures = recentEntries.filter(e => !e.verificationPass).length;
  const recentBlocks = recentEntries.filter(e => e.decision === 'block').length;

  if (recentBlocks > 0) return OP_MODES.EMERGENCY;
  if (snapshot.repairDecision === 'rollback') return OP_MODES.ROLLBACK;
  if (snapshot.repairDecision === 'manual_review') return OP_MODES.REPAIR;
  if (recentFailures >= 2) return OP_MODES.RESTRICTED;
  if (snapshot.state === 'warning' || snapshot.repairProposals > 0) return OP_MODES.GUARDED;
  if (snapshot.state === 'healthy' && snapshot.verificationPass) return OP_MODES.NORMAL;

  return OP_MODES.GUARDED;
}

function evaluateDeployPolicy(mode) {
  const map = {
    [OP_MODES.NORMAL]: POLICY_STATES.ALLOWED,
    [OP_MODES.GUARDED]: POLICY_STATES.GUARDED,
    [OP_MODES.REPAIR]: POLICY_STATES.RESTRICTED,
    [OP_MODES.ROLLBACK]: POLICY_STATES.BLOCKED,
    [OP_MODES.RESTRICTED]: POLICY_STATES.BLOCKED,
    [OP_MODES.EMERGENCY]: POLICY_STATES.EMERGENCY,
  };
  return map[mode] ?? POLICY_STATES.BLOCKED;
}

function evaluateRepairPolicy(mode) {
  const map = {
    [OP_MODES.NORMAL]: POLICY_STATES.ALLOWED,
    [OP_MODES.GUARDED]: POLICY_STATES.ALLOWED,
    [OP_MODES.REPAIR]: POLICY_STATES.ALLOWED,
    [OP_MODES.ROLLBACK]: POLICY_STATES.GUARDED,
    [OP_MODES.RESTRICTED]: POLICY_STATES.RESTRICTED,
    [OP_MODES.EMERGENCY]: POLICY_STATES.EMERGENCY,
  };
  return map[mode] ?? POLICY_STATES.RESTRICTED;
}

function evaluateRollbackPolicy(mode, snapshot) {
  if (mode === OP_MODES.EMERGENCY) return POLICY_STATES.EMERGENCY;
  if (mode === OP_MODES.ROLLBACK) return POLICY_STATES.ALLOWED;
  if (!snapshot?.verificationPass) return POLICY_STATES.GUARDED;
  return POLICY_STATES.RESTRICTED;
}

function evaluateRegistryMutationPolicy(mode) {
  const map = {
    [OP_MODES.NORMAL]: POLICY_STATES.ALLOWED,
    [OP_MODES.GUARDED]: POLICY_STATES.GUARDED,
    [OP_MODES.REPAIR]: POLICY_STATES.RESTRICTED,
    [OP_MODES.ROLLBACK]: POLICY_STATES.BLOCKED,
    [OP_MODES.RESTRICTED]: POLICY_STATES.BLOCKED,
    [OP_MODES.EMERGENCY]: POLICY_STATES.BLOCKED,
  };
  return map[mode] ?? POLICY_STATES.BLOCKED;
}

function evaluateTopologyMutationPolicy(mode) {
  const map = {
    [OP_MODES.NORMAL]: POLICY_STATES.ALLOWED,
    [OP_MODES.GUARDED]: POLICY_STATES.RESTRICTED,
    [OP_MODES.REPAIR]: POLICY_STATES.BLOCKED,
    [OP_MODES.ROLLBACK]: POLICY_STATES.BLOCKED,
    [OP_MODES.RESTRICTED]: POLICY_STATES.BLOCKED,
    [OP_MODES.EMERGENCY]: POLICY_STATES.BLOCKED,
  };
  return map[mode] ?? POLICY_STATES.BLOCKED;
}

function evaluatePropagationPolicy(mode) {
  const map = {
    [OP_MODES.NORMAL]: POLICY_STATES.ALLOWED,
    [OP_MODES.GUARDED]: POLICY_STATES.GUARDED,
    [OP_MODES.REPAIR]: POLICY_STATES.GUARDED,
    [OP_MODES.ROLLBACK]: POLICY_STATES.RESTRICTED,
    [OP_MODES.RESTRICTED]: POLICY_STATES.BLOCKED,
    [OP_MODES.EMERGENCY]: POLICY_STATES.EMERGENCY,
  };
  return map[mode] ?? POLICY_STATES.BLOCKED;
}

function evaluateCardCreationPolicy(mode) {
  const map = {
    [OP_MODES.NORMAL]: POLICY_STATES.ALLOWED,
    [OP_MODES.GUARDED]: POLICY_STATES.ALLOWED,
    [OP_MODES.REPAIR]: POLICY_STATES.RESTRICTED,
    [OP_MODES.ROLLBACK]: POLICY_STATES.BLOCKED,
    [OP_MODES.RESTRICTED]: POLICY_STATES.BLOCKED,
    [OP_MODES.EMERGENCY]: POLICY_STATES.BLOCKED,
  };
  return map[mode] ?? POLICY_STATES.BLOCKED;
}

/**
 * Evaluate all policies for the current runtime state.
 */
export function evaluateAllPolicies() {
  const snapshot = loadJson(SNAPSHOT_PATH);
  const auditLog = loadJson(AUDIT_PATH) ?? [];
  const mode = deriveOperationalMode(snapshot, auditLog);

  return {
    operationalMode: mode,
    policies: {
      deploy: evaluateDeployPolicy(mode),
      repair: evaluateRepairPolicy(mode),
      rollback: evaluateRollbackPolicy(mode, snapshot),
      registryMutation: evaluateRegistryMutationPolicy(mode),
      topologyMutation: evaluateTopologyMutationPolicy(mode),
      propagation: evaluatePropagationPolicy(mode),
      cardCreation: evaluateCardCreationPolicy(mode),
    },
    snapshot: snapshot ? { state: snapshot.state, verificationPass: snapshot.verificationPass } : null,
    recentAuditCount: auditLog.length,
  };
}

export { deriveOperationalMode };

if (process.argv[1]?.endsWith('runtimePolicyEngine.mjs')) {
  const result = evaluateAllPolicies();
  console.log('[policy] Runtime Policy Engine');
  console.log(`[policy] Operational Mode: ${result.operationalMode}`);
  console.log('[policy] Policies:');
  for (const [domain, state] of Object.entries(result.policies)) {
    console.log(`  ${domain}: ${state}`);
  }
  console.log('\n' + JSON.stringify(result, null, 2));
}
