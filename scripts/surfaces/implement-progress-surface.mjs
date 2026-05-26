/**
 * implement-progress (実装進捗) — Operational Surface Builder
 *
 * Real data sources:
 *   - runtime-invocation-lock-state.json       → execution gate
 *   - runtime-orchestration-state.json         → queue, mode, deploy
 *   - runtime-headless-session.json            → latest execution session
 *   - runtime-headless-invocation-report.json  → invocation results
 *   - runtime-execution-result.json            → build/deploy outcome
 *   - runtime-operational-snapshot.json        → deployment state
 *   - runtime-trigger-supervisor-state.json    → trigger health
 *   - runtime-service-state.json               → service lifecycle
 *   - runtime-governance-timeline.json         → operational timeline
 *   - runtime-environment-state.json           → environment health
 *
 * Graph types used:
 *   Execution timeline, queue density map, governance gate grid,
 *   verification state pipeline, execution stage tracker,
 *   operational timeline, service lifecycle gauge
 */

import {
  SURFACE_COLORS, SEVERITY_COLORS, esc,
  surfaceCard, surfaceHeader, surfaceSectionHeader,
  miniBar, miniGauge, stateDot, bigMetric, stateChip, dataRow,
  timelineEvent,
  makeDashboard, makeTextPanel,
  stateTransitionPanelHtml, repairHistoryPanelHtml,
  loadLockState, loadOrchestrationState, loadHeadlessSession,
  loadExecutionResult, loadOperationalSnapshot, loadTriggerSupervisor,
  loadServiceState, loadGovernanceTimeline, loadEnvironmentState,
} from '../lib/runtime-surface-shared.mjs';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(__dirname, '../../runtime_data');

function loadJson(f) {
  try { return JSON.parse(fs.readFileSync(path.resolve(DATA_ROOT, f), 'utf8')); }
  catch { return null; }
}

// ── Panel: Execution Queue ──

function executionQueuePanel() {
  const orch = loadOrchestrationState() ?? {};
  const mode = orch.activeMode ?? 'unknown';
  const modeColor = mode === 'autonomous' ? SURFACE_COLORS.accentCyan
    : mode === 'manual' ? SURFACE_COLORS.warning : SURFACE_COLORS.textMuted;

  const queue = orch.activeQueue ?? [];
  const counters = orch.supervisorCounters ?? {};

  const counterRows = Object.entries(counters).map(([key, val]) => {
    const color = val > 0 ? SURFACE_COLORS.warning : SURFACE_COLORS.textDim;
    return dataRow(key, val, color);
  }).join('');

  const queueHtml = queue.length > 0
    ? queue.slice(0, 5).map((item, i) => `<div style="padding:2px 0;border-bottom:1px solid ${SURFACE_COLORS.cardBorder};font-size:9px;color:${SURFACE_COLORS.text};">${i + 1}. ${esc(typeof item === 'string' ? item : item.id ?? JSON.stringify(item))}</div>`).join('')
    : `<div style="font-size:8px;color:${SURFACE_COLORS.healthy};padding:2px 0;">キュー空 — 即時実行可能</div>`;

  const content = `${surfaceHeader('Execution · Queue', '実行キュー', modeColor)}
    <div style="margin-top:4px;display:flex;align-items:baseline;gap:8px;">
      ${bigMetric(mode, '実行モード', modeColor)}
    </div>
    <div style="margin-top:6px;font-size:8px;font-weight:600;color:${SURFACE_COLORS.textDim};text-transform:uppercase;">キュー内容</div>
    <div style="margin-top:2px;">${queueHtml}</div>
    <div style="margin-top:6px;font-size:8px;font-weight:600;color:${SURFACE_COLORS.textDim};text-transform:uppercase;">スーパーバイザーカウンター</div>
    <div style="margin-top:2px;">${counterRows}</div>
    <div style="margin-top:4px;">
      ${dataRow('圧力スコア', orch.pressureScore ?? 0, SURFACE_COLORS.nominal)}
      ${dataRow('ストーム検出', orch.stormDetected ? '検出' : 'なし', orch.stormDetected ? SURFACE_COLORS.critical : SURFACE_COLORS.healthy)}
      ${dataRow('ループ回数', orch.loopCount ?? 0, SURFACE_COLORS.textMuted)}
    </div>`;

  return surfaceCard(modeColor, content);
}

// ── Panel: Governance Gate ──

