/**
 * Semantic alignment: routes, cards, artifacts, graph, add, viewer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const issues = [];

function fail(code, msg) {
  issues.push({ code, msg });
}

const semantic = JSON.parse(
  fs.readFileSync(path.join(root, 'grafana/federation-semantic-map.json'), 'utf8'),
);
const routes = JSON.parse(
  fs.readFileSync(path.join(root, 'grafana/runtime-workspace-routes.json'), 'utf8'),
);
const v2 = JSON.parse(fs.readFileSync(path.join(root, 'grafana/runtime-workspace-v2.json'), 'utf8'));

const allContent = (v2.panels ?? []).map((p) => p.options?.content ?? '').join('\n');

for (const deprecated of semantic.deprecatedUiPaths ?? []) {
  if (allContent.includes(`href="${deprecated}"`) || allContent.includes(`>${deprecated}<`)) {
    fail('deprecated-ui-path', `Workspace UI still references ${deprecated}`);
  }
}

if (allContent.includes('<details')) {
  fail('details-poc', 'Workspace still uses <details> PoC UI');
}

if (!allContent.includes('fed-overlay-systems')) {
  fail('systems-overlay', 'Missing systems onboarding overlay');
}

if (!allContent.includes('Federated') || !allContent.includes('Read-only')) {
  fail('viewer-badges', 'Operational Systems missing viewer mode badges');
}

if (!allContent.includes('Federation Health') || !allContent.includes('Collapse Risk')) {
  fail('live-graph', 'Federation Graph missing live state metrics');
}

if (!allContent.includes('ADR') || !allContent.includes('Knowledge Cluster')) {
  fail('obsidian-roles', 'Obsidian panel missing role separation');
}

if (allContent.includes('Runtime Federation Brain')) {
  fail('wording', 'Avoid Runtime Federation Brain — use Federation Brain');
}

if (!allContent.includes('↔')) {
  fail('artifact-links', 'Artifacts missing federation cross-links');
}

for (const [step, cfg] of Object.entries(semantic.routes ?? {})) {
  const actual = routes.row1?.[step] ?? routes.row1?.discovery;
  if (step === 'intake' && routes.row1.discovery !== cfg.path) {
    fail('route-intake', `intake path mismatch`);
  }
  if (step === 'intent' && routes.row1.needsTranslation !== cfg.path) {
    fail('route-intent', `intent path mismatch`);
  }
}

const report = { ok: issues.length === 0, issues };
console.log(JSON.stringify(report, null, 2));
process.exit(issues.length === 0 ? 0 : 1);
