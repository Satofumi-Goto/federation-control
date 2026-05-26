/**
 * Verify 7-step Federated Operational Governance structure.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const issues = [];

function fail(msg) {
  issues.push(msg);
}

const gov = JSON.parse(
  fs.readFileSync(path.join(root, 'grafana/federation-governance-routes.json'), 'utf8'),
);
const routes = JSON.parse(
  fs.readFileSync(path.join(root, 'grafana/runtime-workspace-routes.json'), 'utf8'),
);
const routeFile = fs.readFileSync(
  path.join(root, 'src/federation/routes/federationRoutes.tsx'),
  'utf8',
);
const sidebar = fs.readFileSync(
  path.join(root, 'src/federation/components/FederationSidebar.tsx'),
  'utf8',
);

const requiredPaths = gov.steps.map((s) => s.path);

for (const p of requiredPaths) {
  if (!routeFile.includes(`path="${p.replace('/federation/', '')}"`)) {
    fail(`Route not registered: ${p}`);
  }
}

if (gov.steps.length !== 7) fail(`Expected 7 steps, got ${gov.steps.length}`);

const oldLabels = ['連携探索', 'ニーズ翻訳', '関係整理'];
for (const label of oldLabels) {
  if (sidebar.includes(label)) fail(`Sidebar still has old-only label without migration: ${label}`);
}

if (routes.row1.discovery !== '/federation/intake') {
  fail(`row1.discovery must be /federation/intake, got ${routes.row1.discovery}`);
}
if (routes.row1.discoveryLabel !== '入力統合') {
  fail(`row1.discoveryLabel must be 入力統合`);
}
if (routes.row1.needsTranslation !== '/federation/intent') {
  fail(`row1.needsTranslation must be /federation/intent`);
}
if (routes.row1.alignment !== '/federation/responsibility') {
  fail(`row1.alignment must be /federation/responsibility`);
}

if (!fs.existsSync(path.join(root, 'src/federation/store/federationStore.ts'))) {
  fail('Missing federationStore.ts');
}
if (!fs.existsSync(path.join(root, 'src/federation/layouts/FederationLayout.tsx'))) {
  fail('Missing FederationLayout.tsx');
}

for (const legacy of ['/runtime_discovery', '/need_impact']) {
  if (!routeFile.includes(`path="${legacy}"`)) fail(`Missing legacy redirect: ${legacy}`);
}

const report = { ok: issues.length === 0, stepCount: gov.steps.length, issues };
console.log(JSON.stringify(report, null, 2));
process.exit(issues.length === 0 ? 0 : 1);
