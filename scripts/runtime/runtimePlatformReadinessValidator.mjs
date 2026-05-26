#!/usr/bin/env node
/**
 * Runtime Platform Readiness Validator
 *
 * Validates enterprise platform readiness:
 * roles, permission matrix, release controls, audit export,
 * SLA/SLO model, rollback controls, governance controls,
 * and product readiness.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function fileExists(p) {
  return fs.existsSync(path.resolve(REPO_ROOT, p));
}

function run(cmd) {
  try {
    execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 30000, stdio: 'pipe' });
    return true;
  } catch { return false; }
}

function main() {
  console.log('[platform-readiness] Runtime Platform Readiness Validator');
  console.log('='.repeat(60));

  const checks = [];

  function check(id, label, fn) {
    const pass = fn();
    checks.push({ id, label, pass });
    console.log(`  ${pass ? 'PASS' : 'FAIL'}: ${label}`);
    return pass;
  }

  // 1. Roles exist
  check('roles_exist', 'Role Permission Model exists', () =>
    fileExists('scripts/runtime/runtimeRolePermissionModel.mjs'));

  // 2. Permission matrix exists
  check('permission_matrix', 'Permission matrix exists', () =>
    fileExists('runtime_data/runtime-permission-matrix.json') || run('node scripts/runtime/runtimeRolePermissionModel.mjs'));

  // 3. Permission matrix has all 6 roles
  check('roles_count', 'All 6 roles defined in matrix', () => {
    let matrix = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-permission-matrix.json'));
    if (!matrix) {
      try { execSync('node scripts/runtime/runtimeRolePermissionModel.mjs', { cwd: REPO_ROOT, encoding: 'utf8', timeout: 15000, stdio: 'pipe' }); }
      catch { /* ignore */ }
      matrix = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-permission-matrix.json'));
    }
    return Array.isArray(matrix) && matrix.length === 6;
  });

  // 4. Release controls exist
  check('release_controls', 'Release Management Engine exists', () =>
    fileExists('scripts/runtime/runtimeReleaseManagementEngine.mjs'));

  // 5. Audit export exists
  check('audit_export', 'Enterprise Audit Export exists', () =>
    fileExists('scripts/runtime/runtimeEnterpriseAuditExport.mjs'));

  // 6. SLA/SLO model exists
  check('sla_slo', 'SLA/SLO model exists', () => {
    const model = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-sla-slo-model.json'));
    return model?.sla != null && model?.slo != null;
  });

  // 7. Rollback controls exist
  check('rollback_controls', 'Rollback controls exist', () => {
    const actions = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-permission-matrix.json'));
    if (!Array.isArray(actions)) return false;
    return actions.some(role => role.permissions?.allowed?.includes('rollback'));
  });

  // 8. Governance controls exist
  check('governance_controls', 'Governance orchestrator exists', () =>
    fileExists('scripts/runtime/runtimeGovernanceOrchestrator.mjs'));

  // 9. Change control board model exists
  check('change_control', 'Change Control Board model exists', () =>
    fileExists('runtime_data/runtime-change-control-board.json'));

  // 10. Policy engine exists
  check('policy_engine', 'Policy engine exists', () =>
    fileExists('scripts/runtime/runtimePolicyEngine.mjs'));

  // 11. Product readiness validator exists
  check('product_readiness', 'Product readiness validator exists', () =>
    fileExists('scripts/runtime/runtimeProductReadinessValidator.mjs'));

  // 12. Operator action model exists
  check('operator_actions', 'Operator action model exists', () =>
    fileExists('scripts/runtime/runtimeOperatorActionModel.mjs'));

  // 13. Self-repair orchestrator exists
  check('self_repair', 'Self-repair orchestrator exists', () =>
    fileExists('scripts/runtime/runtimeSelfRepairOrchestrator.mjs'));

  // 14. Event bus exists
  check('event_bus', 'Event bus exists', () =>
    fileExists('scripts/runtime/runtimeEventBus.mjs'));

  // 15. Persistent orchestrator exists
  check('persistent_orchestrator', 'Persistent orchestrator exists', () =>
    fileExists('scripts/runtime/runtimePersistentOrchestrator.mjs'));

  // 16. Intelligence engine exists
  check('intelligence_engine', 'Intelligence engine exists', () =>
    fileExists('scripts/runtime/runtimeIntelligenceEngine.mjs'));

  const passed = checks.filter(c => c.pass).length;
  const total = checks.length;
  const score = Math.round((passed / total) * 100);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[platform-readiness] ${passed}/${total} checks passed (${score}%)`);

  const report = {
    ok: score === 100,
    passed,
    total,
    score,
    checks,
    timestamp: new Date().toISOString(),
  };

  console.log('\n' + JSON.stringify(report, null, 2));
}

main();
