const TEXT_PLUGIN_VERSION = '11.5.2';

const STALE_LABELS = [
  '自システム',
  '崩壊制御アーキテクチャ',
  '機能アーキテクチャ図',
  'シーケンス図',
  'Runtime Federation Memory',
  'Growing Runtime Knowledge Graph',
  '崩壊制御 Runtime',
  '運行制御アーキテクチャ'
];
const REQUIRED_LABELS = [
  'Operational Systems',
  'System Artifacts',
  'Obsidian Knowledge Graph',
  'Runtime Federation Graph',
  'Federation Add',
  'Collapse Control Architecture',
  'Functional Topology',
  'Federation Sequence'
];

function panel(id, gridPos, content, title = '') {
  return { id, type: 'text', title, transparent: true, pluginVersion: TEXT_PLUGIN_VERSION, gridPos, options: { mode: 'html', content, code: { language: 'html', showLineNumbers: false, showMiniMap: false } } };
}
function box(inner) {
  return `<div style="height:100%;box-sizing:border-box;padding:12px;background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);border-radius:12px;color:var(--text-primary,#111827);overflow:hidden;">${inner}</div>`;
}
function linkBox(href, label, accent = '#0891b2') {
  return `<a href="${href}" style="display:flex;align-items:center;justify-content:center;height:100%;box-sizing:border-box;padding:12px;background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);border-left:4px solid ${accent};border-radius:12px;color:var(--text-primary,#111827);text-decoration:none;font-weight:800;text-align:center;">${label}</a>`;
}
function headerBox(title) {
  return `<div style="height:100%;display:flex;align-items:center;justify-content:space-between;padding:0 10px;background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);border-radius:8px;color:var(--text-primary,#111827);box-sizing:border-box;"><b style="letter-spacing:.12em;">${title}</b><b style="font-size:18px;">＋</b></div>`;
}
function renderHeader(routes) {
  const nav = [
    [routes.row1.discovery, routes.row1.discoveryLabel ?? '連携探索', '🤝', '#0891b2'],
    [routes.row1.needsTranslation, 'Needs翻訳', '🗣️', '#d97706'],
    [routes.row1.alignment ?? routes.row1.alliance, 'アライメント', '🧩', '#7c3aed']
  ].map(([href, label, icon, color]) => `<a href="${href}" style="padding:8px 12px;border:1px solid var(--border-weak,#e5e7eb);border-radius:10px;color:${color};text-decoration:none;font-weight:800;">${icon} ${label}</a>`).join('');
  return box(`<div style="display:flex;align-items:center;justify-content:space-between;height:100%;"><a href="${routes.runtimeTopPath ?? '/d/sa8ljn4/runtime'}" style="text-decoration:none;color:inherit;"><div style="font-size:26px;font-weight:800;">Runtime</div><div style="font-size:12px;color:var(--text-secondary,#64748b);">Federation Brain</div></a><div style="display:flex;gap:12px;">${nav}</div></div>`);
}
function renderObsidianGraph() {
  const graph = `<div style="height:92px;margin-top:10px;border:1px solid var(--border-weak,#e5e7eb);border-radius:10px;background:var(--background-secondary,#f8fafc);position:relative;"><span style="position:absolute;left:12%;top:30%;color:#8b5cf6;font-size:22px;">●</span><span style="position:absolute;left:42%;top:18%;color:#0ea5e9;font-size:22px;">●</span><span style="position:absolute;left:72%;top:38%;color:#eab308;font-size:22px;">●</span><span style="position:absolute;left:52%;top:64%;color:#ef4444;font-size:22px;">●</span><div style="position:absolute;left:18%;top:52%;right:18%;border-top:1px solid #cbd5e1;transform:rotate(8deg);"></div><div style="position:absolute;left:28%;top:42%;right:26%;border-top:1px solid #cbd5e1;transform:rotate(-18deg);"></div></div>`;
  return `<a href="/d/go-program-index/grafana-obsidian-program-index" style="text-decoration:none;color:inherit;">${box(`<div style="font-size:10px;font-weight:800;color:#7c3aed;">Obsidian · Graph role</div><div style="font-size:18px;font-weight:900;margin-top:3px;">Obsidian Knowledge Graph</div><div style="font-size:10px;color:var(--text-secondary,#64748b);margin-top:6px;">Note · Wikilink · Program · ADR</div>${graph}<div style="font-size:10px;color:var(--text-secondary,#64748b);margin-top:6px;">● Note　● Wikilink　● Program　● ADR</div>`)}</a>`;
}
function renderRuntimeGraph() {
  const metrics = `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:10px;"><div style="border-left:4px solid #ef4444;background:var(--background-secondary,#f8fafc);padding:7px;border-radius:8px;">Collapse Risk<br><b>HIGH</b></div><div style="border-left:4px solid #22c55e;background:var(--background-secondary,#f8fafc);padding:7px;border-radius:8px;">Health<br><b>82%</b></div><div style="border-left:4px solid #f59e0b;background:var(--background-secondary,#f8fafc);padding:7px;border-radius:8px;">Queue Drift<br><b>+12</b></div><div style="border-left:4px solid #38bdf8;background:var(--background-secondary,#f8fafc);padding:7px;border-radius:8px;">Alignment<br><b>74%</b></div></div>`;
  return `<a href="/d/sa8ljn4/runtime" style="text-decoration:none;color:inherit;">${box(`<div style="font-size:10px;font-weight:800;color:#0891b2;">Runtime · Federation role</div><div style="font-size:18px;font-weight:900;margin-top:3px;">Runtime Federation Graph</div><div style="font-size:10px;color:var(--text-secondary,#64748b);margin-top:6px;">Queue · ETA · Throughput · Drift · Alignment · Collapse Risk</div>${metrics}`)}</a>`;
}
function renderFederationAdd() {
  return box(`<div style="font-weight:900;">Federation Add</div><div style="font-size:10px;color:var(--text-secondary,#64748b);margin-top:6px;">Global system onboarding</div><div style="font-size:34px;margin-top:18px;color:#0891b2;">＋</div>`);
}
function assertClean(dashboard) {
  const raw = JSON.stringify(dashboard);
  for (const s of STALE_LABELS) if (raw.includes(s)) throw new Error(`stale label: ${s}`);
  for (const s of REQUIRED_LABELS) if (!raw.includes(s)) throw new Error(`missing label: ${s}`);
}

