import fs from 'node:fs';
import path from 'node:path';
import { federationConnectPanelHtml } from './lib/federation-connect-panel.mjs';

const routesPath = path.resolve('grafana/runtime-workspace-routes.json');
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));

function navCard(href, label, border) {
  return `<a href="${href}" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;padding:4px 6px;text-decoration:none;background:#111827;border:1px solid ${border};border-radius:8px;color:#fff;font-size:10px;font-weight:700;text-align:center;line-height:1.25;">${label}</a>`;
}

/** Same-tab operational console card — name only. */
function operationalCard(href, title, border) {
  return `<a href="${href}" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;padding:10px 12px;text-decoration:none;background:#0f172a;border:1px solid ${border};border-bottom:3px solid ${border};border-radius:10px;color:#fff;font-size:15px;font-weight:900;text-align:center;white-space:nowrap;text-overflow:ellipsis;">${title}</a>`;
}

function row3Meta(routes, key) {
  return routes.row3ConsoleMeta?.[key] ?? { name: key, border: '#64748b' };
}

function knowledgeGraphPanelHtml(href) {
  const nodes = [
    ['Runtime', 180, 68, '#67e8f9'],
    ['Queue', 80, 42, '#f59e0b'],
    ['ODD', 292, 44, '#a78bfa'],
    ['Constraint', 72, 122, '#ef4444'],
    ['ETA', 158, 148, '#38bdf8'],
    ['Dispatch', 280, 132, '#22c55e'],
    ['Fleet', 392, 74, '#3b82f6'],
    ['Energy', 392, 150, '#10b981'],
    ['HILS', 500, 54, '#94a3b8'],
    ['PL/IRR', 504, 138, '#fbbf24'],
  ];
  const edges = [
    [0,1],[0,2],[0,3],[0,4],[0,5],[5,6],[3,2],[1,4],[4,5],[6,7],[2,8],[5,9],[7,9]
  ];
  const edgeSvg = edges.map(([a,b]) => `<line x1="${nodes[a][1]}" y1="${nodes[a][2]}" x2="${nodes[b][1]}" y2="${nodes[b][2]}" stroke="rgba(103,232,249,.32)" stroke-width="1.2"/>`).join('');
  const nodeSvg = nodes.map(([label,x,y,color]) => `<g><circle cx="${x}" cy="${y}" r="9" fill="${color}" opacity=".95"/><text x="${x}" y="${y + 24}" text-anchor="middle" font-size="10" fill="#cbd5e1" font-weight="700">${label}</text></g>`).join('');
  return `<a href="${href}" style="display:block;width:100%;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;padding:12px;text-decoration:none;background:linear-gradient(180deg,#0b1220,#02060c);border:1px solid rgba(148,163,184,.3);border-radius:12px;color:#fff;">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><div><div style="font-size:11px;color:#94a3b8;">Obsidian Knowledge Graph</div><div style="font-size:18px;font-weight:900;margin-top:4px;">知識グラフ</div></div><div style="font-size:10px;color:#67e8f9;font-weight:800;">Runtime全体参照</div></div>
    <div style="margin-top:8px;height:118px;border-radius:10px;background:#0f172a;border:1px solid rgba(56,189,248,.2);overflow:hidden;">
      <svg viewBox="0 0 560 180" width="100%" height="118" preserveAspectRatio="xMidYMid meet">${edgeSvg}${nodeSvg}</svg>
    </div>
    <div style="margin-top:7px;display:flex;gap:6px;font-size:10px;color:#94a3b8;"><span>Runtime</span><span>Queue</span><span>ODD</span><span>Constraint</span><span>Dispatch</span><span>PL</span></div>
  </a>`;
}

