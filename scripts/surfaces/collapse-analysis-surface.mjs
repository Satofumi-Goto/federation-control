/**
 * collapse-analysis (崩壊解析) — Operational Surface Builder
 *
 * Real data sources:
 *   - runtime-operational-digital-twin-graph.json → domain drift, congestion
 *   - runtime-federation-health-graph.json        → propagation severity
 *   - runtime-repair-audit-log.json               → drift history
 *   - runtime-adaptive-topology-result.json       → topology actions
 *   - runtime-federation-memory.json              → knowledge graph for propagation
 *   - runtime-orchestration-state.json            → drift state
 *   - runtime-structural-evolution-model.json     → dependency cycle detection
 *
 * Graph types used:
 *   Propagation tree, drift heat surface, layered health bands,
 *   domain state grid, congestion flow map, topology action list
 */

import {
  SURFACE_COLORS, SEVERITY_COLORS, esc, svgDataUri,
  surfaceCard, surfaceHeader, surfaceSectionHeader,
  miniBar, miniGauge, stateDot, bigMetric, stateChip, dataRow,
  timelineEvent, dependencyArc, pressureHeatmapSvg,
  makeDashboard, makeTextPanel,
  driftTimelinePanelHtml,
  blastRadiusPanelHtml, governanceBlockPanelHtml,
  observabilityPanelHtml,
  loadDigitalTwin, loadHealthGraph, loadRepairAudit,
  loadAdaptiveTopology, loadFederationMemory, loadOrchestrationState,
  loadStructuralEvolution,
} from '../lib/runtime-surface-shared.mjs';

// ── Panel: Drift Origin Analysis ──

function driftOriginPanel() {
  const orch = loadOrchestrationState() ?? {};
  const twin = loadDigitalTwin() ?? {};
  const nodes = twin.nodes ?? [];

  const driftState = orch.driftState ?? 'unknown';
  const stateColor = SEVERITY_COLORS[driftState] || SURFACE_COLORS.textMuted;

  const domainRows = nodes.map(n => {
    const healthColor = SEVERITY_COLORS[n.health] || SURFACE_COLORS.textMuted;
    const stColor = SEVERITY_COLORS[n.state] || SURFACE_COLORS.textMuted;
    return `<div style="display:flex;align-items:center;gap:4px;padding:3px 0;border-bottom:1px solid ${SURFACE_COLORS.cardBorder};">
      <div style="width:5px;height:5px;border-radius:50%;background:${healthColor};"></div>
      <span style="font-size:9px;color:${SURFACE_COLORS.text};flex:1;font-weight:600;">${esc(n.domain?.replace(/-runtime$/, '') ?? n.id)}</span>
      ${stateChip(n.state, n.state)}
      <span style="font-size:8px;color:${n.pressure > 0 ? SURFACE_COLORS.warning : SURFACE_COLORS.textDim};">P:${n.pressure}</span>
    </div>`;
  }).join('');

  const content = `${surfaceHeader('Drift · Origin', 'ドリフト発生源解析', stateColor)}
    <div style="margin-top:4px;display:flex;align-items:baseline;gap:8px;">
      ${bigMetric(driftState, 'ドリフト状態', stateColor)}
    </div>
    <div style="margin-top:6px;font-size:8px;font-weight:600;color:${SURFACE_COLORS.textDim};text-transform:uppercase;">ドメイン別状態</div>
    <div style="margin-top:2px;max-height:200px;overflow-y:auto;">${domainRows}</div>`;

  return surfaceCard(stateColor, content);
}

// ── Panel: Propagation Tree ──

