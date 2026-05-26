#!/usr/bin/env node
/**
 * Runtime Self-Repair Report
 *
 * Reads the audit log and operational snapshot to produce a human-readable report.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const SNAPSHOT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-snapshot.json');
const AUDIT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-repair-audit-log.json');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function main() {
  console.log('[repair-report] Runtime Self-Repair Report');
  console.log('='.repeat(55));

  const snapshot = loadJson(SNAPSHOT_PATH);
  const auditLog = loadJson(AUDIT_PATH) ?? [];

  console.log('\n--- Operational Snapshot ---');
  if (snapshot) {
    console.log(`  State:            ${snapshot.state ?? 'unknown'}`);
    console.log(`  Last Commit:      ${snapshot.lastCommit ?? 'n/a'}`);
    console.log(`  Deploy Version:   ${snapshot.deployVersion ?? 'n/a'}`);
    console.log(`  Panels:           ${snapshot.panels ?? 'n/a'}`);
    console.log(`  Registry Count:   ${snapshot.registryCount ?? 'n/a'}`);
    console.log(`  Verification:     ${snapshot.verificationPass ? 'PASS' : 'FAIL'}`);
    console.log(`  Content Guard:    ${snapshot.contentGuardPass ? 'PASS' : 'FAIL'}`);
    console.log(`  Repair Decision:  ${snapshot.repairDecision ?? 'n/a'}`);
    console.log(`  Proposals:        ${snapshot.repairProposals ?? 0}`);
    console.log(`  Timestamp:        ${snapshot.timestamp ?? 'n/a'}`);
  } else {
    console.log('  (no snapshot found — run runtime:self-repair first)');
  }

  console.log('\n--- Repair Audit Log ---');
  if (auditLog.length === 0) {
    console.log('  (no audit entries)');
  } else {
    const recent = auditLog.slice(-5);
    for (const entry of recent) {
      console.log(`\n  [${entry.timestamp}]`);
      console.log(`    Monitor:      ${entry.monitorState}`);
      console.log(`    Drifts:       ${entry.driftCount}`);
      console.log(`    Proposals:    ${entry.proposalCount}`);
      console.log(`    Decision:     ${entry.decision}`);
      console.log(`    Applied:      ${entry.applied}`);
      console.log(`    Verify Pass:  ${entry.verificationPass}`);
    }
    if (auditLog.length > 5) {
      console.log(`\n  (showing 5 of ${auditLog.length} entries)`);
    }
  }

  console.log('\n--- Remaining Blockers ---');
  const blockers = [];
  if (!snapshot) blockers.push('No operational snapshot');
  if (snapshot && !snapshot.verificationPass) blockers.push('Verification failure');
  if (snapshot && !snapshot.contentGuardPass) blockers.push('Content guard failure');
  if (snapshot && snapshot.repairDecision === 'block') blockers.push('Blocked repair action');
  if (snapshot && snapshot.repairDecision === 'manual_review') blockers.push('Manual review required');

  if (blockers.length === 0) {
    console.log('  None — Runtime is autonomous-ready');
  } else {
    for (const b of blockers) console.log(`  - ${b}`);
  }

  console.log(`\n${'='.repeat(55)}`);
  const ok = blockers.length === 0;
  console.log(`[repair-report] Status: ${ok ? 'HEALTHY / AUTONOMOUS-READY' : 'NEEDS ATTENTION'}`);
  if (!ok) process.exitCode = 1;
}

main();
