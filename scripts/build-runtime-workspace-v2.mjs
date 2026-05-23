import fs from 'node:fs';
import path from 'node:path';

const routes = JSON.parse(fs.readFileSync('grafana/runtime-workspace-routes.json', 'utf8'));
const text = (id, gridPos, title, content) => ({
  id,
  type: 'text',
  title,
  transparent: true,
  pluginVersion: '11.5.2',
  gridPos,
  options: { mode: 'html', content, code: { language: 'html', showLineNumbers: false, showMiniMap: false } }
});
const card = (href, label) => `<a href="${href}" style="display:flex;align-items:center;justify-content:center;height:100%;font-size:18px;font-weight:800;text-decoration:none;color:inherit">${label}</a>`;
const section = (label) => `<div style="display:flex;align-items:center;justify-content:space-between;height:100%"><b>${label}</b><b>＋</b></div>`;
const dashboard = {
  uid: 'sa8ljn4', editable: true, schemaVersion: 39, title: 'Runtime', version: 45, refresh: '30s', timezone: 'browser',
  description: 'Federated Operational Governance Workspace', tags: ['runtime','federation','governance'],
  links: [
    { title: 'Runtime', url: routes.runtimeTopPath },
    { title: routes.row1.discoveryLabel ?? '連携探索', url: routes.row1.discovery },
    { title: 'Needs翻訳', url: routes.row1.needsTranslation },
    { title: 'アライメント', url: routes.row1.alignment }
  ],
  panels: [
    text(100, {h:3,w:24,x:0,y:0}, '', `<h1>Runtime</h1><p>Federation Brain　<a href="${routes.row1.discovery}">連携探索</a>　<a href="${routes.row1.needsTranslation}">Needs翻訳</a>　<a href="${routes.row1.alignment}">アライメント</a></p>`),
    text(201, {h:5,w:12,x:0,y:3}, 'Obsidian Knowledge Graph', '<h2>Obsidian Knowledge Graph</h2><p>Obsidian · Graph role</p><p>Note · Wikilink · Program · ADR</p>'),
    text(202, {h:5,w:12,x:12,y:3}, 'Runtime Federation Graph', '<h2>Runtime Federation Graph</h2><p>Runtime · Federation role</p><p>Queue · ETA · Throughput · Drift · Alignment · Collapse Risk</p>'),
    text(300, {h:1,w:24,x:0,y:8}, '', section('Operational Systems')),
    text(311, {h:4,w:6,x:0,y:9}, '', card(routes.row3.fleetOperation, 'フリート運用')),
    text(312, {h:4,w:6,x:6,y:9}, '', card(routes.row3.serviceHub, 'サービス拠点')),
    text(313, {h:4,w:6,x:12,y:9}, '', card(routes.row3.lifeTransaction, '生活取引')),
    text(314, {h:4,w:6,x:18,y:9}, '', card(routes.row3.urbanOperation, '都市運行')),
    text(350, {h:1,w:24,x:0,y:13}, '', section('System Artifacts')),
    text(401, {h:2,w:8,x:0,y:14}, '', card(routes.row4.collapseArchitecture, 'Collapse Control Architecture')),
    text(402, {h:2,w:8,x:8,y:14}, '', card(routes.row4.functionalArchitecture, 'Functional Topology')),
    text(403, {h:2,w:8,x:16,y:14}, '', card(routes.row4.sequenceDiagram, 'Federation Sequence'))
  ]
};
const raw = JSON.stringify(dashboard, null, 2);
for (const bad of ['Federation Add','Global system onboarding','/login?from_url=','自システム','運行制御アーキテクチャ']) {
  if (raw.includes(bad)) throw new Error(`stale label remains: ${bad}`);
}
fs.writeFileSync(path.resolve('grafana/runtime-workspace-v2.json'), `${raw}\n`);
fs.mkdirSync('dashboards', { recursive: true });
fs.writeFileSync(path.resolve('dashboards/runtime-workspace-v2.json'), `${raw}\n`);
console.log('Wrote runtime workspace dashboard v45');