function propagationTreePanel() {
  const twin = loadDigitalTwin() ?? {};
  const deps = twin.dependencies ?? [];
  const nodes = twin.nodes ?? [];

  const nodeMap = {};
  for (const n of nodes) nodeMap[n.id] = n;

  const arcsHtml = deps.map(d => {
    const fromNode = nodeMap[d.from];
    const toNode = nodeMap[d.to];
    const fromHealth = fromNode?.health ?? 'unknown';
    const toHealth = toNode?.health ?? 'unknown';
    const fromColor = SEVERITY_COLORS[fromHealth] || SURFACE_COLORS.textMuted;
    const toColor = SEVERITY_COLORS[toHealth] || SURFACE_COLORS.textMuted;

    return `<div style="display:flex;align-items:center;gap:3px;padding:2px 0;font-size:9px;border-bottom:1px solid ${SURFACE_COLORS.cardBorder};">
      <span style="font-weight:700;color:${fromColor};">${esc(d.from)}</span>
      <span style="color:${SURFACE_COLORS.textDim};font-size:7px;">─${esc(d.type)}→</span>
      <span style="font-weight:700;color:${toColor};">${esc(d.to)}</span>
      <span style="margin-left:auto;font-size:7px;color:${d.latency > 0 ? SURFACE_COLORS.warning : SURFACE_COLORS.textDim};">L:${d.latency ?? 0}ms</span>
    </div>`;
  }).join('');

  const totalDeps = deps.length;
  const unhealthy = deps.filter(d => d.healthy === false).length;
  const healthyPct = totalDeps > 0 ? Math.round(((totalDeps - unhealthy) / totalDeps) * 100) : 100;

  const content = `${surfaceHeader('Propagation · Tree', '依存伝播ツリー', SURFACE_COLORS.accentTeal)}
    <div style="margin-top:4px;display:flex;gap:10px;">
      <div>${bigMetric(totalDeps, '依存パス', SURFACE_COLORS.accentCyan)}</div>
      <div>${bigMetric(healthyPct + '%', '健全率', healthyPct === 100 ? SURFACE_COLORS.healthy : SURFACE_COLORS.warning)}</div>
    </div>
    <div style="margin-top:6px;max-height:200px;overflow-y:auto;">${arcsHtml}</div>`;

  return surfaceCard(SURFACE_COLORS.accentTeal, content);
}

// ── Panel: Unsynced Layers / Congestion ──

function unsyncedLayersPanel() {
  const twin = loadDigitalTwin() ?? {};
  const congestion = twin.congestion ?? {};
  const hotspots = congestion.hotspots ?? [];
  const level = congestion.level ?? 'none';
  const levelColor = level === 'none' ? SURFACE_COLORS.healthy
    : level === 'low' ? SURFACE_COLORS.nominal
    : level === 'medium' ? SURFACE_COLORS.warning : SURFACE_COLORS.critical;

  const nodes = twin.nodes ?? [];
  const standbyNodes = nodes.filter(n => n.state === 'standby');
  const congestedNodes = nodes.filter(n => n.congestion > 0);

  const standbyHtml = standbyNodes.length > 0
    ? standbyNodes.map(n => dataRow(n.domain?.replace(/-runtime$/, '') ?? n.id, 'standby', SURFACE_COLORS.standby)).join('')
    : `<div style="font-size:8px;color:${SURFACE_COLORS.healthy};padding:2px 0;">全ドメイン稼働中</div>`;

  const congestedHtml = congestedNodes.length > 0
    ? congestedNodes.map(n => miniBar(n.domain?.replace(/-runtime$/, '') ?? n.id, n.congestion, 100, SURFACE_COLORS.warning)).join('')
    : `<div style="font-size:8px;color:${SURFACE_COLORS.healthy};padding:2px 0;">渋滞なし</div>`;

  const recoveryInfo = twin.recovery ?? {};
  const execInfo = twin.execution ?? {};

  const content = `${surfaceHeader('Unsync · Congestion', '非同期レイヤー / 渋滞', levelColor)}
    <div style="margin-top:4px;">${stateDot(level === 'none' ? 'healthy' : level)}</div>
    <div style="margin-top:6px;font-size:8px;font-weight:600;color:${SURFACE_COLORS.textDim};text-transform:uppercase;">スタンバイドメイン</div>
    <div style="margin-top:2px;">${standbyHtml}</div>
    <div style="margin-top:6px;font-size:8px;font-weight:600;color:${SURFACE_COLORS.textDim};text-transform:uppercase;">渋滞ドメイン</div>
    <div style="margin-top:2px;">${congestedHtml}</div>
    <div style="margin-top:6px;">
      ${dataRow('アクティブ復旧', recoveryInfo.activeRecoveries ?? 0, SURFACE_COLORS.repairing)}
      ${dataRow('保留改修', recoveryInfo.pendingRepairs ?? 0, SURFACE_COLORS.warning)}
      ${dataRow('キュー深度', execInfo.queueDepth ?? 0, SURFACE_COLORS.nominal)}
    </div>`;

  return surfaceCard(levelColor, content);
}

// ── Panel: Drift History (Repair Audit) ──

