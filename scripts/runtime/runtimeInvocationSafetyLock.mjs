#!/usr/bin/env node
/**
 * Runtime Invocation Safety Lock
 *
 * Final gate before Cursor Agent execution.
 * Blocks destructive, unauthorized, and unverified operations.
 * Requires manual approval for high-risk actions.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePayload, validateInstruction } from './runtimeInvocationSafetyLayer.mjs';
import { enforceBinding } from './runtimeCursorWorkspaceBinding.mjs';
import { evaluateAllPolicies, POLICY_STATES } from './runtimePolicyEngine.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const LOCK_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-invocation-lock-state.json');

export const LOCK_DECISIONS = {
  PROCEED: 'proceed',
  BLOCKED: 'blocked',
  MANUAL_APPROVAL: 'manual_approval',
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
 * Full safety lock evaluation for a payload before execution.
 */
export function evaluateSafetyLock(payload) {
  const checks = [];
  let decision = LOCK_DECISIONS.PROCEED;

  // 1. Workspace binding
  const binding = enforceBinding(payload);
  checks.push({ check: 'workspace-binding', pass: binding.allowed, detail: binding.allowed ? 'Bound to federation-control' : binding.reason });
  if (!binding.allowed) decision = LOCK_DECISIONS.BLOCKED;

  // 2. Payload safety
  const payloadSafety = validatePayload(payload);
  checks.push({ check: 'payload-safety', pass: payloadSafety.safe, detail: payloadSafety.safe ? 'No forbidden operations' : `${payloadSafety.blocked.length} blocked` });
  if (!payloadSafety.safe) decision = LOCK_DECISIONS.BLOCKED;

  // 3. Instruction safety
  if (payload?.instruction) {
    const instrSafety = validateInstruction(payload.instruction);
    checks.push({ check: 'instruction-safety', pass: instrSafety.safe, detail: instrSafety.safe ? 'Instruction safe' : `${instrSafety.blocked.length} blocked` });
    if (!instrSafety.safe) decision = LOCK_DECISIONS.BLOCKED;
    if (instrSafety.requiresManualReview && decision !== LOCK_DECISIONS.BLOCKED) {
      decision = LOCK_DECISIONS.MANUAL_APPROVAL;
      checks.push({ check: 'manual-review', pass: false, detail: `${instrSafety.review.length} items need manual review` });
    }
  }

  // 4. Governance policy
  const policies = evaluateAllPolicies();
  const deployPolicy = policies.policies.deploy;
  const repairPolicy = policies.policies.repair;

  if (deployPolicy === POLICY_STATES.BLOCKED || deployPolicy === POLICY_STATES.EMERGENCY) {
    checks.push({ check: 'governance-deploy', pass: false, detail: `Deploy policy: ${deployPolicy}` });
    if (decision !== LOCK_DECISIONS.BLOCKED) decision = LOCK_DECISIONS.BLOCKED;
  } else if (deployPolicy === POLICY_STATES.RESTRICTED) {
    checks.push({ check: 'governance-deploy', pass: false, detail: `Deploy policy: ${deployPolicy} — manual approval required` });
    if (decision === LOCK_DECISIONS.PROCEED) decision = LOCK_DECISIONS.MANUAL_APPROVAL;
  } else {
    checks.push({ check: 'governance-deploy', pass: true, detail: `Deploy policy: ${deployPolicy}` });
  }

  // 5. Execution mode validation
  if (payload?.executionMode === 'manual-review') {
    checks.push({ check: 'execution-mode', pass: false, detail: 'Execution mode requires manual review' });
    if (decision === LOCK_DECISIONS.PROCEED) decision = LOCK_DECISIONS.MANUAL_APPROVAL;
  } else {
    checks.push({ check: 'execution-mode', pass: true, detail: `Mode: ${payload?.executionMode ?? 'unknown'}` });
  }

  // 6. Push/deploy guards
  const allowsPush = payload?.allowedOperations?.includes('git-push');
  const allowsDeploy = payload?.allowedOperations?.includes('deploy');
  if (allowsPush || allowsDeploy) {
    const hasVerify = payload?.requiredValidation?.length > 0;
    if (!hasVerify) {
      checks.push({ check: 'verify-before-push', pass: false, detail: 'Push/deploy requested without required validation' });
      if (decision === LOCK_DECISIONS.PROCEED) decision = LOCK_DECISIONS.BLOCKED;
    } else {
      checks.push({ check: 'verify-before-push', pass: true, detail: 'Verification required before push/deploy' });
    }
  }

  const result = {
    decision,
    checks,
    blocked: checks.filter(c => !c.pass),
    governance: { mode: policies.operationalMode, deployPolicy, repairPolicy },
    timestamp: new Date().toISOString(),
  };

  saveJson(LOCK_STATE_PATH, result);
  return result;
}

if (process.argv[1]?.endsWith('runtimeInvocationSafetyLock.mjs')) {
  console.log('[safety-lock] Runtime Invocation Safety Lock');
  console.log('='.repeat(55));

  const payloadPath = path.resolve(REPO_ROOT, '.cursor/tasks/runtime-bridge-payload.json');
  const payload = loadJson(payloadPath);

  if (!payload) {
    console.log('[safety-lock] No payload found — run runtime:cursor-bridge first');
    const result = { decision: LOCK_DECISIONS.BLOCKED, reason: 'No payload', timestamp: new Date().toISOString() };
    console.log('\n' + JSON.stringify(result, null, 2));
  } else {
    const result = evaluateSafetyLock(payload);
    console.log(`\n  Decision: ${result.decision}`);
    for (const c of result.checks) {
      console.log(`  ${c.pass ? 'PASS' : 'FAIL'}: [${c.check}] ${c.detail}`);
    }
    console.log(`\n  Governance mode: ${result.governance.mode}`);
    console.log(`\n${'='.repeat(55)}`);
    console.log(`[safety-lock] ${result.decision.toUpperCase()}`);
    console.log('\n' + JSON.stringify(result, null, 2));
  }
}
