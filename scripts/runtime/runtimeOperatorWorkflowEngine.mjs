#!/usr/bin/env node
/**
 * Runtime Operator Workflow Engine
 *
 * Models operator workflows for incident triage, drift review,
 * repair/deploy/rollback approval, and recovery confirmation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const INCIDENT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-incident-model.json');
const ORCHESTRATION_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-orchestration-state.json');
const AUDIT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-repair-audit-log.json');

export const WORKFLOW_TYPES = {
  INCIDENT_TRIAGE: 'incident-triage',
  DRIFT_REVIEW: 'drift-review',
  REPAIR_APPROVAL: 'repair-approval',
  DEPLOY_APPROVAL: 'deploy-approval',
  ROLLBACK: 'rollback',
  RECOVERY_CONFIRM: 'recovery-confirmation',
};

export const WORKFLOW_STATES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
  ESCALATED: 'escalated',
};

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function deriveIncidents(orch, auditLog) {
  const incidents = [];

  if (orch?.activeHealth === 'degraded' || orch?.activeHealth === 'failed') {
    incidents.push({
      id: `inc-health-${Date.now()}`,
      type: 'health-degradation',
      severity: orch.activeHealth === 'failed' ? 'critical' : 'high',
      affectedNodes: ['runtime'],
      affectedDependencies: [],
      proposedAction: 'repair',
      operatorDecision: null,
      outcome: null,
      timestamp: new Date().toISOString(),
    });
  }

  if (orch?.driftState !== 'healthy') {
    incidents.push({
      id: `inc-drift-${Date.now()}`,
      type: 'drift-detected',
      severity: 'medium',
      affectedNodes: ['registry', 'topology'],
      affectedDependencies: ['dashboard'],
      proposedAction: 'drift-review',
      operatorDecision: null,
      outcome: null,
      timestamp: new Date().toISOString(),
    });
  }

  if (orch?.stormDetected) {
    incidents.push({
      id: `inc-storm-${Date.now()}`,
      type: 'event-storm',
      severity: 'high',
      affectedNodes: ['event-bus'],
      affectedDependencies: ['orchestrator'],
      proposedAction: 'throttle',
      operatorDecision: null,
      outcome: null,
      timestamp: new Date().toISOString(),
    });
  }

  const recentFailures = (auditLog ?? []).slice(-5).filter(e => !e.verificationPass);
  if (recentFailures.length >= 2) {
    incidents.push({
      id: `inc-verify-${Date.now()}`,
      type: 'verification-failure',
      severity: 'high',
      affectedNodes: ['verification'],
      affectedDependencies: ['deploy', 'registry'],
      proposedAction: 'repair',
      operatorDecision: null,
      outcome: null,
      timestamp: new Date().toISOString(),
    });
  }

  return incidents;
}

function deriveWorkflows(incidents, orch) {
  const workflows = [];

  for (const inc of incidents) {
    workflows.push({
      id: `wf-${inc.id}`,
      type: inc.type === 'drift-detected' ? WORKFLOW_TYPES.DRIFT_REVIEW
        : inc.type === 'health-degradation' ? WORKFLOW_TYPES.INCIDENT_TRIAGE
        : inc.type === 'event-storm' ? WORKFLOW_TYPES.INCIDENT_TRIAGE
        : WORKFLOW_TYPES.REPAIR_APPROVAL,
      incidentId: inc.id,
      state: WORKFLOW_STATES.PENDING,
      steps: getWorkflowSteps(inc.type),
      timestamp: new Date().toISOString(),
    });
  }

  if (orch?.activeRepairState && orch.activeRepairState !== 'no_action' && orch.activeRepairState !== 'idle') {
    workflows.push({
      id: `wf-repair-${Date.now()}`,
      type: WORKFLOW_TYPES.REPAIR_APPROVAL,
      incidentId: null,
      state: WORKFLOW_STATES.PENDING,
      steps: getWorkflowSteps('repair'),
      timestamp: new Date().toISOString(),
    });
  }

  return workflows;
}

function getWorkflowSteps(incidentType) {
  switch (incidentType) {
    case 'health-degradation':
      return ['detect', 'triage', 'diagnose', 'propose-repair', 'approve', 'execute', 'verify', 'close'];
    case 'drift-detected':
      return ['detect', 'review-drift', 'acknowledge', 'rebuild', 'verify', 'close'];
    case 'event-storm':
      return ['detect', 'throttle', 'diagnose', 'resolve', 'verify', 'close'];
    case 'verification-failure':
      return ['detect', 'diagnose', 'propose-repair', 'approve', 'rebuild', 'verify', 'close'];
    case 'repair':
      return ['propose', 'review', 'approve', 'execute', 'verify', 'close'];
    default:
      return ['detect', 'triage', 'resolve', 'verify', 'close'];
  }
}

/**
 * Evaluate current workflows based on orchestration state.
 */
export function evaluateWorkflows() {
  const orch = loadJson(ORCHESTRATION_PATH);
  const auditLog = loadJson(AUDIT_PATH) ?? [];
  const existingIncidents = loadJson(INCIDENT_PATH) ?? [];

  const incidents = deriveIncidents(orch, auditLog);
  const workflows = deriveWorkflows(incidents, orch);

  const allIncidents = [...existingIncidents, ...incidents].slice(-50);
  saveJson(INCIDENT_PATH, allIncidents);

  return {
    activeIncidents: incidents.length,
    incidents,
    workflows,
    pendingApprovals: workflows.filter(w => w.state === WORKFLOW_STATES.PENDING).length,
    mode: orch?.activeMode ?? 'unknown',
    timestamp: new Date().toISOString(),
  };
}

if (process.argv[1]?.endsWith('runtimeOperatorWorkflowEngine.mjs')) {
  console.log('[workflows] Runtime Operator Workflow Engine');
  console.log('='.repeat(55));

  const result = evaluateWorkflows();

  console.log(`\n  Mode: ${result.mode}`);
  console.log(`  Active incidents: ${result.activeIncidents}`);
  console.log(`  Pending approvals: ${result.pendingApprovals}`);

  if (result.incidents.length > 0) {
    console.log('\n  Incidents:');
    for (const inc of result.incidents) {
      console.log(`    [${inc.severity}] ${inc.type} — ${inc.proposedAction}`);
    }
  } else {
    console.log('\n  No active incidents');
  }

  if (result.workflows.length > 0) {
    console.log('\n  Workflows:');
    for (const wf of result.workflows) {
      console.log(`    ${wf.type} — ${wf.state} (${wf.steps.length} steps)`);
    }
  } else {
    console.log('  No active workflows');
  }

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[workflows] ${result.activeIncidents === 0 ? 'ALL CLEAR' : `${result.activeIncidents} INCIDENT(S)`}`);
  console.log('\n' + JSON.stringify(result, null, 2));
}