function driftHistoryPanel() {
  const audit = loadRepairAudit() ?? [];
  const recent = audit.slice(-8).reverse();

  const eventsHtml = recent.map(e => {
    const stateColor = e.monitorState === 'warning' ? SURFACE_COLORS.warning
      : e.monitorState === 'critical' ? SURFACE_COLORS.critical : SURFACE_COLORS.healthy;
    const detail = `D:${e.driftCount ?? 0} P:${e.proposalCount ?? 0} → ${e.decision ?? ''}`;
    return timelineEvent(e.monitorState ?? 'unknown', detail, e.timestamp, stateColor);
  }).join('');

  const totalDrift = audit.reduce((sum, e) => sum + (e.driftCount ?? 0), 0);
  const totalProposals = audit.reduce((sum, e) => sum + (e.proposalCount ?? 0), 0);
  const passRate = audit.length > 0
    ? Math.round((audit.filter(e => e.verificationPass).length / audit.length) * 100) : 0;

  const content = `${surfaceHeader('Drift · History', 'ドリフト履歴', SURFACE_COLORS.warning)}
    <div style="margin-top:4px;display:flex;gap:10px;">
      <div>${bigMetric(totalDrift, '検出', SURFACE_COLORS.warning)}</div>
      <div>${bigMetric(passRate + '%', '検証率', passRate === 100 ? SURFACE_COLORS.healthy : SURFACE_COLORS.warning)}</div>
    </div>
    <div style="margin-top:6px;">${eventsHtml || '<div style="font-size:8px;color:' + SURFACE_COLORS.textDim + ';">履歴なし</div>'}</div>`;

  return surfaceCard(SURFACE_COLORS.warning, content);
}

// ── Panel: Predicted Collapse Range ──

function predictedCollapsePanel() {
  const hg = loadHealthGraph() ?? {};
  const twin = loadDigitalTwin() ?? {};
  const nodes = twin.nodes ?? [];
  const govPressure = hg.governancePressure ?? 0;
  const propagation = hg.propagationSeverity ?? 0;

  const activeCount = nodes.filter(n => n.state === 'active').length;
  const standbyCount = nodes.filter(n => n.state === 'standby').length;
  const degradedCount = nodes.filter(n => n.health !== 'healthy').length;

  const riskScore = Math.min(100, govPressure * 2 + propagation * 3 + degradedCount * 15 + standbyCount * 5);
  const riskColor = riskScore > 60 ? SURFACE_COLORS.critical
    : riskScore > 30 ? SURFACE_COLORS.warning : SURFACE_COLORS.healthy;
  const riskLabel = riskScore > 60 ? '高リスク' : riskScore > 30 ? '要注意' : '安定';

  const growthRate = riskScore > 50 ? 1.12 : riskScore > 20 ? 1.04 : 0.97;
  const horizons = [
    { label: '現在', value: riskScore },
    { label: '15分後', value: Math.min(100, Math.round(riskScore * growthRate)) },
    { label: '30分後', value: Math.min(100, Math.round(riskScore * growthRate ** 2)) },
    { label: '1時間後', value: Math.min(100, Math.round(riskScore * growthRate ** 4)) },
  ];

  const barsHtml = horizons.map(h => {
    const c = h.value > 60 ? SURFACE_COLORS.critical : h.value > 30 ? SURFACE_COLORS.warning : SURFACE_COLORS.healthy;
    return miniGauge(h.label, h.value, c);
  }).join('');

  const content = `${surfaceHeader('Collapse · Prediction', '崩壊予測レンジ', riskColor)}
    <div style="margin-top:4px;display:flex;align-items:baseline;gap:6px;">
      ${bigMetric(riskScore, 'リスクスコア', riskColor)}
      ${stateChip(riskLabel, riskScore > 60 ? 'critical' : riskScore > 30 ? 'warning' : 'healthy')}
    </div>
    <div style="margin-top:6px;">${barsHtml}</div>
    <div style="margin-top:6px;">
      ${dataRow('稼働ドメイン', activeCount, SURFACE_COLORS.healthy)}
      ${dataRow('スタンバイ', standbyCount, SURFACE_COLORS.standby)}
      ${dataRow('劣化ドメイン', degradedCount, degradedCount > 0 ? SURFACE_COLORS.warning : SURFACE_COLORS.healthy)}
    </div>`;

  return surfaceCard(riskColor, content);
}

// ── Panel: Topology Adaptation ──

