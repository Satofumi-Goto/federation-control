const TEXT_PLUGIN_VERSION = '11.5.2';

const OLD_ADD = 'Federation' + ' Add';
const BAD = [
  '自システム',
  '崩壊制御アーキテクチャ',
  '機能アーキテクチャ図',
  'シーケンス図',
  'Runtime Federation Memory',
  'Growing Runtime Knowledge Graph',
  '崩壊制御 Runtime',
  '運行制御アーキテクチャ',
  OLD_ADD,
  'Global system onboarding',
  '/login?from_url='
];
const NEED = [
  'Operational Systems',
  'System Artifacts',
  'Obsidian Knowledge Graph',
  'Runtime Federation Graph',
  'Collapse Control Architecture',
  'Functional Topology',
  'Federation Sequence',
  'runtime_embed=grafana',
  'public_view=1'
];

function p(id, gridPos, title, content) {
  return { id, type: 'text', title, transparent: true, pluginVersion: TEXT_PLUGIN_VERSION, gridPos, options: { mode: 'html', content, code: { language: 'html', showLineNumbers: false, showMiniMap: false } } };
}
function wrap(s) { return `<div style="height:100%;box-sizing:border-box;padding:12px;background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);border-radius:12px;color:var(--text-primary,#111827);overflow:hidden;">${s}</div>`; }
function link(href, label, color = '#0891b2') { return `<a href="${href}" style="display:flex;align-items:center;justify-content:center;height:100%;box-sizing:border-box;padding:12px;background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);border-left:4px solid ${color};border-radius:12px;color:var(--text-primary,#111827);text-decoration:none;font-weight:800;text-align:center;">${label}</a>`; }
function section(label) { return `<div style="height:100%;display:flex;align-items:center;justify-content:space-between;padding:0 10px;background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);border-radius:8px;color:var(--text-primary,#111827);box-sizing:border-box;"><b style="letter-spacing:.12em;">${label}</b><b style="font-size:18px;">＋</b></div>`; }
function header(r) {
  return wrap(`<div style="display:flex;align-items:center;justify-content:space-between;height:100%;"><a href="${r.runtimeTopPath}" style="text-decoration:none;color:inherit;"><div style="font-size:26px;font-weight:800;">Runtime</div><div style="font-size:12px;color:var(--text-secondary,#64748b);">Federation Brain</div></a><div style="display:flex;gap:12px;"><a href="${r.row1.discovery}" style="color:#0891b2;text-decoration:none;font-weight:800;">🤝 ${r.row1.discoveryLabel ?? '連携探索'}</a><a href="${r.row1.needsTranslation}" style="color:#d97706;text-decoration:none;font-weight:800;">🗣️ Needs翻訳</a><a href="${r.row1.alignment}" style="color:#7c3aed;text-decoration:none;font-weight:800;">🧩 アライメント</a></div></div>`);
}
function obsidian() {
  return wrap(`<div style="font-size:10px;font-weight:800;color:#7c3aed;">Obsidian · Graph role</div><div style="font-size:18px;font-weight:900;margin-top:3px;">Obsidian Knowledge Graph</div><div style="font-size:10px;color:var(--text-secondary,#64748b);margin-top:6px;">Note · Wikilink · Program · ADR</div><div style="height:92px;margin-top:10px;border:1px solid var(--border-weak,#e5e7eb);border-radius:10px;background:var(--background-secondary,#f8fafc);position:relative;"><span style="position:absolute;left:12%;top:30%;color:#8b5cf6;font-size:22px;">●</span><span style="position:absolute;left:42%;top:18%;color:#0ea5e9;font-size:22px;">●</span><span style="position:absolute;left:72%;top:38%;color:#eab308;font-size:22px;">●</span><span style="position:absolute;left:52%;top:64%;color:#ef4444;font-size:22px;">●</span><div style="position:absolute;left:18%;top:52%;right:18%;border-top:1px solid #cbd5e1;transform:rotate(8deg);"></div><div style="position:absolute;left:28%;top:42%;right:26%;border-top:1px solid #cbd5e1;transform:rotate(-18deg);"></div></div><div style="font-size:10px;color:var(--text-secondary,#64748b);margin-top:6px;">● Note　● Wikilink　● Program　● ADR</div>`);
}
function runtimeGraph() {
  return wrap(`<div style="font-size:10px;font-weight:800;color:#0891b2;">Runtime · Federation role</div><div style="font-size:18px;font-weight:900;margin-top:3px;">Runtime Federation Graph</div><div style="font-size:10px;color:var(--text-secondary,#64748b);margin-top:6px;">Queue · ETA · Throughput · Drift · Alignment · Collapse Risk</div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:10px;"><div style="border-left:4px solid #ef4444;background:var(--background-secondary,#f8fafc);padding:7px;border-radius:8px;">Collapse Risk<br><b>HIGH</b></div><div style="border-left:4px solid #22c55e;background:var(--background-secondary,#f8fafc);padding:7px;border-radius:8px;">Health<br><b>82%</b></div><div style="border-left:4px solid #f59e0b;background:var(--background-secondary,#f8fafc);padding:7px;border-radius:8px;">Queue Drift<br><b>+12</b></div><div style="border-left:4px solid #38bdf8;background:var(--background-secondary,#f8fafc);padding:7px;border-radius:8px;">Alignment<br><b>74%</b></div></div>`);
}
function check(d) { const raw = JSON.stringify(d); for (const x of BAD) if (raw.includes(x)) throw new Error(`bad token: ${x}`); for (const x of NEED) if (!raw.includes(x)) throw new Error(`missing token: ${x}`); }

