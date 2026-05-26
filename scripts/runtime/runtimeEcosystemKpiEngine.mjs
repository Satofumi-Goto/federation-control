#!/usr/bin/env node
/**
 * Runtime Ecosystem KPI Engine
 *
 * Computes ecosystem-level KPIs: stability, cross-runtime efficiency,
 * governance overhead, deploy recovery, throughput, availability,
 * business continuity, and federation resilience.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const ECOSYSTEM_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-business-ecosystem-model.json');
const SERVICE_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-service-state.json');
const ENV_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-environment-state.json');
const SUPERVISOR_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-trigger-supervisor-state.json');
const EVOLUTION_MODEL_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-structural-evolution-model.json');
const GOVERNANCE_RESULT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-evolution-governance-result.json');
const KPI_RESULT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-ecosystem-kpi-result.json');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function kpiEcosystemStability(serviceState, envState) {
  let score = 100;
  const crashes = serviceState?.crash?.crashCount ?? 0;
  const restarts = serviceState?.service?.restartCount ?? 0;
  const composite = envState?.pressure?.composite ?? 0;

  score -= Math.min(30, crashes * 10);
  score -= Math.min(15, restarts * 3);
  score -= Math.min(25, composite * 0.5);

  return { value: Math.max(0, Math.round(score)), unit: '%', target: 90, status: score >= 90 ? 'met' : 'below' };
}

function kpiCrossRuntimeEfficiency(supervisor) {
  const total = supervisor?.totalExecutions ?? 0;
  const blocked = supervisor?.totalBlocked ?? 0;
  if (total === 0 && blocked === 0) return { value: 100, unit: '%', target: 80, status: 'met' };

  const efficiency = Math.round((total / (total + blocked)) * 100);
  return { value: efficiency, unit: '%', target: 80, status: efficiency >= 80 ? 'met' : 'below' };
}

function kpiGovernanceOverhead(envState, governanceResult) {
  const pressure = envState?.pressure?.governance ?? envState?.pressure?.composite ?? 0;
  const blocked = governanceResult?.summary?.blocked ?? 0;

  const overhead = Math.min(100, Math.round(pressure + blocked * 10));
  return { value: overhead, unit: '%', target: 30, status: overhead <= 30 ? 'met' : 'below' };
}

function kpiDeployRecoveryEfficiency(serviceState) {
  const recoveries = serviceState?.recovery?.recoveryCount ?? 0;
  const crashes = serviceState?.crash?.crashCount ?? 0;

  if (crashes === 0) return { value: 100, unit: '%', target: 85, status: 'met' };

  const efficiency = recoveries >= crashes ? Math.round((recoveries / (recoveries + crashes)) * 100) : Math.round((recoveries / crashes) * 100);
  return { value: Math.min(100, efficiency), unit: '%', target: 85, status: efficiency >= 85 ? 'met' : 'below' };
}

function kpiOperationalThroughput(supervisor) {
  const total = supervisor?.totalExecutions ?? 0;
  const rate = total;
  return { value: rate, unit: 'exec', target: 1, status: rate >= 1 ? 'met' : 'below' };
}

function kpiEcosystemAvailability(serviceState, envState) {
  const isActive = serviceState?.service?.active ?? false;
  const health = envState?.health ?? 'unknown';

  let availability = 100;
  if (!isActive) availability -= 50;
  if (health === 'degraded') availability -= 20;
  if (health === 'critical') availability -= 40;

  return { value: Math.max(0, availability), unit: '%', target: 99, status: availability >= 99 ? 'met' : 'below' };
}

function kpiBusinessContinuity(serviceState, ecosystem) {
  const isActive = serviceState?.service?.active ?? false;
  const services = ecosystem?.serviceDomains?.length ?? 0;
  const operators = ecosystem?.operators?.length ?? 0;

  let score = 100;
  if (!isActive) score -= 40;
  if (services === 0) score -= 20;
  if (operators === 0) score -= 20;

  return { value: Math.max(0, score), unit: '%', target: 90, status: score >= 90 ? 'met' : 'below' };
}

function kpiFederationResilience(evolutionModel, governanceResult) {
  const safetyLocks = governanceResult?.summary?.safetyLocks?.allEnforced ?? false;
  const blocked = governanceResult?.summary?.blocked ?? 0;
  const topology = evolutionModel?.topology ?? {};

  let score = 100;
  if (!safetyLocks) score -= 30;
  if (topology.currentNodes === 0) score -= 15;

  return { value: Math.max(0, score), unit: '%', target: 85, status: score >= 85 ? 'met' : 'below' };
}

export function runEcosystemKpi() {
  const now = new Date().toISOString();

  const ecosystem = loadJson(ECOSYSTEM_PATH);
  const serviceState = loadJson(SERVICE_STATE_PATH);
  const envState = loadJson(ENV_STATE_PATH);
  const supervisor = loadJson(SUPERVISOR_PATH);
  const evolutionModel = loadJson(EVOLUTION_MODEL_PATH);
  const governanceResult = loadJson(GOVERNANCE_RESULT_PATH);

  const kpis = {
    ecosystemStability: kpiEcosystemStability(serviceState, envState),
    crossRuntimeEfficiency: kpiCrossRuntimeEfficiency(supervisor),
    governanceOverhead: kpiGovernanceOverhead(envState, governanceResult),
    deployRecoveryEfficiency: kpiDeployRecoveryEfficiency(serviceState),
    operationalThroughput: kpiOperationalThroughput(supervisor),
    ecosystemAvailability: kpiEcosystemAvailability(serviceState, envState),
    businessContinuity: kpiBusinessContinuity(serviceState, ecosystem),
    federationResilience: kpiFederationResilience(evolutionModel, governanceResult),
  };

  const total = Object.keys(kpis).length;
  const met = Object.values(kpis).filter(k => k.status === 'met').length;
  const overallScore = Math.round((met / total) * 100);

  const result = {
    kpis,
    summary: { total, met, below: total - met, overallScore },
    timestamp: now,
  };

  saveJson(KPI_RESULT_PATH, result);
  return result;
}

if (process.argv[1]?.endsWith('runtimeEcosystemKpiEngine.mjs')) {
  console.log('[ecosystem-kpi] Runtime Ecosystem KPI Engine');
  console.log('='.repeat(55));

  const r = runEcosystemKpi();

  console.log('\n  KPIs:');
  for (const [name, kpi] of Object.entries(r.kpis)) {
    const icon = kpi.status === 'met' ? 'OK' : 'MISS';
    const dir = ['governanceOverhead'].includes(name) ? '<=' : '>=';
    console.log(`    [${icon}] ${name}: ${kpi.value}${kpi.unit} (target: ${dir}${kpi.target}${kpi.unit})`);
  }

  console.log(`\n  Summary:`);
  console.log(`    Total: ${r.summary.total}`);
  console.log(`    Met: ${r.summary.met}`);
  console.log(`    Below: ${r.summary.below}`);
  console.log(`    Overall: ${r.summary.overallScore}%`);

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[ecosystem-kpi] ${r.summary.overallScore >= 75 ? 'ECOSYSTEM KPI TARGETS MET' : 'ECOSYSTEM KPI IMPROVEMENT NEEDED'}`);
  console.log('\n' + JSON.stringify({ ok: true, ...r }, null, 2));
}
