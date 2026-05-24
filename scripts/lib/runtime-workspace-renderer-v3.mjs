const TEXT_PLUGIN_VERSION = '11.5.2';

const badWords = ['自システム','崩壊制御アーキテクチャ','機能アーキテクチャ図','シーケンス図','Runtime Federation Memory','Growing Runtime Knowledge Graph','崩壊制御 Runtime','運行制御アーキテクチャ'];
const requiredWords = ['連携探索','Needs翻訳','関係整理','同期改修','崩壊制御','崩壊解析','改修影響','実装進捗','Seneschal','Console','Runtime','runtime_embed=grafana','public_view=1'];

function panel(id, x, y, w, h, title, body) {
  return { id, type: 'text', title, transparent: true, pluginVersion: TEXT_PLUGIN_VERSION, gridPos: { h, w, x, y }, options: { mode: 'markdown', content: body } };
}
function notice(n) { return `●${n}`; }
function tabs() { return 'Seneschal / Console / Runtime'; }
function bar(name, pct) { return `${name}: ${pct}%`; }
function assertClean(dashboard) {
  const raw = JSON.stringify(dashboard);
  for (const word of badWords) if (raw.includes(word)) throw new Error(`bad token: ${word}`);
  for (const word of requiredWords) if (!raw.includes(word)) throw new Error(`missing token: ${word}`);
}

export function buildRuntimeWorkspaceDashboard(routes) {
  const dashboard = {
    uid: 'sa8ljn4', editable: true, schemaVersion: 39, title: 'Runtime', version: 61, refresh: '30s', timezone: 'browser', description: 'Federated Operational Governance Workspace', tags: ['runtime','federation','governance'],
    links: [
      { title: 'Runtime', url: routes.runtimeTopPath },
      { title: '連携探索', url: routes.row1.discovery },
      { title: 'Needs翻訳', url: routes.row1.needsTranslation },
      { title: '関係整理', url: routes.row1.alignment },
      { title: '同期改修', url: routes.row1.alignment }
    ],
    panels: [
      panel(100,0,0,24,3,'Runtime','## Runtime\nFederated Decision and Governance'),
      panel(201,0,3,12,5,'Obsidian Knowledge Graph','### Obsidian Knowledge Graph\nNote / Wikilink / Program / ADR\n\n実データ連携対象'),
      panel(202,12,3,12,5,'Runtime Federation Graph','### Runtime Federation Graph\nRenderer / Artifact / Deploy / Viewer / Topology'),
      panel(300,0,8,24,1,'Decision Flow','Decision Flow'),
      panel(311,0,9,6,4,'連携探索',`## 連携探索 ${notice(1)}\n入力収集\n\n外部入力・自己解析・開発途中課題を入口として集約する。`),
      panel(312,6,9,6,4,'Needs翻訳',`## Needs翻訳 ${notice(2)}\n要求定義\n\nNeed / KPI / constraint / intent へ翻訳する。`),
      panel(313,12,9,6,4,'関係整理',`## 関係整理 ${notice(3)}\n崩壊解析をimport\n\ndependency proposalを取り込み、責務境界をAI会話で修正する。`),
      panel(314,18,9,6,4,'同期改修',`## 同期改修 ${notice(4)}\n改修影響をimport\n\n改修影響から順序・リスクを取り込み、同期改修へ反映する。`),
      panel(350,0,13,24,1,'Governance Telemetry','Governance Telemetry'),
      panel(401,0,14,6,4,'崩壊制御',`## 崩壊制御 ${notice(2)}\nFederation全体の崩壊連鎖を監視\n\nRuntime drift → Viewer不一致 → 実装停止`),
      panel(402,6,14,6,4,'崩壊解析',`## 崩壊解析 ${notice(4)}\n${tabs()}\n\n自動生成 → AI会話で修正\n\n関係整理はこの解析結果をimportする。`),
      panel(403,12,14,6,4,'改修影響',`## 改修影響 ${notice(3)}\n${tabs()}\n\n自動生成 → AI会話で修正\n\n同期改修はこの影響解析をimportする。`),
      panel(404,18,14,6,4,'実装進捗',`## 実装進捗 ${notice(4)}\n${tabs()}\n\n${bar('Artifact再生成',65)}\n${bar('Dashboard deploy',40)}\n${bar('Viewer public化',70)}\n\n完了項目は非表示。`),
      panel(499,0,99,1,1,'guard','runtime_embed=grafana public_view=1')
    ]
  };
  assertClean(dashboard);
  return dashboard;
}
