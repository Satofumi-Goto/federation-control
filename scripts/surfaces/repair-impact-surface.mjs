/**
 * repair-impact (改修影響) — Operational Surface Builder
 *
 * Real data sources:
 *   - runtime-repair-audit-log.json          → repair cycle history
 *   - runtime-operational-digital-twin-graph.json → blast radius deps
 *   - runtime-sla-slo-execution-result.json  → service impact
 *   - runtime-governance-timeline.json       → repair decisions
 *   - runtime-federation-health-graph.json   → health propagation
 *   - runtime-change-control-board.json      → change risk/rollback
 *   - runtime-autonomous-coordination-result.json → recovery actions
 *
 * Graph types used:
 *   Repair execution graph, blast radius arc, rollback feasibility gauge,
 *   governance safety score, affected console grid, repair dependency chain
 */

import {
  SURFACE_COLORS, SEVERITY_COLORS, esc, svgDataUri,
  surfaceCard, surfaceHeader, surfaceSectionHeader,
  miniBar, miniGauge, stateDot, bigMetric, stateChip, dataRow,
  timelineEvent, dependencyArc,
  makeDashboard, makeTextPanel,
  loadRepairAudit, loadDigitalTwin, loadSlaExecution,
  loadGovernanceTimeline, loadHealthGraph, loadChangeControl,
  loadAutonomousCoord,
} from '../lib/runtime-surface-shared.mjs';

// ── Panel: Repair Execution Graph ──

function repairExecutionPanel() {
  const audit = loadRepairAudit() ?? [];
  const recent = audit.slice(-6).reverse();

  const totalCycles = audit.length;
  const passCount = audit.filter(e => e.verificationPass).length;
  const passRate = totalCycles > 0 ? Math.round((passCount / totalCycles) * 100) : 0;
  const passColor = passRate === 100 ? SURFACE_COLORS.healthy : passRate >= 80 ? SURFACE_COLORS.warning : SURFACE_COLORS.critical;

  const phases = ['検出', '分析', '提案', '実行', '検証'];
  const lastEntry = audit[audit.length - 1] ?? {};
  const activePhase = lastEntry.decision === 'no_action' ? 0
    : lastEntry.proposalCount > 0 ? 2
    : lastEntry.applied ? 3
    : lastEntry.verificationPass ? 4 : 1;

  const pipelineHtml = phases.map((p, i) => {
    const active = i <= activePhase;
    const bg = active ? SURFACE_COLORS.accentCyan : SURFACE_COLORS.cardBorder;
    const fg = active ? '#fff' : SURFACE_COLORS.textDim;
    return `<div style="padding:2px 6px;border-radius:4px;background:${bg};color:${fg};font-size:8px;font-weight:700;">${p}</div>`;
  }).join(`<div style="font-size:7px;color:${SURFACE_COLORS.textDim};">→</div>`);

  const historyHtml = recent.map(e => {
    const color = e.verificationPass ? SURFACE_COLORS.healthy : SURFACE_COLORS.critical;
    const detail = `モニタ:${e.monitorState} D:${e.driftCount} P:${e.proposalCount}`;
    return timelineEvent(e.decision ?? 'unknown', detail, e.timestamp, color);
  }).join('');

  const content = `${surfaceHeader('Repair · Execution', '改修実行グラフ', SURFACE_COLORS.repairing)}
    <div style="margin-top:4px;display:flex;gap:10px;">
      <div>${bigMetric(totalCycles, 'サイクル', SURFACE_COLORS.accentCyan)}</div>
      <div>${bigMetric(passRate + '%', '検証率', passColor)}</div>
    </div>
    <div style="margin-top:6px;display:flex;align-items:center;gap:3px;flex-wrap:wrap;">${pipelineHtml}</div>
    <div style="margin-top:8px;font-size:8px;font-weight:600;color:${SURFACE_COLORS.textDim};text-transform:uppercase;">改修履歴</div>
    <div style="margin-top:2px;">${historyHtml || '<div style="font-size:8px;color:' + SURFACE_COLORS.textDim + ';">履歴なし</div>'}</div>`;

  return surfaceCard(SURFACE_COLORS.repairing, content);
}