export function buildRuntimeWorkspaceDashboard(r) {
  const ops = [[311,r.row3.fleetOperation,'フリート運用',0],[312,r.row3.serviceHub,'サービス拠点',6],[313,r.row3.lifeTransaction,'生活取引',12],[314,r.row3.urbanOperation,'都市運行',18]];
  const arts = [[401,r.row4.collapseArchitecture,'Collapse Control Architecture','#ef4444',0,14],[402,r.row4.functionalArchitecture,'Functional Topology','#0ea5e9',8,14],[403,r.row4.sequenceDiagram,'Federation Sequence','#f59e0b',16,14],[404,r.row4.plSimulation,'Business Simulation','#22c55e',0,16],[405,r.row4.costRecoveryPlan,'Cost Recovery','#14b8a6',8,16],[406,r.row4.wbs,'Execution Planning','#94a3b8',16,16],[407,r.row4.serviceOperation,'Service Operations','#3b82f6',0,18],[408,r.row4.pl,'Profit & Loss','#a855f7',8,18],[409,r.row4.irr,'Investment Return','#eab308',16,18]];
  const d = { uid:'sa8ljn4', editable:true, schemaVersion:39, title:'Runtime', version:46, refresh:'30s', timezone:'browser', description:'Federated Operational Governance Workspace', tags:['runtime','federation','governance'], links:[{title:'Runtime',url:r.runtimeTopPath},{title:r.row1.discoveryLabel ?? '連携探索',url:r.row1.discovery},{title:'Needs翻訳',url:r.row1.needsTranslation},{title:'アライメント',url:r.row1.alignment}], panels:[p(100,{h:3,w:24,x:0,y:0},'',header(r)),p(201,{h:5,w:12,x:0,y:3},'',obsidian()),p(202,{h:5,w:12,x:12,y:3},'',runtimeGraph()),p(300,{h:1,w:24,x:0,y:8},'',section('Operational Systems')),...ops.map(([id,href,label,x])=>p(id,{h:4,w:6,x,y:9},'',link(href,label))),p(350,{h:1,w:24,x:0,y:13},'',section('System Artifacts')),...arts.map(([id,href,label,color,x,y])=>p(id,{h:2,w:8,x,y},'',link(href,label,color)))] };
  check(d);
  return d;
}
