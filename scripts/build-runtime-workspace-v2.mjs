import fs from 'node:fs';
import path from 'node:path';
import { federationConnectPanelHtml } from './lib/federation-connect-panel.mjs';
import {
  cardBase,
  cardLink,
  navLink,
  svgDataUri,
  textPanelOptions,
} from './lib/runtime-workspace-theme.mjs';

const routesPath = path.resolve('grafana/runtime-workspace-routes.json');
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));

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

function knowledgeGraphPanelHtml(href) {
  const nodes = [
    ['Runtime', 180, 68, '#0ea5e9'],
    ['Queue', 80, 42, '#f59e0b'],
    ['ODD', 292, 44, '#8b5cf6'],
    ['Constraint', 72, 122, '#ef4444'],
    ['ETA', 158, 148, '#38bdf8'],
    ['Dispatch', 280, 132, '#22c55e'],
    ['Fleet', 392, 74, '#3b82f6'],
    ['Energy', 392, 150, '#10b981'],
    ['HILS', 500, 54, '#64748b'],
    ['PL/IRR', 504, 138, '#eab308'],
  ];
  const edges = [
    [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [5, 6], [3, 2], [1, 4], [4, 5], [6, 7], [2, 8],
    [5, 9], [7, 9],
  ];
  const edgeSvg = edges
    .map(
      ([a, b]) =>
        `<line x1="${nodes[a][1]}" y1="${nodes[a][2]}" x2="${nodes[b][1]}" y2="${nodes[b][2]}" stroke="#cbd5e1" stroke-width="1.5"/>`
    )
    .join('');
  const nodeSvg = nodes
    .map(
      ([label, x, y, color]) =>
        `<circle cx="${x}" cy="${y}" r="9" fill="${color}"/><text x="${x}" y="${y + 22}" text-anchor="middle" font-size="9" fill="#475569" font-family="system-ui,sans-serif">${label}</text>`
    )
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 180" width="560" height="180">${edgeSvg}${nodeSvg}</svg>`;
  const graphImg = `<img alt="Knowledge Graph" width="560" height="118" style="width:100%;height:118px;object-fit:contain;display:block;" src="${svgDataUri(svg)}" />`;

  return `<a href="${href}" style="display:block;width:100%;height:100%;min-height:0;overflow:hidden;padding:12px;text-decoration:none;${cardBase};box-shadow:0 1px 2px rgba(15,23,42,.04);">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><div><div style="font-size:11px;font-weight:600;color:var(--text-secondary,#64748b);">Knowledge Graph</div><div style="font-size:18px;font-weight:700;margin-top:4px;color:var(--text-primary,#111827);">知識グラフ</div></div><div style="font-size:10px;font-weight:600;color:#0891b2;">Runtime全体参照</div></div>
    <div style="margin-top:8px;height:118px;border-radius:10px;background:var(--background-secondary,#f8fafc);border:1px solid var(--border-weak,#e5e7eb);overflow:hidden;">${graphImg}</div>
    <div style="margin-top:7px;display:flex;gap:6px;font-size:10px;color:var(--text-secondary,#64748b);"><span>Runtime</span><span>Queue</span><span>ODD</span><span>Constraint</span><span>Dispatch</span><span>PL</span></div>
  </a>`;
}

function collapseControlPanelHtml(href) {
  const ring = [
    ['Queue', 32, '#f59e0b'],
    ['ETA', 24, '#38bdf8'],
    ['ODD', 18, '#8b5cf6'],
    ['Constraint', 16, '#ef4444'],
    ['Dispatch', 10, '#22c55e'],
  ];
  const legend = ring
    .map(
      ([label, value, color]) =>
        `<div style="display:flex;align-items:center;gap:5px;min-width:0;color:var(--text-secondary,#64748b);"><span style="width:7px;height:7px;border-radius:50%;background:${color};display:inline-block;flex:0 0 auto;"></span><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label} ${value}%</span></div>`
    )
    .join('');
  const donut = `<div style="width:86px;height:86px;border-radius:50%;background:conic-gradient(from -90deg,#f59e0b 0% 32%,#38bdf8 32% 56%,#8b5cf6 56% 74%,#ef4444 74% 90%,#22c55e 90% 100%);position:relative;justify-self:center;"><div style="position:absolute;top:13px;left:13px;right:13px;bottom:13px;border-radius:50%;background:var(--background-primary,#fff);display:flex;align-items:center;justify-content:center;text-align:center;font-size:10px;font-weight:700;line-height:1.2;color:var(--text-primary,#111827);">直ぐに<br/>崩壊</div></div>`;
  const bars = [
    ['Queue→ETA', 86, '#f59e0b'],
    ['ETA→Dispatch', 72, '#38bdf8'],
    ['Constraint→ODD', 64, '#ef4444'],
    ['ODD→Fleet', 58, '#8b5cf6'],
  ]
    .map(
      ([label, value, color]) =>
        `<div style="display:grid;grid-template-columns:92px 1fr 30px;align-items:center;gap:6px;margin-bottom:4px;"><div style="font-size:10px;color:var(--text-secondary,#64748b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label}</div><div style="height:7px;background:#f1f5f9;border-radius:999px;overflow:hidden;"><div style="height:7px;width:${value}%;background:${color};border-radius:999px;"></div></div><div style="font-size:10px;color:var(--text-secondary,#64748b);text-align:right;">${value}</div></div>`
    )
    .join('');
  const nums = [
    ['成立率', '74%', '#22c55e'],
    ['Trips', '35/日', '#38bdf8'],
    ['Queue', '12分', '#f59e0b'],
    ['PL', '+18%', '#eab308'],
  ]
    .map(
      ([label, value, color]) =>
        `<div style="padding:6px;background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);border-left:3px solid ${color};border-radius:8px;min-width:0;"><div style="font-size:9px;color:var(--text-secondary,#64748b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label}</div><div style="font-size:15px;font-weight:700;color:var(--text-primary,#111827);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${value}</div></div>`
    )
    .join('');
  return `<a href="${href}" style="display:block;width:100%;height:100%;min-height:0;overflow:hidden;padding:10px 12px;text-decoration:none;${cardBase};box-shadow:0 1px 2px rgba(15,23,42,.04);">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><div><div style="font-size:11px;font-weight:600;color:#0891b2;">崩壊制御 Runtime</div><div style="font-size:18px;font-weight:700;margin-top:2px;color:var(--text-primary,#111827);">統合制御</div></div><div style="font-size:10px;color:#d97706;font-weight:700;">3段構造</div></div>
    <div style="display:grid;grid-template-columns:116px 1fr;gap:10px;align-items:center;margin-top:6px;height:86px;background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);border-radius:10px;padding:6px;">${donut}<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px;font-size:10px;">${legend}</div></div>
    <div style="margin-top:6px;padding:7px;background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);border-radius:9px;">${bars}</div>
    <div style="margin-top:6px;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">${nums}</div>
  </a>`;
}

const r = routes;
const row3 = r.row3;
const row4 = r.row4;
const discoveryLabel = r.row1.discoveryLabel ?? '連携探索';
const discoveryIcon = r.row1.discoveryIcon ?? '🤝';
const row3Title = row3.title ?? r.row3Title ?? '自システム';
const row4StartY = r.row4Layout?.gridPos?.y ?? 13;

const headerLinkStyle =
  'display:flex;flex-direction:column;align-items:center;padding:6px 10px;border-radius:10px;background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);min-width:64px;text-decoration:none;color:var(--text-primary,#111827);';

const headerHtml = `<div style="width:100%;height:100%;min-height:0;overflow:hidden;display:flex;align-items:center;justify-content:space-between;padding:10px 18px;${cardBase};box-shadow:0 1px 2px rgba(15,23,42,.04);">
  <div>
    <div style="font-size:26px;font-weight:700;line-height:1.1;color:var(--text-primary,#111827);">Runtime</div>
    <div style="margin-top:4px;font-size:11px;color:var(--text-secondary,#64748b);">Federated Runtime Control Platform</div>
  </div>
  <div style="display:flex;gap:12px;flex-shrink:0;">
    <a href="${r.row1.discovery}" style="${headerLinkStyle}">
      <div style="font-size:22px;line-height:1;">${discoveryIcon}</div>
      <div style="font-size:11px;margin-top:4px;font-weight:700;color:#0891b2;">${discoveryLabel}</div>
    </a>
    <a href="${r.row1.needsTranslation}" style="${headerLinkStyle}">
      <div style="font-size:22px;line-height:1;">🗣️</div>
      <div style="font-size:11px;margin-top:4px;font-weight:700;color:#d97706;">Needs翻訳</div>
    </a>
    <a href="${r.row1.alignment ?? r.row1.alliance}" style="${headerLinkStyle}">
      <div style="font-size:22px;line-height:1;">🧩</div>
      <div style="font-size:11px;margin-top:4px;font-weight:700;color:#7c3aed;">アライメント</div>
    </a>
  </div>
</div>`;

const row3Cards = [
  ['fleetOperation', row3.fleetOperation],
  ['serviceHub', row3.serviceHub],
  ['lifeTransaction', row3.lifeTransaction],
  ['urbanOperation', row3.urbanOperation],
];

const navItems = [
  [row4.collapseArchitecture, '崩壊制御アーキテクチャ', '#ef4444'],
  [row4.functionalArchitecture, '機能アーキテクチャ図', '#0ea5e9'],
  [row4.sequenceDiagram, 'シーケンス図', '#f59e0b'],
  [row4.plSimulation, '収支シミュレーション', '#22c55e'],
  [row4.costRecoveryPlan, 'コスト回収計画', '#14b8a6'],
  [row4.wbs, 'WBS', '#94a3b8'],
  [row4.serviceOperation, 'サービス運用', '#3b82f6'],
  [row4.pl, 'PL', '#a855f7'],
  [row4.irr, 'IRR', '#eab308'],
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
  version: 29,
  refresh: '30s',
  timezone: 'browser',
  description:
    '都市OS Runtime Workspace — HTML text panels (sanitizer-safe), Runtime Federation Brain',
  tags: [
    'runtime',
    'urban-os-runtime',
    'workspace-router',
    'theme-adaptive',
    'federation-navigation',
    'collapse-control',
  ],
  links: [
    { title: 'Runtime', url: r.runtimeTopPath ?? '/d/sa8ljn4/runtime' },
    { title: discoveryLabel, url: r.row1.discovery },
    { title: 'Needs翻訳', url: r.row1.needsTranslation },
    { title: 'アライメント', url: r.row1.alignment ?? r.row1.alliance },
  ],
  panels: [
    makeTextPanel({ id: 100, gridPos: { h: 3, w: 24, x: 0, y: 0 }, content: headerHtml }),
    makeTextPanel({
      id: 201,
      gridPos: { h: 5, w: 11, x: 0, y: 3 },
      content: knowledgeGraphPanelHtml(r.row2.obsidianGraph),
    }),
    makeTextPanel({
      id: 202,
      gridPos: { h: 5, w: 11, x: 11, y: 3 },
      content: collapseControlPanelHtml(r.row2.runtimePanel),
    }),
    makeTextPanel({
      id: 203,
      title: 'Federation Connect',
      gridPos: { h: 5, w: 2, x: 22, y: 3 },
      content: federationConnectPanelHtml(r),
    }),
    makeTextPanel({
      id: 300,
      gridPos: { h: 1, w: 24, x: 0, y: 8 },
      content: `<div style="width:100%;height:100%;display:flex;align-items:center;padding:0 6px;box-sizing:border-box;"><div style="font-size:12px;font-weight:700;color:var(--text-secondary,#64748b);letter-spacing:.14em;">${row3Title}</div></div>`,
    }),
    ...row3Cards.map(([key, href], index) => {
      const meta = row3Meta(r, key);
      return makeTextPanel({
        id: 311 + index,
        gridPos: { h: 4, w: 6, x: index * 6, y: 9 },
        content: operationalCard(href, meta.name),
      });
    }),
    ...navPanels,
  ],
};

const outPath = path.resolve('grafana/runtime-workspace-v2.json');
fs.writeFileSync(outPath, `${JSON.stringify(dashboard, null, 2)}\n`);
console.log(`Wrote ${outPath} (${dashboard.panels.length} panels, version ${dashboard.version})`);
