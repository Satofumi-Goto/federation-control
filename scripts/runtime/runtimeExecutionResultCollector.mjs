#!/usr/bin/env node
/**
 * Runtime Execution Result Collector
 *
 * Collects build, verification, deploy, commit, push,
 * and health results after Cursor Agent execution.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const RESULT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-execution-result.json');

function run(cmd) {
  try {
    return { ok: true, output: execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 30000 }).trim() };
  } catch (e) {
    return { ok: false, output: e.stderr?.trim() ?? e.message };
  }
}

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * Collect all execution results.
 */
export function collectResults() {
  const results = {};

  // Changed files
  const porcelain = run('git status --porcelain');
  results.changedFiles = porcelain.output ? porcelain.output.split('\n').filter(Boolean) : [];
  results.changedFileCount = results.changedFiles.length;

  // Build
  const build = run('node scripts/build-runtime-workspace-v2.mjs');
  const dashboard = loadJson(path.resolve(REPO_ROOT, 'grafana/runtime-workspace-v2.json'));
  results.build = {
    ok: build.ok,
    panels: dashboard?.panels?.length ?? 0,
    version: dashboard?.version ?? 0,
  };

  // Verification
  results.verification = {};
  for (const [name, cmd] of [
    ['registry', 'node scripts/verify-registry-migration.mjs'],
    ['topology', 'node scripts/verify-runtime-topology-links.mjs'],
    ['semantic', 'node scripts/verify-federation-semantic.mjs'],
    ['governance', 'node scripts/verify-federation-governance.mjs'],
  ]) {
    results.verification[name] = run(cmd).ok;
  }
  results.verificationPass = Object.values(results.verification).every(Boolean);

  // Git state
  const commitSha = run('git log -1 --format=%H');
  const commitShort = run('git log -1 --format=%h');
  const branch = run('git branch --show-current');
  results.git = {
    branch: branch.output,
    commitSha: commitSha.output,
    commitShort: commitShort.output,
  };

  // Push status (check only, do not push)
  const ahead = run('git rev-list --count @{u}..HEAD');
  results.pushStatus = {
    commitsAhead: parseInt(ahead.output) || 0,
    pushed: ahead.ok && parseInt(ahead.output) === 0,
  };

  // Runtime health
  const snapshot = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-snapshot.json'));
  results.health = {
    state: snapshot?.state ?? 'unknown',
    governanceMode: snapshot?.governanceMode ?? 'unknown',
    pressure: snapshot?.governancePressure ?? 0,
  };

  results.timestamp = new Date().toISOString();
  return results;
}

/**
 * Collect and save results.
 */
export function collectAndSave() {
  const results = collectResults();
  saveJson(RESULT_PATH, results);
  return results;
}

if (process.argv[1]?.endsWith('runtimeExecutionResultCollector.mjs')) {
  console.log('[collector] Runtime Execution Result Collector');
  console.log('='.repeat(55));

  const results = collectAndSave();

  console.log(`\n  Changed files: ${results.changedFileCount}`);
  console.log(`  Build: ${results.build.ok ? 'PASS' : 'FAIL'} (${results.build.panels} panels, v${results.build.version})`);
  console.log(`  Verification: ${results.verificationPass ? 'ALL PASS' : 'SOME FAILED'}`);
  for (const [k, v] of Object.entries(results.verification)) {
    console.log(`    ${k}: ${v ? 'PASS' : 'FAIL'}`);
  }
  console.log(`  Git: ${results.git.branch} @ ${results.git.commitShort}`);
  console.log(`  Push: ${results.pushStatus.pushed ? 'up-to-date' : `${results.pushStatus.commitsAhead} ahead`}`);
  console.log(`  Health: ${results.health.state}`);

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[collector] ${results.verificationPass && results.build.ok ? 'ALL PASS' : 'ISSUES DETECTED'}`);
  console.log('\n' + JSON.stringify(results, null, 2));
}
