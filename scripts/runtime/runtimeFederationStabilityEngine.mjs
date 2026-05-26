#!/usr/bin/env node
/**
 * Runtime Federation Stability Engine
 *
 * Calculates federation stability, collapse probability,
 * governance pressure, repair pressure, and execution saturation
 * across the federated Runtime ecosystem.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const DOMAIN_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-federation-domain-model.json');
const HEALTH_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-federation-health-graph.json');
const ORCH_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-orchestration-state.json');
const SLA_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-sla-slo-model.json');
const MEMORY_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-federation-memory.json');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

/**
 * Calculate federation stability score (0–100).
 */
export function calculateStability() {
  const model = loadJson(DOMAIN_PATH);
  const health = loadJson(HEALTH_PATH);
  const orch = loadJson(ORCH_PATH);
  const memory = loadJson(MEMORY_PATH);

  if (!model) return { ok: false, error: 'Domain model not found' };

  let score = 100;
  const factors = [];

  // Factor: governance pressure
  const govPressure = health?.governancePressure ?? 0;
  if (govPressure > 50) { score -= 20; factors.push({ factor: 'high_governance_pressure', impact: -20, value: govPressure }); }
  else if (govPressure > 20) { score -= 10; factors.push({ factor: 'moderate_governance_pressure', impact: -10, value: govPressure }); }

  // Factor: degraded nodes
  const degradedNodes = (health?.nodes ?? []).filter(n => n.health === 'warning' || n.health === 'critical');
  if (degradedNodes.length > 2) { score -= 25; factors.push({ factor: 'many_degraded_nodes', impact: -25, value: degradedNodes.length }); }
  else if (degradedNodes.length > 0) { score -= 10; factors.push({ factor: 'some_degraded_nodes', impact: -10, value: degradedNodes.length }); }

  // Factor: orchestration pressure
  const orchPressure = orch?.pressureScore ?? 0;
  if (orchPressure > 50) { score -= 15; factors.push({ factor: 'high_orchestration_pressure', impact: -15, value: orchPressure }); }
  else if (orchPressure > 20) { score -= 5; factors.push({ factor: 'moderate_orchestration_pressure', impact: -5, value: orchPressure }); }

  // Factor: active mode
  const mode = orch?.activeMode ?? 'normal';
  if (mode === 'emergency') { score -= 30; factors.push({ factor: 'emergency_mode', impact: -30 }); }
  else if (mode === 'rollback') { score -= 20; factors.push({ factor: 'rollback_mode', impact: -20 }); }
  else if (mode === 'restricted') { score -= 15; factors.push({ factor: 'restricted_mode', impact: -15 }); }
  else if (mode === 'repair') { score -= 10; factors.push({ factor: 'repair_mode', impact: -10 }); }

  // Factor: federation memory health
  const fedHealth = memory?.federationLive?.federationHealth ?? 100;
  if (fedHealth < 50) { score -= 15; factors.push({ factor: 'low_federation_health', impact: -15, value: fedHealth }); }
  else if (fedHealth < 70) { score -= 5; factors.push({ factor: 'moderate_federation_health', impact: -5, value: fedHealth }); }

  // Factor: collapse risk
  const collapseRisk = memory?.federationLive?.collapseRisk ?? 0;
  if (collapseRisk > 60) { score -= 20; factors.push({ factor: 'high_collapse_risk', impact: -20, value: collapseRisk }); }
  else if (collapseRisk > 30) { score -= 10; factors.push({ factor: 'moderate_collapse_risk', impact: -10, value: collapseRisk }); }

  score = Math.max(0, Math.min(100, score));

  return {
    ok: true,
    stabilityScore: score,
    stabilityLevel: score >= 80 ? 'stable' : score >= 60 ? 'moderate' : score >= 40 ? 'unstable' : 'critical',
    factors,
    factorCount: factors.length,
  };
}

/**
 * Calculate federation collapse probability (0–100%).
 */
export function calculateCollapseProbability() {
  const stability = calculateStability();
  if (!stability.ok) return { ok: false, error: stability.error };

  const probability = Math.max(0, 100 - stability.stabilityScore);
  return {
    ok: true,
    collapseProbability: probability,
    level: probability < 10 ? 'negligible' : probability < 30 ? 'low' : probability < 60 ? 'moderate' : 'high',
  };
}

/**
 * Calculate federation governance pressure across all domains.
 */
