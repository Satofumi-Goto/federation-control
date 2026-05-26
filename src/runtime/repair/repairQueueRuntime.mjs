/**
 * Repair Queue Runtime
 *
 * Manages repair requests as a governed queue with defined states.
 *
 * Queue states:
 *   pending → analyzing → verify-running → governance-review →
 *   ready-for-safe-execute → blocked | recovering → completed
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const REPAIR_DIR = path.resolve(REPO_ROOT, 'runtime_data/repair');
const QUEUE_PATH = path.resolve(REPAIR_DIR, 'runtime-repair-queue.json');
const MAX_QUEUE = 50;

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function save(data) {
  fs.mkdirSync(REPAIR_DIR, { recursive: true });
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(data, null, 2) + '\n');
}

const VALID_STATES = [
  'pending', 'analyzing', 'verify-running', 'governance-review',
  'ready-for-safe-execute', 'blocked', 'recovering', 'completed',
];

const STATE_LABELS = {
  'pending': '待機中',
  'analyzing': '解析中',
  'verify-running': '検証中',
  'governance-review': 'ガバナンス確認中',
  'ready-for-safe-execute': '安全実行可能',
  'blocked': '停止中',
  'recovering': '復旧中',
  'completed': '完了',
};

export function loadQueue() {
  const data = loadJson(QUEUE_PATH);
  if (!data) return { items: [], updated: null };
  return data;
}

export function enqueueRepair(proposal) {
  const queue = loadQueue();
  const items = queue.items ?? [];

  const existing = items.find(i => i.repairId === proposal.id);
  if (existing) return queue;

  items.push({
    queueId: crypto.randomUUID(),
    repairId: proposal.id,
    issueType: proposal.issue?.type ?? 'unknown',
    issueSeverity: proposal.issue?.severity ?? 'unknown',
    targetDomains: proposal.targetDomains ?? [],
    estimatedRisk: proposal.estimatedRisk ?? 0,
    state: 'pending',
    stateLabel: STATE_LABELS['pending'],
    enqueuedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [{ state: 'pending', at: new Date().toISOString() }],
  });

  while (items.length > MAX_QUEUE) items.shift();

  const result = { items, updated: new Date().toISOString() };
  save(result);
  return result;
}

export function transitionState(repairId, newState) {
  if (!VALID_STATES.includes(newState)) return null;
  const queue = loadQueue();
  const items = queue.items ?? [];
  const item = items.find(i => i.repairId === repairId);
  if (!item) return null;

  item.state = newState;
  item.stateLabel = STATE_LABELS[newState] ?? newState;
  item.updatedAt = new Date().toISOString();
  item.history.push({ state: newState, at: new Date().toISOString() });

  save({ items, updated: new Date().toISOString() });
  return item;
}

export function getQueuePressure() {
  const queue = loadQueue();
  const items = queue.items ?? [];

  const pending = items.filter(i => i.state === 'pending').length;
  const analyzing = items.filter(i => i.state === 'analyzing').length;
  const blocked = items.filter(i => i.state === 'blocked').length;
  const executing = items.filter(i => i.state === 'ready-for-safe-execute').length;
  const total = items.length;

  const pressureScore = Math.min(100, pending * 10 + analyzing * 8 + blocked * 20 + executing * 5);
  const pressureLevel = pressureScore > 70 ? 'critical'
    : pressureScore > 40 ? 'elevated'
    : pressureScore > 15 ? 'moderate'
    : 'low';

  return {
    total,
    pending,
    analyzing,
    blocked,
    executing,
    recovering: items.filter(i => i.state === 'recovering').length,
    completed: items.filter(i => i.state === 'completed').length,
    pressureScore,
    pressureLevel,
  };
}

export function buildQueueFromPlan() {
  const plan = loadJson(path.resolve(REPAIR_DIR, 'runtime-repair-plan.json'));
  const orchestration = loadJson(path.resolve(REPAIR_DIR, 'runtime-orchestration-result.json'));
  const proposals = plan?.proposals ?? [];
  const orchestrated = orchestration?.orchestrated ?? [];

  for (const proposal of proposals) {
    enqueueRepair(proposal);
    const orch = orchestrated.find(o => o.repairId === proposal.id);
    if (orch) {
      const stateMap = {
        'SAFE_EXECUTE_READY': 'ready-for-safe-execute',
        'GOVERNANCE_REVIEW': 'governance-review',
        'BLOCKED': 'blocked',
      };
      const mapped = stateMap[orch.decision] ?? 'analyzing';
      transitionState(proposal.id, mapped);
    }
  }

  return loadQueue();
}

// ── CLI ──
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  console.log('[repair-queue] Building queue from plan...');
  const queue = buildQueueFromPlan();
  const pressure = getQueuePressure();
  console.log(`[repair-queue] Items: ${queue.items?.length ?? 0}, Pressure: ${pressure.pressureScore} (${pressure.pressureLevel})`);
  for (const item of queue.items ?? []) {
    console.log(`  [${item.issueType}] ${item.state} (${item.stateLabel})`);
  }
}