export function buildRuntimeWorkspaceDashboard(routes) {
  const row3 = routes.row3;
  const row4 = routes.row4;
  const operational = [
    [311, row3.fleetOperation, routes.row3ConsoleMeta?.fleetOperation?.name ?? 'フリート運用', 0],
    [312, row3.serviceHub, routes.row3ConsoleMeta?.serviceHub?.name ?? 'サービス拠点', 6],
    [313, row3.lifeTransaction, routes.row3ConsoleMeta?.lifeTransaction?.name ?? '生活取引', 12],
    [314, row3.urbanOperation, routes.row3ConsoleMeta?.urbanOperation?.name ?? '都市運行', 18]
  ];
  const artifacts = [
    [401, row4.collapseArchitecture, 'Collapse Control Architecture', '#ef4444', 0, 14],
    [402, row4.functionalArchitecture, 'Functional Topology', '#0ea5e9', 8, 14],
    [403, row4.sequenceDiagram, 'Federation Sequence', '#f59e0b', 16, 14],
    [404, row4.plSimulation, 'Business Simulation', '#22c55e', 0, 16],
    [405, row4.costRecoveryPlan, 'Cost Recovery', '#14b8a6', 8, 16],
    [406, row4.wbs, 'Execution Planning', '#94a3b8', 16, 16],
    [407, row4.serviceOperation, 'Service Operations', '#3b82f6', 0, 18],
    [408, row4.pl, 'Profit & Loss', '#a855f7', 8, 18],
    [409, row4.irr, 'Investment Return', '#eab308', 16, 18]
  ];
  const dashboard = {
    uid: 'sa8ljn4', editable: true, schemaVersion: 39, title: 'Runtime', version: 42, refresh: '30s', timezone: 'browser', description: 'Federated Operational Governance Workspace', tags: ['runtime','federation','governance'],
    links: [
      { title: 'Runtime', url: routes.runtimeTopPath ?? '/d/sa8ljn4/runtime' },
      { title: routes.row1.discoveryLabel ?? '連携探索', url: routes.row1.discovery },
      { title: 'Needs翻訳', url: routes.row1.needsTranslation },
      { title: 'アライメント', url: routes.row1.alignment ?? routes.row1.alliance }
    ],
    panels: [
      panel(100, { h: 3, w: 24, x: 0, y: 0 }, renderHeader(routes)),
      panel(201, { h: 5, w: 11, x: 0, y: 3 }, renderObsidianGraph()),
      panel(202, { h: 5, w: 11, x: 11, y: 3 }, renderRuntimeGraph()),
      panel(203, { h: 5, w: 2, x: 22, y: 3 }, renderFederationAdd(), 'Federation Add'),
      panel(300, { h: 1, w: 24, x: 0, y: 8 }, headerBox('Operational Systems')),
      ...operational.map(([id, href, label, x]) => panel(id, { h: 4, w: 6, x, y: 9 }, linkBox(href, label))),
      panel(350, { h: 1, w: 24, x: 0, y: 13 }, headerBox('System Artifacts')),
      ...artifacts.map(([id, href, label, color, x, y]) => panel(id, { h: 2, w: 8, x, y }, linkBox(href, label, color)))
    ]
  };
  assertClean(dashboard);
  return dashboard;
}
