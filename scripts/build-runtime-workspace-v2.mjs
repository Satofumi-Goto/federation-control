import fs from 'node:fs';
import path from 'node:path';
import { federationConnectPanelHtml } from './lib/federation-connect-panel.mjs';
import { cardBase, rtThemeStyleBlock } from './lib/runtime-workspace-theme.mjs';

const routesPath = path.resolve('grafana/runtime-workspace-routes.json');
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));

function navCard(href, label, accentBorder) {
  return `<a href="${href}" class="rt-nav" style="border-left:3px solid ${accentBorder};">${label}</a>`;
}

function operationalCard(href, title) {
  return `<a href="${href}" class="rt-card">${title}</a>`;
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
        `<line x1="${nodes[a][1]}" y1="${nodes[a][2]}" x2="${nodes[b][1]}" y2="${nodes[b][2]}" stroke="#cbd5e1" stroke-width="1.2"/><line x1="${nodes[a][1]}" y1="${nodes[a][2]}" x2="${nodes[b][1]}" y2="${nodes[b][2]}" stroke="#bae6fd" stroke-width="0.6" opacity=".8"/>`
    )
    .join('');
  const nodeSvg = nodes
    .map(
      ([label, x, y, color]) =>
        `<g><circle cx="${x}" cy="${y}" r="9" fill="${color}"/><text x="${x}" y="${y + 24}" text-anchor="middle" font-size="10" fill="#475569" font-weight="600">${label}</text></g>`
    )
    .join('');
  return `<a href="${href}" class="rt-root" style="display:block;width:100%;height:100%;min-height:0;overflow:hidden;padding:12px;text-decoration:none;${cardBase};box-shadow:0 1px 2px rgba(15,23,42,.04);">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><div><div class="rt-muted" style="font-size:11px;font-weight:600;">Knowledge Graph</div><div style="font-size:18px;font-weight:700;margin-top:4px;color:var(--text-primary,#111827);">知識グラフ</div></div><div class="rt-accent" style="font-size:10px;">Runtime全体参照</div></div>
    <div style="margin-top:8px;height:118px;border-radius:10px;background:var(--background-secondary,#f8fafc);border:1px solid var(--border-weak,#e5e7eb);overflow:hidden;">
      <svg viewBox="0 0 560 180" width="100%" height="118" preserveAspectRatio="xMidYMid meet">${edgeSvg}${nodeSvg}</svg>
    </div>
    <div class="rt-muted" style="margin-top:7px;display:flex;gap:6px;font-size:10px;"><span>Runtime</span><span>Queue</span><span>ODD</span><span>Constraint</span><span>Dispatch</span><span>PL</span></div>
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
  let offset = 25;
  const circles = ring
    .map(([label, value, color]) => {
      const seg = `<circle cx="58" cy="58" r="42" fill="none" stroke="${color}" stroke-width="13" stroke-dasharray="${value} ${100 - value}" stroke-dashoffset="-${offset}" pathLength="100" transform="rotate(-90 58 58)"/>`;
      offset += value;
      return seg;
    })
    .join('');
  const legend = ring
    .map(
      ([label, value, color]) =>
        `<div style="display:flex;align-items:center;gap:5px;min-width:0;color:var(--text-secondary,#64748b);"><span style="width:7px;height:7px;border-radius:50%;background:${color};display:inline-block;flex:0 0 auto;"></span><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label} ${value}%</span></div>`
    )
    .join('');
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
  return `<a href="${href}" class="rt-root" style="display:block;width:100%;height:100%;min-height:0;overflow:hidden;padding:10px 12px;text-decoration:none;${cardBase};box-shadow:0 1px 2px rgba(15,23,42,.04);">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><div><div class="rt-accent" style="font-size:11px;">崩壊制御 Runtime</div><div style="font-size:18px;font-weight:700;margin-top:2px;color:var(--text-primary,#111827);">統合制御</div></div><div style="font-size:10px;color:#d97706;font-weight:700;">3段構造</div></div>
    <div style="display:grid;grid-template-columns:116px 1fr;gap:10px;align-items:center;margin-top:6px;height:86px;background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);border-radius:10px;padding:6px;">
      <svg viewBox="0 0 116 116" width="86" height="86" style="justify-self:center;"><circle cx="58" cy="58" r="42" fill="none" stroke="#e5e7eb" stroke-width="13"/>${circles}<text x="58" y="55" text-anchor="middle" font-size="11" fill="#111827" font-weight="700">直ぐに</text><text x="58" y="70" text-anchor="middle" font-size="11" fill="#111827" font-weight="700">崩壊</text></svg>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px;font-size:10px;">${legend}</div>
    </div>
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