function governanceGatePanel() {
  const lock = loadLockState() ?? {};
  const checks = lock.checks ?? [];
  const decision = lock.decision ?? 'unknown';
  const decisionColor = decision === 'proceed' ? SURFACE_COLORS.healthy
    : decision === 'blocked' ? SURFACE_COLORS.critical : SURFACE_COLORS.warning;

  const passCount = checks.filter(c => c.pass).length;
  const totalCount = checks.length;
  const passRate = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;

  const gateGrid = checks.map(c => {
    const color = c.pass ? SURFACE_COLORS.healthy : SURFACE_COLORS.critical;
    const icon = c.pass ? '✓' : '✗';
    return `<div style="display:flex;align-items:center;gap:4px;padding:4px 6px;background:${color}12;border:1px solid ${color}33;border-radius:6px;">
      <span style="font-size:11px;font-weight:700;color:${color};">${icon}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:9px;font-weight:600;color:${SURFACE_COLORS.text};">${esc(c.check)}</div>
        <div style="font-size:7px;color:${SURFACE_COLORS.textMuted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(c.detail)}</div>
      </div>
    </div>`;
  }).join('');

  const blocked = lock.blocked ?? [];
  const blockedHtml = blocked.length > 0
    ? blocked.map(b => `<div style="font-size:8px;color:${SURFACE_COLORS.critical};padding:1px 0;">⚠ ${esc(typeof b === 'string' ? b : b.reason ?? JSON.stringify(b))}</div>`).join('')
    : '';

  const content = `${surfaceHeader('Governance · Gate', 'ガバナンスゲート', decisionColor)}
    <div style="margin-top:4px;display:flex;gap:10px;">
      <div>${bigMetric(decision, '判定', decisionColor)}</div>
      <div>${bigMetric(passCount + '/' + totalCount, 'ゲート', passRate === 100 ? SURFACE_COLORS.healthy : SURFACE_COLORS.warning)}</div>
    </div>
    <div style="margin-top:6px;display:grid;grid-template-columns:1fr 1fr;gap:4px;">${gateGrid}</div>
    ${blockedHtml ? '<div style="margin-top:4px;">' + blockedHtml + '</div>' : ''}`;

  return surfaceCard(decisionColor, content);
}

// ── Panel: Execution Session ──

function executionSessionPanel() {
  const session = loadHeadlessSession() ?? {};
  const status = session.status ?? 'unknown';
  const statusColor = status === 'completed' ? SURFACE_COLORS.healthy
    : status === 'running' ? SURFACE_COLORS.accentCyan
    : status === 'failed' ? SURFACE_COLORS.critical : SURFACE_COLORS.textMuted;

  const startTime = session.startTime ? new Date(session.startTime).toLocaleString('ja-JP') : '--';
  const endTime = session.endTime ? new Date(session.endTime).toLocaleString('ja-JP') : '--';
  const model = session.model ?? '--';
  const runId = session.runId ?? '--';

  const prompt = session.prompt ?? '';
  const truncatedPrompt = prompt.length > 100 ? prompt.slice(0, 100) + '...' : prompt;

  const content = `${surfaceHeader('Execution · Session', '実行セッション', statusColor)}
    <div style="margin-top:4px;">${stateDot(status)}</div>
    <div style="margin-top:6px;">
      ${dataRow('モデル', model, SURFACE_COLORS.accentCyan)}
      ${dataRow('実行ID', runId.slice(0, 16) + '...', SURFACE_COLORS.textMuted)}
      ${dataRow('開始', startTime, SURFACE_COLORS.textMuted)}
      ${dataRow('終了', endTime, SURFACE_COLORS.textMuted)}
    </div>
    <div style="margin-top:6px;font-size:8px;font-weight:600;color:${SURFACE_COLORS.textDim};text-transform:uppercase;">プロンプト</div>
    <div style="margin-top:2px;font-size:8px;color:${SURFACE_COLORS.textMuted};background:${SURFACE_COLORS.base};padding:4px 6px;border-radius:4px;word-break:break-all;">${esc(truncatedPrompt)}</div>`;

  return surfaceCard(statusColor, content);
}

// ── Panel: Deployment State ──

