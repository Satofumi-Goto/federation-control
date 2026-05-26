#!/usr/bin/env node
/**
 * Runtime Live Telemetry Federation
 *
 * Federates live telemetry from all Runtime subsystems: execution,
 * queue, congestion, infrastructure, and governance telemetry into
 * a unified telemetry snapshot.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const ENV_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-environment-state.json');
const SERVICE_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-service-state.json');
const SUPERVISOR_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-trigger-supervisor-state.json');
const INFRA_TOPO_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-infrastructure-topology-graph.json');
const GOVERNANCE_RESULT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-evolution-governance-result.json');
const TWIN_GRAPH_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-digital-twin-graph.json');
const TELEMETRY_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-live-telemetry-snapshot.json');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function collectExecutionTelemetry(supervisor, serviceState) {
  return {
    totalExecutions: supervisor?.totalExecutions ?? 0,
    blockedExecutions: supervisor?.totalBlocked ?? 0,
    consecutiveFailures: supervisor?.consecutiveFailures ?? 0,
    serviceActive: serviceState?.service?.active ?? false,
    restartCount: serviceState?.service?.restartCount ?? 0,
    crashCount: serviceState?.crash?.crashCount ?? 0,
  };
}

function collectQueueTelemetry(supervisor, envState) {
  return {
    queuePressure: envState?.pressure?.queue ?? 0,
    queueDepth: supervisor?.totalBlocked ?? 0,
    executionRate: supervisor?.totalExecutions ?? 0,
    paused: supervisor?.paused ?? false,
  };
}

function collectCongestionTelemetry(infraTopo, twin) {
  const nodes = infraTopo?.nodes ?? [];
  const congestedNodes = nodes.filter(n => n.capacity > 0 && (n.utilization / n.capacity) > 0.6);

  return {
    congestionLevel: infraTopo?.congestion?.currentLevel ?? twin?.congestion?.level ?? 'none',
    hotspots: congestedNodes.map(n => ({ id: n.id, domain: n.domain, utilization: Math.round((n.utilization / n.capacity) * 100) })),
    totalNodes: nodes.length,
    congestedCount: congestedNodes.length,
  };
}

function collectInfrastructureTelemetry(infraTopo) {
  const nodes = infraTopo?.nodes ?? [];
  const activeNodes = nodes.filter(n => n.status === 'active');
  const totalCapacity = nodes.reduce((s, n) => s + (n.capacity ?? 0), 0);
  const totalUtilization = nodes.reduce((s, n) => s + (n.utilization ?? 0), 0);

  return {
    totalNodes: nodes.length,
    activeNodes: activeNodes.length,
    totalCapacity,
    totalUtilization,
    overallUtilization: totalCapacity > 0 ? Math.round((totalUtilization / totalCapacity) * 100) : 0,
    constraintsEnforced: infraTopo?.constraints?.filter(c => c.enforced).length ?? 0,
  };
}

function collectGovernanceTelemetry(governanceResult, envState) {
  return {
    safetyLocksActive: governanceResult?.summary?.safetyLocks?.allEnforced ?? true,
    forbiddenRules: governanceResult?.summary?.safetyLocks?.forbiddenRulesActive ?? 0,
    autoApproved: governanceResult?.summary?.autoApproved ?? 0,
    blocked: governanceResult?.summary?.blocked ?? 0,
    registryCanonical: governanceResult?.registryCanonical ?? true,
    governancePressure: envState?.pressure?.governance ?? envState?.pressure?.composite ?? 0,
  };
}

export function runTelemetryFederation() {
  const now = new Date().toISOString();

  const envState = loadJson(ENV_STATE_PATH);
  const serviceState = loadJson(SERVICE_STATE_PATH);
  const supervisor = loadJson(SUPERVISOR_PATH);
  const infraTopo = loadJson(INFRA_TOPO_PATH);
  const governanceResult = loadJson(GOVERNANCE_RESULT_PATH);
  const twin = loadJson(TWIN_GRAPH_PATH);

  const execution = collectExecutionTelemetry(supervisor, serviceState);
  const queue = collectQueueTelemetry(supervisor, envState);
  const congestion = collectCongestionTelemetry(infraTopo, twin);
  const infrastructure = collectInfrastructureTelemetry(infraTopo);
  const governance = collectGovernanceTelemetry(governanceResult, envState);

  const compositePressure = envState?.pressure?.composite ?? 0;

  const snapshot = {
    telemetry: { execution, queue, congestion, infrastructure, governance },
    compositePressure,
    overallHealth: execution.serviceActive && governance.safetyLocksActive && congestion.congestedCount === 0 ? 'healthy' : 'degraded',
    federated: true,
    sourcesAvailable: {
      envState: !!envState,
      serviceState: !!serviceState,
      supervisor: !!supervisor,
      infraTopo: !!infraTopo,
      governanceResult: !!governanceResult,
      twinGraph: !!twin,
    },
    timestamp: now,
  };

  saveJson(TELEMETRY_PATH, snapshot);
  return snapshot;
}

if (process.argv[1]?.endsWith('runtimeLiveTelemetryFederation.mjs')) {
  console.log('[telemetry] Runtime Live Telemetry Federation');
  console.log('='.repeat(55));

  const r = runTelemetryFederation();

  console.log('\n  Execution:');
  console.log(`    Total: ${r.telemetry.execution.totalExecutions}, Blocked: ${r.telemetry.execution.blockedExecutions}, Crashes: ${r.telemetry.execution.crashCount}`);

  console.log('  Queue:');
  console.log(`    Pressure: ${r.telemetry.queue.queuePressure}%, Depth: ${r.telemetry.queue.queueDepth}`);

  console.log('  Congestion:');
  console.log(`    Level: ${r.telemetry.congestion.congestionLevel}, Hotspots: ${r.telemetry.congestion.congestedCount}`);

  console.log('  Infrastructure:');
  console.log(`    Nodes: ${r.telemetry.infrastructure.activeNodes}/${r.telemetry.infrastructure.totalNodes}, Utilization: ${r.telemetry.infrastructure.overallUtilization}%`);

  console.log('  Governance:');
  console.log(`    Safety: ${r.telemetry.governance.safetyLocksActive}, Registry: ${r.telemetry.governance.registryCanonical}, Blocked: ${r.telemetry.governance.blocked}`);

  console.log(`\n  Composite pressure: ${r.compositePressure}`);
  console.log(`  Overall health: ${r.overallHealth}`);
  console.log(`  Federated: ${r.federated}`);

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[telemetry] TELEMETRY FEDERATED`);
  console.log('\n' + JSON.stringify({ ok: true, ...r }, null, 2));
}
