#!/usr/bin/env node
/**
 * Runtime SLA / SLO Execution Engine
 *
 * Evaluates Runtime SLA/SLO status, detects risk and degradation,
 * maps failures to service-level impact, and generates alerts.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const SLA_MODEL_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-sla-slo-model.json');
const SERVICE_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-service-state.json');
const ENV_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-environment-state.json');
const SUPERVISOR_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-trigger-supervisor-state.json');
const QUEUE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-execution-queue.json');
const RESULT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-sla-slo-execution-result.json');

const DEFAULT_SLA_TARGETS = {
  availability: { target: 99.5, unit: '%', window: '30d' },
  deploySuccess: { target: 95, unit: '%', window: '7d' },
  repairLeadTime: { target: 30, unit: 'min', window: '7d' },
  meanRecoveryTime: { target: 15, unit: 'min', window: '7d' },
  driftDetectionTime: { target: 60, unit: 'min', window: '7d' },
};

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function evaluateAvailability(serviceState) {
  const isActive = serviceState?.service?.active ?? false;
  const crashes = serviceState?.crash?.crashCount ?? 0;
  const restarts = serviceState?.service?.restartCount ?? 0;

  let estimatedAvailability = 100;
  if (!isActive) estimatedAvailability -= 50;
  estimatedAvailability -= Math.min(30, crashes * 5);
  estimatedAvailability -= Math.min(10, restarts * 1);

  return Math.max(0, Math.round(estimatedAvailability * 10) / 10);
}

function evaluateDeploySuccess(supervisor) {
  const total = supervisor?.totalExecutions ?? 0;
  const blocked = supervisor?.totalBlocked ?? 0;
  const failures = supervisor?.consecutiveFailures ?? 0;

  if (total === 0) return 100;

  const successful = total - failures;
  return Math.max(0, Math.round((successful / total) * 1000) / 10);
}

function evaluateRepairLeadTime(serviceState) {
  const recoveryCount = serviceState?.recovery?.recoveryCount ?? 0;
  if (recoveryCount === 0) return 0;
  return Math.min(60, recoveryCount * 5);
}

function detectRisks(metrics, targets) {
  const risks = [];

  for (const [key, target] of Object.entries(targets)) {
    const current = metrics[key]?.current;
    if (current === undefined) continue;

    const threshold = target.target;

    if (key === 'repairLeadTime' || key === 'meanRecoveryTime' || key === 'driftDetectionTime') {
      if (current > threshold) {
        risks.push({ metric: key, severity: current > threshold * 1.5 ? 'critical' : 'warning', current, target: threshold, unit: target.unit, detail: `${key} ${current}${target.unit} exceeds target ${threshold}${target.unit}` });
      } else if (current > threshold * 0.8) {
        risks.push({ metric: key, severity: 'approaching', current, target: threshold, unit: target.unit, detail: `${key} ${current}${target.unit} approaching target ${threshold}${target.unit}` });
      }
    } else {
      if (current < threshold) {
        risks.push({ metric: key, severity: current < threshold * 0.9 ? 'critical' : 'warning', current, target: threshold, unit: target.unit, detail: `${key} ${current}${target.unit} below target ${threshold}${target.unit}` });
      } else if (current < threshold * 1.02) {
        risks.push({ metric: key, severity: 'approaching', current, target: threshold, unit: target.unit, detail: `${key} ${current}${target.unit} near target ${threshold}${target.unit}` });
      }
    }
  }

  return risks;
}

function mapFailureToServiceImpact(risks) {
  const impacts = [];

  for (const risk of risks) {
    if (risk.severity === 'critical') {
      impacts.push({ metric: risk.metric, serviceImpact: 'service-degraded', customerImpact: 'potential-disruption', recoveryAction: `Prioritize ${risk.metric} recovery`, urgency: 'immediate' });
    } else if (risk.severity === 'warning') {
      impacts.push({ metric: risk.metric, serviceImpact: 'service-at-risk', customerImpact: 'none-yet', recoveryAction: `Monitor and optimize ${risk.metric}`, urgency: 'within-1h' });
    }
  }

  return impacts;
}

function generateAlerts(risks, serviceImpacts) {
  const alerts = [];

  for (const impact of serviceImpacts) {
    if (impact.urgency === 'immediate') {
      alerts.push({ level: 'critical', metric: impact.metric, message: `SLA BREACH: ${impact.metric} — ${impact.recoveryAction}`, requiresAck: true });
    } else if (impact.urgency === 'within-1h') {
      alerts.push({ level: 'warning', metric: impact.metric, message: `SLO AT RISK: ${impact.metric} — ${impact.recoveryAction}`, requiresAck: false });
    }
  }

  for (const risk of risks.filter(r => r.severity === 'approaching')) {
    alerts.push({ level: 'info', metric: risk.metric, message: `SLO approaching threshold: ${risk.detail}`, requiresAck: false });
  }

  return alerts;
}

export function runSlaSloExecution() {
  const now = new Date().toISOString();

  const slaModel = loadJson(SLA_MODEL_PATH);
  const serviceState = loadJson(SERVICE_STATE_PATH);
  const envState = loadJson(ENV_STATE_PATH);
  const supervisor = loadJson(SUPERVISOR_PATH);

  const targets = slaModel?.targets ?? DEFAULT_SLA_TARGETS;

  const availability = evaluateAvailability(serviceState);
  const deploySuccess = evaluateDeploySuccess(supervisor);
  const repairLeadTime = evaluateRepairLeadTime(serviceState);
  const meanRecoveryTime = envState?.pressure?.recovery ?? 0;

  const metrics = {
    availability: { current: availability, target: targets.availability?.target ?? 99.5, unit: '%' },
    deploySuccess: { current: deploySuccess, target: targets.deploySuccess?.target ?? 95, unit: '%' },
    repairLeadTime: { current: repairLeadTime, target: targets.repairLeadTime?.target ?? 30, unit: 'min' },
    meanRecoveryTime: { current: meanRecoveryTime, target: targets.meanRecoveryTime?.target ?? 15, unit: 'min' },
  };

  const risks = detectRisks(metrics, targets);
  const serviceImpacts = mapFailureToServiceImpact(risks);
  const alerts = generateAlerts(risks, serviceImpacts);

  const overallStatus = risks.some(r => r.severity === 'critical') ? 'breached' :
    risks.some(r => r.severity === 'warning') ? 'at-risk' :
      risks.some(r => r.severity === 'approaching') ? 'nominal-approaching' : 'healthy';

  const result = {
    metrics,
    risks,
    serviceImpacts,
    alerts,
    overallStatus,
    slaModelDefined: !!slaModel,
    timestamp: now,
  };

  saveJson(RESULT_PATH, result);
  return result;
}

if (process.argv[1]?.endsWith('runtimeSlaSloExecutionEngine.mjs')) {
  console.log('[sla/slo] Runtime SLA/SLO Execution Engine');
  console.log('='.repeat(55));

  const r = runSlaSloExecution();

  console.log('\n  Metrics:');
  for (const [key, m] of Object.entries(r.metrics)) {
    const status = m.current >= m.target ? 'OK' : 'BREACH';
    console.log(`    ${key}: ${m.current}${m.unit} (target: ${m.target}${m.unit}) [${status}]`);
  }

  console.log(`\n  Risks: ${r.risks.length}`);
  for (const risk of r.risks) console.log(`    [${risk.severity.toUpperCase()}] ${risk.detail}`);

  console.log(`\n  Alerts: ${r.alerts.length}`);
  for (const a of r.alerts) console.log(`    [${a.level.toUpperCase()}] ${a.message}`);

  console.log(`\n  Overall status: ${r.overallStatus.toUpperCase()}`);
  console.log(`  SLA model defined: ${r.slaModelDefined}`);

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[sla/slo] ${r.overallStatus === 'healthy' || r.overallStatus === 'nominal-approaching' ? 'SLA/SLO COMPLIANT' : 'SLA/SLO ATTENTION NEEDED'}`);
  console.log('\n' + JSON.stringify({ ok: true, ...r }, null, 2));
}