export function calculateFederationGovernancePressure() {
  const model = loadJson(DOMAIN_PATH);
  const health = loadJson(HEALTH_PATH);
  if (!model) return { ok: false, error: 'Domain model not found' };

  const nodes = health?.nodes ?? [];
  const domainPressures = model.domains.map(d => {
    const node = nodes.find(n => n.id === d.id.replace('-runtime', ''));
    return { domain: d.id, pressure: node?.pressure ?? 0, governanceScopes: d.governanceScope.length };
  });

  const totalPressure = domainPressures.reduce((sum, d) => sum + d.pressure, 0);
  const avgPressure = domainPressures.length > 0 ? totalPressure / domainPressures.length : 0;

  return {
    ok: true,
    domainPressures,
    totalPressure,
    averagePressure: Math.round(avgPressure * 10) / 10,
    maxPressure: Math.max(...domainPressures.map(d => d.pressure)),
  };
}

/**
 * Calculate federation repair pressure.
 */
export function calculateRepairPressure() {
  const health = loadJson(HEALTH_PATH);
  const orch = loadJson(ORCH_PATH);

  return {
    ok: true,
    repairPressure: health?.repairPressure ?? 0,
    repairState: orch?.activeRepairState ?? 'unknown',
    deployPressure: health?.deployPressure ?? 0,
    executionPressure: health?.executionPressure ?? 0,
  };
}

/**
 * Calculate federation execution saturation.
 */
export function calculateExecutionSaturation() {
  const orch = loadJson(ORCH_PATH);
  const health = loadJson(HEALTH_PATH);

  const queueSize = orch?.activeQueue?.length ?? 0;
  const pressure = health?.executionPressure ?? 0;
  const saturation = Math.min(100, queueSize * 10 + pressure);

  return {
    ok: true,
    saturation,
    level: saturation < 30 ? 'low' : saturation < 60 ? 'moderate' : saturation < 85 ? 'high' : 'saturated',
    queueSize,
    executionPressure: pressure,
  };
}

function main() {
  console.log('[stability] Runtime Federation Stability Engine');
  console.log('='.repeat(60));

  // 1. Stability
  console.log('\n[stability] Phase 1: Federation Stability');
  const stability = calculateStability();
  if (stability.ok) {
    console.log(`  Score: ${stability.stabilityScore}/100 (${stability.stabilityLevel})`);
    console.log(`  Factors: ${stability.factorCount}`);
    for (const f of stability.factors) {
      console.log(`    ${f.factor}: ${f.impact} ${f.value != null ? `(value: ${f.value})` : ''}`);
    }
  }

  // 2. Collapse probability
  console.log('\n[stability] Phase 2: Collapse Probability');
  const collapse = calculateCollapseProbability();
  if (collapse.ok) {
    console.log(`  Probability: ${collapse.collapseProbability}% (${collapse.level})`);
  }

  // 3. Governance pressure
  console.log('\n[stability] Phase 3: Governance Pressure');
  const govPressure = calculateFederationGovernancePressure();
  if (govPressure.ok) {
    console.log(`  Total: ${govPressure.totalPressure} | Avg: ${govPressure.averagePressure} | Max: ${govPressure.maxPressure}`);
  }

  // 4. Repair pressure
  console.log('\n[stability] Phase 4: Repair Pressure');
  const repairPressure = calculateRepairPressure();
  if (repairPressure.ok) {
    console.log(`  Repair: ${repairPressure.repairPressure} | Deploy: ${repairPressure.deployPressure} | Execution: ${repairPressure.executionPressure}`);
  }

  // 5. Execution saturation
  console.log('\n[stability] Phase 5: Execution Saturation');
  const saturation = calculateExecutionSaturation();
  if (saturation.ok) {
    console.log(`  Saturation: ${saturation.saturation}% (${saturation.level})`);
  }

  const report = {
    ok: stability.ok,
    stability: { score: stability.stabilityScore, level: stability.stabilityLevel, factors: stability.factorCount },
    collapse: { probability: collapse.collapseProbability, level: collapse.level },
    governancePressure: { total: govPressure.totalPressure, average: govPressure.averagePressure },
    repairPressure: repairPressure.repairPressure,
    executionSaturation: { saturation: saturation.saturation, level: saturation.level },
    timestamp: new Date().toISOString(),
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[stability] Federation stability: ${stability.stabilityScore}/100 (${stability.stabilityLevel})`);
  console.log('\n' + JSON.stringify(report, null, 2));
}

main();
