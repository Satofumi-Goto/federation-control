#!/usr/bin/env node
/**
 * Runtime Multi-Operator Coordination Engine
 *
 * Coordinates multiple Runtime operators across deploy, repair,
 * governance, and emergency domains. Manages ownership, approvals,
 * escalation paths, and conflict resolution.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const ECOSYSTEM_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-business-ecosystem-model.json');
const RESPONSIBILITY_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-business-responsibility-matrix.json');
const SERVICE_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-service-state.json');
const ENV_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-environment-state.json');
const RESULT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-multi-operator-coordination-result.json');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function coordinateDeployOwnership(ecosystem) {
  const deployOp = ecosystem?.operators?.find(o => o.domain === 'deployment');
  if (!deployOp) return { status: 'unassigned', owner: null, issue: 'No deploy operator defined' };

  return {
    status: 'assigned',
    owner: deployOp.id,
    responsibilities: deployOp.responsibilities,
    escalationPath: ['ops-deploy', 'primary-operator', 'platform-admin'],
  };
}

function coordinateRepairOwnership(ecosystem) {
  const repairOp = ecosystem?.operators?.find(o => o.domain === 'repair');
  if (!repairOp) return { status: 'unassigned', owner: null, issue: 'No repair operator defined' };

  return {
    status: 'assigned',
    owner: repairOp.id,
    responsibilities: repairOp.responsibilities,
    escalationPath: ['ops-repair', 'primary-operator', 'ops-emergency'],
  };
}

function coordinateGovernanceApprovals(ecosystem, responsibility) {
  const govOp = ecosystem?.operators?.find(o => o.domain === 'governance');
  const raci = responsibility?.raciMatrix ?? {};
  const approvalPaths = {};

  for (const [action, roles] of Object.entries(raci)) {
    approvalPaths[action] = {
      requester: roles.responsible,
      approver: roles.accountable,
      reviewer: roles.consulted,
      notified: roles.informed,
    };
  }

  return {
    governanceOperator: govOp?.id ?? null,
    approvalPaths,
    totalApprovalFlows: Object.keys(approvalPaths).length,
  };
}

function coordinateEscalation(ecosystem, responsibility) {
  const chain = responsibility?.escalationChain ?? [];
  const authority = ecosystem?.governanceHierarchy ?? [];

  return {
    escalationLevels: chain.length,
    chain: chain.map(level => ({
      level: level.level,
      roles: level.roles,
      responseTime: level.responseTime,
      authority: authority.find(a => a.level === level.level)?.scope ?? 'unknown',
    })),
    emergencyController: ecosystem?.operators?.find(o => o.domain === 'emergency')?.id ?? null,
  };
}

function coordinateEmergencyControl(ecosystem, serviceState) {
  const emergencyOp = ecosystem?.operators?.find(o => o.domain === 'emergency');
  const crashes = serviceState?.crash?.crashCount ?? 0;
  const isActive = serviceState?.service?.active ?? false;

  let emergencyLevel = 'none';
  if (crashes > 3 || !isActive) emergencyLevel = 'elevated';
  if (crashes > 5) emergencyLevel = 'critical';

  return {
    controller: emergencyOp?.id ?? null,
    responsibilities: emergencyOp?.responsibilities ?? [],
    currentLevel: emergencyLevel,
    serviceActive: isActive,
    crashCount: crashes,
  };
}

function detectConflicts(ecosystem) {
  const conflicts = [];
  const operators = ecosystem?.operators ?? [];

  const domainOwners = {};
  for (const op of operators) {
    if (domainOwners[op.domain]) {
      conflicts.push({ type: 'domain-overlap', domain: op.domain, operators: [domainOwners[op.domain], op.id], detail: `Multiple operators for ${op.domain}` });
    }
    domainOwners[op.domain] = op.id;
  }

  const deps = ecosystem?.operationalDependencies ?? [];
  for (const dep of deps) {
    for (const requires of dep.dependsOn) {
      const providerByScope = ecosystem?.providers?.find(p => p.scope?.includes(requires));
      const providerByService = ecosystem?.providers?.find(p => p.service === requires);
      const serviceDomain = ecosystem?.serviceDomains?.find(s => s.id === requires);
      if (!providerByScope && !providerByService && !serviceDomain) {
        conflicts.push({ type: 'unresolved-dependency', service: dep.service, requires, detail: `${dep.service} depends on ${requires} — no provider found` });
      }
    }
  }

  return conflicts;
}

export function runMultiOperatorCoordination() {
  const now = new Date().toISOString();

  const ecosystem = loadJson(ECOSYSTEM_PATH);
  const responsibility = loadJson(RESPONSIBILITY_PATH);
  const serviceState = loadJson(SERVICE_STATE_PATH);

  const deploy = coordinateDeployOwnership(ecosystem);
  const repair = coordinateRepairOwnership(ecosystem);
  const governance = coordinateGovernanceApprovals(ecosystem, responsibility);
  const escalation = coordinateEscalation(ecosystem, responsibility);
  const emergency = coordinateEmergencyControl(ecosystem, serviceState);
  const conflicts = detectConflicts(ecosystem);

  const totalOperators = ecosystem?.operators?.length ?? 0;
  const assignedDomains = ecosystem?.operators?.filter(o => o.responsibilities?.length > 0).length ?? 0;

  const result = {
    coordination: { deploy, repair, governance, escalation, emergency },
    conflicts,
    summary: {
      totalOperators,
      assignedDomains,
      approvalFlows: governance.totalApprovalFlows,
      escalationLevels: escalation.escalationLevels,
      emergencyLevel: emergency.currentLevel,
      conflictCount: conflicts.length,
      coordinationActive: totalOperators > 0 && conflicts.length === 0,
    },
    timestamp: now,
  };

  saveJson(RESULT_PATH, result);
  return result;
}

if (process.argv[1]?.endsWith('runtimeMultiOperatorCoordinationEngine.mjs')) {
  console.log('[coordination] Runtime Multi-Operator Coordination Engine');
  console.log('='.repeat(55));

  const r = runMultiOperatorCoordination();

  console.log(`\n  Deploy: ${r.coordination.deploy.status} → ${r.coordination.deploy.owner ?? 'none'}`);
  console.log(`  Repair: ${r.coordination.repair.status} → ${r.coordination.repair.owner ?? 'none'}`);
  console.log(`  Governance: ${r.coordination.governance.totalApprovalFlows} approval flows`);
  console.log(`  Escalation: ${r.coordination.escalation.escalationLevels} levels`);
  console.log(`  Emergency: ${r.coordination.emergency.currentLevel} (controller: ${r.coordination.emergency.controller ?? 'none'})`);

  console.log(`\n  Conflicts: ${r.conflicts.length}`);
  for (const c of r.conflicts) console.log(`    [${c.type}] ${c.detail}`);

  console.log(`\n  Summary:`);
  console.log(`    Operators: ${r.summary.totalOperators}`);
  console.log(`    Assigned domains: ${r.summary.assignedDomains}`);
  console.log(`    Coordination active: ${r.summary.coordinationActive}`);

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[coordination] ${r.summary.coordinationActive ? 'COORDINATION OPERATIONAL' : 'COORDINATION NEEDS ATTENTION'}`);
  console.log('\n' + JSON.stringify({ ok: true, ...r }, null, 2));
}
