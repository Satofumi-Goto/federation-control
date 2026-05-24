import fs from 'node:fs';
import path from 'node:path';
import { buildRuntimeWorkspaceDashboard } from './lib/runtime-workspace-renderer-v3.mjs';

const routesPath = path.resolve('grafana/runtime-workspace-routes.json');
const grafanaOut = path.resolve('grafana/runtime-workspace-v2.json');
const deployOut = path.resolve('dashboards/runtime-workspace-v2.json');

const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));
const dashboard = buildRuntimeWorkspaceDashboard(routes);
const raw = `${JSON.stringify(dashboard, null, 2)}\n`;

const forbidden = [
  '自システム',
  '崩壊制御アーキテクチャ',
  '機能アーキテクチャ図',
  'シーケンス図',
  'Runtime Federation Memory',
  'Growing Runtime Knowledge Graph',
  '崩壊制御 Runtime',
  '運行制御アーキテクチャ',
  'Federation Add',
  'Global system onboarding',
  '/login' + '?from_url='
];

const required = [
  '連携探索',
  'Needs翻訳',
  '関係整理',
  '同期改修',
  '崩壊制御',
  '崩壊解析',
  '改修影響',
  '実装進捗',
  'Seneschal',
  'Console',
  'Runtime',
  'runtime_embed=grafana',
  'public_view=1'
];

for (const token of forbidden) {
  if (raw.includes(token)) throw new Error(`Runtime workspace build rejected stale token: ${token}`);
}
for (const token of required) {
  if (!raw.includes(token)) throw new Error(`Runtime workspace build missing required token: ${token}`);
}

fs.mkdirSync(path.dirname(grafanaOut), { recursive: true });
fs.mkdirSync(path.dirname(deployOut), { recursive: true });
fs.writeFileSync(grafanaOut, raw);
fs.writeFileSync(deployOut, raw);

console.log(`Runtime workspace built from ${routesPath}`);
console.log(`Canonical artifact: ${grafanaOut}`);
console.log(`Deploy artifact: ${deployOut}`);
console.log(`Dashboard version: ${dashboard.version}`);
console.log(`Panels: ${dashboard.panels.length}`);
