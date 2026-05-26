#!/usr/bin/env node
/**
 * Runtime Role & Permission Model
 *
 * Defines Runtime user roles, operator permissions,
 * and action authorization by role.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTIONS } from './runtimeOperatorActionModel.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const MATRIX_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-permission-matrix.json');

export const ROLES = {
  OWNER: 'owner',
  RUNTIME_ADMIN: 'runtime-admin',
  OPERATOR: 'operator',
  REVIEWER: 'reviewer',
  OBSERVER: 'observer',
  EMERGENCY_CONTROLLER: 'emergency-controller',
};

const ROLE_DEFS = [
  { id: ROLES.OWNER, label: 'オーナー', level: 100, description: 'Full control over all Runtime operations' },
  { id: ROLES.RUNTIME_ADMIN, label: 'Runtime管理者', level: 90, description: 'Administer Runtime configuration and deployment' },
  { id: ROLES.OPERATOR, label: 'オペレーター', level: 70, description: 'Execute Runtime operations within governance' },
  { id: ROLES.REVIEWER, label: 'レビュアー', level: 50, description: 'Review and approve changes, read-write on approvals only' },
  { id: ROLES.OBSERVER, label: 'オブザーバー', level: 10, description: 'Read-only access to Runtime state and reports' },
  { id: ROLES.EMERGENCY_CONTROLLER, label: '緊急制御者', level: 95, description: 'Emergency halt/recover operations only' },
];

const PERMISSION_MAP = {
  [ROLES.OWNER]: {
    allowed: ['build', 'verify', 'repair-approve', 'repair-reject', 'deploy', 'deploy-verify', 'rollback', 'rollback-confirm', 'registry-edit', 'card-create', 'drift-acknowledge', 'incident-close', 'mode-change', 'emergency-halt', 'emergency-recover'],
    blocked: [],
    approvalRequired: [],
    auditRequired: ['deploy', 'rollback', 'registry-edit', 'mode-change', 'emergency-halt', 'emergency-recover'],
  },
  [ROLES.RUNTIME_ADMIN]: {
    allowed: ['build', 'verify', 'repair-approve', 'repair-reject', 'deploy', 'deploy-verify', 'rollback', 'rollback-confirm', 'registry-edit', 'card-create', 'drift-acknowledge', 'incident-close', 'mode-change'],
    blocked: ['emergency-halt', 'emergency-recover'],
    approvalRequired: ['rollback', 'mode-change'],
    auditRequired: ['deploy', 'rollback', 'registry-edit', 'mode-change'],
  },
  [ROLES.OPERATOR]: {
    allowed: ['build', 'verify', 'repair-approve', 'repair-reject', 'deploy-verify', 'card-create', 'drift-acknowledge', 'incident-close'],
    blocked: ['registry-edit', 'mode-change', 'emergency-halt', 'emergency-recover'],
    approvalRequired: ['deploy', 'rollback', 'rollback-confirm'],
    auditRequired: ['deploy', 'repair-approve'],
  },
  [ROLES.REVIEWER]: {
    allowed: ['verify', 'deploy-verify', 'repair-approve', 'repair-reject', 'drift-acknowledge', 'incident-close'],
    blocked: ['build', 'deploy', 'rollback', 'rollback-confirm', 'registry-edit', 'card-create', 'mode-change', 'emergency-halt', 'emergency-recover'],
    approvalRequired: [],
    auditRequired: ['repair-approve'],
  },
  [ROLES.OBSERVER]: {
    allowed: ['verify', 'deploy-verify'],
    blocked: ['build', 'repair-approve', 'repair-reject', 'deploy', 'rollback', 'rollback-confirm', 'registry-edit', 'card-create', 'drift-acknowledge', 'incident-close', 'mode-change', 'emergency-halt', 'emergency-recover'],
    approvalRequired: [],
    auditRequired: [],
  },
  [ROLES.EMERGENCY_CONTROLLER]: {
    allowed: ['verify', 'deploy-verify', 'emergency-halt', 'emergency-recover', 'rollback', 'rollback-confirm', 'mode-change'],
    blocked: ['build', 'deploy', 'registry-edit', 'card-create', 'repair-approve'],
    approvalRequired: [],
    auditRequired: ['emergency-halt', 'emergency-recover', 'rollback', 'mode-change'],
  },
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
 * Get permissions for a role.
 */
export function getPermissions(role) {
  return PERMISSION_MAP[role] ?? PERMISSION_MAP[ROLES.OBSERVER];
}

/**
 * Check if a role can perform an action.
 */
export function canPerform(role, actionId) {
  const perms = getPermissions(role);
  if (perms.blocked.includes(actionId)) return { allowed: false, reason: 'Blocked for this role' };
  if (perms.approvalRequired.includes(actionId)) return { allowed: true, requiresApproval: true, reason: 'Approval required' };
  if (perms.allowed.includes(actionId)) return { allowed: true, requiresApproval: false, reason: 'Allowed' };
  return { allowed: false, reason: 'Not in allowed list' };
}

/**
 * Build and save the full permission matrix.
 */
export function buildPermissionMatrix() {
  const matrix = ROLE_DEFS.map(role => ({
    ...role,
    permissions: PERMISSION_MAP[role.id],
    actionCount: {
      allowed: PERMISSION_MAP[role.id].allowed.length,
      blocked: PERMISSION_MAP[role.id].blocked.length,
      approvalRequired: PERMISSION_MAP[role.id].approvalRequired.length,
      auditRequired: PERMISSION_MAP[role.id].auditRequired.length,
    },
  }));

  saveJson(MATRIX_PATH, matrix);
  return matrix;
}

if (process.argv[1]?.endsWith('runtimeRolePermissionModel.mjs')) {
  console.log('[roles] Runtime Role & Permission Model');
  console.log('='.repeat(55));

  const matrix = buildPermissionMatrix();

  console.log(`\n  Roles (${matrix.length}):`);
  for (const role of matrix) {
    console.log(`\n    ${role.label} (${role.id}) — level ${role.level}`);
    console.log(`      Allowed: ${role.actionCount.allowed} | Blocked: ${role.actionCount.blocked} | Review: ${role.actionCount.approvalRequired} | Audit: ${role.actionCount.auditRequired}`);
  }

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[roles] ${matrix.length} roles, ${ACTIONS.length} actions, permission matrix saved`);
  console.log('\n' + JSON.stringify({ ok: true, roles: matrix.length, actions: ACTIONS.length, timestamp: new Date().toISOString() }, null, 2));
}
