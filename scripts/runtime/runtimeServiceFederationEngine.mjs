#!/usr/bin/env node
/**
 * Runtime Service Federation Engine
 *
 * Federates Runtime services, execution domains, governance domains,
 * business domains, SLA/SLO responsibilities, and deployment ownership
 * across the ecosystem.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const ECOSYSTEM_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-business-ecosystem-model.json');
const FEDERATION_DOMAIN_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-federation-domain-model.json');
const SLA_MODEL_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-sla-slo-model.json');
const RESPONSIBILITY_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-business-responsibility-matrix.json');
const RESULT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-service-federation-result.json');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function federateServices(ecosystem) {
  const domains = ecosystem?.serviceDomains ?? [];
  return domains.map(d => ({
    id: d.id,
    label: d.label,
    owner: d.owner,
    slaTarget: d.slaTarget,
    federated: true,
    federationType: 'service-domain',
  }));
}

function federateExecutionDomains(ecosystem) {
  const operators = ecosystem?.operators ?? [];
  return operators.map(op => ({
    operatorId: op.id,
    domain: op.domain,
    responsibilities: op.responsibilities,
    federated: true,
    federationType: 'execution-domain',
  }));
}

function federateGovernanceDomains(ecosystem) {
  const hierarchy = ecosystem?.governanceHierarchy ?? [];
  return hierarchy.map(level => ({
    level: level.level,
    authority: level.authority,
    scope: level.scope,
    federated: true,
    federationType: 'governance-domain',
  }));
}

function federateBusinessDomains(ecosystem) {
  const revenueFlows = ecosystem?.revenueFlows ?? [];
  const costFlows = ecosystem?.costFlows ?? [];

  return {
    revenueStreams: revenueFlows.map(f => ({
      from: f.from,
      to: f.to,
      type: f.type,
      model: f.model,
      federated: true,
    })),
    costCenters: costFlows.map(f => ({
      from: f.from,
      to: f.to,
      type: f.type,
      model: f.model,
      federated: true,
    })),
    totalRevenueStreams: revenueFlows.length,
    totalCostCenters: costFlows.length,
  };
}

function federateSlaSlo(ecosystem, slaModel) {
  const domains = ecosystem?.serviceDomains ?? [];
  const targets = slaModel?.targets ?? {};

  return domains.map(d => ({
    serviceId: d.id,
    owner: d.owner,
    slaTarget: d.slaTarget,
    globalTargets: {
      availability: targets.availability?.target ?? 99.5,
      deploySuccess: targets.deploySuccess?.target ?? 95,
    },
    federated: true,
    compliant: d.slaTarget >= (targets.availability?.target ?? 99.5) * 0.9,
  }));
}

function federateDeployOwnership(ecosystem, responsibility) {
  const raci = responsibility?.raciMatrix?.deploy ?? {};
  const deployOp = ecosystem?.operators?.find(o => o.domain === 'deployment');

  return {
    primaryOwner: deployOp?.id ?? null,
    responsible: raci.responsible ?? null,
    accountable: raci.accountable ?? null,
    consulted: raci.consulted ?? null,
    informed: raci.informed ?? null,
    federated: !!deployOp,
  };
}

function calculateFederationHealth(services, execution, governance, business, sla, deploy) {
  let score = 100;
  const issues = [];

  if (services.length === 0) { score -= 30; issues.push('No service domains federated'); }
  if (execution.length === 0) { score -= 20; issues.push('No execution domains federated'); }
  if (governance.length === 0) { score -= 20; issues.push('No governance domains federated'); }
  if (!deploy.federated) { score -= 15; issues.push('Deploy ownership not federated'); }
  if (sla.some(s => !s.compliant)) { score -= 10; issues.push('SLA non-compliance in federated services'); }

  const nonCompliant = sla.filter(s => !s.compliant).length;
  if (nonCompliant > 0) issues.push(`${nonCompliant} service(s) below SLA compliance`);

  return { score: Math.max(0, score), issues };
}

export function runServiceFederation() {
  const now = new Date().toISOString();

  const ecosystem = loadJson(ECOSYSTEM_PATH);
  const slaModel = loadJson(SLA_MODEL_PATH);
  const responsibility = loadJson(RESPONSIBILITY_PATH);

  const services = federateServices(ecosystem);
  const execution = federateExecutionDomains(ecosystem);
  const governance = federateGovernanceDomains(ecosystem);
  const business = federateBusinessDomains(ecosystem);
  const sla = federateSlaSlo(ecosystem, slaModel);
  const deploy = federateDeployOwnership(ecosystem, responsibility);

  const health = calculateFederationHealth(services, execution, governance, business, sla, deploy);

  const result = {
    federation: { services, execution, governance, business, sla, deploy },
    health,
    summary: {
      federatedServices: services.length,
      federatedExecution: execution.length,
      federatedGovernance: governance.length,
      revenueStreams: business.totalRevenueStreams,
      costCenters: business.totalCostCenters,
      slaCompliant: sla.filter(s => s.compliant).length,
      slaNonCompliant: sla.filter(s => !s.compliant).length,
      deployFederated: deploy.federated,
      healthScore: health.score,
    },
    timestamp: now,
  };

  saveJson(RESULT_PATH, result);
  return result;
}

if (process.argv[1]?.endsWith('runtimeServiceFederationEngine.mjs')) {
  console.log('[federation] Runtime Service Federation Engine');
  console.log('='.repeat(55));

  const r = runServiceFederation();

  console.log(`\n  Services federated: ${r.summary.federatedServices}`);
  for (const s of r.federation.services) console.log(`    ${s.id}: ${s.label} (owner: ${s.owner}, SLA: ${s.slaTarget}%)`);

  console.log(`\n  Execution domains: ${r.summary.federatedExecution}`);
  for (const e of r.federation.execution) console.log(`    ${e.operatorId}: ${e.domain}`);

  console.log(`\n  Governance levels: ${r.summary.federatedGovernance}`);
  for (const g of r.federation.governance) console.log(`    L${g.level}: ${g.authority} (${g.scope})`);

  console.log(`\n  Business: ${r.summary.revenueStreams} revenue streams, ${r.summary.costCenters} cost centers`);
  console.log(`  SLA: ${r.summary.slaCompliant} compliant, ${r.summary.slaNonCompliant} non-compliant`);
  console.log(`  Deploy: ${r.summary.deployFederated ? 'FEDERATED' : 'NOT FEDERATED'}`);
  console.log(`  Health: ${r.summary.healthScore}/100`);

  if (r.health.issues.length > 0) {
    console.log('\n  Issues:');
    for (const i of r.health.issues) console.log(`    - ${i}`);
  }

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[federation] ${r.summary.healthScore >= 80 ? 'SERVICE FEDERATION OPERATIONAL' : 'FEDERATION NEEDS ATTENTION'}`);
  console.log('\n' + JSON.stringify({ ok: true, ...r }, null, 2));
}
