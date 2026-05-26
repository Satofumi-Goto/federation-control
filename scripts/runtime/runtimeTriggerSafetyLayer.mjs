#!/usr/bin/env node
/**
 * Runtime Trigger Safety Layer
 *
 * Guards automatic trigger execution. Blocks when the Runtime is in
 * an unsafe state, and requires manual approval for destructive actions.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateAllPolicies, POLICY_STATES } from './runtimePolicyEngine.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

const DESTRUCTIVE_PATTERNS = [
  /\bdelete\s+(all|entire|every)\b/i,
  /\brm\s+-rf\b/i,
  /\bgit\s+push\s+--force\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bdrop\s+(table|database)\b/i,
  /\breplace\s+(all|entire)\s+canonical\b/i,
  /\bremove\s+(runtime\s+)?registry\b/i,
  /\bcredential\s+(modify|replace|delete|overwrite)\b/i,
  /\brewrite\s+(entire|all|whole)\s+repo\b/i,
];

const MANUAL_APPROVAL_PATTERNS = [
  /\bdeploy\s+to\s+production\b/i,
  /\bcanonical\s+replacement\b/i,
  /\bmodify\s+credential/i,
  /\bsecret\s+(update|change|rotate)/i,
  /\bgit\s+push\b/i,
  /\brelease\b/i,
];

export function evaluateTriggerSafety(instruction) {
  const checks = [];
  let decision = 'allow';
  const blockers = [];
  const approvals = [];

  // 1. Governance mode check
  const policies = evaluateAllPolicies();
  const opMode = policies.operationalMode;
  if (opMode === 'emergency' || opMode === 'lockdown') {
    checks.push({ check: 'governance-mode', pass: false, detail: `Governance mode: ${opMode}` });
    decision = 'block';
    blockers.push(`Runtime governance in ${opMode} mode`);
  } else {
    checks.push({ check: 'governance-mode', pass: true, detail: `Governance mode: ${opMode}` });
  }

  // 2. Pressure check
  const snapshot = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-snapshot.json'));
  const pressure = snapshot?.governancePressure?.composite ?? snapshot?.pressure ?? 0;
  if (pressure > 80) {
    checks.push({ check: 'pressure', pass: false, detail: `Pressure: ${pressure} (>80 threshold)` });
    decision = 'block';
    blockers.push(`Runtime pressure too high: ${pressure}`);
  } else {
    checks.push({ check: 'pressure', pass: true, detail: `Pressure: ${pressure}` });
  }

  // 3. Drift check
  const driftState = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-drift-monitor-state.json'));
  const unresolvedDrifts = driftState?.drifts?.filter(d => d.status === 'unresolved')?.length ?? 0;
  if (unresolvedDrifts > 3) {
    checks.push({ check: 'drift', pass: false, detail: `Unresolved drifts: ${unresolvedDrifts}` });
    decision = 'block';
    blockers.push(`${unresolvedDrifts} unresolved drifts`);
  } else {
    checks.push({ check: 'drift', pass: true, detail: `Unresolved drifts: ${unresolvedDrifts}` });
  }

  // 4. Registry consistency
  const registry = loadJson(path.resolve(REPO_ROOT, 'src/runtime/registry/runtimeRegistryData.json'));
  if (!registry || !Array.isArray(registry) || registry.length < 5) {
    checks.push({ check: 'registry', pass: false, detail: 'Registry inconsistent or missing cards' });
    decision = 'block';
    blockers.push('Runtime Registry inconsistent');
  } else {
    checks.push({ check: 'registry', pass: true, detail: `Registry: ${registry.length} cards` });
  }

  // 5. Destructive pattern detection
  if (instruction) {
    const destructive = DESTRUCTIVE_PATTERNS.filter(p => p.test(instruction));
    if (destructive.length > 0) {
      checks.push({ check: 'destructive', pass: false, detail: `${destructive.length} destructive pattern(s) detected` });
      decision = 'block';
      blockers.push('Forbidden destructive operations detected');
    } else {
      checks.push({ check: 'destructive', pass: true, detail: 'No destructive patterns' });
    }

    // 6. Manual approval patterns
    const needsApproval = MANUAL_APPROVAL_PATTERNS.filter(p => p.test(instruction));
    if (needsApproval.length > 0) {
      checks.push({ check: 'manual-approval', pass: false, detail: `${needsApproval.length} action(s) require manual approval` });
      if (decision === 'allow') decision = 'manual-approval';
      approvals.push(...needsApproval.map(p => p.source));
    } else {
      checks.push({ check: 'manual-approval', pass: true, detail: 'No manual approval required' });
    }
  }

  // 7. Payload well-formedness
  if (!instruction || instruction.trim().length < 10) {
    checks.push({ check: 'payload', pass: false, detail: 'Instruction too short or empty' });
    decision = 'block';
    blockers.push('Payload malformed or empty');
  } else {
    checks.push({ check: 'payload', pass: true, detail: `Instruction: ${instruction.length} chars` });
  }

  return { decision, checks, blockers, approvals, governance: { mode: opMode, pressure }, timestamp: new Date().toISOString() };
}

if (process.argv[1]?.endsWith('runtimeTriggerSafetyLayer.mjs')) {
  console.log('[trigger-safety] Runtime Trigger Safety Layer');
  console.log('='.repeat(55));

  const testInstruction = process.argv[2] ?? 'Verify Runtime Registry consistency and run build verification.';
  const result = evaluateTriggerSafety(testInstruction);

  for (const c of result.checks) {
    console.log(`  ${c.pass ? 'PASS' : 'FAIL'}: [${c.check}] ${c.detail}`);
  }
  console.log(`\n  Decision: ${result.decision}`);
  if (result.blockers.length > 0) {
    console.log('  Blockers:');
    for (const b of result.blockers) console.log(`    → ${b}`);
  }
  console.log('\n' + JSON.stringify(result, null, 2));
}
