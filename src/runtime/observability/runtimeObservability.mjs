/**
 * Federation Runtime Observability
 *
 * Internal runtime observation — real operational metrics only.
 * No fake CPU meters, no meaningless TPS, no generic infra graphs.
 *
 * Metrics:
 *   - verify duration
 *   - repair pipeline latency
 *   - governance block frequency
 *   - drift recurrence
 *   - queue saturation
 *   - runtime degradation trend
 *   - repair success rate
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DATA_ROOT = path.resolve(REPO_ROOT, 'runtime_data');
const STABILITY_DIR = path.resolve(DATA_ROOT, 'stability');

function tryLoadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function measureVerifyDuration() {
  const govTimeline = tryLoadJson(path.resolve(DATA_ROOT, 'runtime-governance-timeline.json')) ?? [];
  const verifications = govTimeline.filter(e => e.type === 'verification');
  if (verifications.length < 2) return { metric: '検証間隔', value: null, unit: 'ms', note: 'データ不足' };
  const recent = verifications.slice(-2);
  const t1 = new Date(recent[0].timestamp).getTime();
  const t2 = new Date(recent[1].timestamp).getTime();
  return { metric: '検証間隔', value: Math.abs(t2 - t1), unit: 'ms' };
}

function measureGovernanceBlockFrequency() {
  const govTimeline = tryLoadJson(path.resolve(DATA_ROOT, 'runtime-governance-timeline.json')) ?? [];
  const blocks = govTimeline.filter(e => e.type === 'governance_decision' && e.decision === 'blocked');
  const total = govTimeline.filter(e => e.type === 'governance_decision').length || 1;
  return { metric: 'ガバナンスブロック率', value: Math.round((blocks.length / total) * 100), unit: '%' };
}

function measureDriftRecurrence() {
  const timeline = tryLoadJson(path.resolve(DATA_ROOT, 'state/runtime-drift-timeline.json'));
  const events = timeline?.events ?? [];
  const recurring = events.filter(e => (e.recurrence ?? 0) > 0).length;
  return { metric: 'ドリフト再発件数', value: recurring, unit: '件' };
}

function measureQueueSaturation() {
  const queue = tryLoadJson(path.resolve(DATA_ROOT, 'repair/runtime-repair-queue.json'));
  const items = queue?.items ?? [];
  const blocked = items.filter(i => i.state === 'blocked').length;
  const total = items.length || 1;
  return { metric: 'キュー飽和度', value: Math.round((blocked / total) * 100), unit: '%', blocked, total: items.length };
}

function measureDegradationTrend() {
  const history = tryLoadJson(path.resolve(DATA_ROOT, 'state/runtime-state-history.json'));
  const entries = history?.entries ?? [];
  if (entries.length < 3) return { metric: '劣化傾向', value: 'stable', note: '履歴不足' };
  const recent = entries.slice(-5);
  const degradedCount = recent.filter(e => e.state && e.state !== 'HEALTHY').length;
  const trend = degradedCount >= 3 ? 'worsening' : degradedCount >= 1 ? 'fluctuating' : 'stable';
  return { metric: '劣化傾向', value: trend, degradedInRecent: degradedCount };
}

function measureRepairSuccessRate() {
  const repairHistory = tryLoadJson(path.resolve(DATA_ROOT, 'state/runtime-repair-history.json'));
  const entries = repairHistory?.entries ?? [];
  if (entries.length === 0) return { metric: '修復成功率', value: 100, unit: '%', note: '修復履歴なし' };
  const successful = entries.filter(e => e.verifyResult?.topology && e.verifyResult?.semantic).length;
  return { metric: '修復成功率', value: Math.round((successful / entries.length) * 100), unit: '%' };
}

function measureRepairPipelineLatency() {
  const queue = tryLoadJson(path.resolve(DATA_ROOT, 'repair/runtime-repair-queue.json'));
  const items = queue?.items ?? [];
  const completed = items.filter(i => i.state === 'completed' && i.enqueuedAt && i.updatedAt);
  if (completed.length === 0) return { metric: '修復パイプライン遅延', value: null, unit: 'ms', note: '完了済みキューなし' };
  const latencies = completed.map(i => new Date(i.updatedAt).getTime() - new Date(i.enqueuedAt).getTime());
  const avg = Math.round(latencies.reduce((s, l) => s + l, 0) / latencies.length);
  return { metric: '修復パイプライン遅延', value: avg, unit: 'ms' };
}

export function collectObservability() {
  const metrics = [
    measureVerifyDuration(),
    measureRepairPipelineLatency(),
    measureGovernanceBlockFrequency(),
    measureDriftRecurrence(),
    measureQueueSaturation(),
    measureDegradationTrend(),
    measureRepairSuccessRate(),
  ];

  const result = {
    timestamp: new Date().toISOString(),
    metricCount: metrics.length,
    metrics,
  };

  fs.mkdirSync(STABILITY_DIR, { recursive: true });
  fs.writeFileSync(
    path.resolve(STABILITY_DIR, 'runtime-observability.json'),
    JSON.stringify(result, null, 2) + '\n',
  );
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  console.log('[observability] Collecting runtime observability...');
  const r = collectObservability();
  for (const m of r.metrics) {
    console.log(`  ${m.metric}: ${m.value ?? '--'} ${m.unit ?? ''}`);
  }
}
