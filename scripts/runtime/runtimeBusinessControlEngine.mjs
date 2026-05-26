#!/usr/bin/env node
/**
 * Runtime Business Control Engine
 *
 * Translates Runtime operational state into business impact metrics.
 * Calculates operational, service, cost, revenue, and SLA/SLO impact
 * and determines operator action priority.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const SERVICE_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-service-state.json');
const ENV_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-environment-state.json');
const SLA_MODEL_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-sla-slo-model.json');
const SUPERVISOR_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-trigger-supervisor-state.json');
const QUEUE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-execution-queue.json');
const OPERATING_MODEL_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-product-operating-model.json');
const RESULT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-business-control-result.json');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function calculateOperationalImpact(serviceState, envState) {
  let score = 100;
  const factors = [];

  if (serviceState?.crash?.crashCount > 0) {
    score -= Math.min(30, serviceState.crash.crashCount * 10);
    factors.push({ factor: 'crash-history', impact: -Math.min(30, serviceState.crash.crashCount * 10), detail: `${serviceState.crash.crashCount} crashes` });
  }

  if (serviceState?.service?.restartCount > 3) {
    score -= 15;
    factors.push({ factor: 'restart-frequency', impact: -15, detail: `${serviceState.service.restartCount} restarts` });
  }

  const composite = envState?.pressure?.composite ?? 0;
  if (composite > 50) {
    const penalty = Math.min(25, Math.round((composite - 50) / 2));
    score -= penalty;
    factors.push({ factor: 'pressure', impact: -penalty, detail: `Composite pressure ${composite}%` });
  }

  return { score: Math.max(0, score), factors };
}

function calculateServiceImpact(serviceState, envState) {
  let score = 100;
  const factors = [];

  if (!serviceState?.service?.active) {
    score -= 40;
    factors.push({ factor: 'service-inactive', impact: -40, detail: 'Runtime service not active' });
  }

  if (envState?.health === 'degraded') {
    score -= 20;
    factors.push({ factor: 'health-degraded', impact: -20, detail: 'Environment health degraded' });
  } else if (envState?.health === 'critical') {
    score -= 40;
    factors.push({ factor: 'health-critical', impact: -40, detail: 'Environment health critical' });
  }

  const recoveryCount = serviceState?.recovery?.recoveryCount ?? 0;
  if (recoveryCount > 5) {
    score -= 10;
    factors.push({ factor: 'recovery-frequency', impact: -10, detail: `${recoveryCount} recoveries` });
  }

  return { score: Math.max(0, score), factors };
}

function calculateCostImpact(envState, supervisor) {
  let score = 100;
  const factors = [];

  const memPressure = envState?.pressure?.memory ?? 0;
  if (memPressure > 60) {
    const penalty = Math.min(20, Math.round((memPressure - 60) / 2));
    score -= penalty;
    factors.push({ factor: 'memory-cost', impact: -penalty, detail: `Memory pressure ${memPressure}% — increased infrastructure cost` });
  }

  const totalBlocked = supervisor?.totalBlocked ?? 0;
  const totalExec = supervisor?.totalExecutions ?? 0;
  if (totalBlocked > 0 && totalExec > 0) {
    const wasteRatio = totalBlocked / (totalExec + totalBlocked);
    if (wasteRatio > 0.3) {
      const penalty = Math.min(15, Math.round(wasteRatio * 20));
      score -= penalty;
      factors.push({ factor: 'execution-waste', impact: -penalty, detail: `${Math.round(wasteRatio * 100)}% executions blocked — wasted compute` });
    }
  }

  return { score: Math.max(0, score), factors };
}

function calculateRevenueImpact(serviceImpact, slaModel) {
  let score = 100;
  const factors = [];

  if (serviceImpact.score < 80) {
    const penalty = Math.min(30, 100 - serviceImpact.score);
    score -= penalty;
    factors.push({ factor: 'service-degradation', impact: -penalty, detail: `Service score ${serviceImpact.score}/100 — potential customer impact` });
  }

  if (!slaModel) {
    score -= 10;
    factors.push({ factor: 'sla-undefined', impact: -10, detail: 'SLA model not defined — revenue risk unquantified' });
  }

  return { score: Math.max(0, score), factors };
}

function calculateSlaImpact(serviceState, envState, slaModel) {
  let score = 100;
  const factors = [];

  const targets = slaModel?.targets ?? {};
  const availability = targets.availability?.target ?? 99.5;
  const isActive = serviceState?.service?.active ?? false;

  if (!isActive) {
    score -= 50;
    factors.push({ factor: 'availability-breach', impact: -50, detail: `Service inactive — availability below ${availability}% target` });
  }

  const deployPressure = envState?.pressure?.deploy ?? 0;
  if (deployPressure > 40) {
    score -= 15;
    factors.push({ factor: 'deploy-pressure', impact: -15, detail: `Deploy pressure ${deployPressure}% — SLO at risk` });
  }

  const recoveryPressure = envState?.pressure?.recovery ?? 0;
  if (recoveryPressure > 40) {
    score -= 15;
    factors.push({ factor: 'recovery-pressure', impact: -15, detail: `Recovery pressure ${recoveryPressure}% — repair SLO at risk` });
  }

  return { score: Math.max(0, score), factors };
}

function determineActionPriority(impacts) {
  const minScore = Math.min(
    impacts.operational.score,
    impacts.service.score,
    impacts.cost.score,
    impacts.revenue.score,
    impacts.sla.score
  );

  if (minScore < 30) return { priority: 'critical', action: 'Immediate operator intervention required' };
  if (minScore < 50) return { priority: 'high', action: 'Operator review within 1 hour' };
  if (minScore < 70) return { priority: 'medium', action: 'Schedule optimization within 24 hours' };
  if (minScore < 90) return { priority: 'low', action: 'Monitor — no immediate action needed' };
  return { priority: 'none', action: 'All systems nominal' };
}

export function runBusinessControl() {
  const now = new Date().toISOString();

  const serviceState = loadJson(SERVICE_STATE_PATH);
  const envState = loadJson(ENV_STATE_PATH);
  const slaModel = loadJson(SLA_MODEL_PATH);
  const supervisor = loadJson(SUPERVISOR_PATH);
  const operatingModel = loadJson(OPERATING_MODEL_PATH);

  const operational = calculateOperationalImpact(serviceState, envState);
  const service = calculateServiceImpact(serviceState, envState);
  const cost = calculateCostImpact(envState, supervisor);
  const revenue = calculateRevenueImpact(service, slaModel);
  const sla = calculateSlaImpact(serviceState, envState, slaModel);

  const impacts = { operational, service, cost, revenue, sla };
  const actionPriority = determineActionPriority(impacts);

  const compositeScore = Math.round(
    (operational.score + service.score + cost.score + revenue.score + sla.score) / 5
  );

  const result = {
    impacts,
    compositeScore,
    actionPriority,
    operatingModelActive: !!operatingModel,
    timestamp: now,
  };

  saveJson(RESULT_PATH, result);
  return result;
}

if (process.argv[1]?.endsWith('runtimeBusinessControlEngine.mjs')) {
  console.log('[business] Runtime Business Control Engine');
  console.log('='.repeat(55));

  const r = runBusinessControl();

  const areas = ['operational', 'service', 'cost', 'revenue', 'sla'];
  for (const area of areas) {
    const imp = r.impacts[area];
    console.log(`\n  ${area.charAt(0).toUpperCase() + area.slice(1)} impact: ${imp.score}/100`);
    for (const f of imp.factors) console.log(`    [${f.impact > 0 ? '+' : ''}${f.impact}] ${f.detail}`);
    if (imp.factors.length === 0) console.log('    (no degradation)');
  }

  console.log(`\n  Composite score: ${r.compositeScore}/100`);
  console.log(`  Action priority: ${r.actionPriority.priority.toUpperCase()}`);
  console.log(`  Action: ${r.actionPriority.action}`);
  console.log(`  Operating model: ${r.operatingModelActive ? 'ACTIVE' : 'MISSING'}`);

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[business] ${r.actionPriority.priority === 'none' || r.actionPriority.priority === 'low' ? 'BUSINESS STABLE' : 'ACTION REQUIRED'}`);
  console.log('\n' + JSON.stringify({ ok: true, ...r }, null, 2));
}