// ── Panel: Blast Radius ──

function blastRadiusPanel() {
  const twin = loadDigitalTwin() ?? {};
  const nodes = twin.nodes ?? [];
  const deps = twin.dependencies ?? [];

  const directAffected = new Set();
  const secondaryAffected = new Set();
  for (const d of deps) {
    directAffected.add(d.to);
    for (const d2 of deps) {
      if (d2.from === d.to && d2.to !== d.from) secondaryAffected.add(d2.to);
    }
  }

  const directCount = directAffected.size;
  const secondaryCount = secondaryAffected.size;
  const totalImpact = Math.min(100, Math.round(((directCount + secondaryCount * 0.5) / Math.max(nodes.length, 1)) * 100));
  const impactColor = totalImpact > 60 ? SURFACE_COLORS.critical
    : totalImpact > 30 ? SURFACE_COLORS.warning : SURFACE_COLORS.healthy;

  const impactLayers = [
    { label: '直接影響', count: directCount, color: SURFACE_COLORS.critical },
    { label: '二次影響', count: secondaryCount, color: SURFACE_COLORS.warning },
    { label: '非影響', count: Math.max(0, nodes.length - directCount), color: SURFACE_COLORS.healthy },
  ];

  const layersHtml = impactLayers.map(l =>
    miniBar(l.label, l.count, nodes.length || 1, l.color)
  ).join('');

  const topAffected = [...directAffected].slice(0, 6).map(id => {
    const node = nodes.find(n => n.id === id);
    return dataRow(node?.domain?.replace(/-runtime$/, '') ?? id, node?.health ?? 'unknown',
      SEVERITY_COLORS[node?.health] || SURFACE_COLORS.textMuted);
  }).join('');

  const content = `${surfaceHeader('Blast · Radius', '影響範囲推定', impactColor)}
    <div style="margin-top:4px;display:flex;align-items:baseline;gap:6px;">
      ${bigMetric(totalImpact + '%', '影響度', impactColor)}
    </div>
    <div style="margin-top:6px;">${layersHtml}</div>
    <div style="margin-top:6px;font-size:8px;font-weight:600;color:${SURFACE_COLORS.textDim};text-transform:uppercase;">影響ドメイン</div>
    <div style="margin-top:2px;">${topAffected}</div>`;

  return surfaceCard(impactColor, content);
}

// ── Panel: Rollback Feasibility ──

function rollbackFeasibilityPanel() {
  const ccb = loadChangeControl() ?? {};
  const records = ccb.records ?? [];
  const latest = records[records.length - 1] ?? {};

  const riskLevel = latest.riskLevel ?? 'unknown';
  const riskColor = riskLevel === 'high' ? SURFACE_COLORS.critical
    : riskLevel === 'medium' ? SURFACE_COLORS.warning
    : riskLevel === 'low' ? SURFACE_COLORS.healthy : SURFACE_COLORS.textMuted;

  const rollbackPlan = latest.rollbackPlan ?? {};
  const rollbackAvail = rollbackPlan.available !== false;
  const rollbackColor = rollbackAvail ? SURFACE_COLORS.healthy : SURFACE_COLORS.critical;

  const sla = loadSlaExecution() ?? {};
  const serviceImpacts = sla.serviceImpacts ?? [];

  const impactsHtml = serviceImpacts.map(si =>
    `<div style="padding:3px 0;border-bottom:1px solid ${SURFACE_COLORS.cardBorder};">
      <div style="display:flex;align-items:center;gap:4px;">
        ${stateChip(si.metric, si.serviceImpact === 'service-at-risk' ? 'warning' : 'healthy')}
        <span style="font-size:8px;color:${SURFACE_COLORS.textMuted};">${esc(si.urgency ?? '')}</span>
      </div>
      <div style="font-size:8px;color:${SURFACE_COLORS.textMuted};margin-top:1px;">${esc(si.recoveryAction ?? '')}</div>
    </div>`
  ).join('');

  const content = `${surfaceHeader('Rollback · Feasibility', 'ロールバック実現性', rollbackColor)}
    <div style="margin-top:4px;display:flex;gap:8px;">
      <div>${bigMetric(rollbackAvail ? '可能' : '不可', 'ロールバック', rollbackColor)}</div>
      <div>${stateDot(riskLevel === 'unknown' ? 'nominal' : riskLevel)}</div>
    </div>
    <div style="margin-top:6px;">
      ${dataRow('リスクレベル', riskLevel, riskColor)}
      ${dataRow('変更レコード', records.length, SURFACE_COLORS.nominal)}
    </div>
    <div style="margin-top:6px;font-size:8px;font-weight:600;color:${SURFACE_COLORS.textDim};text-transform:uppercase;">サービス影響</div>
    <div style="margin-top:2px;">${impactsHtml || '<div style="font-size:8px;color:' + SURFACE_COLORS.healthy + ';">影響なし</div>'}</div>`;

  return surfaceCard(rollbackColor, content);
}