function collapseControlPanelHtml() {
  const ring = [
    ['Queue', 32, '#f59e0b'],
    ['ETA', 24, '#38bdf8'],
    ['ODD', 18, '#a78bfa'],
    ['Constraint', 16, '#ef4444'],
    ['Dispatch', 10, '#22c55e'],
  ];
  let offset = 25;
  const circles = ring.map(([label, value, color]) => {
    const seg = `<circle cx="58" cy="58" r="42" fill="none" stroke="${color}" stroke-width="13" stroke-dasharray="${value} ${100 - value}" stroke-dashoffset="-${offset}" pathLength="100" transform="rotate(-90 58 58)"/>`;
    offset += value;
    return seg;
  }).join('');
  const legend = ring.map(([label, value, color]) => `<div style="display:flex;align-items:center;gap:5px;min-width:0;"><span style="width:7px;height:7px;border-radius:50%;background:${color};display:inline-block;flex:0 0 auto;"></span><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label} ${value}%</span></div>`).join('');
  const bars = [
    ['Queue→ETA', 86, '#f59e0b'],
    ['ETA→Dispatch', 72, '#38bdf8'],
    ['Constraint→ODD', 64, '#ef4444'],
    ['ODD→Fleet', 58, '#a78bfa'],
  ].map(([label, value, color]) => `<div style="display:grid;grid-template-columns:92px 1fr 30px;align-items:center;gap:6px;margin-bottom:4px;"><div style="font-size:10px;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label}</div><div style="height:7px;background:#111827;border-radius:999px;overflow:hidden;"><div style="height:7px;width:${value}%;background:${color};border-radius:999px;"></div></div><div style="font-size:10px;color:#94a3b8;text-align:right;">${value}</div></div>`).join('');
  const nums = [
    ['成立率','74%','#22c55e'],
    ['Trips','35/日','#38bdf8'],
    ['Queue','12分','#f59e0b'],
    ['PL','+18%','#fbbf24'],
  ].map(([label, value, color]) => `<div style="padding:6px 6px;background:#111827;border-left:3px solid ${color};border-radius:8px;min-width:0;"><div style="font-size:9px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label}</div><div style="font-size:15px;font-weight:900;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${value}</div></div>`).join('');
  return `<div style="display:block;width:100%;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;padding:10px 12px;background:linear-gradient(180deg,#0b1220,#02060c);border:1px solid rgba(56,189,248,.35);border-radius:12px;color:#fff;">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><div><div style="font-size:11px;color:#67e8f9;">Runtime Federation Memory</div><div style="font-size:18px;font-weight:900;margin-top:2px;">崩壊制御 Runtime</div></div><div style="font-size:10px;color:#fbbf24;font-weight:800;">3段構造</div></div>
    <div style="display:grid;grid-template-columns:116px 1fr;gap:10px;align-items:center;margin-top:6px;height:86px;">
      <svg viewBox="0 0 116 116" width="86" height="86" style="justify-self:center;"><circle cx="58" cy="58" r="42" fill="none" stroke="#111827" stroke-width="13"/>${circles}<text x="58" y="55" text-anchor="middle" font-size="11" fill="#fff" font-weight="900">直ぐに</text><text x="58" y="70" text-anchor="middle" font-size="11" fill="#fff" font-weight="900">崩壊</text></svg>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px;font-size:10px;color:#cbd5e1;">${legend}</div>
    </div>
    <div style="margin-top:6px;padding:7px;background:rgba(15,23,42,.7);border:1px solid rgba(148,163,184,.18);border-radius:9px;">${bars}</div>
    <div style="margin-top:6px;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">${nums}</div>
  </div>`;
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
  [row4.collapseArchitecture, '崩壊制御アーキテクチャ', 'rgba(239,68,68,.35)'],
  [row4.functionalArchitecture, '機能アーキテクチャ図', 'rgba(56,189,248,.3)'],
  [row4.sequenceDiagram, 'シーケンス図', 'rgba(245,158,11,.35)'],
  [row4.plSimulation, '収支シミュレーション', 'rgba(34,197,94,.3)'],
  [row4.costRecoveryPlan, 'コスト回収計画', 'rgba(20,184,166,.3)'],
  [row4.wbs, 'WBS', 'rgba(148,163,184,.3)'],
  [row4.serviceOperation, 'サービス運用', 'rgba(59,130,246,.3)'],
  [row4.pl, 'PL', 'rgba(168,85,247,.3)'],
  [row4.irr, 'IRR', 'rgba(251,191,36,.35)'],
];