function deploymentStatePanel() {
  const snap = loadOperationalSnapshot() ?? {};
  const execResult = loadExecutionResult() ?? {};

  const version = snap.version ?? 0;
  const panelCount = snap.panelCount ?? 0;
  const registryCount = snap.registryCount ?? 0;
  const verifyPass = snap.verificationPass ? '合格' : '不合格';
  const verifyColor = snap.verificationPass ? SURFACE_COLORS.healthy : SURFACE_COLORS.critical;

  const changedFiles = execResult.changedFiles ?? [];
  const buildOk = execResult.buildOk ?? execResult.ok;
  const buildColor = buildOk ? SURFACE_COLORS.healthy : buildOk === false ? SURFACE_COLORS.critical : SURFACE_COLORS.textMuted;

  const fileListHtml = changedFiles.slice(0, 6).map(f =>
    `<div style="font-size:8px;color:${SURFACE_COLORS.textMuted};padding:1px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(f)}</div>`
  ).join('');

  const content = `${surfaceHeader('Deploy · State', 'デプロイ状態', verifyColor)}
    <div style="margin-top:4px;display:flex;gap:10px;">
      <div>${bigMetric('v' + version, 'バージョン', SURFACE_COLORS.accentCyan)}</div>
      <div>${bigMetric(verifyPass, '検証', verifyColor)}</div>
    </div>
    <div style="margin-top:6px;">
      ${dataRow('パネル数', panelCount, SURFACE_COLORS.nominal)}
      ${dataRow('レジストリ数', registryCount, SURFACE_COLORS.nominal)}
      ${dataRow('ビルド結果', buildOk ? '成功' : buildOk === false ? '失敗' : '未実行', buildColor)}
      ${dataRow('変更ファイル', changedFiles.length, SURFACE_COLORS.textMuted)}
    </div>
    ${fileListHtml ? `<div style="margin-top:4px;font-size:8px;font-weight:600;color:${SURFACE_COLORS.textDim};text-transform:uppercase;">変更ファイル</div><div style="margin-top:2px;">${fileListHtml}</div>` : ''}`;

  return surfaceCard(verifyColor, content);
}

// ── Panel: Trigger Supervisor ──

function triggerSupervisorPanel() {
  const trigger = loadTriggerSupervisor() ?? {};
  const totalExec = trigger.totalExecutions ?? 0;
  const totalBlocked = trigger.totalBlocked ?? 0;
  const consecutive = trigger.consecutiveFailures ?? 0;
  const paused = trigger.paused ?? false;
  const pauseColor = paused ? SURFACE_COLORS.critical : SURFACE_COLORS.healthy;

  const blockRate = (totalExec + totalBlocked) > 0
    ? Math.round((totalBlocked / (totalExec + totalBlocked)) * 100) : 0;
  const blockColor = blockRate > 50 ? SURFACE_COLORS.critical : blockRate > 20 ? SURFACE_COLORS.warning : SURFACE_COLORS.healthy;

  const content = `${surfaceHeader('Trigger · Supervisor', 'トリガー監視', pauseColor)}
    <div style="margin-top:4px;display:flex;gap:8px;">
      <div>${bigMetric(paused ? '停止' : '稼働', '状態', pauseColor)}</div>
      <div>${bigMetric(blockRate + '%', 'ブロック率', blockColor)}</div>
    </div>
    <div style="margin-top:6px;">
      ${miniGauge('ブロック率', blockRate, blockColor)}
    </div>
    <div style="margin-top:4px;">
      ${dataRow('総実行', totalExec, SURFACE_COLORS.nominal)}
      ${dataRow('総ブロック', totalBlocked, totalBlocked > 0 ? SURFACE_COLORS.warning : SURFACE_COLORS.textDim)}
      ${dataRow('連続失敗', consecutive, consecutive > 0 ? SURFACE_COLORS.critical : SURFACE_COLORS.healthy)}
    </div>`;

  return surfaceCard(pauseColor, content);
}

// ── Panel: Operational Timeline ──

function operationalTimelinePanel() {
  const govTimeline = loadGovernanceTimeline() ?? [];
  const recent = govTimeline.slice(-10).reverse();

  const typeIcons = {
    repair_cycle: SURFACE_COLORS.repairing,
    policy_evaluation: SURFACE_COLORS.accentCyan,
    pressure_evaluation: SURFACE_COLORS.warning,
    governance_decision: SURFACE_COLORS.accentIce,
    verification: SURFACE_COLORS.healthy,
    health_propagation: SURFACE_COLORS.accentTeal,
  };

  const eventsHtml = recent.map(e => {
    const color = typeIcons[e.type] || SURFACE_COLORS.textMuted;
    let detail = '';
    if (e.type === 'governance_decision') detail = e.decision ?? '';
    else if (e.type === 'pressure_evaluation') detail = `圧力:${e.pressure ?? 0} ${e.level ?? ''}`;
    else if (e.type === 'policy_evaluation') detail = `モード:${e.mode ?? ''}`;
    else if (e.type === 'repair_cycle') detail = e.decision ?? (e.ok ? '正常' : '異常');
    else if (e.type === 'verification') detail = e.ok ? '合格' : '不合格';
    else if (e.type === 'health_propagation') detail = `圧力:${e.healthGraph?.pressure ?? 0}`;
    return timelineEvent(e.type.replace(/_/g, ' '), detail, e.timestamp, color);
  }).join('');

  const content = `${surfaceHeader('Operational · Timeline', '運用タイムライン', SURFACE_COLORS.accentIce)}
    <div style="margin-top:6px;max-height:220px;overflow-y:auto;">${eventsHtml || '<div style="font-size:8px;color:' + SURFACE_COLORS.textDim + ';">イベントなし</div>'}</div>`;

  return surfaceCard(SURFACE_COLORS.accentIce, content);
}

