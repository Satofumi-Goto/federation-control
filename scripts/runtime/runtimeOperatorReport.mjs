#!/usr/bin/env node
/**
 * Runtime Operator Report
 *
 * Operator-facing report: active incidents, blocked actions,
 * pending approvals, repair/rollback queues, deploy safety,
 * and product readiness score.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateActions } from './runtimeOperatorActionModel.mjs';
import { evaluateWorkflows } from './runtimeOperatorWorkflowEngine.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function main() {
  console.log('[operator] Runtime Operator Report');
  console.log('='.repeat(60));

  const orch = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-orchestration-state.json'));
  const snapshot = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-snapshot.json'));
  const healthGraph = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-federation-health-graph.json'));
  const sessionState = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-cursor-session-state.json'));

  // 1. Runtime Status
  console.log('\n--- Runtime Status ---');
  console.log(`  Mode:       ${orch?.activeMode ?? 'unknown'}`);
  console.log(`  Health:     ${orch?.activeHealth ?? 'unknown'}`);
  console.log(`  Pressure:   ${orch?.pressureScore ?? 0}/100`);
  console.log(`  Drift:      ${orch?.driftState ?? 'unknown'}`);
  console.log(`  Supervisor: ${orch?.supervisorDecision ?? 'unknown'}`);
  console.log(`  Loop:       #${orch?.loopCount ?? 0}`);

  // 2. Active Incidents
  console.log('\n--- Active Incidents ---');
  const workflows = evaluateWorkflows();
  if (workflows.activeIncidents === 0) {
    console.log('  None');
  } else {
    for (const inc of workflows.incidents) {
      console.log(`  [${inc.severity.toUpperCase()}] ${inc.type}`);
      console.log(`    Proposed: ${inc.proposedAction}`);
      console.log(`    Affected: ${inc.affectedNodes.join(', ')}`);
    }
  }

  // 3. Blocked Actions
  console.log('\n--- Blocked Actions ---');
  const actions = evaluateActions();
  const blocked = actions.actions.filter(a => a.state === 'blocked');
  const disabled = actions.actions.filter(a => a.state === 'disabled');
  if (blocked.length === 0 && disabled.length === 0) {
    console.log('  None');
  } else {
    for (const a of [...blocked, ...disabled]) {
      console.log(`  ✕ ${a.label} (${a.id}) — ${a.state}`);
    }
  }

  // 4. Pending Approvals
  console.log('\n--- Pending Approvals ---');
  const review = actions.actions.filter(a => a.state === 'requires_review');
  if (review.length === 0) {
    console.log('  None');
  } else {
    for (const a of review) {
      console.log(`  ◐ ${a.label} (${a.id})`);
    }
  }

  // 5. Repair Queue
  console.log('\n--- Repair Queue ---');
  console.log(`  Repair state: ${orch?.activeRepairState ?? 'idle'}`);
  console.log(`  Recovery:     ${orch?.recoveryState ?? 'none'}`);

  // 6. Rollback Queue
  console.log('\n--- Rollback Queue ---');
  const rollbackState = sessionState?.rollbackState;
  console.log(`  Rollback: ${rollbackState ?? 'none'}`);

  // 7. Deploy Safety
  console.log('\n--- Deploy Safety ---');
  console.log(`  Deploy state: ${orch?.activeDeployState ?? 'unknown'}`);
  console.log(`  Verification: ${snapshot?.verificationPass ? 'PASS' : 'FAIL'}`);
  console.log(`  Content guard: ${snapshot?.contentGuardPass ? 'PASS' : 'FAIL'}`);
  console.log(`  Deploy safe:   ${snapshot?.deploySafe ? 'YES' : 'NO'}`);

  // 8. Health Graph
  console.log('\n--- Federation Health ---');
  if (healthGraph?.nodes) {
    for (const node of healthGraph.nodes) {
      const bar = '█'.repeat(Math.round(node.pressure / 5)) + '░'.repeat(20 - Math.round(node.pressure / 5));
      console.log(`  ${node.id.padEnd(15)} ${node.health.padEnd(12)} ${bar} ${node.pressure}`);
    }
  }

  // 9. Product Readiness Score (simplified inline check)
  const readinessChecks = [
    !!snapshot,
    snapshot?.verificationPass === true,
    !!orch?.activeMode,
    orch?.supervisorDecision === 'proceed',
    workflows.activeIncidents === 0,
    blocked.length <= 2,
  ];
  const readinessScore = readinessChecks.filter(Boolean).length;
  const readinessPercent = Math.round((readinessScore / readinessChecks.length) * 100);

  console.log('\n--- Product Readiness ---');
  console.log(`  Score: ${readinessScore}/${readinessChecks.length} (${readinessPercent}%)`);
  console.log(`  Status: ${readinessPercent >= 80 ? 'PRODUCT READY' : 'NEEDS ATTENTION'}`);

  // Report JSON
  const report = {
    ok: workflows.activeIncidents === 0 && readinessPercent >= 80,
    mode: orch?.activeMode ?? 'unknown',
    health: orch?.activeHealth ?? 'unknown',
    pressure: orch?.pressureScore ?? 0,
    incidents: workflows.activeIncidents,
    blockedActions: blocked.length,
    disabledActions: disabled.length,
    pendingApprovals: review.length,
    repairState: orch?.activeRepairState ?? 'idle',
    rollbackState: rollbackState ?? 'none',
    deploySafe: snapshot?.deploySafe ?? false,
    readinessPercent,
    timestamp: new Date().toISOString(),
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[operator] ${report.ok ? 'OPERATIONAL' : 'NEEDS ATTENTION'}`);
  console.log('\n' + JSON.stringify(report, null, 2));
}

main();