const navPanels = navItems.map(([href, label, border], index) => {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return {
    id: 401 + index,
    type: 'text',
    title: '',
    transparent: true,
    gridPos: { h: 2, w: 8, x: col * 8, y: row4StartY + row * 2 },
    options: { mode: 'html', content: navCard(href, label, border) },
  };
});

const dashboard = {
  uid: 'sa8ljn4',
  editable: true,
  schemaVersion: 39,
  style: 'dark',
  title: 'Runtime',
  version: 27,
  refresh: '30s',
  timezone: 'browser',
  description: '都市OS Runtime Workspace Router — Runtime Federation Brain',
  tags: ['runtime', 'urban-os-runtime', 'workspace-router', 'toyota-denso', 'federation-navigation', 'collapse-control'],
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
      options: {
        mode: 'html',
        content: `<div style="width:100%;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:linear-gradient(180deg,#0b1220,#02060c);border:1px solid rgba(56,189,248,.35);border-radius:12px;color:#fff;"><div><div style="font-size:28px;font-weight:900;line-height:1.1;">Runtime</div><div style="margin-top:4px;font-size:11px;color:#67e8f9;">Federated Runtime Control Platform</div></div><div style="display:flex;gap:20px;flex-shrink:0;"><a href="${r.row1.discovery}" style="text-decoration:none;color:#67e8f9;text-align:center;"><div style="font-size:24px;line-height:1;">${discoveryIcon}</div><div style="font-size:11px;margin-top:2px;font-weight:700;">${discoveryLabel}</div></a><a href="${r.row1.needsTranslation}" style="text-decoration:none;color:#fbbf24;text-align:center;"><div style="font-size:24px;line-height:1;">🗣️</div><div style="font-size:11px;margin-top:2px;font-weight:700;">Needs翻訳</div></a><a href="${r.row1.alignment ?? r.row1.alliance}" style="text-decoration:none;color:#a78bfa;text-align:center;"><div style="font-size:24px;line-height:1;">🧩</div><div style="font-size:11px;margin-top:2px;font-weight:700;">アライメント</div></a></div></div>`,
      },
    },
    {
      id: 201,
      type: 'text',
      title: '',
      transparent: true,
      gridPos: { h: 5, w: 11, x: 0, y: 3 },
      options: {
        mode: 'html',
        content: knowledgeGraphPanelHtml(r.row2.obsidianGraph),
      },
    },
    {
      id: 202,
      type: 'text',
      title: '',
      transparent: true,
      gridPos: { h: 5, w: 11, x: 11, y: 3 },
      options: {
        mode: 'html',
        content: collapseControlPanelHtml(),
      },
    },
    {
      id: 203,
      type: 'text',
      title: 'Federation Connect',
      transparent: true,
      gridPos: { h: 5, w: 2, x: 22, y: 3 },
      options: {
        mode: 'html',
        content: federationConnectPanelHtml(r),
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
        content: `<div style="width:100%;height:100%;display:flex;align-items:center;padding:0 4px;box-sizing:border-box;"><div style="font-size:12px;font-weight:900;color:#94a3b8;letter-spacing:.12em;">${row3Title}</div></div>`,
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
          content: operationalCard(href, meta.name, meta.border),
        },
      };
    }),
    ...navPanels,
  ],
};

const outPath = path.resolve('grafana/runtime-workspace-v2.json');
fs.writeFileSync(outPath, `${JSON.stringify(dashboard, null, 2)}\n`);
console.log(`Wrote ${outPath} (${dashboard.panels.length} panels, version ${dashboard.version})`);
