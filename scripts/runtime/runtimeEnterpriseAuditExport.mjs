#!/usr/bin/env node
/**
 * Runtime Enterprise Audit Export
 *
 * Exports Runtime audit history, governance decisions, repair decisions,
 * deployment decisions, rollback decisions, and operator action history.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const EXPORT_DIR = path.resolve(REPO_ROOT, 'runtime_reports');
const EXPORT_PATH = path.resolve(EXPORT_DIR, 'runtime-enterprise-audit-export.json');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function main() {
  console.log('[audit-export] Runtime Enterprise Audit Export');
  console.log('='.repeat(55));

  const repairAudit = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-repair-audit-log.json')) ?? [];
  const eventLog = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-event-log.json')) ?? [];
  const governanceTimeline = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-governance-timeline.json')) ?? [];
  const ccb = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-change-control-board.json')) ?? [];
  const incidentModel = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-incident-model.json')) ?? [];
  const executionLog = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-cursor-execution-log.json')) ?? [];
  const snapshot = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-snapshot.json'));
  const orchState = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-orchestration-state.json'));

  // Governance decisions
  const governanceDecisions = governanceTimeline
    .filter(e => e.type === 'governance_decision' || e.type === 'policy_evaluation')
    .map(e => ({ type: e.type, decision: e.decision, mode: e.mode, policies: e.policies, timestamp: e.timestamp }));

  // Repair decisions
  const repairDecisions = repairAudit.map(e => ({
    type: 'repair',
    monitorState: e.monitorState,
    decision: e.decision,
    applied: e.applied,
    verificationPass: e.verificationPass,
    timestamp: e.timestamp,
  }));

  // Deploy decisions
  const deployEvents = eventLog
    .filter(e => e.type === 'runtime.deployed' || e.type === 'runtime.rollback')
    .map(e => ({ type: e.type, data: e.data, timestamp: e.timestamp }));

  // Operator actions (from execution log)
  const operatorActions = executionLog.map(e => ({
    type: 'execution',
    instructionId: e.instructionId,
    mode: e.executionMode,
    buildOk: e.buildOk,
    verifyOk: e.verifyOk,
    startTime: e.startTime,
    endTime: e.endTime,
  }));

  // Mode changes
  const modeChanges = eventLog
    .filter(e => e.type === 'runtime.mode_change')
    .map(e => ({ type: 'mode_change', from: e.data?.from, to: e.data?.to, timestamp: e.timestamp }));

  const auditExport = {
    exportVersion: '1.0',
    exportTimestamp: new Date().toISOString(),
    runtimeState: {
      mode: orchState?.activeMode ?? 'unknown',
      health: orchState?.activeHealth ?? 'unknown',
      pressure: orchState?.pressureScore ?? 0,
      loopCount: orchState?.loopCount ?? 0,
    },
    sections: {
      governanceDecisions: { count: governanceDecisions.length, entries: governanceDecisions },
      repairDecisions: { count: repairDecisions.length, entries: repairDecisions },
      deployDecisions: { count: deployEvents.length, entries: deployEvents },
      operatorActions: { count: operatorActions.length, entries: operatorActions },
      modeChanges: { count: modeChanges.length, entries: modeChanges },
      changeControlBoard: { count: ccb.length, entries: ccb },
      incidents: { count: incidentModel.length, entries: incidentModel },
    },
    totals: {
      governanceDecisions: governanceDecisions.length,
      repairDecisions: repairDecisions.length,
      deployDecisions: deployEvents.length,
      operatorActions: operatorActions.length,
      modeChanges: modeChanges.length,
      changeControlEntries: ccb.length,
      incidents: incidentModel.length,
    },
  };

  saveJson(EXPORT_PATH, auditExport);

  console.log(`\n  Export sections:`);
  for (const [section, data] of Object.entries(auditExport.totals)) {
    console.log(`    ${section}: ${data}`);
  }
  console.log(`\n  Export saved: ${EXPORT_PATH}`);

  console.log(`\n${'='.repeat(55)}`);
  const totalEntries = Object.values(auditExport.totals).reduce((a, b) => a + b, 0);
  console.log(`[audit-export] ${totalEntries} total audit entries exported`);
  console.log('\n' + JSON.stringify({ ok: true, totalEntries, path: EXPORT_PATH, timestamp: new Date().toISOString() }, null, 2));
}

main();
