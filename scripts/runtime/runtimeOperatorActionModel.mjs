#!/usr/bin/env node
/**
 * Runtime Operator Action Model
 *
 * Defines operator actions, their availability by Runtime mode,
 * approval requirements, and emergency overrides.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const ORCHESTRATION_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-orchestration-state.json');

export const ACTION_STATES = {
  AVAILABLE: 'available',
  DISABLED: 'disabled',
  REQUIRES_REVIEW: 'requires_review',
  EMERGENCY_ONLY: 'emergency_only',
  BLOCKED: 'blocked',
};

export const ACTIONS = [
  { id: 'build', label: '再ビルド', category: 'execution', risk: 'low' },
  { id: 'verify', label: '検証実行', category: 'execution', risk: 'low' },
  { id: 'repair-approve', label: '修復承認', category: 'repair', risk: 'medium' },
  { id: 'repair-reject', label: '修復拒否', category: 'repair', risk: 'low' },
  { id: 'deploy', label: 'デプロイ実行', category: 'deploy', risk: 'high' },
  { id: 'deploy-verify', label: 'デプロイ検証', category: 'deploy', risk: 'low' },
  { id: 'rollback', label: 'ロールバック', category: 'rollback', risk: 'high' },
  { id: 'rollback-confirm', label: 'ロールバック確認', category: 'rollback', risk: 'medium' },
  { id: 'registry-edit', label: 'レジストリ編集', category: 'mutation', risk: 'high' },
  { id: 'card-create', label: 'カード作成', category: 'mutation', risk: 'medium' },
  { id: 'drift-acknowledge', label: 'ドリフト承認', category: 'triage', risk: 'low' },
  { id: 'incident-close', label: 'インシデント終了', category: 'triage', risk: 'low' },
  { id: 'mode-change', label: 'モード変更', category: 'governance', risk: 'high' },
  { id: 'emergency-halt', label: '緊急停止', category: 'emergency', risk: 'critical' },
  { id: 'emergency-recover', label: '緊急復旧', category: 'emergency', risk: 'critical' },
];

const MODE_POLICY = {
  normal:      { build: 'available', verify: 'available', 'repair-approve': 'available', 'repair-reject': 'available', deploy: 'available', 'deploy-verify': 'available', rollback: 'requires_review', 'rollback-confirm': 'requires_review', 'registry-edit': 'available', 'card-create': 'available', 'drift-acknowledge': 'available', 'incident-close': 'available', 'mode-change': 'requires_review', 'emergency-halt': 'emergency_only', 'emergency-recover': 'emergency_only' },
  autonomous:  { build: 'available', verify: 'available', 'repair-approve': 'available', 'repair-reject': 'available', deploy: 'available', 'deploy-verify': 'available', rollback: 'requires_review', 'rollback-confirm': 'requires_review', 'registry-edit': 'available', 'card-create': 'available', 'drift-acknowledge': 'available', 'incident-close': 'available', 'mode-change': 'requires_review', 'emergency-halt': 'emergency_only', 'emergency-recover': 'emergency_only' },
  guarded:     { build: 'available', verify: 'available', 'repair-approve': 'requires_review', 'repair-reject': 'available', deploy: 'requires_review', 'deploy-verify': 'available', rollback: 'requires_review', 'rollback-confirm': 'requires_review', 'registry-edit': 'requires_review', 'card-create': 'available', 'drift-acknowledge': 'available', 'incident-close': 'available', 'mode-change': 'requires_review', 'emergency-halt': 'available', 'emergency-recover': 'emergency_only' },
  repair:      { build: 'available', verify: 'available', 'repair-approve': 'available', 'repair-reject': 'available', deploy: 'disabled', 'deploy-verify': 'available', rollback: 'available', 'rollback-confirm': 'available', 'registry-edit': 'disabled', 'card-create': 'disabled', 'drift-acknowledge': 'available', 'incident-close': 'available', 'mode-change': 'requires_review', 'emergency-halt': 'available', 'emergency-recover': 'available' },
  rollback:    { build: 'disabled', verify: 'available', 'repair-approve': 'disabled', 'repair-reject': 'available', deploy: 'blocked', 'deploy-verify': 'available', rollback: 'available', 'rollback-confirm': 'available', 'registry-edit': 'blocked', 'card-create': 'blocked', 'drift-acknowledge': 'available', 'incident-close': 'available', 'mode-change': 'requires_review', 'emergency-halt': 'available', 'emergency-recover': 'available' },
  restricted:  { build: 'requires_review', verify: 'available', 'repair-approve': 'requires_review', 'repair-reject': 'available', deploy: 'blocked', 'deploy-verify': 'available', rollback: 'requires_review', 'rollback-confirm': 'requires_review', 'registry-edit': 'blocked', 'card-create': 'blocked', 'drift-acknowledge': 'available', 'incident-close': 'requires_review', 'mode-change': 'requires_review', 'emergency-halt': 'available', 'emergency-recover': 'requires_review' },
  emergency:   { build: 'disabled', verify: 'available', 'repair-approve': 'disabled', 'repair-reject': 'available', deploy: 'blocked', 'deploy-verify': 'available', rollback: 'available', 'rollback-confirm': 'available', 'registry-edit': 'blocked', 'card-create': 'blocked', 'drift-acknowledge': 'available', 'incident-close': 'available', 'mode-change': 'available', 'emergency-halt': 'available', 'emergency-recover': 'available' },
  supervised:  { build: 'requires_review', verify: 'available', 'repair-approve': 'requires_review', 'repair-reject': 'available', deploy: 'requires_review', 'deploy-verify': 'available', rollback: 'requires_review', 'rollback-confirm': 'requires_review', 'registry-edit': 'requires_review', 'card-create': 'requires_review', 'drift-acknowledge': 'available', 'incident-close': 'available', 'mode-change': 'requires_review', 'emergency-halt': 'available', 'emergency-recover': 'requires_review' },
};

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

/**
 * Get available actions for the current Runtime mode.
 */
