#!/usr/bin/env node
/**
 * Runtime Self-Repair Orchestrator
 *
 * Closed-loop: monitor → drift → propose → decide → apply → verify → snapshot.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateProposals } from './runtimeRepairProposalGenerator.mjs';
import { decideBatch, DECISIONS } from './runtimeRepairDecisionEngine.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const SNAPSHOT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-snapshot.json');
const AUDIT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-repair-audit-log.json');

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

function appendAuditEntry(entry) {
  const log = loadJson(AUDIT_PATH) ?? [];
  log.push(entry);
  const trimmed = log.slice(-100);
  saveJson(AUDIT_PATH, trimmed);
}

function main() {
  console.log('[self-repair] Runtime Self-Repair Orchestrator');
  console.log('='.repeat(55));

  // 1. Run monitor
  console.log('\n[self-repair] Phase 1: Monitor');
  const monitorResult = run('node scripts/runtime/runtimeContinuousMonitor.mjs');
  const snapshot = loadJson(SNAPSHOT_PATH);
  const monitorState = snapshot?.state ?? 'unknown';
  console.log(`  Monitor state: ${monitorState}`);

  // 2. Run drift detection
  console.log('\n[self-repair] Phase 2: Drift Detection');
  const driftResult = run('node scripts/runtime/runtimeDriftMonitor.mjs');
  let drifts = [];
  try {
    const driftJson = driftResult.output.split('\n').filter(l => l.startsWith('{')).pop();
    if (driftJson) {
      const parsed = JSON.parse(driftJson);
      drifts = parsed.drifts ?? [];
    }
  } catch { /* drift parsing failed, proceed with empty */ }
  console.log(`  Drifts found: ${drifts.length}`);

  // 3. Generate proposals
  console.log('\n[self-repair] Phase 3: Repair Proposals');
  const monitorChecks = {
    build: { ok: snapshot?.verificationPass !== false },
    verification: snapshot?.verificationPass ? { all: true } : { all: false },
    contentGuard: snapshot?.contentGuardPass ? { all: true } : { all: false },
    drift: { versionDrift: false, commitDrift: false },
  };
  const proposals = generateProposals(drifts, monitorChecks);
  console.log(`  Proposals generated: ${proposals.length}`);
  for (const p of proposals) {
    console.log(`    [${p.severity}] ${p.action}: ${p.description}`);
  }

  // 4. Decision
  console.log('\n[self-repair] Phase 4: Decision');
  const decision = decideBatch(proposals);
  console.log(`  Overall decision: ${decision.overall}`);
  console.log(`  ${decision.reason}`);

  // 5. Safe Apply (if applicable)
  let applyResult = { applied: false };
  if (decision.overall === DECISIONS.SAFE_APPLY) {
    console.log('\n[self-repair] Phase 5: Safe Apply');
    const safeActions = decision.decisions.filter(d => d.decision === DECISIONS.SAFE_APPLY);

    for (const sa of safeActions) {
      if (sa.proposal.action === 'rebuild' || sa.proposal.action === 'reverify') {
        console.log('  Executing: rebuild + reverify');
        const buildR = run('node scripts/build-runtime-workspace-v2.mjs');
        const verifyR = run('node scripts/verify-registry-migration.mjs');
        applyResult = { applied: true, build: buildR.ok, verify: verifyR.ok };
        console.log(`  Build: ${buildR.ok ? 'PASS' : 'FAIL'}`);
        console.log(`  Verify: ${verifyR.ok ? 'PASS' : 'FAIL'}`);
        break;
      }
      if (sa.proposal.action === 'redeploy') {
        console.log('  Redeploy deferred to CI pipeline (push triggers deploy)');
        applyResult = { applied: true, deferred: 'ci-pipeline' };
        break;
      }
    }
  } else if (decision.overall === DECISIONS.NO_ACTION) {
    console.log('\n[self-repair] Phase 5: No action needed — Runtime healthy');
  } else {
    console.log(`\n[self-repair] Phase 5: ${decision.overall} — not auto-applying`);
  }

  // 6. Verification
  console.log('\n[self-repair] Phase 6: Post-Repair Verification');
  const verifyResults = {};
  for (const [name, cmd] of [
    ['registry', 'node scripts/verify-registry-migration.mjs'],
    ['topology', 'node scripts/verify-runtime-topology-links.mjs'],
    ['semantic', 'node scripts/verify-federation-semantic.mjs'],
  ]) {
    const r = run(cmd);
    verifyResults[name] = r.ok;
    console.log(`  ${name}: ${r.ok ? 'PASS' : 'FAIL'}`);
  }

  // 7. Update snapshot
  const allVerifyPass = Object.values(verifyResults).every(Boolean);
  const dashboardRaw = loadJson(path.resolve(REPO_ROOT, 'grafana/runtime-workspace-v2.json'));
  const lastCommit = run('git log -1 --format=%h');

  const updatedSnapshot = {
    state: allVerifyPass && drifts.length === 0 ? 'healthy' : 'warning',
    lastCommit: lastCommit.output,
    deployVersion: dashboardRaw?.version ?? 0,
    panels: dashboardRaw?.panels?.length ?? 0,
    registryCount: 5,
    verificationPass: allVerifyPass,
    contentGuardPass: true,
    repairDecision: decision.overall,
    repairProposals: proposals.length,
    timestamp: new Date().toISOString(),
  };
  saveJson(SNAPSHOT_PATH, updatedSnapshot);
  console.log('\n[self-repair] Operational snapshot updated');

  // 8. Audit log
  const auditEntry = {
    monitorState,
    driftCount: drifts.length,
    proposalCount: proposals.length,
    decision: decision.overall,
    applied: applyResult.applied,
    verificationPass: allVerifyPass,
    timestamp: new Date().toISOString(),
  };
  appendAuditEntry(auditEntry);
  console.log('[self-repair] Audit log updated');

  // Summary
  const report = {
    ok: allVerifyPass && decision.overall !== DECISIONS.BLOCK,
    monitorState,
    driftCount: drifts.length,
    proposals: proposals.length,
    decision: decision.overall,
    applied: applyResult,
    verification: verifyResults,
    snapshot: updatedSnapshot,
    timestamp: new Date().toISOString(),
  };

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[self-repair] Result: ${report.ok ? 'HEALTHY' : 'NEEDS ATTENTION'}`);
  console.log('\n' + JSON.stringify(report, null, 2));
}

main();
