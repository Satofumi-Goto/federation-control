import fs from 'node:fs';
import path from 'node:path';

const routesPath = path.resolve('grafana/runtime-workspace-routes.json');
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));

function navCard(href, label, border) {
  return `<a href="${href}" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;padding:4px 6px;text-decoration:none;background:#111827;border:1px solid ${border};border-radius:8px;color:#fff;font-size:10px;font-weight:700;text-align:center;line-height:1.25;">${label}</a>`;
}

function consoleCard(href, title, sub, border, { pending = false } = {}) {
  const subColor = pending ? '#fbbf24' : '#94a3b8';
  const bg = pending ? '#1e293b' : '#0f172a';
  const borderStyle = pending ? 'dashed' : 'solid';
  return `<a href="${href}" style="display:flex;flex-direction:column;justify-content:center;width:100%;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;padding:10px 12px;text-decoration:none;background:${bg};border:1px ${borderStyle} ${border};border-bottom:3px ${borderStyle} ${border};border-radius:10px;color:#fff;"><div style="font-size:15px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${title}</div><div style="margin-top:4px;font-size:10px;color:${subColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sub}</div></a>`;
}

function row3Meta(routes, key) {
  return routes.row3ConsoleMeta?.[key] ?? { sub: 'Grafana', pending: false };
}

const r = routes;
const row3 = r.row3;
const row4 = r.row4;

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
    gridPos: { h: 2, w: 8, x: col * 8, y: 12 + row * 2 },
    options: { mode: 'html', content: navCard(href, label, border) },
  };
});

