/**
 * Long-running Stability Controls
 *
 * Controls for long-running operation:
 *   - history size management
 *   - queue stagnation detection
 *   - stale state accumulation cleanup
 *   - orphan repair chain detection
 *   - dependency drift accumulation tracking
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DATA_ROOT = path.resolve(REPO_ROOT, 'runtime_data');
const STABILITY_DIR = path.resolve(DATA_ROOT, 'stability');

const MAX_HISTORY = 50;
const MAX_QUEUE = 50;
const MAX_DRIFT_EVENTS = 100;
const MAX_REPAIR_ENTRIES = 50;
const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function tryLoadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function checkHistorySize() {
  const history = tryLoadJson(path.resolve(DATA_ROOT, 'state/runtime-state-history.json'));
  const count = (history?.entries ?? []).length;
  return {
    control: '履歴サイズ',
    current: count,
    limit: MAX_HISTORY,
    ok: count <= MAX_HISTORY,
    action: count > MAX_HISTORY ? '古い履歴を削除推奨' : null,
  };
}

function checkQueueStagnation() {
  const queue = tryLoadJson(path.resolve(DATA_ROOT, 'repair/runtime-repair-queue.json'));
  const items = queue?.items ?? [];
  const now = Date.now();
  const stale = items.filter(i => {
    if (i.state === 'completed') return false;
    const updatedAt = new Date(i.updatedAt ?? i.enqueuedAt).getTime();
    return now - updatedAt > STALE_THRESHOLD_MS;
  });
  return {
    control: 'キュー滞留',
    total: items.length,
    staleCount: stale.length,
    ok: stale.length === 0 && items.length <= MAX_QUEUE,
    action: stale.length > 0 ? `${stale.length} 件の滞留アイテムあり — 確認推奨` : null,
  };
}

function checkStaleStateAccumulation() {
  const transitions = tryLoadJson(path.resolve(DATA_ROOT, 'state/runtime-state-transitions.json'));
  const count = (transitions?.transitions ?? []).length;
  return {
    control: '状態遷移蓄積',
    current: count,
    limit: 100,
    ok: count <= 100,
    action: count > 100 ? '古い遷移を削除推奨' : null,
  };
}

function checkOrphanRepairChains() {
  const graph = tryLoadJson(path.resolve(DATA_ROOT, 'repair/runtime-repair-graph.json'));
  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];
  const nodeIds = new Set(nodes.map(n => n.id));
  const orphanEdges = edges.filter(e => !nodeIds.has(e.from) && !nodeIds.has(e.to));
  return {
    control: '孤立修復チェーン',
    orphanCount: orphanEdges.length,
    ok: orphanEdges.length === 0,
    action: orphanEdges.length > 0 ? `${orphanEdges.length} 件の孤立エッジ — グラフ再構築推奨` : null,
  };
}

function checkDriftAccumulation() {
  const timeline = tryLoadJson(path.resolve(DATA_ROOT, 'state/runtime-drift-timeline.json'));
  const events = timeline?.events ?? [];
  const unresolved = events.filter(e => e.status === 'active' || !e.resolvedAt);
  return {
    control: 'ドリフト蓄積',
    totalEvents: events.length,
    unresolvedCount: unresolved.length,
    limit: MAX_DRIFT_EVENTS,
    ok: unresolved.length === 0 && events.length <= MAX_DRIFT_EVENTS,
    action: unresolved.length > 0 ? `${unresolved.length} 件の未解決ドリフト` : null,
  };
}

export function checkStability() {
  const controls = [
    checkHistorySize(),
    checkQueueStagnation(),
    checkStaleStateAccumulation(),
    checkOrphanRepairChains(),
    checkDriftAccumulation(),
  ];

  const passed = controls.filter(c => c.ok).length;
  const total = controls.length;
  const actions = controls.filter(c => c.action).map(c => ({ control: c.control, action: c.action }));

  const result = {
    timestamp: new Date().toISOString(),
    passed,
    total,
    stable: passed === total,
    actions,
    controls,
  };

  fs.mkdirSync(STABILITY_DIR, { recursive: true });
  fs.writeFileSync(
    path.resolve(STABILITY_DIR, 'runtime-stability-result.json'),
    JSON.stringify(result, null, 2) + '\n',
  );
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  console.log('[stability] Checking long-running stability...');
  const r = checkStability();
  console.log(`[stability] ${r.passed}/${r.total} controls OK, stable: ${r.stable}`);
  for (const c of r.controls) {
    console.log(`  ${c.ok ? 'OK' : 'NG'}: ${c.control}${c.action ? ' — ' + c.action : ''}`);
  }
}
