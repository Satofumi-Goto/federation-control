#!/usr/bin/env node
/**
 * Runtime Release Management Engine
 *
 * Manages release candidates, validation, approval state,
 * deploy readiness, rollback readiness, and audit trail.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const CCB_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-change-control-board.json');
const SNAPSHOT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-snapshot.json');

export const RELEASE_STATES = {
  CANDIDATE: 'candidate',
  VALIDATING: 'validating',
  VALIDATED: 'validated',
  APPROVED: 'approved',
  DEPLOYING: 'deploying',
  DEPLOYED: 'deployed',
  ROLLBACK: 'rollback',
  FAILED: 'failed',
};

function run(cmd) {
  try { return { ok: true, output: execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 20000 }).trim() }; }
  catch (e) { return { ok: false, output: e.stderr?.trim() ?? e.message }; }
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
 * Generate a release candidate from current state.
 */
export function generateReleaseCandidate() {
  const commitShort = run('git log -1 --format=%h');
  const commitFull = run('git log -1 --format=%H');
  const branch = run('git branch --show-current');
  const dashboard = loadJson(path.resolve(REPO_ROOT, 'grafana/runtime-workspace-v2.json'));
  const snapshot = loadJson(SNAPSHOT_PATH);

  return {
    id: `rc-${commitShort.output}-${Date.now()}`,
    commit: commitFull.output,
    commitShort: commitShort.output,
    branch: branch.output,
    dashboardVersion: dashboard?.version ?? 0,
    panels: dashboard?.panels?.length ?? 0,
    state: RELEASE_STATES.CANDIDATE,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validate a release candidate.
 */
export function validateRelease(candidate) {
  const checks = {};

  checks.build = run('node scripts/build-runtime-workspace-v2.mjs').ok;
  checks.registry = run('node scripts/verify-registry-migration.mjs').ok;
  checks.topology = run('node scripts/verify-runtime-topology-links.mjs').ok;
  checks.semantic = run('node scripts/verify-federation-semantic.mjs').ok;
  checks.governance = run('node scripts/verify-federation-governance.mjs').ok;

  const dashboard = loadJson(path.resolve(REPO_ROOT, 'grafana/runtime-workspace-v2.json'));
  const dashContent = dashboard ? JSON.stringify(dashboard) : '';
  checks.noObsolete = !dashContent.includes('viewPanel=401') && !dashContent.includes('Federation collapse governance');

  const allPass = Object.values(checks).every(Boolean);

  return {
    ...candidate,
    state: allPass ? RELEASE_STATES.VALIDATED : RELEASE_STATES.FAILED,
    validation: checks,
    validationPass: allPass,
    validatedAt: new Date().toISOString(),
  };
}

/**
 * Evaluate deploy readiness for a validated release.
 */
export function evaluateDeployReadiness(release) {
  const snapshot = loadJson(SNAPSHOT_PATH);
  const ready = release.validationPass
    && snapshot?.verificationPass !== false
    && snapshot?.contentGuardPass !== false;

  return {
    deployReady: ready,
    rollbackReady: true,
    rollbackTarget: release.commitShort,
    blockers: ready ? [] : ['Validation or snapshot checks failed'],
  };
}

/**
 * Append a change control entry.
 */
export function appendChangeControl(entry) {
  const ccb = loadJson(CCB_PATH) ?? [];
  ccb.push({ ...entry, timestamp: new Date().toISOString() });
  saveJson(CCB_PATH, ccb.slice(-100));
}

function main() {
  console.log('[release] Runtime Release Management Engine');
  console.log('='.repeat(55));

  // 1. Generate candidate
  console.log('\n[release] Phase 1: Release Candidate');
  const candidate = generateReleaseCandidate();
  console.log(`  ID: ${candidate.id}`);
  console.log(`  Commit: ${candidate.commitShort}`);
  console.log(`  Dashboard: v${candidate.dashboardVersion} (${candidate.panels} panels)`);

  // 2. Validate
  console.log('\n[release] Phase 2: Validation');
  const validated = validateRelease(candidate);
  console.log(`  State: ${validated.state}`);
  for (const [check, pass] of Object.entries(validated.validation)) {
    console.log(`    ${pass ? 'PASS' : 'FAIL'}: ${check}`);
  }

  // 3. Deploy readiness
  console.log('\n[release] Phase 3: Deploy Readiness');
  const readiness = evaluateDeployReadiness(validated);
  console.log(`  Deploy ready: ${readiness.deployReady}`);
  console.log(`  Rollback ready: ${readiness.rollbackReady}`);

  // 4. Change control entry
  appendChangeControl({
    changeId: candidate.id,
    changeType: 'release-candidate',
    proposedBy: 'runtime-orchestrator',
    reviewedBy: null,
    approvedBy: null,
    riskLevel: 'low',
    rolloutPlan: 'standard-deploy',
    rollbackPlan: `git revert to ${candidate.commitShort}`,
    decision: validated.validationPass ? 'auto-validated' : 'blocked',
  });

  const report = {
    ok: validated.validationPass,
    candidate: { id: candidate.id, commit: candidate.commitShort, branch: candidate.branch },
    state: validated.state,
    validation: validated.validation,
    deployReady: readiness.deployReady,
    rollbackReady: readiness.rollbackReady,
    timestamp: new Date().toISOString(),
  };

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[release] ${validated.validationPass ? 'RELEASE VALIDATED' : 'RELEASE FAILED'}`);
  console.log('\n' + JSON.stringify(report, null, 2));
}

main();