function topologyAdaptationPanel() {
  const adapt = loadAdaptiveTopology() ?? {};
  const actions = adapt.actions ?? [];
  const byArea = adapt.actionsByArea ?? {};
  const priority = adapt.prioritySummary ?? {};

  const actionsHtml = actions.map(a => {
    const color = a.priority === 'high' ? SURFACE_COLORS.critical
      : a.priority === 'medium' ? SURFACE_COLORS.warning : SURFACE_COLORS.nominal;
    return `<div style="padding:4px 0;border-bottom:1px solid ${SURFACE_COLORS.cardBorder};">
      <div style="display:flex;align-items:center;gap:4px;">
        ${stateChip(a.priority, a.priority === 'high' ? 'critical' : a.priority === 'medium' ? 'warning' : 'nominal')}
        <span style="font-size:9px;font-weight:700;color:${color};">${esc(a.type)}</span>
      </div>
      <div style="font-size:8px;color:${SURFACE_COLORS.textMuted};margin-top:1px;">${esc(a.detail)}</div>
    </div>`;
  }).join('');

  const areaRows = Object.entries(byArea).map(([area, count]) =>
    dataRow(area, count, count > 0 ? SURFACE_COLORS.warning : SURFACE_COLORS.textDim)
  ).join('');

  const content = `${surfaceHeader('Topology · Adaptation', 'トポロジー適応', SURFACE_COLORS.accentSteel)}
    <div style="margin-top:4px;display:flex;gap:8px;">
      <div>${bigMetric(adapt.totalActions ?? 0, 'アクション', SURFACE_COLORS.accentSteel)}</div>
      <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">
        ${stateChip('高:' + (priority.high ?? 0), priority.high > 0 ? 'critical' : 'healthy')}
        ${stateChip('中:' + (priority.medium ?? 0), priority.medium > 0 ? 'warning' : 'healthy')}
        ${stateChip('低:' + (priority.low ?? 0), 'nominal')}
      </div>
    </div>
    <div style="margin-top:6px;">${actionsHtml || '<div style="font-size:8px;color:' + SURFACE_COLORS.textDim + ';">適応アクションなし</div>'}</div>
    <div style="margin-top:6px;font-size:8px;font-weight:600;color:${SURFACE_COLORS.textDim};text-transform:uppercase;">エリア別</div>
    <div style="margin-top:2px;">${areaRows}</div>
    <div style="margin-top:4px;">
      ${dataRow('ガバナンスブロック', adapt.governanceBlocked ?? 0, SURFACE_COLORS.textDim)}
      ${dataRow('安全ロック', adapt.safetyLocksEnforced ? '有効' : '無効', adapt.safetyLocksEnforced ? SURFACE_COLORS.healthy : SURFACE_COLORS.critical)}
    </div>`;

  return surfaceCard(SURFACE_COLORS.accentSteel, content);
}

// ── Build ──

export function buildCollapseAnalysis() {
  return makeDashboard({
    uid: 'saz2p8x',
    title: '崩壊解析 — Collapse Analysis',
    description: 'Federation Runtime 崩壊解析 Operational Surface — ドリフト・伝播・渋滞・予測・適応',
    panels: [
      makeTextPanel({ id: 1, gridPos: { h: 1, w: 24, x: 0, y: 0 },
        content: surfaceSectionHeader('崩壊解析 Collapse Analysis', 'ドリフト · 伝播 · 渋滞 · 予測 · 適応', SURFACE_COLORS.warning) }),
      makeTextPanel({ id: 10, gridPos: { h: 8, w: 8, x: 0, y: 1 }, content: driftOriginPanel() }),
      makeTextPanel({ id: 11, gridPos: { h: 8, w: 8, x: 8, y: 1 }, content: propagationTreePanel() }),
      makeTextPanel({ id: 12, gridPos: { h: 8, w: 8, x: 16, y: 1 }, content: unsyncedLayersPanel() }),
      makeTextPanel({ id: 20, gridPos: { h: 6, w: 8, x: 0, y: 9 }, content: driftHistoryPanel() }),
      makeTextPanel({ id: 21, gridPos: { h: 6, w: 8, x: 8, y: 9 }, content: predictedCollapsePanel() }),
      makeTextPanel({ id: 22, gridPos: { h: 6, w: 8, x: 16, y: 9 }, content: topologyAdaptationPanel() }),
      makeTextPanel({ id: 30, gridPos: { h: 5, w: 8, x: 0, y: 15 }, content: driftTimelinePanelHtml() }),
      makeTextPanel({ id: 31, gridPos: { h: 5, w: 8, x: 8, y: 15 }, content: blastRadiusPanelHtml() }),
      makeTextPanel({ id: 32, gridPos: { h: 5, w: 8, x: 16, y: 15 }, content: governanceBlockPanelHtml() }),
      makeTextPanel({ id: 40, gridPos: { h: 5, w: 24, x: 0, y: 20 }, content: observabilityPanelHtml() }),
    ],
  });
}