// ── Panel: Environment Health ──

function environmentHealthPanel() {
  const env = loadEnvironmentState() ?? {};
  const healthScore = env.healthScore ?? 0;
  const modules = env.activeModules ?? [];
  const pressure = env.pressureScores ?? {};

  const scoreColor = healthScore >= 90 ? SURFACE_COLORS.healthy
    : healthScore >= 70 ? SURFACE_COLORS.warning : SURFACE_COLORS.critical;

  const moduleHtml = modules.slice(0, 8).map(m => {
    const name = typeof m === 'string' ? m : m.name ?? m.id ?? '';
    return stateChip(name, 'active');
  }).join(' ');

  const pressureRows = Object.entries(pressure).slice(0, 6).map(([key, val]) => {
    const v = typeof val === 'number' ? val : 0;
    const color = v > 50 ? SURFACE_COLORS.critical : v > 20 ? SURFACE_COLORS.warning : SURFACE_COLORS.healthy;
    return miniBar(key, v, 100, color);
  }).join('');

  const content = `${surfaceHeader('Environment · Health', '環境ヘルス', scoreColor)}
    <div style="margin-top:4px;">${bigMetric(healthScore, 'ヘルススコア', scoreColor)}</div>
    <div style="margin-top:4px;">${miniGauge('環境健全性', healthScore, scoreColor)}</div>
    <div style="margin-top:6px;font-size:8px;font-weight:600;color:${SURFACE_COLORS.textDim};text-transform:uppercase;">アクティブモジュール</div>
    <div style="margin-top:2px;display:flex;flex-wrap:wrap;gap:3px;">${moduleHtml || '--'}</div>
    ${pressureRows ? `<div style="margin-top:6px;font-size:8px;font-weight:600;color:${SURFACE_COLORS.textDim};text-transform:uppercase;">圧力分布</div><div style="margin-top:2px;">${pressureRows}</div>` : ''}`;

  return surfaceCard(scoreColor, content);
}

// ── Build ──

export function buildImplementProgress() {
  return makeDashboard({
    uid: 'sassvwp',
    title: '実装進捗 — Implement Progress',
    description: 'Federation Runtime 実装進捗 Operational Surface — キュー・ゲート・セッション・デプロイ・監視・タイムライン',
    panels: [
      makeTextPanel({ id: 1, gridPos: { h: 1, w: 24, x: 0, y: 0 },
        content: surfaceSectionHeader('実装進捗 Implement Progress', 'キュー · ゲート · セッション · デプロイ · 監視 · タイムライン', SURFACE_COLORS.accentCyan) }),
      makeTextPanel({ id: 10, gridPos: { h: 8, w: 6, x: 0, y: 1 }, content: executionQueuePanel() }),
      makeTextPanel({ id: 11, gridPos: { h: 8, w: 6, x: 6, y: 1 }, content: governanceGatePanel() }),
      makeTextPanel({ id: 12, gridPos: { h: 8, w: 6, x: 12, y: 1 }, content: executionSessionPanel() }),
      makeTextPanel({ id: 13, gridPos: { h: 8, w: 6, x: 18, y: 1 }, content: deploymentStatePanel() }),
      makeTextPanel({ id: 20, gridPos: { h: 6, w: 8, x: 0, y: 9 }, content: triggerSupervisorPanel() }),
      makeTextPanel({ id: 21, gridPos: { h: 6, w: 8, x: 8, y: 9 }, content: operationalTimelinePanel() }),
      makeTextPanel({ id: 22, gridPos: { h: 6, w: 8, x: 16, y: 9 }, content: environmentHealthPanel() }),
      makeTextPanel({ id: 30, gridPos: { h: 5, w: 12, x: 0, y: 15 }, content: stateTransitionPanelHtml() }),
      makeTextPanel({ id: 31, gridPos: { h: 5, w: 12, x: 12, y: 15 }, content: repairHistoryPanelHtml() }),
    ],
  });
}
