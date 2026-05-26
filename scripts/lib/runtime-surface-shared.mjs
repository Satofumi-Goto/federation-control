/**
 * Shared utilities for Federation Runtime Operational Surface dashboards.
 *
 * Provides data loaders (from runtime_data/), visual primitives
 * (gauges, grids, timeline bars, dependency arcs), and color tokens
 * used across collapse-control, collapse-analysis, repair-impact,
 * repair-proposal, and implement-progress dashboards.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(__dirname, '../../runtime_data');

// ── Color tokens ──

export const SURFACE_COLORS = {
  base: '#1e293b',
  card: '#0f172a',
  cardBorder: '#334155',
  headerBorder: '#06b6d4',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  textDim: '#64748b',
  accentCyan: '#06b6d4',
  accentIce: '#67e8f9',
  accentSteel: '#38bdf8',
  accentTeal: '#14b8a6',
  healthy: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
  repairing: '#34d399',
  blocked: '#f97316',
  collapsed: '#991b1b',
  nominal: '#06b6d4',
  degraded: '#f97316',
  standby: '#475569',
};

export const SEVERITY_COLORS = {
  healthy: SURFACE_COLORS.healthy,
  nominal: SURFACE_COLORS.nominal,
  operational: SURFACE_COLORS.healthy,
  active: SURFACE_COLORS.accentCyan,
  warning: SURFACE_COLORS.warning,
  'at-risk': SURFACE_COLORS.warning,
  degraded: SURFACE_COLORS.degraded,
  critical: SURFACE_COLORS.critical,
  blocked: SURFACE_COLORS.blocked,
  collapsed: SURFACE_COLORS.collapsed,
  standby: SURFACE_COLORS.standby,
  repairing: SURFACE_COLORS.repairing,
};

// ── Data loaders ──

function loadJson(filename) {
  try { return JSON.parse(fs.readFileSync(path.resolve(DATA_ROOT, filename), 'utf8')); }
  catch { return null; }
}

export function loadHealthGraph() { return loadJson('runtime-federation-health-graph.json'); }
export function loadDigitalTwin() { return loadJson('runtime-operational-digital-twin-graph.json'); }
export function loadRepairAudit() { return loadJson('runtime-repair-audit-log.json'); }
export function loadGovernanceTimeline() { return loadJson('runtime-governance-timeline.json'); }
export function loadOrchestrationState() { return loadJson('runtime-orchestration-state.json'); }
export function loadSlaExecution() { return loadJson('runtime-sla-slo-execution-result.json'); }
export function loadLockState() { return loadJson('runtime-invocation-lock-state.json'); }
export function loadAdaptiveTopology() { return loadJson('runtime-adaptive-topology-result.json'); }
export function loadFederationMemory() { return loadJson('runtime-federation-memory.json'); }
export function loadEnvironmentState() { return loadJson('runtime-environment-state.json'); }
export function loadExecutionResult() { return loadJson('runtime-execution-result.json'); }
export function loadHeadlessSession() { return loadJson('runtime-headless-session.json'); }
export function loadServiceState() { return loadJson('runtime-service-state.json'); }
export function loadInfraTopology() { return loadJson('runtime-infrastructure-topology-graph.json'); }
export function loadDomainModel() { return loadJson('runtime-federation-domain-model.json'); }
export function loadAutonomousCoord() { return loadJson('runtime-autonomous-coordination-result.json'); }
export function loadEvolutionProposals() { return loadJson('runtime-evolution-proposals.json'); }
export function loadEmergencyCommand() { return loadJson('runtime-emergency-command-result.json'); }
export function loadOperationalSnapshot() { return loadJson('runtime-operational-snapshot.json'); }
export function loadTriggerSupervisor() { return loadJson('runtime-trigger-supervisor-state.json'); }
export function loadChangeControl() { return loadJson('runtime-change-control-board.json'); }
export function loadStructuralEvolution() { return loadJson('runtime-structural-evolution-model.json'); }

// ── Escape helper ──

export function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── SVG helper ──

export function svgDataUri(svg) {
  return `data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}`;
}

// ── Surface card wrapper ──

export function surfaceCard(borderColor, content) {
  return `<div style="width:100%;height:100%;min-height:0;overflow:auto;padding:10px;background:${SURFACE_COLORS.card};border:1px solid ${SURFACE_COLORS.cardBorder};border-radius:10px;border-left:3px solid ${borderColor};box-sizing:border-box;color:${SURFACE_COLORS.text};font-family:system-ui,-apple-system,sans-serif;">${content}</div>`;
}

export function surfaceHeader(label, title, accentColor) {
  return `<div style="font-size:9px;font-weight:600;color:${accentColor};letter-spacing:.06em;text-transform:uppercase;">${esc(label)}</div>
  <div style="font-size:14px;font-weight:700;margin-top:2px;color:${SURFACE_COLORS.text};">${esc(title)}</div>`;
}

export function surfaceSectionHeader(title, subtitle, borderColor) {
  return `<div style="width:100%;height:100%;min-height:0;display:flex;align-items:center;padding:4px 12px;background:${SURFACE_COLORS.card};border:1px solid ${SURFACE_COLORS.cardBorder};border-radius:8px;border-bottom:2px solid ${borderColor};box-sizing:border-box;">
    <div style="font-size:13px;font-weight:800;color:${SURFACE_COLORS.text};letter-spacing:.02em;">${esc(title)}</div>
    <div style="margin-left:10px;font-size:9px;color:${SURFACE_COLORS.textDim};">${esc(subtitle)}</div>
  </div>`;
}

// ── Visual primitives ──

export function miniBar(label, value, max, color) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return `<div style="margin-bottom:4px;">
    <div style="display:flex;justify-content:space-between;font-size:9px;color:${SURFACE_COLORS.textMuted};margin-bottom:1px;">
      <span>${esc(label)}</span><span style="font-weight:700;color:${color};">${value}</span>
    </div>
    <div style="height:4px;border-radius:2px;background:#1e293b;overflow:hidden;">
      <div style="height:100%;width:${pct}%;background:${color};border-radius:2px;"></div>
    </div>
  </div>`;
}

export function miniGauge(label, pct, color) {
  const clamped = Math.min(100, Math.max(0, pct));
  return `<div style="margin-bottom:3px;">
    <div style="display:flex;justify-content:space-between;font-size:8px;color:${SURFACE_COLORS.textMuted};">
      <span>${esc(label)}</span><span style="font-weight:700;color:${color};">${clamped}%</span>
    </div>
    <div style="height:3px;border-radius:2px;background:#1e293b;">
      <div style="height:100%;width:${clamped}%;background:${color};border-radius:2px;"></div>
    </div>
  </div>`;
}

export function stateDot(state, size = 7) {
  const color = SEVERITY_COLORS[state] || SURFACE_COLORS.standby;
  return `<div style="display:inline-flex;align-items:center;gap:3px;">
    <div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};box-shadow:0 0 4px ${color}66;"></div>
    <span style="font-size:9px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.04em;">${esc(state)}</span>
  </div>`;
}

export function bigMetric(value, unit, color) {
  return `<span style="font-size:26px;font-weight:900;color:${color};letter-spacing:-0.02em;">${esc(String(value))}</span>
  <span style="font-size:10px;font-weight:600;color:${SURFACE_COLORS.textMuted};margin-left:3px;">${esc(unit)}</span>`;
}

export function stateChip(label, state) {
  const color = SEVERITY_COLORS[state] || SURFACE_COLORS.standby;
  return `<span style="padding:2px 6px;border-radius:4px;font-size:8px;font-weight:700;color:${color};background:${color}18;border:1px solid ${color}44;">${esc(label)}</span>`;
}

export function dataRow(label, value, color) {
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid ${SURFACE_COLORS.cardBorder};">
    <span style="font-size:9px;color:${SURFACE_COLORS.textMuted};">${esc(label)}</span>
    <span style="font-size:10px;font-weight:700;color:${color ?? SURFACE_COLORS.text};">${esc(String(value))}</span>
  </div>`;
}

export function timelineEvent(type, detail, timestamp, color) {
  const time = timestamp ? new Date(timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '--:--';
  return `<div style="display:flex;align-items:flex-start;gap:6px;padding:3px 0;border-bottom:1px solid ${SURFACE_COLORS.cardBorder};">
    <div style="width:6px;height:6px;border-radius:50%;background:${color};margin-top:4px;flex-shrink:0;"></div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:9px;font-weight:700;color:${color};text-transform:uppercase;">${esc(type)}</div>
      <div style="font-size:8px;color:${SURFACE_COLORS.textMuted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(detail)}</div>
    </div>
    <div style="font-size:8px;color:${SURFACE_COLORS.textDim};flex-shrink:0;">${time}</div>
  </div>`;
}

export function dependencyArc(from, to, type, healthy) {
  const color = healthy ? SURFACE_COLORS.accentCyan : SURFACE_COLORS.critical;
  return `<div style="display:flex;align-items:center;gap:4px;padding:2px 0;font-size:9px;">
    <span style="font-weight:700;color:${color};">${esc(from)}</span>
    <span style="color:${SURFACE_COLORS.textDim};">→</span>
    <span style="font-weight:700;color:${color};">${esc(to)}</span>
    <span style="font-size:7px;color:${SURFACE_COLORS.textDim};margin-left:auto;">${esc(type)}</span>
  </div>`;
}

// ── Dependency matrix (grid visualization) ──

export function dependencyMatrixSvg(nodes, deps, width = 300, height = 160) {
  const n = Math.min(nodes.length, 12);
  const items = nodes.slice(0, n);
  const cellSize = Math.floor(Math.min((width - 80) / n, (height - 40) / n));
  const ox = 70, oy = 30;

  let cells = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const dep = deps.find(d => d.from === items[r].id && d.to === items[c].id);
      const fill = dep ? (dep.healthy !== false ? '#06b6d4' : '#ef4444') : '#1e293b';
      const opacity = dep ? '0.8' : '0.3';
      cells += `<rect x="${ox + c * cellSize}" y="${oy + r * cellSize}" width="${cellSize - 1}" height="${cellSize - 1}" rx="2" fill="${fill}" fill-opacity="${opacity}"/>`;
    }
  }

  const labels = items.map((item, i) => {
    const color = SEVERITY_COLORS[item.health || item.state] || '#94a3b8';
    return `<text x="${ox - 4}" y="${oy + i * cellSize + cellSize / 2 + 3}" text-anchor="end" font-size="7" fill="${color}" font-family="system-ui">${item.id.slice(0, 8)}</text>
    <text x="${ox + i * cellSize + cellSize / 2}" y="${oy - 4}" text-anchor="middle" font-size="6" fill="#64748b" font-family="system-ui" transform="rotate(-45 ${ox + i * cellSize + cellSize / 2} ${oy - 4})">${item.id.slice(0, 6)}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${labels}${cells}</svg>`;
}

// ── Pressure heatmap SVG ──

export function pressureHeatmapSvg(nodes, width = 300, height = 80) {
  const n = nodes.length || 1;
  const cellW = Math.floor((width - 10) / n);
  const cellH = height - 20;

  const cells = nodes.map((node, i) => {
    const p = node.pressure ?? 0;
    const color = p > 60 ? '#ef4444' : p > 30 ? '#f59e0b' : p > 10 ? '#06b6d4' : '#22c55e';
    const opacity = Math.max(0.3, Math.min(1, p / 80));
    return `<rect x="${5 + i * cellW}" y="12" width="${cellW - 2}" height="${cellH}" rx="3" fill="${color}" fill-opacity="${opacity}"/>
    <text x="${5 + i * cellW + cellW / 2}" y="${cellH + 22}" text-anchor="middle" font-size="6" fill="#94a3b8" font-family="system-ui">${(node.id || '').slice(0, 6)}</text>
    <text x="${5 + i * cellW + cellW / 2}" y="${cellH / 2 + 15}" text-anchor="middle" font-size="8" fill="#fff" font-weight="700" font-family="system-ui">${p}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${cells}</svg>`;
}

// ── Grafana dashboard skeleton ──

export function makeDashboard({ uid, title, description, panels }) {
  return {
    uid,
    editable: true,
    schemaVersion: 39,
    title,
    version: 1,
    refresh: '30s',
    timezone: 'browser',
    description,
    tags: ['federation-runtime', 'operational-surface'],
    style: 'dark',
    panels,
  };
}

export function makeTextPanel({ id, gridPos, title = '', content, transparent = true }) {
  return {
    id,
    type: 'text',
    title,
    transparent,
    pluginVersion: '11.5.2',
    gridPos,
    options: { mode: 'html', content, code: { language: 'html', showLineNumbers: false, showMiniMap: false } },
  };
}
