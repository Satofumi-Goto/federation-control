/**
 * collapse-control (崩壊制御) — Operational Surface Builder
 *
 * Real data sources:
 *   - runtime-federation-health-graph.json   → health nodes, pressure
 *   - runtime-operational-digital-twin-graph.json → dependency matrix
 *   - runtime-orchestration-state.json       → governance state
 *   - runtime-sla-slo-execution-result.json  → SLA risk indicators
 *   - runtime-invocation-lock-state.json     → governance lock state
 *   - runtime-governance-timeline.json       → policy/pressure events
 *   - runtime-federation-memory.json         → knowledge graph collapse nodes
 *
 * Graph types used:
 *   Dependency matrix, pressure heatmap, health band grid,
 *   governance lock state grid, SLA risk gauge, collapse propagation arc
 */

import {
  SURFACE_COLORS, SEVERITY_COLORS, esc, svgDataUri,
  surfaceCard, surfaceHeader, surfaceSectionHeader,
  miniBar, miniGauge, stateDot, bigMetric, stateChip, dataRow,
  timelineEvent, dependencyArc, dependencyMatrixSvg, pressureHeatmapSvg,
  makeDashboard, makeTextPanel,
  stateTransitionPanelHtml, rollbackLineagePanelHtml,
  loadHealthGraph, loadDigitalTwin, loadOrchestrationState,
  loadSlaExecution, loadLockState, loadGovernanceTimeline,
  loadFederationMemory,
} from '../lib/runtime-surface-shared.mjs';

// ── Panel: Federation Health Surface ──

function healthSurfacePanel() {
  const hg = loadHealthGraph() ?? {};
  const nodes = hg.nodes ?? [];
  const overallLevel = hg.governanceLevel ?? 'unknown';
  const overallColor = SEVERITY_COLORS[overallLevel] || SURFACE_COLORS.textMuted;
  const govPressure = hg.governancePressure ?? 0;

  const nodeRows = nodes.map(n => {
    const color = SEVERITY_COLORS[n.health] || SURFACE_COLORS.textMuted;
    const pressureColor = n.pressure > 30 ? SURFACE_COLORS.warning : n.pressure > 10 ? SURFACE_COLORS.nominal : SURFACE_COLORS.healthy;
    return `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid ${SURFACE_COLORS.cardBorder};">
      <div style="width:6px;height:6px;border-radius:50%;background:${color};box-shadow:0 0 4px ${color}55;"></div>
      <span style="font-size:9px;font-weight:700;color:${SURFACE_COLORS.text};flex:1;">${esc(n.id)}</span>
      ${stateDot(n.health)}
      <span style="font-size:8px;font-weight:600;color:${pressureColor};">P:${n.pressure}</span>
    </div>`;
  }).join('');

  const pressureBreakdown = [
    { label: 'ガバナンス圧力', value: govPressure, color: govPressure > 30 ? SURFACE_COLORS.warning : SURFACE_COLORS.healthy },
    { label: '実行圧力', value: hg.executionPressure ?? 0, color: SURFACE_COLORS.nominal },
    { label: '改修圧力', value: hg.repairPressure ?? 0, color: SURFACE_COLORS.healthy },
    { label: 'デプロイ圧力', value: hg.deployPressure ?? 0, color: (hg.deployPressure ?? 0) > 5 ? SURFACE_COLORS.warning : SURFACE_COLORS.healthy },
    { label: '伝播深刻度', value: hg.propagationSeverity ?? 0, color: SURFACE_COLORS.healthy },
  ];

  const barsHtml = pressureBreakdown.map(p => miniBar(p.label, p.value, 100, p.color)).join('');

  const content = `${surfaceHeader('Federation · Health', '連邦ヘルス', overallColor)}
    <div style="margin-top:6px;display:flex;align-items:baseline;gap:8px;">
      ${bigMetric(govPressure, '圧力スコア', overallColor)}
      ${stateDot(overallLevel)}
    </div>
    <div style="margin-top:8px;">${barsHtml}</div>
    <div style="margin-top:6px;font-size:8px;font-weight:600;color:${SURFACE_COLORS.textDim};text-transform:uppercase;letter-spacing:.05em;">ノード健全性</div>
    <div style="margin-top:2px;">${nodeRows}</div>`;

  return surfaceCard(overallColor, content);
}

