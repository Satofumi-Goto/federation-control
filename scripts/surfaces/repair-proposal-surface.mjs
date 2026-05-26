/**
 * repair-proposal (改修提案) — Operational Surface Builder
 *
 * Real data sources:
 *   - runtime-evolution-proposals.json        → active proposals
 *   - runtime-evolution-governance-result.json → proposal evaluations
 *   - runtime-structural-evolution-model.json  → topology changes, cycles
 *   - runtime-repair-audit-log.json           → repair decision history
 *   - runtime-adaptive-topology-result.json   → adaptation actions
 *   - runtime-change-control-board.json       → release candidates
 *   - runtime-business-control-result.json    → business impact
 *
 * Graph types used:
 *   Proposal evaluation pipeline, dependency cycle detection,
 *   structural change timeline, adaptation action density,
 *   business impact gauge, release candidate tracker
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SURFACE_COLORS, SEVERITY_COLORS, esc,
  surfaceCard, surfaceHeader, surfaceSectionHeader,
  miniBar, miniGauge, stateDot, bigMetric, stateChip, dataRow,
  timelineEvent,
  makeDashboard, makeTextPanel,
  stateTransitionPanelHtml,
  loadEvolutionProposals, loadRepairAudit,
  loadAdaptiveTopology, loadChangeControl, loadStructuralEvolution,
} from '../lib/runtime-surface-shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(__dirname, '../../runtime_data');

function loadJson(f) {
  try { return JSON.parse(fs.readFileSync(path.resolve(DATA_ROOT, f), 'utf8')); }
  catch { return null; }
}

// ── Panel: Active Proposals ──

function activeProposalsPanel() {
  const proposals = loadEvolutionProposals() ?? {};
  const items = proposals.proposals ?? [];
  const pending = items.filter(p => p.status === 'pending' || p.status === 'proposed');
  const approved = items.filter(p => p.status === 'approved' || p.status === 'auto-approved');
  const rejected = items.filter(p => p.status === 'rejected');

  const statusSummary = [
    { label: '保留中', count: pending.length, color: SURFACE_COLORS.warning },
    { label: '承認済', count: approved.length, color: SURFACE_COLORS.healthy },
    { label: '却下', count: rejected.length, color: SURFACE_COLORS.critical },
  ];

  const summaryHtml = statusSummary.map(s =>
    `<div style="text-align:center;">
      <div style="font-size:18px;font-weight:900;color:${s.color};">${s.count}</div>
      <div style="font-size:8px;color:${SURFACE_COLORS.textMuted};">${s.label}</div>
    </div>`
  ).join('');

  const proposalRows = items.slice(0, 6).map(p => {
    const stColor = p.status === 'approved' || p.status === 'auto-approved' ? SURFACE_COLORS.healthy
      : p.status === 'rejected' ? SURFACE_COLORS.critical : SURFACE_COLORS.warning;
    return `<div style="padding:3px 0;border-bottom:1px solid ${SURFACE_COLORS.cardBorder};">
      <div style="display:flex;align-items:center;gap:4px;">
        ${stateChip(p.status ?? 'unknown', p.status === 'approved' ? 'healthy' : p.status === 'rejected' ? 'critical' : 'warning')}
        <span style="font-size:9px;font-weight:600;color:${SURFACE_COLORS.text};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(p.title ?? p.type ?? p.id ?? '')}</span>
      </div>
      <div style="font-size:8px;color:${SURFACE_COLORS.textMuted};margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(p.description ?? p.detail ?? '')}</div>
    </div>`;
  }).join('');

  const content = `${surfaceHeader('Proposal · Active', '改修提案一覧', SURFACE_COLORS.accentIce)}
    <div style="margin-top:6px;display:flex;justify-content:space-around;gap:8px;">${summaryHtml}</div>
    <div style="margin-top:8px;font-size:8px;font-weight:600;color:${SURFACE_COLORS.textDim};text-transform:uppercase;">提案詳細</div>
    <div style="margin-top:2px;max-height:160px;overflow-y:auto;">${proposalRows || '<div style="font-size:8px;color:' + SURFACE_COLORS.textDim + ';">提案なし</div>'}</div>`;

  return surfaceCard(SURFACE_COLORS.accentIce, content);
}

// ── Panel: Structural Evolution ──

function structuralEvolutionPanel() {
  const struct = loadStructuralEvolution() ?? {};
  const topology = struct.topologyChanges ?? [];
  const modules = struct.moduleChanges ?? [];
  const policies = struct.policyTransitions ?? [];
  const cycles = struct.dependencyCycles ?? [];

  const content = `${surfaceHeader('Structure · Evolution', '構造進化モデル', SURFACE_COLORS.accentSteel)}
    <div style="margin-top:4px;display:flex;gap:10px;">
      <div>${bigMetric(topology.length, 'トポロジー変更', SURFACE_COLORS.accentSteel)}</div>
      <div>${bigMetric(cycles.length, '循環依存', cycles.length > 0 ? SURFACE_COLORS.critical : SURFACE_COLORS.healthy)}</div>
    </div>
    <div style="margin-top:6px;">
      ${miniBar('トポロジー変更', topology.length, 10, SURFACE_COLORS.accentSteel)}
      ${miniBar('モジュール変更', modules.length, 10, SURFACE_COLORS.nominal)}
      ${miniBar('ポリシー遷移', policies.length, 10, SURFACE_COLORS.warning)}
      ${miniBar('循環依存検出', cycles.length, 5, cycles.length > 0 ? SURFACE_COLORS.critical : SURFACE_COLORS.healthy)}
    </div>
    <div style="margin-top:4px;">
      ${cycles.length > 0
        ? cycles.map(c => dataRow('循環: ' + (c.path ?? []).join(' → '), '検出', SURFACE_COLORS.critical)).join('')
        : `<div style="font-size:8px;color:${SURFACE_COLORS.healthy};padding:2px 0;">循環依存なし</div>`}
    </div>`;

  return surfaceCard(SURFACE_COLORS.accentSteel, content);
}

// ── Panel: Change Control Board ──

function changeControlPanel() {
  const ccb = loadChangeControl() ?? {};
  const records = ccb.records ?? [];
  const latest = records[records.length - 1];

  const rowsHtml = records.slice(-4).reverse().map(r => {
    const riskColor = r.riskLevel === 'high' ? SURFACE_COLORS.critical
      : r.riskLevel === 'medium' ? SURFACE_COLORS.warning : SURFACE_COLORS.healthy;
    return `<div style="padding:3px 0;border-bottom:1px solid ${SURFACE_COLORS.cardBorder};">
      <div style="display:flex;align-items:center;gap:4px;">
        ${stateChip(r.riskLevel ?? 'unknown', r.riskLevel === 'high' ? 'critical' : r.riskLevel === 'medium' ? 'warning' : 'healthy')}
        <span style="font-size:9px;color:${SURFACE_COLORS.text};flex:1;">${esc(r.title ?? r.id ?? '')}</span>
        <span style="font-size:8px;color:${SURFACE_COLORS.textMuted};">${esc(r.decision ?? '')}</span>
      </div>
    </div>`;
  }).join('');

  const content = `${surfaceHeader('Change · Control', '変更管理ボード', SURFACE_COLORS.nominal)}
    <div style="margin-top:4px;">
      ${bigMetric(records.length, 'レコード', SURFACE_COLORS.nominal)}
    </div>
    <div style="margin-top:6px;">${rowsHtml || '<div style="font-size:8px;color:' + SURFACE_COLORS.textDim + ';">変更レコードなし</div>'}</div>`;

  return surfaceCard(SURFACE_COLORS.nominal, content);
}

// ── Panel: Repair Decision Timeline ──

function repairDecisionPanel() {
  const audit = loadRepairAudit() ?? [];
  const recent = audit.slice(-6).reverse();

  const decisionCount = {};
  for (const e of audit) {
    const d = e.decision ?? 'unknown';
    decisionCount[d] = (decisionCount[d] || 0) + 1;
  }

  const decisionRows = Object.entries(decisionCount).map(([d, c]) => {
    const color = d === 'apply' ? SURFACE_COLORS.healthy
      : d === 'no_action' ? SURFACE_COLORS.textDim : SURFACE_COLORS.warning;
    return dataRow(d, c, color);
  }).join('');

  const eventsHtml = recent.map(e => {
    const color = e.decision === 'apply' ? SURFACE_COLORS.healthy
      : e.decision === 'no_action' ? SURFACE_COLORS.textDim : SURFACE_COLORS.warning;
    return timelineEvent(e.decision ?? 'unknown', `drift:${e.driftCount} proposal:${e.proposalCount}`, e.timestamp, color);
  }).join('');

  const content = `${surfaceHeader('Repair · Decisions', '改修判定タイムライン', SURFACE_COLORS.warning)}
    <div style="margin-top:4px;font-size:8px;font-weight:600;color:${SURFACE_COLORS.textDim};text-transform:uppercase;">判定分布</div>
    <div style="margin-top:2px;">${decisionRows}</div>
    <div style="margin-top:6px;font-size:8px;font-weight:600;color:${SURFACE_COLORS.textDim};text-transform:uppercase;">直近タイムライン</div>
    <div style="margin-top:2px;">${eventsHtml}</div>`;

  return surfaceCard(SURFACE_COLORS.warning, content);
}

// ── Panel: Business Impact ──

function businessImpactPanel() {
  const biz = loadJson('runtime-business-control-result.json') ?? {};
  const scores = biz.scores ?? biz;

  const operational = scores.operational ?? 0;
  const service = scores.service ?? 0;
  const cost = scores.cost ?? 0;
  const avg = Math.round((operational + service + cost) / 3);
  const avgColor = avg >= 80 ? SURFACE_COLORS.healthy : avg >= 50 ? SURFACE_COLORS.warning : SURFACE_COLORS.critical;

  const content = `${surfaceHeader('Business · Impact', 'ビジネスインパクト', avgColor)}
    <div style="margin-top:4px;">${bigMetric(avg, '総合スコア', avgColor)}</div>
    <div style="margin-top:6px;">
      ${miniGauge('オペレーション', operational, operational >= 80 ? SURFACE_COLORS.healthy : SURFACE_COLORS.warning)}
      ${miniGauge('サービス', service, service >= 80 ? SURFACE_COLORS.healthy : SURFACE_COLORS.warning)}
      ${miniGauge('コスト', cost, cost >= 80 ? SURFACE_COLORS.healthy : SURFACE_COLORS.warning)}
    </div>`;

  return surfaceCard(avgColor, content);
}

// ── Panel: Adaptation Density ──

function adaptationDensityPanel() {
  const adapt = loadAdaptiveTopology() ?? {};
  const byArea = adapt.actionsByArea ?? {};
  const total = adapt.totalActions ?? 0;

  const areas = Object.entries(byArea);
  const maxCount = Math.max(1, ...areas.map(([, c]) => c));

  const gridHtml = areas.map(([area, count]) => {
    const pct = Math.round((count / maxCount) * 100);
    const color = count > 0 ? SURFACE_COLORS.warning : SURFACE_COLORS.textDim;
    const bg = count > 0 ? `${color}22` : 'transparent';
    return `<div style="padding:4px 6px;border-radius:4px;background:${bg};border:1px solid ${SURFACE_COLORS.cardBorder};text-align:center;">
      <div style="font-size:14px;font-weight:900;color:${color};">${count}</div>
      <div style="font-size:7px;color:${SURFACE_COLORS.textMuted};margin-top:1px;">${esc(area)}</div>
    </div>`;
  }).join('');

  const content = `${surfaceHeader('Adaptation · Density', '適応密度マップ', SURFACE_COLORS.accentTeal)}
    <div style="margin-top:4px;">${bigMetric(total, 'アクション総数', SURFACE_COLORS.accentTeal)}</div>
    <div style="margin-top:6px;display:grid;grid-template-columns:repeat(3,1fr);gap:4px;">${gridHtml}</div>`;

  return surfaceCard(SURFACE_COLORS.accentTeal, content);
}

// ── Build ──

export function buildRepairProposal() {
  return makeDashboard({
    uid: 'sajbd8b',
    title: '改修提案 — Repair Proposal',
    description: 'Federation Runtime 改修提案 Operational Surface — 提案・構造進化・変更管理・判定・インパクト・適応',
    panels: [
      makeTextPanel({ id: 1, gridPos: { h: 1, w: 24, x: 0, y: 0 },
        content: surfaceSectionHeader('改修提案 Repair Proposal', '提案 · 構造進化 · 変更管理 · 判定 · インパクト', SURFACE_COLORS.accentIce) }),
      makeTextPanel({ id: 10, gridPos: { h: 8, w: 8, x: 0, y: 1 }, content: activeProposalsPanel() }),
      makeTextPanel({ id: 11, gridPos: { h: 8, w: 8, x: 8, y: 1 }, content: structuralEvolutionPanel() }),
      makeTextPanel({ id: 12, gridPos: { h: 8, w: 8, x: 16, y: 1 }, content: changeControlPanel() }),
      makeTextPanel({ id: 20, gridPos: { h: 6, w: 8, x: 0, y: 9 }, content: repairDecisionPanel() }),
      makeTextPanel({ id: 21, gridPos: { h: 6, w: 8, x: 8, y: 9 }, content: businessImpactPanel() }),
      makeTextPanel({ id: 22, gridPos: { h: 6, w: 8, x: 16, y: 9 }, content: adaptationDensityPanel() }),
      makeTextPanel({ id: 30, gridPos: { h: 5, w: 24, x: 0, y: 15 }, content: stateTransitionPanelHtml() }),
    ],
  });
}
