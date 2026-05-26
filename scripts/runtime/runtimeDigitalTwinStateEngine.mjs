#!/usr/bin/env node
/**
 * Runtime Digital Twin State Engine
 *
 * Maintains and synchronizes the Runtime digital twin state by
 * reading live operational data from all subsystems and projecting
 * it into the twin graph.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const TWIN_GRAPH_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-digital-twin-graph.json');
const SERVICE_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-service-state.json');
const ENV_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-environment-state.json');
const SUPERVISOR_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-trigger-supervisor-state.json');
const INFRA_TOPO_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-infrastructure-topology-graph.json');
const DOMAIN_MODEL_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-federation-domain-model.json');
const GOVERNANCE_RESULT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-evolution-governance-result.json');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function syncOperationalState(twin, serviceState) {
  const isActive = serviceState?.service?.active ?? false;
  const coreNode = twin.nodes.find(n => n.id === 'core');
  if (coreNode) {
    coreNode.state = isActive ? 'active' : 'inactive';
    coreNode.health = isActive ? 'healthy' : 'degraded';
  }
  const crashes = serviceState?.crash?.crashCount ?? 0;
  const repairNode = twin.nodes.find(n => n.id === 'repair');
  if (repairNode) {
    repairNode.state = crashes > 0 ? 'active' : 'standby';
    repairNode.pressure = Math.min(100, crashes * 15);
  }
  twin.recovery.pendingRepairs = crashes;
  twin.recovery.activeRecoveries = serviceState?.recovery?.recoveryCount ?? 0;
}

function syncInfrastructureState(twin, infraTopo) {
  if (!infraTopo?.nodes) return;
  for (const infraNode of infraTopo.nodes) {
    const twinNode = twin.nodes.find(n => n.domain === infraNode.domain);
    if (twinNode) {
      twinNode.congestion = infraNode.capacity > 0
        ? Math.round((infraNode.utilization / infraNode.capacity) * 100)
        : 0;
    }
  }
  twin.congestion.level = infraTopo.congestion?.currentLevel ?? 'none';
  twin.congestion.hotspots = infraTopo.congestion?.hotspots ?? [];
}

function syncTopologyState(twin, domainModel) {
  if (!domainModel?.domains) return;
  for (const domain of domainModel.domains) {
    const existing = twin.nodes.find(n => n.domain === domain.id);
    if (!existing) {
      twin.nodes.push({
        id: domain.id.replace('-runtime', ''),
        domain: domain.id,
        state: 'active',
        pressure: 0,
        congestion: 0,
        health: 'healthy',
      });
    }
  }
}

function syncCongestionState(twin, envState) {
  const composite = envState?.pressure?.composite ?? 0;
  twin.pressure.composite = composite;

  const pressureMap = {
    queue: envState?.pressure?.queue ?? 0,
    deploy: envState?.pressure?.deploy ?? 0,
    recovery: envState?.pressure?.recovery ?? 0,
    memory: envState?.pressure?.memory ?? 0,
  };
  twin.pressure.byDomain = pressureMap;

  for (const node of twin.nodes) {
    if (node.id === 'execution') node.pressure = pressureMap.queue;
    if (node.id === 'repair') node.pressure = Math.max(node.pressure, pressureMap.recovery);
  }
}

function syncRepairState(twin, serviceState) {
  const recoveries = serviceState?.recovery?.recoveryCount ?? 0;
  const repairNode = twin.nodes.find(n => n.id === 'repair');
  if (repairNode && recoveries > 5) {
    repairNode.health = 'warning';
  }
}

function syncEmergencyState(twin, envState) {
  const emergencyNode = twin.nodes.find(n => n.id === 'emergency');
  if (!emergencyNode) return;

  const composite = envState?.pressure?.composite ?? 0;
  if (composite > 80) {
    emergencyNode.state = 'active';
    emergencyNode.health = 'warning';
  } else {
    emergencyNode.state = 'standby';
    emergencyNode.health = 'healthy';
  }
}

function syncGovernanceState(twin, governanceResult) {
  twin.governance.safetyLocksActive = governanceResult?.summary?.safetyLocks?.allEnforced ?? true;
  const blocked = governanceResult?.summary?.blocked ?? 0;
  if (blocked > 0) twin.governance.escalationLevel = 'elevated';
  else twin.governance.escalationLevel = 'none';
}

function syncExecutionState(twin, supervisor) {
  twin.execution.activeExecutions = supervisor?.totalExecutions ?? 0;
  twin.execution.queueDepth = supervisor?.totalBlocked ?? 0;
  twin.execution.throughput = supervisor?.totalExecutions ?? 0;

  const execNode = twin.nodes.find(n => n.id === 'execution');
  if (execNode) {
    const blocked = supervisor?.totalBlocked ?? 0;
    const total = supervisor?.totalExecutions ?? 0;
    if (total + blocked > 0) {
      execNode.congestion = Math.round((blocked / (total + blocked)) * 100);
    }
  }
}

export function runDigitalTwinSync() {
  const now = new Date().toISOString();

  const twin = loadJson(TWIN_GRAPH_PATH) ?? { nodes: [], dependencies: [], pressure: {}, congestion: {}, governance: {}, recovery: {}, execution: {} };
  const serviceState = loadJson(SERVICE_STATE_PATH);
  const envState = loadJson(ENV_STATE_PATH);
  const supervisor = loadJson(SUPERVISOR_PATH);
  const infraTopo = loadJson(INFRA_TOPO_PATH);
  const domainModel = loadJson(DOMAIN_MODEL_PATH);
  const governanceResult = loadJson(GOVERNANCE_RESULT_PATH);

  syncTopologyState(twin, domainModel);
  syncOperationalState(twin, serviceState);
  syncInfrastructureState(twin, infraTopo);
  syncCongestionState(twin, envState);
  syncRepairState(twin, serviceState);
  syncEmergencyState(twin, envState);
  syncGovernanceState(twin, governanceResult);
  syncExecutionState(twin, supervisor);

  twin.lastSynchronized = now;
  saveJson(TWIN_GRAPH_PATH, twin);

  const activeNodes = twin.nodes.filter(n => n.state === 'active' || n.state === 'standby').length;
  const healthyNodes = twin.nodes.filter(n => n.health === 'healthy').length;
  const congestedNodes = twin.nodes.filter(n => n.congestion > 50).length;

  return {
    totalNodes: twin.nodes.length,
    activeNodes,
    healthyNodes,
    congestedNodes,
    pressure: twin.pressure,
    congestion: twin.congestion,
    governance: twin.governance,
    recovery: twin.recovery,
    execution: twin.execution,
    synchronized: true,
    timestamp: now,
  };
}

if (process.argv[1]?.endsWith('runtimeDigitalTwinStateEngine.mjs')) {
  console.log('[twin] Runtime Digital Twin State Engine');
  console.log('='.repeat(55));

  const r = runDigitalTwinSync();

  console.log(`\n  Nodes: ${r.totalNodes} total, ${r.activeNodes} active, ${r.healthyNodes} healthy`);
  console.log(`  Congested: ${r.congestedNodes}`);
  console.log(`  Pressure: composite=${r.pressure.composite}`);
  console.log(`  Congestion: ${r.congestion.level}`);
  console.log(`  Governance: safety=${r.governance.safetyLocksActive}, escalation=${r.governance.escalationLevel}`);
  console.log(`  Recovery: active=${r.recovery.activeRecoveries}, pending=${r.recovery.pendingRepairs}`);
  console.log(`  Execution: queue=${r.execution.queueDepth}, active=${r.execution.activeExecutions}`);
  console.log(`  Synchronized: ${r.synchronized}`);

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[twin] DIGITAL TWIN SYNCHRONIZED`);
  console.log('\n' + JSON.stringify({ ok: true, ...r }, null, 2));
}
