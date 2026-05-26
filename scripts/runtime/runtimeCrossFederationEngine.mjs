#!/usr/bin/env node
/**
 * Cross-Runtime Federation Engine
 *
 * Runtime-to-Runtime propagation, cross-runtime dependency resolution,
 * governance coordination, repair orchestration, execution coordination,
 * and health propagation across the federation ecosystem.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const DOMAIN_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-federation-domain-model.json');
const HEALTH_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-federation-health-graph.json');
const ORCH_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-orchestration-state.json');

export const PROPAGATION_TYPES = {
  HEALTH: 'health',
  GOVERNANCE: 'governance',
  REPAIR: 'repair',
  EXECUTION: 'execution',
  AUTHORITY: 'authority',
};

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

/**
 * Resolve cross-runtime dependencies for a given domain.
 */
export function resolveDependencies(domainId) {
  const model = loadJson(DOMAIN_PATH);
  if (!model) return { ok: false, error: 'Domain model not found' };

  const domain = model.domains.find(d => d.id === domainId);
  if (!domain) return { ok: false, error: `Domain ${domainId} not found` };

  const direct = domain.dependencies;
  const transitive = new Set();

  function walk(id) {
    const d = model.domains.find(x => x.id === id);
    if (!d) return;
    for (const dep of d.dependencies) {
      if (!transitive.has(dep)) {
        transitive.add(dep);
        walk(dep);
      }
    }
  }
  walk(domainId);

  return {
    ok: true,
    domainId,
    direct,
    transitive: [...transitive],
    depth: transitive.size,
  };
}

/**
 * Propagate health across runtime domains.
 */
export function propagateHealth() {
  const model = loadJson(DOMAIN_PATH);
  const health = loadJson(HEALTH_PATH);
  const orch = loadJson(ORCH_PATH);
  if (!model) return { ok: false, error: 'Domain model not found' };

  const baseHealth = health?.nodes ?? [];
  const pressure = orch?.pressureScore ?? 0;
  const mode = orch?.activeMode ?? 'normal';

  const domainHealth = model.domains.map(domain => {
    const matchNode = baseHealth.find(n => n.id === domain.id.replace('-runtime', ''));
    const depHealths = domain.dependencies.map(dep => {
      const depNode = baseHealth.find(n => n.id === dep.replace('-runtime', ''));
      return depNode?.health ?? 'unknown';
    });

    const hasDegradedDep = depHealths.includes('warning') || depHealths.includes('critical');
    let derivedHealth = matchNode?.health ?? 'operational';
    if (hasDegradedDep && derivedHealth === 'healthy') derivedHealth = 'warning';

    return {
      domainId: domain.id,
      label: domain.label,
      health: derivedHealth,
      pressure: matchNode?.pressure ?? 0,
      dependencyHealth: hasDegradedDep ? 'degraded' : 'healthy',
      authorityLevel: domain.authorityLevel,
    };
  });

  return {
    ok: true,
    federationHealth: domainHealth,
    overallPressure: pressure,
    activeMode: mode,
    healthyCount: domainHealth.filter(d => d.health === 'healthy' || d.health === 'operational').length,
    degradedCount: domainHealth.filter(d => d.health === 'warning' || d.health === 'critical').length,
    totalDomains: domainHealth.length,
  };
}

/**
 * Coordinate governance across runtimes.
 */
export function coordinateGovernance() {
  const model = loadJson(DOMAIN_PATH);
  if (!model) return { ok: false, error: 'Domain model not found' };

  const governanceMap = model.domains.map(domain => ({
    domainId: domain.id,
    governanceScope: domain.governanceScope,
    authorityLevel: domain.authorityLevel,
    canOverride: domain.authorityLevel === 'primary',
    govEdges: model.topology.edges.filter(e => e.type === 'governance' && (e.from === domain.id || e.to === domain.id)),
  }));

  const primaryDomains = governanceMap.filter(g => g.canOverride);
  const secondaryDomains = governanceMap.filter(g => !g.canOverride);

  return {
    ok: true,
    governanceMap,
    primaryCount: primaryDomains.length,
    secondaryCount: secondaryDomains.length,
    totalGovernanceScopes: governanceMap.reduce((sum, g) => sum + g.governanceScope.length, 0),
  };
}

/**
 * Coordinate repair across runtimes.
 */