export function getAvailableActions(mode) {
  const policy = MODE_POLICY[mode] ?? MODE_POLICY.restricted;
  return ACTIONS.map(action => ({
    ...action,
    state: policy[action.id] ?? ACTION_STATES.BLOCKED,
  }));
}

/**
 * Evaluate all actions for the current orchestration state.
 */
export function evaluateActions() {
  const orch = loadJson(ORCHESTRATION_PATH);
  const mode = orch?.activeMode ?? 'restricted';
  const actions = getAvailableActions(mode);

  const available = actions.filter(a => a.state === ACTION_STATES.AVAILABLE);
  const disabled = actions.filter(a => a.state === ACTION_STATES.DISABLED);
  const review = actions.filter(a => a.state === ACTION_STATES.REQUIRES_REVIEW);
  const blocked = actions.filter(a => a.state === ACTION_STATES.BLOCKED);
  const emergency = actions.filter(a => a.state === ACTION_STATES.EMERGENCY_ONLY);

  return {
    mode,
    actions,
    summary: { available: available.length, disabled: disabled.length, requiresReview: review.length, blocked: blocked.length, emergencyOnly: emergency.length },
    health: orch?.activeHealth ?? 'unknown',
    pressure: orch?.pressureScore ?? 0,
    timestamp: new Date().toISOString(),
  };
}

if (process.argv[1]?.endsWith('runtimeOperatorActionModel.mjs')) {
  console.log('[actions] Runtime Operator Action Model');
  console.log('='.repeat(55));

  const result = evaluateActions();

  console.log(`\n  Mode: ${result.mode}`);
  console.log(`  Health: ${result.health}`);
  console.log(`  Pressure: ${result.pressure}/100`);
  console.log(`\n  Actions (${result.actions.length}):`);
  for (const a of result.actions) {
    const icon = a.state === 'available' ? '●' : a.state === 'requires_review' ? '◐' : a.state === 'disabled' ? '○' : a.state === 'emergency_only' ? '◇' : '✕';
    console.log(`    ${icon} ${a.id.padEnd(22)} ${a.state.padEnd(18)} [${a.risk}]`);
  }

  console.log(`\n  Summary:`);
  for (const [k, v] of Object.entries(result.summary)) {
    console.log(`    ${k}: ${v}`);
  }

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[actions] Mode: ${result.mode} — ${result.summary.available} available, ${result.summary.requiresReview} review, ${result.summary.blocked} blocked`);
  console.log('\n' + JSON.stringify(result, null, 2));
}
