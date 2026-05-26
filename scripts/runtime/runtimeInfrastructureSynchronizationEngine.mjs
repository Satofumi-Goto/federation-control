#!/usr/bin/env node
/**
 * Runtime Infrastructure Synchronization Engine
 *
 * Synchronizes Runtime infrastructure domains: energy, node capacity,
 * logistics, infrastructure health, and recovery paths into the
 * digital twin state.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const INFRA_TOPO_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-infrastructure-topology-graph.json');
const TWIN_GRAPH_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-digital-twin-graph.json');
const DOMAIN_MODEL_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-federation-domain-model.json');
const ENV_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-environment-state.json');
const SYNC_RESULT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-infrastructure-sync-result.json');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function syncInfrastructureDomains(infraTopo, domainModel) {
  const infraDomains = ['infrastructure-runtime', 'energy-runtime', 'logistics-runtime', 'urban-runtime'];
  const synced = [];

  for (const domainId of infraDomains) {
    const domain = domainModel?.domains?.find(d => d.id === domainId);
    const infraNode = infraTopo?.nodes?.find(n => n.domain === domainId);

    synced.push({
      domain: domainId,
      label: domain?.label ?? domainId,
      defined: !!domain,
      infraNodePresent: !!infraNode,
      status: infraNode?.status ?? 'unknown',
      capacity: infraNode?.capacity ?? 0,
      utilization: infraNode?.utilization ?? 0,
      utilizationPct: infraNode?.capacity > 0 ? Math.round((infraNode.utilization / infraNode.capacity) * 100) : 0,
    });
  }

  return synced;
}

function syncEnergyState(infraTopo) {
  const energyNode = infraTopo?.nodes?.find(n => n.domain === 'energy-runtime');
  if (!energyNode) return { available: false, status: 'unknown', capacity: 0, utilization: 0, saturation: 0 };

  const saturation = energyNode.capacity > 0 ? Math.round((energyNode.utilization / energyNode.capacity) * 100) : 0;
  return {
    available: true,
    status: energyNode.status,
    capacity: energyNode.capacity,
    utilization: energyNode.utilization,
    saturation,
    overloaded: saturation > 85,
  };
}

function syncNodeCapacity(infraTopo) {
  const nodes = infraTopo?.nodes ?? [];
  const capacitySummary = nodes.map(n => ({
    id: n.id,
    domain: n.domain,
    type: n.type,
    capacity: n.capacity,
    utilization: n.utilization,
    available: n.capacity - n.utilization,
    utilizationPct: n.capacity > 0 ? Math.round((n.utilization / n.capacity) * 100) : 0,
  }));

  const totalCapacity = nodes.reduce((s, n) => s + (n.capacity ?? 0), 0);
  const totalUtilization = nodes.reduce((s, n) => s + (n.utilization ?? 0), 0);

  return {
    nodes: capacitySummary,
    totalCapacity,
    totalUtilization,
    totalAvailable: totalCapacity - totalUtilization,
    overallUtilization: totalCapacity > 0 ? Math.round((totalUtilization / totalCapacity) * 100) : 0,
    overloaded: capacitySummary.filter(n => n.utilizationPct > 80),
  };
}

function syncLogisticsState(infraTopo) {
  const logisticsNode = infraTopo?.nodes?.find(n => n.domain === 'logistics-runtime');
  if (!logisticsNode) return { available: false, status: 'unknown' };

  return {
    available: true,
    status: logisticsNode.status,
    capacity: logisticsNode.capacity,
    utilization: logisticsNode.utilization,
    utilizationPct: logisticsNode.capacity > 0 ? Math.round((logisticsNode.utilization / logisticsNode.capacity) * 100) : 0,
  };
}

function syncInfrastructureHealth(infraTopo) {
  const nodes = infraTopo?.nodes ?? [];
  const active = nodes.filter(n => n.status === 'active').length;
  const standby = nodes.filter(n => n.status === 'standby').length;
  const inactive = nodes.filter(n => n.status !== 'active' && n.status !== 'standby').length;

  const constraints = infraTopo?.constraints ?? [];
  const enforced = constraints.filter(c => c.enforced).length;
  const violated = constraints.filter(c => !c.enforced).length;

  return {
    totalNodes: nodes.length,
    active,
    standby,
    inactive,
    constraintsTotal: constraints.length,
    constraintsEnforced: enforced,
    constraintsViolated: violated,
    healthy: inactive === 0 && violated === 0,
  };
}

function syncRecoveryPaths(infraTopo) {
  const paths = infraTopo?.recoveryPaths ?? [];
  return {
    totalPaths: paths.length,
    paths: paths.map(p => ({
      scenario: p.scenario,
      steps: p.path.length,
      estimatedMs: p.estimatedRecoveryMs,
    })),
    averageRecoveryMs: paths.length > 0
      ? Math.round(paths.reduce((s, p) => s + p.estimatedRecoveryMs, 0) / paths.length)
      : 0,
  };
}

export function runInfrastructureSync() {
  const now = new Date().toISOString();

  const infraTopo = loadJson(INFRA_TOPO_PATH);
  const domainModel = loadJson(DOMAIN_MODEL_PATH);
  const twin = loadJson(TWIN_GRAPH_PATH);

  const domains = syncInfrastructureDomains(infraTopo, domainModel);
  const energy = syncEnergyState(infraTopo);
  const capacity = syncNodeCapacity(infraTopo);
  const logistics = syncLogisticsState(infraTopo);
  const health = syncInfrastructureHealth(infraTopo);
  const recovery = syncRecoveryPaths(infraTopo);

  // Update twin graph infrastructure nodes
  if (twin) {
    for (const d of domains) {
      const twinNode = twin.nodes?.find(n => n.domain === d.domain);
      if (twinNode) {
        twinNode.congestion = d.utilizationPct;
        twinNode.health = d.utilizationPct > 80 ? 'warning' : 'healthy';
      }
    }
    twin.lastSynchronized = now;
    saveJson(TWIN_GRAPH_PATH, twin);
  }

  const result = {
    infrastructure: { domains, energy, capacity, logistics, health, recovery },
    summary: {
      domainsSynced: domains.filter(d => d.defined && d.infraNodePresent).length,
      domainsTotal: domains.length,
      overallUtilization: capacity.overallUtilization,
      overloadedNodes: capacity.overloaded.length,
      healthyInfra: health.healthy,
      recoveryPaths: recovery.totalPaths,
    },
    synchronized: true,
    timestamp: now,
  };

  saveJson(SYNC_RESULT_PATH, result);
  return result;
}

if (process.argv[1]?.endsWith('runtimeInfrastructureSynchronizationEngine.mjs')) {
  console.log('[infra-sync] Runtime Infrastructure Synchronization Engine');
  console.log('='.repeat(55));

  const r = runInfrastructureSync();

  console.log(`\n  Domains synced: ${r.summary.domainsSynced}/${r.summary.domainsTotal}`);
  for (const d of r.infrastructure.domains) {
    console.log(`    ${d.label}: ${d.status} (${d.utilizationPct}% utilization)`);
  }

  console.log(`\n  Energy: ${r.infrastructure.energy.available ? `${r.infrastructure.energy.saturation}% saturation` : 'unavailable'}`);
  console.log(`  Logistics: ${r.infrastructure.logistics.available ? r.infrastructure.logistics.status : 'unavailable'}`);
  console.log(`  Capacity: ${r.summary.overallUtilization}% overall, ${r.summary.overloadedNodes} overloaded`);
  console.log(`  Health: ${r.summary.healthyInfra ? 'HEALTHY' : 'ISSUES'}`);
  console.log(`  Recovery paths: ${r.summary.recoveryPaths} (avg ${r.infrastructure.recovery.averageRecoveryMs}ms)`);

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[infra-sync] INFRASTRUCTURE SYNCHRONIZED`);
  console.log('\n' + JSON.stringify({ ok: true, ...r }, null, 2));
}
