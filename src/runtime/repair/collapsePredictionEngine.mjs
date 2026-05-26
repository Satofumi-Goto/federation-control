/**
 * Collapse Prediction Engine
 *
 * Predicts drift escalation, sync degradation, dependency fragmentation,
 * repair delay impact, execution blockage, and runtime pressure propagation.
 *
 * No fake AI prediction — all predictions are derived from
 * real state history, drift timeline, dependency graph,
 * repair history, and topology/semantic verify results.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const STATE_DIR = path.resolve(REPO_ROOT, 'runtime_data/state');
const DATA_ROOT = path.resolve(REPO_ROOT, 'runtime_data');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function loadHistory() { return loadJson(path.resolve(STATE_DIR, 'runtime-state-history.json')); }
function loadDriftTimeline() { return loadJson(path.resolve(STATE_DIR, 'runtime-drift-timeline.json')); }
function loadRepairHistory() { return loadJson(path.resolve(STATE_DIR, 'runtime-repair-history.json')); }
function loadTransitions() { return loadJson(path.resolve(STATE_DIR, 'runtime-state-transitions.json')); }
function loadTwin() { return loadJson(path.resolve(DATA_ROOT, 'runtime-operational-digital-twin-graph.json')); }
function loadSnapshot() { return loadJson(path.resolve(STATE_DIR, 'runtime-snapshot-latest.json')); }

function predictDriftEscalation(driftTl) {
  const events = driftTl?.events ?? [];
  const unresolvedCount = events.filter(e => e.status === 'active' || !e.resolvedAt).length;
  const recurrence = events.filter(e => e.recurrence > 0).length;
  const score = Math.min(100, unresolvedCount * 20 + recurrence * 15);
  return {
    label: 'ドリフト拡大リスク',
    score,
    level: score > 60 ? 'critical' : score > 30 ? 'warning' : 'stable',
    evidence: {
      unresolvedDrifts: unresolvedCount,
      recurringDrifts: recurrence,
      totalEvents: events.length,
    },
  };
}

function predictSyncDegradation(history) {
  const entries = history?.entries ?? [];
  if (entries.length < 2) return { label: '同期劣化リスク', score: 0, level: 'stable', evidence: { dataPoints: entries.length } };
  const recent = entries.slice(-5);
  const degraded = recent.filter(e => e.state && e.state !== 'HEALTHY').length;
  const score = Math.min(100, degraded * 25);
  return {
    label: '同期劣化リスク',
    score,
    level: score > 60 ? 'critical' : score > 30 ? 'warning' : 'stable',
    evidence: { recentDegraded: degraded, recentTotal: recent.length },
  };
}

function predictDependencyFragmentation(twin) {
  const deps = twin?.dependencies ?? [];
  const broken = deps.filter(d => d.healthy === false).length;
  const total = deps.length || 1;
  const score = Math.min(100, Math.round((broken / total) * 100));
  return {
    label: '依存関係断片化リスク',
    score,
    level: score > 50 ? 'critical' : score > 20 ? 'warning' : 'stable',
    evidence: { brokenDeps: broken, totalDeps: total },
  };
}

function predictRepairDelayImpact(repairHistory) {
  const entries = repairHistory?.entries ?? [];
  const pending = entries.filter(e => e.status === 'proposed' || e.status === 'pending').length;
  const failed = entries.filter(e => e.status === 'failed').length;
  const score = Math.min(100, pending * 15 + failed * 25);
  return {
    label: '修復遅延リスク',
    score,
    level: score > 60 ? 'critical' : score > 30 ? 'warning' : 'stable',
    evidence: { pendingRepairs: pending, failedRepairs: failed },
  };
}

function predictExecutionBlockage(snapshot) {
  const exec = snapshot?.execution ?? {};
  const gov = snapshot?.governance ?? {};
  let score = 0;
  if (exec.deployState === 'blocked') score += 30;
  if (gov.lockDecision === 'blocked') score += 40;
  if ((gov.violations ?? 0) > 0) score += 20;
  score = Math.min(100, score);
  return {
    label: '実行停止リスク',
    score,
    level: score > 60 ? 'critical' : score > 30 ? 'warning' : 'stable',
    evidence: {
      deployBlocked: exec.deployState === 'blocked',
      governanceLocked: gov.lockDecision === 'blocked',
      violations: gov.violations ?? 0,
    },
  };
}

function predictPressurePropagation(snapshot, twin) {
  const gov = snapshot?.governance ?? {};
  const pressure = gov.pressureScore ?? 0;
  const nodes = twin?.nodes?.length ?? 1;
  const score = Math.min(100, Math.round(pressure * (nodes / 10)));
  return {
    label: 'ランタイム圧力伝播リスク',
    score,
    level: score > 60 ? 'critical' : score > 30 ? 'warning' : 'stable',
    evidence: { pressureScore: pressure, nodeCount: nodes },
  };
}

export function predictCollapse() {
  const snapshot = loadSnapshot();
  const driftTl = loadDriftTimeline();
  const history = loadHistory();
  const repairHistory = loadRepairHistory();
  const twin = loadTwin();

  const predictions = [
    predictDriftEscalation(driftTl),
    predictSyncDegradation(history),
    predictDependencyFragmentation(twin),
    predictRepairDelayImpact(repairHistory),
    predictExecutionBlockage(snapshot),
    predictPressurePropagation(snapshot, twin),
  ];

  const overallScore = Math.round(predictions.reduce((s, p) => s + p.score, 0) / predictions.length);
  const criticalCount = predictions.filter(p => p.level === 'critical').length;
  const overallLevel = criticalCount >= 2 ? 'collapse-imminent'
    : criticalCount === 1 ? 'collapse-risk'
    : overallScore > 40 ? 'elevated'
    : 'stable';

  const result = {
    timestamp: new Date().toISOString(),
    snapshotId: snapshot?.id ?? null,
    overallScore,
    overallLevel,
    criticalCount,
    predictions,
  };

  fs.mkdirSync(path.resolve(DATA_ROOT, 'repair'), { recursive: true });
  fs.writeFileSync(
    path.resolve(DATA_ROOT, 'repair/runtime-collapse-prediction.json'),
    JSON.stringify(result, null, 2) + '\n',
  );
  return result;
}

// ── CLI ──
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  console.log('[collapse-predict] Running collapse prediction...');
  const result = predictCollapse();
  console.log(`[collapse-predict] Overall: ${result.overallScore}/100 (${result.overallLevel})`);
  for (const p of result.predictions) {
    console.log(`  ${p.label}: ${p.score} [${p.level}]`);
  }
}
