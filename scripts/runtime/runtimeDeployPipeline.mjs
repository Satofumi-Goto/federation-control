#!/usr/bin/env node
/**
 * Runtime Deploy Pipeline
 *
 * Stages: build → verify → commit → push → grafana-deploy → deploy-verify
 * Each stage is independently skippable via CLI flags.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveGrafana, getCredentialSummary } from './runtimeCredentialResolver.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

function run(cmd, opts = {}) {
  try {
    const result = execSync(cmd, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      timeout: 60000,
      ...opts,
    });
    return { ok: true, output: result.trim() };
  } catch (e) {
    return { ok: false, output: e.stderr?.trim() ?? e.message };
  }
}

function stage(name, fn) {
  console.log(`\n[${'='.repeat(50)}]`);
  console.log(`[pipeline] STAGE: ${name}`);
  console.log(`[${'='.repeat(50)}]`);
  const start = Date.now();
  const result = fn();
  const elapsed = Date.now() - start;
  const status = result.ok ? 'PASS' : 'FAIL';
  console.log(`[pipeline] ${name}: ${status} (${elapsed}ms)`);
  return { stage: name, ...result, elapsed };
}

function main() {
  const args = process.argv.slice(2);
  const skipCommit = args.includes('--skip-commit');
  const skipPush = args.includes('--skip-push');
  const skipDeploy = args.includes('--skip-deploy');
  const commitMsg = args.find((a) => a.startsWith('--message='))?.slice(10) ?? null;

  console.log('[pipeline] Runtime Deploy Pipeline');
  console.log(`[pipeline] repo: ${REPO_ROOT}`);
  console.log(`[pipeline] flags: skip-commit=${skipCommit} skip-push=${skipPush} skip-deploy=${skipDeploy}`);

  const credSummary = getCredentialSummary();
  console.log('[pipeline] credentials (masked):', JSON.stringify(credSummary, null, 2));

  const results = [];

  // Stage 1: Build
  results.push(stage('build', () => {
    const r = run('node scripts/build-runtime-workspace-v2.mjs');
    if (r.ok) console.log(`  ${r.output}`);
    return r;
  }));

  // Stage 2: Verify
  results.push(stage('verify', () => {
    const checks = [
      { name: 'registry-migration', cmd: 'node scripts/verify-registry-migration.mjs' },
      { name: 'topology', cmd: 'node scripts/verify-runtime-topology-links.mjs' },
      { name: 'semantic', cmd: 'node scripts/verify-federation-semantic.mjs' },
    ];
    const checkResults = [];
    let allOk = true;
    for (const c of checks) {
      const r = run(c.cmd);
      checkResults.push({ name: c.name, ok: r.ok });
      console.log(`  ${c.name}: ${r.ok ? 'PASS' : 'FAIL'}`);
      if (!r.ok) allOk = false;
    }
    return { ok: allOk, checks: checkResults, output: '' };
  }));

  if (!results.every((r) => r.ok)) {
    console.error('\n[pipeline] ABORT: Build or verify failed. Stopping pipeline.');
    printSummary(results);
    process.exit(1);
  }

  // Stage 3: Commit
  if (skipCommit) {
    results.push({ stage: 'commit', ok: true, skipped: true, output: 'skipped', elapsed: 0 });
    console.log('\n[pipeline] STAGE: commit — SKIPPED');
  } else {
    results.push(stage('commit', () => {
      const status = run('git status --porcelain');
      if (!status.output) {
        console.log('  No changes to commit');
        return { ok: true, output: 'nothing to commit' };
      }
      const msg = commitMsg ?? `Runtime deploy: build + verify pass [${new Date().toISOString().slice(0, 10)}]`;
      const addR = run('git add -A');
      if (!addR.ok) return addR;
      const commitR = run(`git commit -m "${msg.replace(/"/g, '\\"')}"`);
      if (commitR.ok) {
        const sha = run('git rev-parse --short HEAD');
        console.log(`  Committed: ${sha.output}`);
        return { ok: true, output: sha.output };
      }
      return commitR;
    }));
  }

  // Stage 4: Push
  if (skipPush) {
    results.push({ stage: 'push', ok: true, skipped: true, output: 'skipped', elapsed: 0 });
    console.log('\n[pipeline] STAGE: push — SKIPPED');
  } else {
    results.push(stage('push', () => run('git push origin main')));
  }

  // Stage 5: Grafana Deploy
  if (skipDeploy) {
    results.push({ stage: 'grafana-deploy', ok: true, skipped: true, output: 'skipped', elapsed: 0 });
    console.log('\n[pipeline] STAGE: grafana-deploy — SKIPPED');
  } else {
    results.push(stage('grafana-deploy', () => {
      const grafana = resolveGrafana();
      if (!grafana.available) {
        console.log('  WARN: Grafana credentials not available — deploy via CI on push');
        return { ok: true, output: 'deferred-to-ci' };
      }
      const r = run('node scripts/deploy-runtime-workspace.mjs', {
        env: { ...process.env, GRAFANA_TOKEN: grafana.token, GRAFANA_URL: grafana.url, DASHBOARD_PATH: 'grafana/runtime-workspace-v2.json' },
      });
      return r;
    }));
  }

  // Stage 6: Deploy Verify
  if (skipDeploy) {
    results.push({ stage: 'deploy-verify', ok: true, skipped: true, output: 'skipped', elapsed: 0 });
    console.log('\n[pipeline] STAGE: deploy-verify — SKIPPED');
  } else {
    results.push(stage('deploy-verify', () => {
      const grafana = resolveGrafana();
      if (!grafana.available) {
        console.log('  WARN: Grafana credentials not available — skipping deploy verification');
        return { ok: true, output: 'skipped-no-credentials' };
      }
      const r = run('node scripts/runtime/runtimeGrafanaVerify.mjs');
      return r;
    }));
  }

  printSummary(results);
}

function printSummary(results) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('[pipeline] SUMMARY');
  console.log('='.repeat(60));
  for (const r of results) {
    const status = r.skipped ? 'SKIP' : r.ok ? 'PASS' : 'FAIL';
    console.log(`  ${status}: ${r.stage} (${r.elapsed}ms)`);
  }
  const allOk = results.every((r) => r.ok);
  console.log(`\n[pipeline] Overall: ${allOk ? 'SUCCESS' : 'FAILED'}`);

  const report = {
    ok: allOk,
    stages: results.map((r) => ({ stage: r.stage, ok: r.ok, skipped: r.skipped ?? false })),
    timestamp: new Date().toISOString(),
  };
  console.log('\n' + JSON.stringify(report, null, 2));
}

main();