// ── Panel: Governance Safety Score ──

function governanceSafetyPanel() {
  const timeline = loadGovernanceTimeline() ?? [];
  const policyEvals = timeline.filter(e => e.type === 'policy_evaluation');
  const pressureEvals = timeline.filter(e => e.type === 'pressure_evaluation');
  const verifications = timeline.filter(e => e.type === 'verification');

  const lastPolicy = policyEvals[policyEvals.length - 1];
  const lastPressure = pressureEvals[pressureEvals.length - 1];
  const verifyPassRate = verifications.length > 0
    ? Math.round((verifications.filter(v => v.ok).length / verifications.length) * 100) : 100;

  const policies = lastPolicy?.policies ?? {};
  const policyRows = Object.entries(policies).map(([key, val]) => {
    const color = val === 'allowed' ? SURFACE_COLORS.healthy
      : val === 'restricted' ? SURFACE_COLORS.warning : SURFACE_COLORS.critical;
    return dataRow(key, val, color);
  }).join('');

  const pressure = lastPressure?.pressure ?? 0;
  const level = lastPressure?.level ?? 'unknown';
  const safetyScore = Math.max(0, 100 - pressure * 2 - (100 - verifyPassRate));
  const safetyColor = safetyScore >= 80 ? SURFACE_COLORS.healthy
    : safetyScore >= 50 ? SURFACE_COLORS.warning : SURFACE_COLORS.critical;

  const content = `${surfaceHeader('Governance · Safety', 'ガバナンス安全スコア', safetyColor)}
    <div style="margin-top:4px;display:flex;gap:10px;">
      <div>${bigMetric(safetyScore, '安全性', safetyColor)}</div>
      <div>${bigMetric(verifyPassRate + '%', '検証率', verifyPassRate === 100 ? SURFACE_COLORS.healthy : SURFACE_COLORS.warning)}</div>
    </div>
    <div style="margin-top:6px;">
      ${miniGauge('ガバナンス安全性', safetyScore, safetyColor)}
    </div>
    <div style="margin-top:6px;font-size:8px;font-weight:600;color:${SURFACE_COLORS.textDim};text-transform:uppercase;">ポリシー状態</div>
    <div style="margin-top:2px;">${policyRows}</div>`;

  return surfaceCard(safetyColor, content);
}

// ── Panel: Recovery Actions ──