export function coordinateRepair() {
  const model = loadJson(DOMAIN_PATH);
  const orch = loadJson(ORCH_PATH);
  if (!model) return { ok: false, error: 'Domain model not found' };

  const repairDomain = model.domains.find(d => d.id === 'repair-runtime');
  const repairDeps = repairDomain?.dependencies ?? [];
  const affectedDomains = model.domains.filter(d =>
    d.dependencies.includes('repair-runtime') || d.id === 'repair-runtime'
  );

  return {
    ok: true,
    repairState: orch?.activeRepairState ?? 'unknown',
    repairDomain: repairDomain?.id ?? 'missing',
    repairDependencies: repairDeps,
    affectedDomains: affectedDomains.map(d => d.id),
    crossRuntimeRepairReady: repairDomain != null,
  };
}

/**
 * Coordinate execution across runtimes.
 */
export function coordinateExecution() {
  const model = loadJson(DOMAIN_PATH);
  if (!model) return { ok: false, error: 'Domain model not found' };

  const execEdges = model.topology.edges.filter(e => e.type === 'execution');
  const execDomains = model.domains.filter(d =>
    d.executionScope.length > 0
  );

  return {
    ok: true,
    executionEdges: execEdges.length,
    executionDomains: execDomains.length,
    totalExecutionScopes: execDomains.reduce((sum, d) => sum + d.executionScope.length, 0),
    coordinationPaths: execEdges.map(e => `${e.from} → ${e.to}`),
  };
}

function main() {
  console.log('[cross-federation] Cross-Runtime Federation Engine');
  console.log('='.repeat(60));

  // 1. Health propagation
  console.log('\n[cross-federation] Phase 1: Health Propagation');
  const health = propagateHealth();
  if (health.ok) {
    console.log(`  Domains: ${health.totalDomains} (${health.healthyCount} healthy, ${health.degradedCount} degraded)`);
    console.log(`  Overall pressure: ${health.overallPressure}`);
    console.log(`  Active mode: ${health.activeMode}`);
    for (const d of health.federationHealth) {
      console.log(`    ${d.label}: ${d.health} (dep: ${d.dependencyHealth})`);
    }
  }

  // 2. Governance coordination
  console.log('\n[cross-federation] Phase 2: Governance Coordination');
  const gov = coordinateGovernance();
  if (gov.ok) {
    console.log(`  Primary: ${gov.primaryCount} | Secondary: ${gov.secondaryCount}`);
    console.log(`  Governance scopes: ${gov.totalGovernanceScopes}`);
  }

  // 3. Repair coordination
  console.log('\n[cross-federation] Phase 3: Repair Coordination');
  const repair = coordinateRepair();
  if (repair.ok) {
    console.log(`  Repair state: ${repair.repairState}`);
    console.log(`  Cross-runtime repair ready: ${repair.crossRuntimeRepairReady}`);
  }

  // 4. Execution coordination
  console.log('\n[cross-federation] Phase 4: Execution Coordination');
  const exec = coordinateExecution();
  if (exec.ok) {
    console.log(`  Execution edges: ${exec.executionEdges}`);
    console.log(`  Execution domains: ${exec.executionDomains}`);
    console.log(`  Coordination paths: ${exec.coordinationPaths.join(', ')}`);
  }

  // 5. Dependency resolution (runtime-core example)
  console.log('\n[cross-federation] Phase 5: Dependency Resolution');
  const deps = resolveDependencies('fleet-runtime');
  if (deps.ok) {
    console.log(`  fleet-runtime → direct: [${deps.direct.join(', ')}]`);
    console.log(`  fleet-runtime → transitive: [${deps.transitive.join(', ')}]`);
  }

  const report = {
    ok: health.ok && gov.ok && repair.ok && exec.ok,
    health: { totalDomains: health.totalDomains, healthy: health.healthyCount, degraded: health.degradedCount },
    governance: { primary: gov.primaryCount, secondary: gov.secondaryCount, scopes: gov.totalGovernanceScopes },
    repair: { state: repair.repairState, crossRuntimeReady: repair.crossRuntimeRepairReady },
    execution: { edges: exec.executionEdges, domains: exec.executionDomains },
    timestamp: new Date().toISOString(),
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log('[cross-federation] Federation engine operational');
  console.log('\n' + JSON.stringify(report, null, 2));
}

main();
