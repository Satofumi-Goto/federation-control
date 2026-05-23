import fs from 'node:fs';
import path from 'node:path';
import { federationConnectPanelHtml } from './lib/federation-connect-panel.mjs';
import {
  collapseControlPanelHtml,
  knowledgeGraphPanelHtml,
  loadRuntimeFederationMemory,
} from './lib/runtime-federation-brain-panels.mjs';
import {
  resolveOperationalArchitectureHref,
  resolveRuntimeCenterHref,
} from './lib/runtime-topology.mjs';
import { cardBase, cardLink, navLink, textPanelOptions } from './lib/runtime-workspace-theme.mjs';

const routesPath = path.resolve('grafana/runtime-workspace-routes.json');
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));
const federationMemory = loadRuntimeFederationMemory();

const TEXT_PLUGIN_VERSION = '11.5.2';

function makeTextPanel({ id, gridPos, title = '', content, transparent = true }) {
  return {
    id,
    type: 'text',
    title,
    transparent,
    pluginVersion: TEXT_PLUGIN_VERSION,
    gridPos,
    options: textPanelOptions(content),
  };
}

function navCard(href, label, accentBorder) {
  return `<a href="${href}" style="${navLink};border-left:3px solid ${accentBorder};">${label}</a>`;
}

function operationalCard(href, title) {
  return `<a href="${href}" style="${cardLink}">${title}</a>`;
}

function row3Meta(routes, key) {
  return routes.row3ConsoleMeta?.[key] ?? { name: key };
}

const r = routes;
const runtimeCenterHref = resolveRuntimeCenterHref(r);
const operationalArchitectureHref = resolveOperationalArchitectureHref(r);
const row3 = r.row3;
const row4 = r.row4;
const discoveryLabel = r.row1.discoveryLabel ?? '連携探索';
const discoveryIcon = r.row1.discoveryIcon ?? '🤝';
const row3Title = row3.title ?? 'Operational Systems';
const row4Title = row4.title ?? 'System Artifacts';
const row4StartY = r.row4Layout?.gridPos?.y ?? 14;

const headerLinkStyle =
  'display:flex;flex-direction:column;align-items:center;padding:6px 10px;border-radius:10px;background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);min-width:64px;text-decoration:none;color:var(--text-primary,#111827);';

const headerHtml = `<div style="width:100%;height:100%;min-height:0;overflow:hidden;display:flex;align-items:center;justify-content:space-between;padding:10px 18px;${cardBase};box-shadow:0 1px 2px rgba(15,23,42,.04);"><a href="${runtimeCenterHref}" style="text-decoration:none;color:inherit;"><div style="font-size:26px;font-weight:700;line-height:1.1;color:var(--text-primary,#111827);">Runtime</div><div style="margin-top:4px;font-size:11px;color:var(--text-secondary,#64748b);">Federation Brain</div></a><div style="display:flex;gap:12px;flex-shrink:0;"><a href="${r.row1.discovery}" style="${headerLinkStyle}"><div style="font-size:22px;line-height:1;">${discoveryIcon}</div><div style="font-size:11px;margin-top:4px;font-weight:700;color:#0891b2;">${discoveryLabel}</div></a><a href="${r.row1.needsTranslation}" style="${headerLinkStyle}"><div style="font-size:22px;line-height:1;">🗣️</div><div style="font-size:11px;margin-top:4px;font-weight:700;color:#d97706;">Needs翻訳</div></a><a href="${r.row1.alignment ?? r.row1.alliance}" style="${headerLinkStyle}"><div style="font-size:22px;line-height:1;">🧩</div><div style="font-size:11px;margin-top:4px;font-weight:700;color:#7c3aed;">アライメント</div></a></div></div>`;

const row3Cards = [
  ['fleetOperation', row3.fleetOperation],
  ['serviceHub', row3.serviceHub],
  ['lifeTransaction', row3.lifeTransaction],
  ['urbanOperation', row3.urbanOperation],
];

const navItems = [
  [row4.collapseArchitecture, 'Collapse Control Architecture', '#ef4444'],
  [row4.functionalArchitecture, 'Functional Topology', '#0ea5e9'],
  [row4.sequenceDiagram, 'Federation Sequence', '#f59e0b'],
  [row4.plSimulation, 'Business Simulation', '#22c55e'],
  [row4.costRecoveryPlan, 'Cost Recovery', '#14b8a6'],
  [row4.wbs, 'Execution Planning', '#94a3b8'],
  [row4.serviceOperation, 'Service Operations', '#3b82f6'],
  [row4.pl, 'Profit & Loss', '#a855f7'],
  [row4.irr, 'Investment Return', '#eab308'],
];

const navPanels = navItems.map(([href, label, accent], index) => {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return makeTextPanel({
    id: 401 + index,
    gridPos: { h: 2, w: 8, x: col * 8, y: row4StartY + row * 2 },
    content: navCard(href, label, accent),
  });
});

const dashboard = {
  uid: 'sa8ljn4',
  editable: true,
  schemaVersion: 39,
  title: 'Runtime',
  version: 32,
  refresh: '30s',
  timezone: 'browser',
  description: 'Federated Operational Governance Workspace',
  tags: ['runtime','federation','governance'],
  links: [
    { title: 'Runtime', url: r.runtimeTopPath ?? '/d/sa8ljn4/runtime' },
    { title: discoveryLabel, url: r.row1.discovery },
    { title: 'Needs翻訳', url: r.row1.needsTranslation },
    { title: 'アライメント', url: r.row1.alignment ?? r.row1.alliance },
  ],
  panels: [
    makeTextPanel({ id: 100, gridPos: { h: 3, w: 24, x: 0, y: 0 }, content: headerHtml }),
    makeTextPanel({ id: 201, gridPos: { h: 5, w: 11, x: 0, y: 3 }, content: knowledgeGraphPanelHtml(r.row2.obsidianGraph, federationMemory) }),
    makeTextPanel({ id: 202, gridPos: { h: 5, w: 11, x: 11, y: 3 }, content: collapseControlPanelHtml(operationalArchitectureHref, federationMemory) }),
    makeTextPanel({ id: 203, title: 'Federation Add', gridPos: { h: 5, w: 2, x: 22, y: 3 }, content: federationConnectPanelHtml(r) }),
    makeTextPanel({ id: 300, gridPos: { h: 1, w: 24, x: 0, y: 8 }, content: `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:space-between;padding:0 6px;box-sizing:border-box;"><div style="font-size:12px;font-weight:700;color:var(--text-secondary,#64748b);letter-spacing:.14em;">${row3Title}</div><div style="font-size:16px;font-weight:700;">+</div></div>` }),
    ...row3Cards.map(([key, href], index) => { const meta = row3Meta(r, key); return makeTextPanel({ id: 311 + index, gridPos: { h: 4, w: 6, x: index * 6, y: 9 }, content: operationalCard(href, meta.name) }); }),
    makeTextPanel({ id: 350, gridPos: { h: 1, w: 24, x: 0, y: 13 }, content: `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:space-between;padding:0 6px;box-sizing:border-box;"><div style="font-size:12px;font-weight:700;color:var(--text-secondary,#64748b);letter-spacing:.14em;">${row4Title}</div><div style="font-size:16px;font-weight:700;">+</div></div>` }),
    ...navPanels,
  ],
};

const outPath = path.resolve('grafana/runtime-workspace-v2.json');
fs.writeFileSync(outPath, `${JSON.stringify(dashboard, null, 2)}\n`);
console.log(`Wrote ${outPath} (${dashboard.panels.length} panels, version ${dashboard.version})`);
