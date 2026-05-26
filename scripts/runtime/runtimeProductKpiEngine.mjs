#!/usr/bin/env node
/**
 * Runtime Product KPI Engine
 *
 * Computes key performance indicators for the Runtime product:
 * availability, deploy success, drift recovery, repair lead time,
 * operator response, SLA recovery, business impact, governance intervention.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const SERVICE_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-service-state.json');
const ENV_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-environment-state.json');
const SUPERVISOR_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-trigger-supervisor-state.json');
const SNAPSHOT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-snapshot.json');
const EVOLUTION_MODEL_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-structural-evolution-model.json');
const KPI_RESULT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-product-kpi-result.json');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function kpiAvailability(serviceState) {
  const isActive = serviceState?.service?.active ?? false;
  const crashes = serviceState?.crash?.crashCount ?? 0;
  const restarts = serviceState?.service?.restartCount ?? 0;

  let availability = 100;
  if (!isActive) availability -= 50;
  availability -= Math.min(30, crashes * 5);
  availability -= Math.min(10, restarts * 1);
  return { value: Math.max(0, Math.round(availability * 10) / 10), unit: '%', target: 99.5, status: availability >= 99.5 ? 'met' : 'below' };
}

function kpiDeploySuccessRate(supervisor) {
  const total = supervisor?.totalExecutions ?? 0;
  const failures = supervisor?.consecutiveFailures ?? 0;
  if (total === 0) return { value: 100, unit: '%', target: 95, status: 'met' };

  const rate = Math.round(((total - failures) / total) * 1000) / 10;
  return { value: rate, unit: '%', target: 95, status: rate >= 95 ? 'met' : 'below' };
}

function kpiDriftRecoveryTime(envState) {
  const recoveryPressure = envState?.pressure?.recovery ?? 0;
  const estimated = Math.round(recoveryPressure * 0.6);
  return { value: estimated, unit: 'min', target: 60, status: estimated <= 60 ? 'met' : 'below' };
}

function kpiRepairLeadTime(serviceState) {
  const recoveryCount = serviceState?.recovery?.recoveryCount ?? 0;
  const estimated = Math.min(120, recoveryCount * 5);
  return { value: estimated, unit: 'min', target: 30, status: estimated <= 30 ? 'met' : 'below' };
}

function kpiOperatorResponseTime(serviceState) {
  const isActive = serviceState?.service?.active ?? false;
  if (isActive) return { value: 0, unit: 'min', target: 15, status: 'met' };
  return { value: 30, unit: 'min', target: 15, status: 'below' };
}

function kpiSlaRecoveryTime(serviceState, envState) {
  const crashes = serviceState?.crash?.crashCount ?? 0;
  const recoveryPressure = envState?.pressure?.recovery ?? 0;
  const estimated = Math.min(60, crashes * 3 + recoveryPressure * 0.3);
  return { value: Math.round(estimated), unit: 'min', target: 15, status: estimated <= 15 ? 'met' : 'below' };
}

function kpiBusinessImpactReduction(envState) {
  const composite = envState?.pressure?.composite ?? 0;
  const reduction = Math.max(0, 100 - composite);
  return { value: reduction, unit: '%', target: 80, status: reduction >= 80 ? 'met' : 'below' };
}

function kpiGovernanceInterventionRate(snapshot) {
  const govPressure = snapshot?.governancePressure?.composite ?? 0;
  const rate = Math.min(100, Math.round(govPressure));
  return { value: rate, unit: '%', target: 20, status: rate <= 20 ? 'met' : 'below' };
}

export function runProductKpi() {
  const now = new Date().toISOString();

  const serviceState = loadJson(SERVICE_STATE_PATH);
  const envState = loadJson(ENV_STATE_PATH);
  const supervisor = loadJson(SUPERVISOR_PATH);
  const snapshot = loadJson(SNAPSHOT_PATH);

  const kpis = {
    availability: kpiAvailability(serviceState),
    deploySuccessRate: kpiDeploySuccessRate(supervisor),
    driftRecoveryTime: kpiDriftRecoveryTime(envState),
    repairLeadTime: kpiRepairLeadTime(serviceState),
    operatorResponseTime: kpiOperatorResponseTime(serviceState),
    slaRecoveryTime: kpiSlaRecoveryTime(serviceState, envState),
    businessImpactReduction: kpiBusinessImpactReduction(envState),
    governanceInterventionRate: kpiGovernanceInterventionRate(snapshot),
  };

  const totalKpis = Object.keys(kpis).length;
  const metCount = Object.values(kpis).filter(k => k.status === 'met').length;
  const belowCount = totalKpis - metCount;

  const overallScore = Math.round((metCount / totalKpis) * 100);

  const result = {
    kpis,
    summary: { total: totalKpis, met: metCount, below: belowCount, overallScore },
    timestamp: now,
  };

  saveJson(KPI_RESULT_PATH, result);
  return result;
}

if (process.argv[1]?.endsWith('runtimeProductKpiEngine.mjs')) {
  console.log('[kpi] Runtime Product KPI Engine');
  console.log('='.repeat(55));

  const r = runProductKpi();

  console.log('\n  KPIs:');
  for (const [name, kpi] of Object.entries(r.kpis)) {
    const icon = kpi.status === 'met' ? 'OK' : 'MISS';
    const comparison = kpi.unit === '%' && name !== 'driftRecoveryTime' && name !== 'repairLeadTime' && name !== 'operatorResponseTime' && name !== 'slaRecoveryTime' && name !== 'governanceInterventionRate'
      ? `${kpi.value}${kpi.unit} (target: >=${kpi.target}${kpi.unit})`
      : `${kpi.value}${kpi.unit} (target: <=${kpi.target}${kpi.unit})`;
    console.log(`    [${icon}] ${name}: ${comparison}`);
  }

  console.log(`\n  Summary:`);
  console.log(`    Total KPIs: ${r.summary.total}`);
  console.log(`    Met: ${r.summary.met}`);
  console.log(`    Below target: ${r.summary.below}`);
  console.log(`    Overall score: ${r.summary.overallScore}%`);

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[kpi] ${r.summary.overallScore >= 75 ? 'KPI TARGETS MET' : 'KPI IMPROVEMENT NEEDED'}`);
  console.log('\n' + JSON.stringify({ ok: true, ...r }, null, 2));
}