const dashboard = {
  uid: 'sa8ljn4',
  editable: true,
  schemaVersion: 39,
  style: 'dark',
  title: 'Runtime',
  version: 24,
  refresh: '30s',
  timezone: 'browser',
  description: '都市OS Runtime Workspace Router',
  tags: ['runtime', 'urban-os-runtime', 'workspace-router', 'toyota-denso'],
  links: [
    { title: 'Runtime', url: '/d/sa8ljn4/runtime' },
    { title: 'Discovery', url: r.row1.discovery },
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
        content: `<div style="width:100%;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:linear-gradient(180deg,#0b1220,#02060c);border:1px solid rgba(56,189,248,.35);border-radius:12px;color:#fff;"><div><div style="font-size:28px;font-weight:900;line-height:1.1;">Runtime</div><div style="margin-top:4px;font-size:11px;color:#67e8f9;">都市OS Runtime Workspace Router</div></div><div style="display:flex;gap:20px;flex-shrink:0;"><a href="${r.row1.discovery}" style="text-decoration:none;color:#67e8f9;text-align:center;"><div style="font-size:24px;line-height:1;">🕸️</div><div style="font-size:11px;margin-top:2px;font-weight:700;">Discovery</div></a><a href="${r.row1.needsTranslation}" style="text-decoration:none;color:#fbbf24;text-align:center;"><div style="font-size:24px;line-height:1;">🗣️</div><div style="font-size:11px;margin-top:2px;font-weight:700;">Needs翻訳</div></a><a href="${r.row1.alignment ?? r.row1.alliance}" style="text-decoration:none;color:#a78bfa;text-align:center;"><div style="font-size:24px;line-height:1;">🧩</div><div style="font-size:11px;margin-top:2px;font-weight:700;">アライメント</div></a></div></div>`,
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
        content: `<a href="${r.row2.obsidianGraph}" style="display:block;width:100%;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;padding:12px;text-decoration:none;background:linear-gradient(180deg,#0b1220,#02060c);border:1px solid rgba(148,163,184,.3);border-radius:12px;color:#fff;"><div style="font-size:11px;color:#94a3b8;">Obsidian Graph</div><div style="font-size:18px;font-weight:900;margin-top:4px;">知識グラフ</div><div style="margin-top:8px;height:40px;border-radius:8px;background:#0f172a;border:1px solid rgba(56,189,248,.2);overflow:hidden;"><svg viewBox="0 0 160 40" width="100%" height="40"><line x1="24" y1="12" x2="80" y2="22" stroke="#38bdf8" opacity=".5"/><line x1="80" y1="22" x2="136" y2="14" stroke="#a78bfa" opacity=".5"/><circle cx="24" cy="12" r="4" fill="#38bdf8"/><circle cx="80" cy="22" r="5" fill="#67e8f9"/><circle cx="136" cy="14" r="4" fill="#a78bfa"/></svg></div><div style="margin-top:6px;font-size:11px;color:#67e8f9;">開く →</div></a>`,
      },
    },
    {
      id: 202,
      type: 'text',
      title: '',
      transparent: true,
      gridPos: { h: 5, w: 13, x: 11, y: 3 },
      options: {
        mode: 'html',
        content: `<a href="${r.row2.runtimePanel}" style="display:block;width:100%;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;padding:12px;text-decoration:none;background:linear-gradient(180deg,#0b1220,#02060c);border:1px solid rgba(56,189,248,.35);border-radius:12px;color:#fff;"><div style="font-size:11px;color:#67e8f9;">Runtime Panel</div><div style="font-size:18px;font-weight:900;margin-top:4px;">統合制御</div><div style="margin-top:8px;display:flex;gap:6px;font-size:10px;"><span style="flex:1;padding:6px 4px;background:#111827;border-left:2px solid #22c55e;border-radius:6px;text-align:center;">許可</span><span style="flex:1;padding:6px 4px;background:#111827;border-left:2px solid #f59e0b;border-radius:6px;text-align:center;">保留</span><span style="flex:1;padding:6px 4px;background:#111827;border-left:2px solid #ef4444;border-radius:6px;text-align:center;">停止</span></div><div style="margin-top:6px;font-size:11px;color:#94a3b8;">開く →</div></a>`,
      },
    },
    {
      id: 311,
      type: 'text',
      title: '',
      transparent: true,
      gridPos: { h: 4, w: 6, x: 0, y: 8 },
      options: {
        mode: 'html',
        content: consoleCard(
          row3.fleetOperation,
          'フリート運用',
          row3Meta(r, 'fleetOperation').sub,
          '#3b82f6',
          { pending: row3Meta(r, 'fleetOperation').pending }
        ),
      },
    },
    {
      id: 312,
      type: 'text',
      title: '',
      transparent: true,
      gridPos: { h: 4, w: 6, x: 6, y: 8 },
      options: {
        mode: 'html',
        content: consoleCard(
          row3.serviceHub,
          'サービス拠点',
          row3Meta(r, 'serviceHub').sub,
          '#8b5cf6',
          { pending: row3Meta(r, 'serviceHub').pending }
        ),
      },
    },
    {
      id: 313,
      type: 'text',
      title: '',
      transparent: true,
      gridPos: { h: 4, w: 6, x: 12, y: 8 },
      options: {
        mode: 'html',
        content: consoleCard(
          row3.lifeTransaction,
          '生活取引',
          row3Meta(r, 'lifeTransaction').sub,
          '#f97316',
          { pending: row3Meta(r, 'lifeTransaction').pending }
        ),
      },
    },
    {
      id: 314,
      type: 'text',
      title: '',
      transparent: true,
      gridPos: { h: 4, w: 6, x: 18, y: 8 },
      options: {
        mode: 'html',
        content: consoleCard(
          row3.urbanOperation,
          '都市運行',
          row3Meta(r, 'urbanOperation').sub,
          '#22c55e',
          { pending: row3Meta(r, 'urbanOperation').pending }
        ),
      },
    },
    ...navPanels,
  ],
};

const outPath = path.resolve('grafana/runtime-workspace-v2.json');
fs.writeFileSync(outPath, `${JSON.stringify(dashboard, null, 2)}\n`);
console.log(`Wrote ${outPath} (${dashboard.panels.length} panels, version ${dashboard.version})`);