// ── Panel: Dependency Collapse Matrix ──

function dependencyCollapsePanel() {
  const twin = loadDigitalTwin() ?? {};
  const nodes = twin.nodes ?? [];
  const deps = twin.dependencies ?? [];

  const svg = dependencyMatrixSvg(nodes, deps, 300, 180);
  const img = `<img alt="依存関係マトリクス" style="width:100%;height:auto;display:block;border-radius:6px;" src="${svgDataUri(svg)}" />`;

  const depTypeCount = {};
  for (const d of deps) { depTypeCount[d.type] = (depTypeCount[d.type] || 0) + 1; }
  const typeRows = Object.entries(depTypeCount).map(([type, count]) =>
    dataRow(type, count, SURFACE_COLORS.accentCyan)
  ).join('');

  const unhealthy = deps.filter(d => d.healthy === false);
  const unhealthyHtml = unhealthy.length > 0
    ? unhealthy.map(d => dependencyArc(d.from, d.to, d.type, false)).join('')
    : `<div style="font-size:8px;color:${SURFACE_COLORS.healthy};padding:2px 0;">異常依存なし</div>`;

  const content = `${surfaceHeader('Dependency · Collapse', '依存関係崩壊マトリクス', SURFACE_COLORS.accentCyan)}
    <div style="margin-top:6px;background:#0f172a;border-radius:8px;border:1px solid ${SURFACE_COLORS.cardBorder};padding:4px;overflow:hidden;">${img}</div>
    <div style="margin-top:6px;font-size:8px;font-weight:600;color:${SURFACE_COLORS.textDim};text-transform:uppercase;">依存タイプ別件数</div>
    <div style="margin-top:2px;">${typeRows}</div>
    <div style="margin-top:6px;font-size:8px;font-weight:600;color:${SURFACE_COLORS.critical};text-transform:uppercase;">異常依存パス</div>
    <div style="margin-top:2px;">${unhealthyHtml}</div>`;

  return surfaceCard(SURFACE_COLORS.accentCyan, content);
}

// ── Panel: Governance Lock State ──

function governanceLockPanel() {
  const lock = loadLockState() ?? {};
  const orch = loadOrchestrationState() ?? {};

  const decision = lock.decision ?? 'unknown';
  const decisionColor = decision === 'proceed' ? SURFACE_COLORS.healthy
    : decision === 'blocked' ? SURFACE_COLORS.critical : SURFACE_COLORS.warning;

  const checks = (lock.checks ?? []).map(c => {
    const color = c.pass ? SURFACE_COLORS.healthy : SURFACE_COLORS.critical;
    const icon = c.pass ? '✓' : '✗';
    return `<div style="display:flex;align-items:center;gap:4px;padding:3px 0;border-bottom:1px solid ${SURFACE_COLORS.cardBorder};">
      <span style="font-size:10px;color:${color};font-weight:700;">${icon}</span>
      <span style="font-size:9px;color:${SURFACE_COLORS.text};flex:1;">${esc(c.check)}</span>
      <span style="font-size:8px;color:${SURFACE_COLORS.textMuted};">${esc(c.detail)}</span>
    </div>`;
  }).join('');

  const govMode = orch.governanceState ?? lock.governance?.mode ?? 'unknown';
  const deployPolicy = lock.governance?.deployPolicy ?? 'unknown';
  const repairPolicy = lock.governance?.repairPolicy ?? 'unknown';

  const govRows = [
    dataRow('ガバナンスモード', govMode, SEVERITY_COLORS[govMode] || SURFACE_COLORS.nominal),
    dataRow('デプロイポリシー', deployPolicy, deployPolicy === 'allowed' ? SURFACE_COLORS.healthy : SURFACE_COLORS.critical),
    dataRow('改修ポリシー', repairPolicy, repairPolicy === 'allowed' ? SURFACE_COLORS.healthy : SURFACE_COLORS.critical),
    dataRow('圧力スコア', orch.pressureScore ?? 0, SURFACE_COLORS.nominal),
    dataRow('違反検出', orch.violations ?? 0, (orch.violations ?? 0) > 0 ? SURFACE_COLORS.critical : SURFACE_COLORS.healthy),
  ].join('');

  const content = `${surfaceHeader('Governance · Lock', 'ガバナンスロック状態', decisionColor)}
    <div style="margin-top:6px;display:flex;align-items:baseline;gap:6px;">
      ${bigMetric(decision, '判定', decisionColor)}
    </div>
    <div style="margin-top:8px;font-size:8px;font-weight:600;color:${SURFACE_COLORS.textDim};text-transform:uppercase;">安全ゲート</div>
    <div style="margin-top:2px;">${checks}</div>
    <div style="margin-top:8px;font-size:8px;font-weight:600;color:${SURFACE_COLORS.textDim};text-transform:uppercase;">ガバナンスポリシー</div>
    <div style="margin-top:2px;">${govRows}</div>`;

  return surfaceCard(decisionColor, content);
}