const headerHtml = `${rtThemeStyleBlock}
<div class="rt-root rt-surface" style="width:100%;height:100%;min-height:0;overflow:hidden;display:flex;align-items:center;justify-content:space-between;padding:10px 18px;box-shadow:0 1px 2px rgba(15,23,42,.04);">
  <div>
    <div style="font-size:26px;font-weight:700;line-height:1.1;color:var(--text-primary,#111827);">Runtime</div>
    <div class="rt-muted" style="margin-top:4px;font-size:11px;">Federated Runtime Control Platform</div>
  </div>
  <div style="display:flex;gap:12px;flex-shrink:0;">
    <a href="${r.row1.discovery}" class="rt-header-link" style="color:var(--text-primary,#111827);">
      <div style="font-size:22px;line-height:1;">${discoveryIcon}</div>
      <div style="font-size:11px;margin-top:4px;font-weight:700;color:#0891b2;">${discoveryLabel}</div>
    </a>
    <a href="${r.row1.needsTranslation}" class="rt-header-link" style="color:var(--text-primary,#111827);">
      <div style="font-size:22px;line-height:1;">🗣️</div>
      <div style="font-size:11px;margin-top:4px;font-weight:700;color:#d97706;">Needs翻訳</div>
    </a>
    <a href="${r.row1.alignment ?? r.row1.alliance}" class="rt-header-link" style="color:var(--text-primary,#111827);">
      <div style="font-size:22px;line-height:1;">🧩</div>
      <div style="font-size:11px;margin-top:4px;font-weight:700;color:#7c3aed;">アライメント</div>
    </a>
  </div>
</div>`;

const navPanels = navItems.map(([href, label, accent], index) => {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return {
    id: 401 + index,
    type: 'text',
    title: '',
    transparent: true,
    gridPos: { h: 2, w: 8, x: col * 8, y: row4StartY + row * 2 },
    options: { mode: 'html', content: navCard(href, label, accent) },
  };
});

const dashboard = {
  uid: 'sa8ljn4',
  editable: true,
  schemaVersion: 39,
  title: 'Runtime',
  version: 28,
  refresh: '30s',
  timezone: 'browser',
  description:
    '都市OS Runtime Workspace — theme-adaptive SaaS layout, Runtime Federation Brain',
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
    {
      id: 100,
      type: 'text',
      title: '',
      transparent: true,
      gridPos: { h: 3, w: 24, x: 0, y: 0 },
      options: { mode: 'html', content: headerHtml },
    },
    {
      id: 201,
      type: 'text',
      title: '',
      transparent: true,
      gridPos: { h: 5, w: 11, x: 0, y: 3 },
      options: { mode: 'html', content: knowledgeGraphPanelHtml(r.row2.obsidianGraph) },
    },
    {
      id: 202,
      type: 'text',
      title: '',
      transparent: true,
      gridPos: { h: 5, w: 11, x: 11, y: 3 },
      options: { mode: 'html', content: collapseControlPanelHtml(r.row2.runtimePanel) },
    },
    {
      id: 203,
      type: 'text',
      title: 'Federation Connect',
      transparent: true,
      gridPos: { h: 5, w: 2, x: 22, y: 3 },
      options: {
        mode: 'html',
        content: `${rtThemeStyleBlock}${federationConnectPanelHtml(r)}`,
      },
    },
    {
      id: 300,
      type: 'text',
      title: '',
      transparent: true,
      gridPos: { h: 1, w: 24, x: 0, y: 8 },
      options: {
        mode: 'html',
        content: `<div class="rt-root" style="width:100%;height:100%;display:flex;align-items:center;padding:0 6px;box-sizing:border-box;"><div style="font-size:12px;font-weight:700;color:var(--text-secondary,#64748b);letter-spacing:.14em;">${row3Title}</div></div>`,
      },
    },
    ...row3Cards.map(([key, href], index) => {
      const meta = row3Meta(r, key);
      return {
        id: 311 + index,
        type: 'text',
        title: '',
        transparent: true,
        gridPos: { h: 4, w: 6, x: index * 6, y: 9 },
        options: {
          mode: 'html',
          content: `${rtThemeStyleBlock}${operationalCard(href, meta.name)}`,
        },
      };
    }),
    ...navPanels,
  ],
};

const outPath = path.resolve('grafana/runtime-workspace-v2.json');
fs.writeFileSync(outPath, `${JSON.stringify(dashboard, null, 2)}\n`);
console.log(`Wrote ${outPath} (${dashboard.panels.length} panels, version ${dashboard.version})`);
