import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardBase, svgDataUri } from './runtime-workspace-theme.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const memoryPath = path.resolve(__dirname, '../../runtime_data/runtime-federation-memory.json');

const NODE_COLORS = {
  collapse: '#ef4444',
  stable: '#0ea5e9',
  knowledge: '#8b5cf6',
  draft: '#eab308',
};

export function loadRuntimeFederationMemory() {
  try {
    return JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
  } catch {
    return { knowledgeGraph: { nodes: [], edges: [] }, collapseControl: {} };
  }
}

function buildKnowledgeGraphSvg(memory) {
  const kg = memory.knowledgeGraph ?? {};
  const nodes = kg.nodes ?? [];
  const edges = kg.edges ?? [];
  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));

  const edgeSvg = (edges || [])
    .map(([from, to]) => {
      const a = nodeById[from];
      const b = nodeById[to];
      if (!a || !b) return '';
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#cbd5e1" stroke-width="1.2"/>`;
    })
    .join('');

  const nodeSvg = nodes
    .map((n) => {
      const fill = NODE_COLORS[n.kind] ?? NODE_COLORS.stable;
      return `<circle cx="${n.x}" cy="${n.y}" r="8" fill="${fill}"/><text x="${n.x}" y="${n.y + 18}" text-anchor="middle" font-size="8" fill="#475569" font-family="system-ui,sans-serif">${n.label}</text>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 580 180" width="580" height="180">${edgeSvg}${nodeSvg}</svg>`;
}

export function knowledgeGraphPanelHtml(href, memory = loadRuntimeFederationMemory()) {
  const kg = memory.knowledgeGraph ?? {};
  const title = kg.title ?? 'Growing Runtime Knowledge Graph';
  const sources = (kg.growthSources ?? []).join(' · ');
  const svg = buildKnowledgeGraphSvg(memory);
  const graphImg = `<img alt="${title}" width="580" height="118" style="width:100%;height:118px;object-fit:contain;display:block;" src="${svgDataUri(svg)}" />`;

  const legend = `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:8px;font-size:9px;color:var(--text-secondary,#64748b);">
    <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444;vertical-align:middle;margin-right:3px;"></span>崩壊しやすい</span>
    <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#0ea5e9;vertical-align:middle;margin-right:3px;"></span>安定</span>
    <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#8b5cf6;vertical-align:middle;margin-right:3px;"></span>Knowledge</span>
    <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#eab308;vertical-align:middle;margin-right:3px;"></span>Draft/未同期</span>
  </div>`;

  return `<a href="${href}" style="display:block;width:100%;height:100%;min-height:0;overflow:hidden;padding:12px;text-decoration:none;${cardBase};box-shadow:0 1px 2px rgba(15,23,42,.04);">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
      <div>
        <div style="font-size:10px;font-weight:600;color:#0891b2;letter-spacing:.06em;">Runtime Federation Memory</div>
        <div style="font-size:17px;font-weight:700;margin-top:3px;color:var(--text-primary,#111827);">${title}</div>
      </div>
      <div style="font-size:9px;font-weight:600;color:var(--text-secondary,#64748b);text-align:right;max-width:42%;line-height:1.35;">Memory参照</div>
    </div>
    <div style="margin-top:6px;font-size:9px;color:var(--text-secondary,#64748b);line-height:1.4;">Growth: ${sources}</div>
    <div style="margin-top:6px;height:118px;border-radius:10px;background:var(--background-secondary,#f8fafc);border:1px solid var(--border-weak,#e5e7eb);overflow:hidden;">${graphImg}</div>
    ${legend}
  </a>`;
}

function toneColor(tone) {
  if (tone === 'warn') return '#f59e0b';
  if (tone === 'bad') return '#ef4444';
  return '#22c55e';
}

export function collapseControlPanelHtml(href, memory = loadRuntimeFederationMemory()) {
  const cc = memory.collapseControl ?? {};
  const ring = cc.imminent ?? [];
  const ringColors = ['#f59e0b', '#38bdf8', '#8b5cf6', '#ef4444', '#22c55e'];
  let offset = 0;
  const ringTotal = ring.reduce((s, r) => s + (r.pct ?? 0), 0) || 100;
  const ringGradient = ring
    .map((r, i) => {
      const pct = ((r.pct ?? 0) / ringTotal) * 100;
      const start = offset;
      offset += pct;
      const color = ringColors[i % ringColors.length];
      return `${color} ${start}% ${offset}%`;
    })
    .join(',');

  const legend = ring
    .map((r, i) => {
      const color = ringColors[i % ringColors.length];
      return `<div style="display:flex;align-items:center;gap:5px;color:var(--text-secondary,#64748b);font-size:9px;"><span style="width:7px;height:7px;border-radius:50%;background:${color};flex:0 0 auto;"></span><span>${r.label} ${r.pct}%</span></div>`;
    })
    .join('');

  const donut = `<div style="width:86px;height:86px;border-radius:50%;background:conic-gradient(from -90deg,${ringGradient});position:relative;justify-self:center;"><div style="position:absolute;top:13px;left:13px;right:13px;bottom:13px;border-radius:50%;background:var(--background-primary,#fff);display:flex;align-items:center;justify-content:center;text-align:center;font-size:9px;font-weight:700;line-height:1.25;color:var(--text-primary,#111827);">直ぐに<br/>崩壊</div></div>`;

  const barColors = ['#f59e0b', '#38bdf8', '#ef4444', '#8b5cf6'];
  const bars = (cc.propagation ?? [])
    .map(
      (r, i) =>
        `<div style="display:grid;grid-template-columns:88px 1fr 28px;align-items:center;gap:5px;margin-bottom:3px;"><div style="font-size:9px;color:var(--text-secondary,#64748b);">${r.label}</div><div style="height:7px;background:#f1f5f9;border-radius:999px;overflow:hidden;"><div style="height:7px;width:${r.pct}%;background:${barColors[i % barColors.length]};border-radius:999px;"></div></div><div style="font-size:9px;text-align:right;color:var(--text-secondary,#64748b);">${r.pct}</div></div>`,
    )
    .join('');

  const feas = cc.feasibility ?? [];
  const nums = feas
    .map((f) => {
      const c = toneColor(f.tone);
      return `<div style="padding:5px 4px;background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);border-left:3px solid ${c};border-radius:7px;min-width:0;"><div style="font-size:8px;color:var(--text-secondary,#64748b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.label}</div><div style="font-size:13px;font-weight:700;color:var(--text-primary,#111827);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.value}</div></div>`;
    })
    .join('');

  const eventCount = (memory.runtimeSeneschalEvents ?? []).length;

  return `<a href="${href}" style="display:block;width:100%;height:100%;min-height:0;overflow:hidden;padding:10px 12px;text-decoration:none;${cardBase};box-shadow:0 1px 2px rgba(15,23,42,.04);">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
      <div>
        <div style="font-size:10px;font-weight:600;color:#0891b2;">崩壊制御 Runtime</div>
        <div style="font-size:17px;font-weight:700;margin-top:2px;color:var(--text-primary,#111827);">運行制御アーキテクチャ</div>
      </div>
      <div style="font-size:9px;font-weight:700;color:#d97706;text-align:right;">3段構造<br/>Seneschal ${eventCount}</div>
    </div>
    <div style="display:grid;grid-template-columns:108px 1fr;gap:8px;align-items:center;margin-top:6px;padding:6px;background:var(--background-secondary,#f8fafc);border:1px solid var(--border-weak,#e5e7eb);border-radius:10px;">${donut}<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;">${legend}</div></div>
    <div style="margin-top:5px;padding:6px;background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);border-radius:8px;">${bars}</div>
    <div style="margin-top:5px;display:grid;grid-template-columns:repeat(3,1fr);gap:5px;">${nums}</div>
  </a>`;
}

export function memoryStatusStripHtml(memory = loadRuntimeFederationMemory()) {
  const consoles = memory.consoles ?? {};
  const chips = Object.entries(consoles)
    .map(([key, state]) => {
      const sig = state.collapseSignal ?? '—';
      const label = key === 'serviceHub' ? 'Hub' : key === 'life' ? 'Life' : key.charAt(0).toUpperCase() + key.slice(1);
      return `<span style="padding:2px 6px;border-radius:6px;background:#f1f5f9;border:1px solid #e5e7eb;font-size:9px;color:#475569;">${label}: ${sig}</span>`;
    })
    .join('');
  const updated = memory.updatedAt ? new Date(memory.updatedAt).toLocaleString('ja-JP') : '—';
  return `<div style="width:100%;padding:4px 8px;font-size:9px;color:var(--text-secondary,#64748b);border-top:1px solid var(--border-weak,#e5e7eb);margin-top:4px;">Memory ${updated} · ${chips}</div>`;
}