// ── Panel: SLA/SLO Risk Surface ──

function slaRiskPanel() {
  const sla = loadSlaExecution() ?? {};
  const metrics = sla.metrics ?? {};
  const risks = sla.risks ?? [];
  const overallStatus = sla.overallStatus ?? 'unknown';
  const statusColor = SEVERITY_COLORS[overallStatus] || SURFACE_COLORS.textMuted;

  const metricsHtml = Object.entries(metrics).map(([key, m]) => {
    const pct = Math.round((m.current / Math.max(m.target, 1)) * 100);
    const atTarget = key === 'repairLeadTime' || key === 'meanRecoveryTime'
      ? m.current <= m.target : m.current >= m.target;
    const color = atTarget ? SURFACE_COLORS.healthy : SURFACE_COLORS.warning;
    return `<div style="margin-bottom:4px;">
      <div style="display:flex;justify-content:space-between;font-size:9px;color:${SURFACE_COLORS.textMuted};">
        <span>${esc(key)}</span>
        <span style="font-weight:700;color:${color};">${m.current}${m.unit} / ${m.target}${m.unit}</span>
      </div>
      ${miniGauge('', Math.min(pct, 100), color)}
    </div>`;
  }).join('');

  const riskHtml = risks.length > 0
    ? risks.map(r => `<div style="display:flex;align-items:center;gap:4px;padding:2px 0;">
        ${stateChip(r.metric, r.severity)}
        <span style="font-size:8px;color:${SURFACE_COLORS.textMuted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(r.detail)}</span>
      </div>`).join('')
    : `<div style="font-size:8px;color:${SURFACE_COLORS.healthy};">リスクなし</div>`;

  const content = `${surfaceHeader('SLA/SLO · Risk', 'サービスレベルリスク', statusColor)}
    <div style="margin-top:4px;">${stateDot(overallStatus)}</div>
    <div style="margin-top:6px;">${metricsHtml}</div>
    <div style="margin-top:6px;font-size:8px;font-weight:600;color:${SURFACE_COLORS.textDim};text-transform:uppercase;">アクティブリスク</div>
    <div style="margin-top:2px;">${riskHtml}</div>`;

  return surfaceCard(statusColor, content);
}

// ── Panel: Collapse Pressure Heatmap ──

function collapsePressurePanel() {
  const hg = loadHealthGraph() ?? {};
  const nodes = hg.nodes ?? [];
  const svg = pressureHeatmapSvg(nodes, 300, 90);
  const img = `<img alt="圧力ヒートマップ" style="width:100%;height:auto;display:block;border-radius:6px;" src="${svgDataUri(svg)}" />`;

  const depHealth = hg.dependencyHealth ?? 'unknown';
  const depColor = SEVERITY_COLORS[depHealth] || SURFACE_COLORS.textMuted;

  const content = `${surfaceHeader('Collapse · Pressure', '崩壊圧力ヒートマップ', SURFACE_COLORS.critical)}
    <div style="margin-top:6px;background:#0f172a;border-radius:8px;border:1px solid ${SURFACE_COLORS.cardBorder};padding:4px;">${img}</div>
    <div style="margin-top:6px;">${dataRow('依存関係健全性', depHealth, depColor)}</div>
    <div style="margin-top:2px;">${dataRow('全体圧力', hg.governancePressure ?? 0, SURFACE_COLORS.nominal)}</div>
    <div style="margin-top:2px;">${dataRow('伝播深刻度', hg.propagationSeverity ?? 0, SURFACE_COLORS.healthy)}</div>`;

  return surfaceCard(SURFACE_COLORS.critical, content);
}

