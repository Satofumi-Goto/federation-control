import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeFederationLiveState, liveStateMetricsHtml } from './federation-live-state.mjs';
import { persistenceNoticeHtml } from './federation-persistence.mjs';
import { cardBase, svgDataUri } from './runtime-workspace-theme.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const memoryPath = path.resolve(__dirname, '../../runtime_data/runtime-federation-memory.json');

const NODE_COLORS = {
  collapse: '#ef4444',
  stable: '#0ea5e9',
  knowledge: '#8b5cf6',
  draft: '#eab308',
};

const OBSIDIAN_ROLES = [
  { label: 'ADR', color: '#7c3aed' },
  { label: 'Runtime Note', color: '#6366f1' },
  { label: 'Collapse Note', color: '#ef4444' },
  { label: 'Federation Link', color: '#0891b2' },
  { label: 'Knowledge Cluster', color: '#a855f7' },
];

export function loadRuntimeFederationMemory() {
  try {
    return JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
  } catch {
    return { knowledgeGraph: { nodes: [], edges: [] }, federationLive: {} };
  }
}

function buildFederationGraphSvg(memory, live) {
  const kg = memory.knowledgeGraph ?? {};
  const nodes = kg.nodes ?? [];
  const edges = kg.edges ?? [];
  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const pulse = live.collapseRisk > 40 ? 1.4 : 1;

  const edgeSvg = (edges || [])
    .map(([from, to]) => {
      const a = nodeById[from];
      const b = nodeById[to];
      if (!a || !b) return '';
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#94a3b8" stroke-width="${pulse}"/>`;
    })
    .join('');

  const nodeSvg = nodes
    .map((n) => {
      const fill = NODE_COLORS[n.kind] ?? NODE_COLORS.stable;
      const r = n.kind === 'collapse' ? 9 : 8;
      return `<circle cx="${n.x}" cy="${n.y}" r="${r}" fill="${fill}"/><text x="${n.x}" y="${n.y + 18}" text-anchor="middle" font-size="8" fill="#475569" font-family="system-ui,sans-serif">${n.label}</text>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 580 180" width="580" height="180">${edgeSvg}${nodeSvg}</svg>`;
}

function buildObsidianRoleSvg() {
  const positions = [
    [100, 90, 'ADR'],
    [200, 45, 'Runtime Note'],
    [300, 70, 'Collapse Note'],
    [400, 95, 'Federation Link'],
    [500, 55, 'Knowledge Cluster'],
  ];
  const nodes = positions
    .map(
      ([x, y, label], i) => {
        const c = OBSIDIAN_ROLES[i]?.color ?? '#8b5cf6';
        return `<circle cx="${x}" cy="${y}" r="11" fill="${c}"/><text x="${x}" y="${y + 22}" text-anchor="middle" font-size="7" fill="#5b21b6" font-family="system-ui,sans-serif">${label}</text>`;
      },
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 580 180" width="580" height="180">
    <line x1="100" y1="90" x2="200" y2="45" stroke="#c4b5fd" stroke-width="1.2"/>
    <line x1="200" y1="45" x2="300" y2="70" stroke="#c4b5fd" stroke-width="1.2"/>
    <line x1="300" y1="70" x2="400" y2="95" stroke="#c4b5fd" stroke-width="1.2"/>
    <line x1="400" y1="95" x2="500" y2="55" stroke="#c4b5fd" stroke-width="1.2"/>
    ${nodes}
  </svg>`;
}

export function obsidianKnowledgeGraphPanelHtml(href) {
  const svg = buildObsidianRoleSvg();
  const graphImg = `<img alt="Obsidian Knowledge Graph" width="580" height="118" style="width:100%;height:118px;object-fit:contain;display:block;" src="${svgDataUri(svg)}" />`;
  const roleChips = OBSIDIAN_ROLES.map(
    (r) =>
      `<span style="padding:2px 7px;border-radius:999px;font-size:8px;font-weight:700;color:${r.color};background:${r.color}18;border:1px solid ${r.color}44;">${r.label}</span>`,
  ).join('');

  return `<a href="${href}" style="display:block;width:100%;height:100%;min-height:0;overflow:hidden;padding:12px;text-decoration:none;${cardBase};box-shadow:0 1px 2px rgba(15,23,42,.04);border-left:3px solid #8b5cf6;">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
      <div>
        <div style="font-size:10px;font-weight:600;color:#7c3aed;letter-spacing:.06em;">Obsidian · Knowledge role</div>
        <div style="font-size:17px;font-weight:700;margin-top:3px;color:var(--text-primary,#111827);">Obsidian Knowledge Graph</div>
      </div>
      <div style="font-size:9px;font-weight:600;color:#7c3aed;text-align:right;">Design source</div>
    </div>
    <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">${roleChips}</div>
    <div style="margin-top:6px;height:118px;border-radius:10px;background:linear-gradient(180deg,#faf5ff,#f5f3ff);border:1px solid #e9d5ff;overflow:hidden;">${graphImg}</div>
  </a>`;
}

export function federationGraphPanelHtml(href, memory = loadRuntimeFederationMemory()) {
  const live = computeFederationLiveState(memory);
  const svg = buildFederationGraphSvg(memory, live);
  const graphImg = `<img alt="Federation Graph" width="580" height="90" style="width:100%;height:90px;object-fit:contain;display:block;" src="${svgDataUri(svg)}" />`;
  const metrics = liveStateMetricsHtml(live);

  return `<a href="${href}" style="display:block;width:100%;height:100%;min-height:0;overflow:hidden;padding:12px;text-decoration:none;${cardBase};box-shadow:0 1px 2px rgba(15,23,42,.04);border-left:3px solid #0891b2;">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
      <div>
        <div style="font-size:10px;font-weight:600;color:#0891b2;letter-spacing:.06em;">Federation · Live state</div>
        <div style="font-size:17px;font-weight:700;margin-top:3px;color:var(--text-primary,#111827);">Federation Graph</div>
      </div>
      <div style="font-size:9px;font-weight:600;color:#0891b2;text-align:right;">${live.mode} · ${live.ageSec}s</div>
    </div>
    <div style="margin-top:6px;display:grid;grid-template-columns:repeat(3,1fr);gap:5px;">${metrics}</div>
    <div style="margin-top:6px;height:90px;border-radius:10px;background:var(--background-secondary,#f8fafc);border:1px solid var(--border-weak,#e5e7eb);overflow:hidden;">${graphImg}</div>
    ${persistenceNoticeHtml()}
  </a>`;
}

/** @deprecated */
export function runtimeFederationGraphPanelHtml(href, memory) {
  return federationGraphPanelHtml(href, memory);
}

export function collapseControlPanelHtml() {
  return '';
}
