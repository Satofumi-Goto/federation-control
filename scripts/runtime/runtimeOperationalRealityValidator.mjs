#!/usr/bin/env node
/**
 * Runtime Operational Reality Validator
 *
 * Validates that the digital twin accurately reflects real operational
 * state: twin consistency, telemetry, topology, infrastructure,
 * governance, pressure, and operational realism.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const TWIN_GRAPH_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-digital-twin-graph.json');
const TELEMETRY_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-live-telemetry-snapshot.json');
const INFRA_TOPO_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-infrastructure-topology-graph.json');
const DOMAIN_MODEL_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-federation-domain-model.json');
const ENV_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-environment-state.json');
const GOVERNANCE_RESULT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-evolution-governance-result.json');
const SERVICE_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-service-state.json');
const RESULT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-reality-result.json');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function validateTwinConsistency(twin, domainModel) {
  const issues = [];
  if (!twin) { issues.push('Digital twin graph missing'); return { valid: false, issues }; }
  if (!twin.lastSynchronized) issues.push('Twin never synchronized');

  const domainIds = domainModel?.domains?.map(d => d.id) ?? [];
  for (const domainId of domainIds) {
    const node = twin.nodes?.find(n => n.domain === domainId);
    if (!node) issues.push(`Domain ${domainId} missing from twin`);
  }

  const orphans = twin.nodes?.filter(n => !domainIds.includes(n.domain)) ?? [];
  for (const orphan of orphans) issues.push(`Orphan node ${orphan.id} (${orphan.domain}) not in domain model`);

  return { valid: issues.length === 0, issues, nodeCount: twin.nodes?.length ?? 0, domainCount: domainIds.length };
}

function validateTelemetryConsistency(telemetry, serviceState) {
  const issues = [];
  if (!telemetry) { issues.push('Telemetry snapshot missing'); return { valid: false, issues }; }

  const serviceActive = serviceState?.service?.active ?? false;
  if (telemetry.telemetry?.execution?.serviceActive !== serviceActive) {
    issues.push(`Telemetry service state mismatch: telemetry=${telemetry.telemetry?.execution?.serviceActive}, actual=${serviceActive}`);
  }

  const crashCount = serviceState?.crash?.crashCount ?? 0;
  if (telemetry.telemetry?.execution?.crashCount !== crashCount) {
    issues.push(`Crash count mismatch: telemetry=${telemetry.telemetry?.execution?.crashCount}, actual=${crashCount}`);
  }

  if (!telemetry.federated) issues.push('Telemetry not federated');

  return { valid: issues.length === 0, issues, federated: telemetry.federated ?? false };
}

function validateTopologyConsistency(twin, infraTopo) {
  const issues = [];
  if (!infraTopo) { issues.push('Infrastructure topology missing'); return { valid: false, issues }; }

  const infraDomains = new Set(infraTopo.nodes?.map(n => n.domain) ?? []);
  const twinDomains = new Set(twin?.nodes?.map(n => n.domain) ?? []);

  for (const domain of infraDomains) {
    if (!twinDomains.has(domain)) issues.push(`Infra domain ${domain} missing from twin`);
  }

  return { valid: issues.length === 0, issues, infraNodes: infraDomains.size, twinNodes: twinDomains.size };
}

function validateInfrastructureConsistency(infraTopo) {
  const issues = [];
  if (!infraTopo) { issues.push('Infrastructure topology missing'); return { valid: false, issues }; }

  const nodes = infraTopo.nodes ?? [];
  for (const node of nodes) {
    if (node.utilization > node.capacity) issues.push(`Node ${node.id} over capacity: ${node.utilization}/${node.capacity}`);
  }

  const constraints = infraTopo.constraints ?? [];
  const violated = constraints.filter(c => !c.enforced);
  for (const v of violated) issues.push(`Constraint violated: ${v.type} on ${v.node ?? v.from}`);

  return { valid: issues.length === 0, issues, nodes: nodes.length, constraints: constraints.length };
}

function validateGovernanceConsistency(governanceResult) {
  const issues = [];
  if (!governanceResult) { return { valid: true, issues: ['Governance result not available — optional'], optional: true }; }

  if (!governanceResult.summary?.safetyLocks?.allEnforced) issues.push('Safety locks not fully enforced');
  if (!governanceResult.registryCanonical) issues.push('Registry not canonical');
  if (!governanceResult.orchestrationStable) issues.push('Orchestration not stable');

  return { valid: issues.length === 0, issues };
}

function validatePressureConsistency(twin, envState) {
  const issues = [];
  if (!twin || !envState) { issues.push('Twin or environment state missing'); return { valid: false, issues }; }

  const twinPressure = twin.pressure?.composite ?? 0;
  const envPressure = envState.pressure?.composite ?? 0;
  const drift = Math.abs(twinPressure - envPressure);

  if (drift > 20) issues.push(`Pressure drift: twin=${twinPressure}, env=${envPressure}, drift=${drift}`);

  return { valid: issues.length === 0, issues, twinPressure, envPressure, drift };
}

function validateOperationalRealism(twin, telemetry) {
  const issues = [];

  // No fake/placeholder states
  const placeholderNodes = twin?.nodes?.filter(n => n.state === 'placeholder' || n.state === 'mock') ?? [];
  if (placeholderNodes.length > 0) issues.push(`${placeholderNodes.length} placeholder nodes detected`);

  // Pressure must reflect real state
  if (twin?.pressure?.composite === undefined) issues.push('No composite pressure — operational state invisible');

  // Execution state must reflect reality
  if (twin?.execution?.activeExecutions === undefined) issues.push('Execution state not tracked');

  // Telemetry must be federated from real sources
  if (telemetry) {
    const sources = telemetry.sourcesAvailable ?? {};
    const availCount = Object.values(sources).filter(Boolean).length;
    if (availCount < 3) issues.push(`Only ${availCount} telemetry sources available — low operational visibility`);
  }

  return { valid: issues.length === 0, issues };
}

export function runRealityValidation() {
  const now = new Date().toISOString();

  const twin = loadJson(TWIN_GRAPH_PATH);
  const telemetry = loadJson(TELEMETRY_PATH);
  const infraTopo = loadJson(INFRA_TOPO_PATH);
  const domainModel = loadJson(DOMAIN_MODEL_PATH);
  const envState = loadJson(ENV_STATE_PATH);
  const governanceResult = loadJson(GOVERNANCE_RESULT_PATH);
  const serviceState = loadJson(SERVICE_STATE_PATH);

  const checks = {
    twinConsistency: validateTwinConsistency(twin, domainModel),
    telemetryConsistency: validateTelemetryConsistency(telemetry, serviceState),
    topologyConsistency: validateTopologyConsistency(twin, infraTopo),
    infrastructureConsistency: validateInfrastructureConsistency(infraTopo),
    governanceConsistency: validateGovernanceConsistency(governanceResult),
    pressureConsistency: validatePressureConsistency(twin, envState),
    operationalRealism: validateOperationalRealism(twin, telemetry),
  };

  const total = Object.keys(checks).length;
  const passed = Object.values(checks).filter(c => c.valid).length;
  const allIssues = Object.values(checks).flatMap(c => c.issues);

  const result = {
    checks,
    summary: { total, passed, failed: total - passed, allIssues },
    operationallyReal: passed >= total - 1,
    timestamp: now,
  };

  saveJson(RESULT_PATH, result);
  return result;
}

if (process.argv[1]?.endsWith('runtimeOperationalRealityValidator.mjs')) {
  console.log('[reality] Runtime Operational Reality Validator');
  console.log('='.repeat(55));

  const r = runRealityValidation();

  for (const [name, check] of Object.entries(r.checks)) {
    const icon = check.valid ? 'PASS' : (check.optional ? 'SKIP' : 'FAIL');
    console.log(`\n  [${icon}] ${name}`);
    for (const issue of check.issues) console.log(`    - ${issue}`);
    if (check.issues.length === 0) console.log('    (consistent)');
  }

  console.log(`\n  Summary: ${r.summary.passed}/${r.summary.total} passed`);
  console.log(`  Operationally real: ${r.operationallyReal}`);

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[reality] ${r.operationallyReal ? 'OPERATIONAL REALITY VALIDATED' : 'REALITY ISSUES DETECTED'}`);
  console.log('\n' + JSON.stringify({ ok: true, ...r }, null, 2));
}