// ── Panel: Governance Timeline ──

function governanceTimelinePanel() {
  const timeline = loadGovernanceTimeline() ?? [];
  const recent = timeline.slice(-8).reverse();

  const eventsHtml = recent.map(e => {
    const typeColor = {
      repair_cycle: SURFACE_COLORS.repairing,
      policy_evaluation: SURFACE_COLORS.accentCyan,
      pressure_evaluation: SURFACE_COLORS.warning,
      governance_decision: SURFACE_COLORS.accentIce,
      verification: SURFACE_COLORS.healthy,
      health_propagation: SURFACE_COLORS.accentTeal,
    }[e.type] || SURFACE_COLORS.textMuted;

    let detail = '';
    if (e.type === 'governance_decision') detail = e.decision ?? '';
    else if (e.type === 'pressure_evaluation') detail = `圧力: ${e.pressure ?? 0} (${e.level ?? ''})`;
    else if (e.type === 'policy_evaluation') detail = `モード: ${e.mode ?? ''}`;
    else if (e.type === 'repair_cycle') detail = e.decision ?? (e.ok ? '正常' : '異常');
    else if (e.type === 'verification') detail = e.ok ? '検証パス' : '検証失敗';
    else if (e.type === 'health_propagation') detail = `圧力: ${e.healthGraph?.pressure ?? 0}`;

    return timelineEvent(e.type.replace(/_/g, ' '), detail, e.timestamp, typeColor);
  }).join('');

  const content = `${surfaceHeader('Governance · Timeline', 'ガバナンスタイムライン', SURFACE_COLORS.accentIce)}
    <div style="margin-top:6px;">${eventsHtml || '<div style="font-size:8px;color:' + SURFACE_COLORS.textDim + ';">イベントなし</div>'}</div>`;

  return surfaceCard(SURFACE_COLORS.accentIce, content);
}

// ── Build ──

export function buildCollapseControl() {
  return makeDashboard({
    uid: 'samvklp',
    title: '崩壊制御 — Collapse Control',
    description: 'Federation Runtime 崩壊制御 Operational Surface — ヘルス・依存関係・ガバナンス・SLAリスク・圧力ヒートマップ',
    panels: [
      makeTextPanel({ id: 1, gridPos: { h: 1, w: 24, x: 0, y: 0 },
        content: surfaceSectionHeader('崩壊制御 Collapse Control', 'ヘルス · 依存関係 · ガバナンス · 圧力', SURFACE_COLORS.critical) }),
      makeTextPanel({ id: 10, gridPos: { h: 8, w: 8, x: 0, y: 1 }, content: healthSurfacePanel() }),
      makeTextPanel({ id: 11, gridPos: { h: 8, w: 8, x: 8, y: 1 }, content: dependencyCollapsePanel() }),
      makeTextPanel({ id: 12, gridPos: { h: 8, w: 8, x: 16, y: 1 }, content: governanceLockPanel() }),
      makeTextPanel({ id: 20, gridPos: { h: 6, w: 8, x: 0, y: 9 }, content: slaRiskPanel() }),
      makeTextPanel({ id: 21, gridPos: { h: 6, w: 8, x: 8, y: 9 }, content: collapsePressurePanel() }),
      makeTextPanel({ id: 22, gridPos: { h: 6, w: 8, x: 16, y: 9 }, content: governanceTimelinePanel() }),
      makeTextPanel({ id: 30, gridPos: { h: 5, w: 12, x: 0, y: 15 }, content: stateTransitionPanelHtml() }),
      makeTextPanel({ id: 31, gridPos: { h: 5, w: 12, x: 12, y: 15 }, content: rollbackLineagePanelHtml() }),
    ],
  });
}
