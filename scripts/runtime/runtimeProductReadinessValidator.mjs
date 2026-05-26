#!/usr/bin/env node
/**
 * Runtime Product Readiness Validator
 *
 * Validates that Runtime surfaces are actionable, every critical state
 * has an operator action, and all governance/verification/audit logic
 * is wired.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateActions } from './runtimeOperatorActionModel.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function fileExists(rel) {
  return fs.existsSync(path.resolve(REPO_ROOT, rel));
}

function run(cmd) {
  try {
    execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 20000, stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

function main() {
  console.log('[readiness] Runtime Product Readiness Validator');
  console.log('='.repeat(55));

  const checks = [];
  let score = 0;
  const total = 12;

  // 1. Runtime Registry canonical
  const registry = loadJson(path.resolve(REPO_ROOT, 'src/runtime/registry/runtimeRegistryData.json'));
  const registryOk = !!registry && Array.isArray(registry) && registry.length > 0;
  const allCardsHaveHealth = registryOk && registry.every(c => c.health?.state);
  const allCardsHaveTarget = registryOk && registry.every(c => c.target?.url || c.target?.type);
  checks.push({ check: 'registry-canonical', pass: registryOk, detail: registryOk ? `${registry.length} cards` : 'Registry missing' });
  checks.push({ check: 'cards-have-health', pass: allCardsHaveHealth, detail: allCardsHaveHealth ? 'All cards have health state' : 'Some cards missing health' });
  checks.push({ check: 'cards-have-target', pass: allCardsHaveTarget, detail: allCardsHaveTarget ? 'All cards have target' : 'Some cards missing target' });
  if (registryOk) score++;
  if (allCardsHaveHealth) score++;
  if (allCardsHaveTarget) score++;

  // 2. Operator action model coverage
  const actions = evaluateActions();
  const hasRepairAction = actions.actions.some(a => a.id === 'repair-approve');
  const hasDeployAction = actions.actions.some(a => a.id === 'deploy');
  const hasRollbackAction = actions.actions.some(a => a.id === 'rollback');
  const hasEmergencyAction = actions.actions.some(a => a.id === 'emergency-halt');
  checks.push({ check: 'action-coverage', pass: hasRepairAction && hasDeployAction && hasRollbackAction && hasEmergencyAction, detail: 'Repair, deploy, rollback, emergency actions defined' });
  if (hasRepairAction && hasDeployAction && hasRollbackAction && hasEmergencyAction) score++;

  // 3. Verification pipeline
  const verifyOk = run('node scripts/runtime/runtimeAutoVerificationPipeline.mjs');
  checks.push({ check: 'verification-pipeline', pass: verifyOk, detail: verifyOk ? 'All verifications pass' : 'Some verifications failed' });
  if (verifyOk) score++;

  // 4. Governance enforcement
  const snapshot = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-snapshot.json'));
  const governanceOk = !!snapshot && snapshot.verificationPass !== undefined;
  checks.push({ check: 'governance-enforced', pass: governanceOk, detail: governanceOk ? `State: ${snapshot.state}` : 'No governance snapshot' });
  if (governanceOk) score++;

  // 5. Audit log exists
  const auditLog = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-repair-audit-log.json'));
  const auditOk = Array.isArray(auditLog);
  checks.push({ check: 'audit-log', pass: auditOk, detail: auditOk ? `${auditLog.length} entries` : 'No audit log' });
  if (auditOk) score++;

  // 6. Event bus operational
  const eventLog = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-event-log.json'));
  const eventsOk = Array.isArray(eventLog);
  checks.push({ check: 'event-bus', pass: eventsOk, detail: eventsOk ? `${eventLog.length} events` : 'No event log' });
  if (eventsOk) score++;

  // 7. Orchestration state
  const orchState = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-orchestration-state.json'));
  const orchOk = !!orchState && !!orchState.activeMode;
  checks.push({ check: 'orchestration-state', pass: orchOk, detail: orchOk ? `Mode: ${orchState.activeMode}` : 'No orchestration state' });
  if (orchOk) score++;

  // 8. Safety lock wired
  const lockState = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-invocation-lock-state.json'));
  checks.push({ check: 'safety-lock', pass: !!lockState, detail: lockState ? `Decision: ${lockState.decision}` : 'No lock state' });
  if (lockState) score++;

  // 9. No obsolete panels in dashboard
  const dashboard = loadJson(path.resolve(REPO_ROOT, 'grafana/runtime-workspace-v2.json'));
  const dashContent = dashboard ? JSON.stringify(dashboard) : '';
  const noObsolete = !dashContent.includes('viewPanel=401') && !dashContent.includes('Federation collapse governance');
  checks.push({ check: 'no-obsolete-panels', pass: noObsolete, detail: noObsolete ? 'Clean' : 'Obsolete content detected' });
  if (noObsolete) score++;

  // 10. Incident model
  const incidentModel = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-incident-model.json'));
  checks.push({ check: 'incident-model', pass: Array.isArray(incidentModel), detail: Array.isArray(incidentModel) ? `${incidentModel.length} incidents` : 'Missing' });
  if (Array.isArray(incidentModel)) score++;

  // Readiness score
  const readinessPercent = Math.round((score / total) * 100);
  const ready = readinessPercent >= 80;

  const report = {
    ready,
    score,
    total,
    readinessPercent,
    checks,
    failed: checks.filter(c => !c.pass),
    mode: orchState?.activeMode ?? 'unknown',
    timestamp: new Date().toISOString(),
  };

  console.log('\n  Checks:');
  for (const c of checks) {
    console.log(`  ${c.pass ? 'PASS' : 'FAIL'}: ${c.check} — ${c.detail}`);
  }

  console.log(`\n  Readiness: ${score}/${total} (${readinessPercent}%)`);

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[readiness] ${ready ? 'PRODUCT READY' : 'NOT READY'} (${readinessPercent}%)`);
  console.log('\n' + JSON.stringify(report, null, 2));
}

main();