function recoveryActionsPanel() {
  const coord = loadAutonomousCoord() ?? {};
  const metrics = coord.metrics ?? {};
  const actions = coord.actions ?? [];

  const metricEntries = Object.entries(metrics).slice(0, 6);
  const metricsHtml = metricEntries.map(([key, val]) => {
    const numVal = typeof val === 'number' ? val : typeof val === 'object' ? val.score ?? val.value ?? 0 : 0;
    const color = numVal > 80 ? SURFACE_COLORS.healthy : numVal > 50 ? SURFACE_COLORS.warning : SURFACE_COLORS.critical;
    return miniGauge(key.replace(/([A-Z])/g, ' $1').trim(), numVal, color);
  }).join('');

  const actionsHtml = actions.slice(0, 5).map(a => {
    const color = a.priority === 'high' ? SURFACE_COLORS.critical
      : a.priority === 'medium' ? SURFACE_COLORS.warning : SURFACE_COLORS.nominal;
    return `<div style="padding:2px 0;border-bottom:1px solid ${SURFACE_COLORS.cardBorder};">
      <div style="display:flex;align-items:center;gap:4px;">
        ${stateChip(a.type ?? 'unknown', a.priority === 'high' ? 'critical' : 'nominal')}
      </div>
      <div style="font-size:8px;color:${SURFACE_COLORS.textMuted};margin-top:1px;">${esc(a.detail ?? a.description ?? '')}</div>
    </div>`;
  }).join('');

  const content = `${surfaceHeader('Recovery · Actions', '復旧アクション', SURFACE_COLORS.accentTeal)}
    <div style="margin-top:6px;">${metricsHtml || '<div style="font-size:8px;color:' + SURFACE_COLORS.textDim + ';">メトリクスなし</div>'}</div>
    <div style="margin-top:6px;font-size:8px;font-weight:600;color:${SURFACE_COLORS.textDim};text-transform:uppercase;">実行アクション</div>
    <div style="margin-top:2px;">${actionsHtml || '<div style="font-size:8px;color:' + SURFACE_COLORS.textDim + ';">保留中のアクションなし</div>'}</div>`;

  return surfaceCard(SURFACE_COLORS.accentTeal, content);
}

// ── Panel: Health Propagation ──

function healthPropagationPanel() {
  const hg = loadHealthGraph() ?? {};
  const nodes = hg.nodes ?? [];
  const depHealth = hg.dependencyHealth ?? 'unknown';

  const chainHtml = nodes.map((n, i) => {
    const color = SEVERITY_COLORS[n.health] || SURFACE_COLORS.textMuted;
    const next = nodes[i + 1];
    const arrow = next ? `<div style="font-size:7px;color:${SURFACE_COLORS.textDim};text-align:center;">↓</div>` : '';
    return `<div style="display:flex;align-items:center;gap:4px;padding:2px 0;">
      <div style="width:5px;height:5px;border-radius:50%;background:${color};box-shadow:0 0 3px ${color}55;"></div>
      <span style="font-size:9px;font-weight:700;color:${color};">${esc(n.id)}</span>
      <span style="font-size:8px;color:${SURFACE_COLORS.textMuted};margin-left:auto;">P:${n.pressure}</span>
    </div>${arrow}`;
  }).join('');

  const content = `${surfaceHeader('Health · Propagation', 'ヘルス伝播チェーン', SEVERITY_COLORS[depHealth] || SURFACE_COLORS.nominal)}
    <div style="margin-top:4px;">${stateDot(depHealth)}</div>
    <div style="margin-top:6px;">${chainHtml}</div>`;

  return surfaceCard(SEVERITY_COLORS[depHealth] || SURFACE_COLORS.nominal, content);
}

// ── Build ──

export function buildRepairImpact() {
  return makeDashboard({
    uid: 'sambt57',
    title: '改修影響 — Repair Impact',
    description: 'Federation Runtime 改修影響 Operational Surface — 改修グラフ・影響範囲・ロールバック・安全性・復旧',
    panels: [
      makeTextPanel({ id: 1, gridPos: { h: 1, w: 24, x: 0, y: 0 },
        content: surfaceSectionHeader('改修影響 Repair Impact', '改修グラフ · 影響範囲 · ロールバック · 安全性 · 復旧', SURFACE_COLORS.repairing) }),
      makeTextPanel({ id: 10, gridPos: { h: 8, w: 8, x: 0, y: 1 }, content: repairExecutionPanel() }),
      makeTextPanel({ id: 11, gridPos: { h: 8, w: 8, x: 8, y: 1 }, content: blastRadiusPanel() }),
      makeTextPanel({ id: 12, gridPos: { h: 8, w: 8, x: 16, y: 1 }, content: rollbackFeasibilityPanel() }),
      makeTextPanel({ id: 20, gridPos: { h: 6, w: 8, x: 0, y: 9 }, content: governanceSafetyPanel() }),
      makeTextPanel({ id: 21, gridPos: { h: 6, w: 8, x: 8, y: 9 }, content: recoveryActionsPanel() }),
      makeTextPanel({ id: 22, gridPos: { h: 6, w: 8, x: 16, y: 9 }, content: healthPropagationPanel() }),
    ],
  });
}
