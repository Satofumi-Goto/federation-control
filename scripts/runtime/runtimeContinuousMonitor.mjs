#!/usr/bin/env node
/**
 * Runtime Continuous Monitor
 *
 * Monitors build, verification, deploy, drift, and registry
 * consistency. Outputs a single operational state.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCredentialSummary } from './runtimeCredentialResolver.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const SNAPSHOT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-snapshot.json');

const MONITOR_STATES = ['healthy', 'warning', 'drifting', 'repairing', 'degraded', 'failed'];

function run(cmd) {
  try {
    return { ok: true, output: execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 30000 }).trim() };
  } catch (e) {
    return { ok: false, output: e.stderr?.trim() ?? e.message };
  }
}

function loadDashboard() {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(REPO_ROOT, 'grafana/runtime-workspace-v2.json'), 'utf8'));
  } catch { return null; }
}

function loadRegistry() {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(REPO_ROOT, 'src/runtime/registry/runtimeRegistryData.json'), 'utf8'));
  } catch { return []; }
}

function loadSnapshot() {
  try { return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8')); }
  catch { return null; }
}

function saveSnapshot(snapshot) {
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
}

function main() {
  console.log('[monitor] Runtime Continuous Monitor');

  const checks = {};

  // Build status
  const build = run('node scripts/build-runtime-workspace-v2.mjs');
  const dashboard = loadDashboard();
  checks.build = { ok: build.ok, panels: dashboard?.panels?.length ?? 0, version: dashboard?.version ?? 0 };

  // Verification status
  const verifyChecks = [
    ['registry', 'node scripts/verify-registry-migration.mjs'],
    ['topology', 'node scripts/verify-runtime-topology-links.mjs'],
    ['semantic', 'node scripts/verify-federation-semantic.mjs'],
  ];
  checks.verification = {};
  for (const [name, cmd] of verifyChecks) {
    checks.verification[name] = run(cmd).ok;
  }

  // Registry consistency
  const registry = loadRegistry();
  checks.registry = { count: registry.length, hasHealth: registry.every(c => c.health?.state) };

  // Deploy status
  const creds = getCredentialSummary();
  checks.deploy = { grafanaAvailable: creds.grafana.available, githubAvailable: creds.github.available };

  // Git state
  const branch = run('git branch --show-current');
  const lastCommit = run('git log -1 --format=%h');
  const porcelain = run('git status --porcelain');
  const dirtyFiles = porcelain.output ? porcelain.output.split('\n').filter(Boolean).length : 0;
  checks.git = { branch: branch.output, lastCommit: lastCommit.output, dirtyFiles };

  // Dashboard content check
  const dashContent = dashboard ? JSON.stringify(dashboard) : '';
  checks.contentGuard = {
    noViewPanel401: !dashContent.includes('viewPanel=401'),
    noWindowLocation: !dashContent.includes('window.location'),
    noObsoletePanels: !dashContent.includes('Federation collapse governance'),
  };

  // Topology drift (compare snapshot)
  const prevSnapshot = loadSnapshot();
  checks.drift = {
    versionDrift: prevSnapshot ? prevSnapshot.deployVersion !== (dashboard?.version ?? 0) : false,
    commitDrift: prevSnapshot ? prevSnapshot.lastCommit !== lastCommit.output : false,
  };

  // Compute overall state
  const allVerifyPass = Object.values(checks.verification).every(Boolean);
  const contentClean = Object.values(checks.contentGuard).every(Boolean);
  let state;
  if (!checks.build.ok) state = 'failed';
  else if (!allVerifyPass) state = 'degraded';
  else if (!contentClean) state = 'degraded';
  else if (checks.drift.versionDrift || checks.drift.commitDrift) state = 'drifting';
  else if (dirtyFiles > 20) state = 'warning';
  else state = 'healthy';

  // Save snapshot
  const snapshot = {
    state,
    lastCommit: lastCommit.output,
    deployVersion: dashboard?.version ?? 0,
    panels: dashboard?.panels?.length ?? 0,
    registryCount: registry.length,
    verificationPass: allVerifyPass,
    contentGuardPass: contentClean,
    dirtyFiles,
    grafanaAvailable: creds.grafana.available,
    timestamp: new Date().toISOString(),
  };
  saveSnapshot(snapshot);

  // Output
  console.log(`[monitor] state: ${state}`);
  console.log(`[monitor] build: ${checks.build.ok ? 'PASS' : 'FAIL'} (${checks.build.panels} panels, v${checks.build.version})`);
  for (const [k, v] of Object.entries(checks.verification)) {
    console.log(`[monitor] verify/${k}: ${v ? 'PASS' : 'FAIL'}`);
  }
  console.log(`[monitor] registry: ${checks.registry.count} cards, health=${checks.registry.hasHealth}`);
  console.log(`[monitor] git: ${checks.git.branch} @ ${checks.git.lastCommit} (${dirtyFiles} dirty)`);
  console.log(`[monitor] drift: version=${checks.drift.versionDrift} commit=${checks.drift.commitDrift}`);
  console.log(`[monitor] content-guard: ${contentClean ? 'PASS' : 'FAIL'}`);

  const report = { ok: state === 'healthy' || state === 'warning', state, checks, snapshot };
  console.log('\n' + JSON.stringify(report, null, 2));
}

main();
