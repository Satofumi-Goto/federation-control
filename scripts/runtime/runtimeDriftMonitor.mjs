#!/usr/bin/env node
/**
 * Runtime Drift Monitor
 *
 * Compares Runtime Registry vs deployed dashboard,
 * detects orphan cards, unresolved routes, and
 * forbidden content reappearance.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const FORBIDDEN = [
  { pattern: 'viewPanel=401', label: 'viewPanel=401 routing' },
  { pattern: 'Federation collapse governance', label: 'obsolete governance panel' },
  { pattern: '崩壊制御 ●2', label: 'obsolete collapse-control duplicate' },
  { pattern: 'window.location', label: 'window.location usage' },
  { pattern: 'window.open', label: 'window.open usage' },
];

const REQUIRED_CARDS = ['崩壊制御', '崩壊解析', '改修影響', '改修提案', '実装進捗'];

const REQUIRED_ROUTES = [
  'grafana.net/d/sa8ljn4',
  'runtime_discovery',
  'need_impact',
  'external-federation-view',
  'go-execution-tasks',
];

function loadFile(rel) {
  try { return fs.readFileSync(path.resolve(REPO_ROOT, rel), 'utf8'); }
  catch { return null; }
}

function main() {
  console.log('[drift] Runtime Drift Monitor');

  const dashboardRaw = loadFile('grafana/runtime-workspace-v2.json');
  const registryRaw = loadFile('src/runtime/registry/runtimeRegistryData.json');
  const memoryRaw = loadFile('runtime_data/runtime-federation-memory.json');

  const drifts = [];

  if (!dashboardRaw) {
    drifts.push({ type: 'missing-artifact', detail: 'runtime-workspace-v2.json not found' });
  }
  if (!registryRaw) {
    drifts.push({ type: 'missing-artifact', detail: 'runtimeRegistryData.json not found' });
  }

  const dashboard = dashboardRaw ? JSON.parse(dashboardRaw) : null;
  const registry = registryRaw ? JSON.parse(registryRaw) : [];
  const memory = memoryRaw ? JSON.parse(memoryRaw) : {};
  const dashContent = dashboardRaw ?? '';

  // Forbidden content reappearance
  for (const f of FORBIDDEN) {
    if (dashContent.includes(f.pattern)) {
      drifts.push({ type: 'forbidden-reappearance', detail: f.label });
    }
  }

  // Required cards present in dashboard
  for (const card of REQUIRED_CARDS) {
    if (!dashContent.includes(card)) {
      drifts.push({ type: 'missing-card', detail: `Card "${card}" not found in dashboard` });
    }
  }

  // Required routes present
  for (const route of REQUIRED_ROUTES) {
    if (!dashContent.includes(route)) {
      drifts.push({ type: 'unresolved-route', detail: `Route "${route}" not found in dashboard` });
    }
  }

  // Registry vs Memory consistency
  const memoryNodes = memory.knowledgeGraph?.nodes ?? [];
  const memoryIds = new Set(memoryNodes.map(n => n.id));
  for (const card of registry) {
    if (!memoryIds.has(card.id)) {
      // Registry cards don't need direct memory node mapping,
      // but collapse-related ones should
      if (['collapse-control', 'collapse-analysis'].includes(card.id)) {
        drifts.push({ type: 'registry-memory-gap', detail: `Registry card "${card.id}" has no memory node` });
      }
    }
  }

  // Orphan detection: memory nodes that reference deleted concepts
  const registryIds = new Set(registry.map(c => c.id));
  const knownNodeIds = new Set([
    'runtime', 'queue', 'odd', 'constraint', 'eta', 'dispatch',
    'fleet', 'energy', 'node', 'hils', 'pl', 'irr', 'draft',
    'seneschal', 'intent',
  ]);

  // Dashboard version check
  if (dashboard && dashboard.version < 1) {
    drifts.push({ type: 'invalid-version', detail: `Dashboard version is ${dashboard.version}` });
  }

  // Compute state
  let state;
  const hasForbidden = drifts.some(d => d.type === 'forbidden-reappearance');
  const hasMissing = drifts.some(d => d.type === 'missing-card' || d.type === 'unresolved-route');
  if (hasForbidden) state = 'degraded';
  else if (hasMissing) state = 'drifting';
  else if (drifts.length > 0) state = 'warning';
  else state = 'healthy';

  // Output
  console.log(`[drift] state: ${state}`);
  console.log(`[drift] drifts found: ${drifts.length}`);
  for (const d of drifts) {
    console.log(`  ${d.type}: ${d.detail}`);
  }

  const report = {
    ok: state === 'healthy',
    state,
    driftCount: drifts.length,
    drifts,
    dashboard: dashboard ? { uid: dashboard.uid, version: dashboard.version, panels: dashboard.panels?.length } : null,
    registryCards: registry.length,
    memoryNodes: memoryNodes.length,
    timestamp: new Date().toISOString(),
  };

  console.log('\n' + JSON.stringify(report, null, 2));
  process.exit(state === 'healthy' ? 0 : 1);
}

main();
