#!/usr/bin/env node
/**
 * Runtime Economic Model Engine
 *
 * Calculates Runtime operational, governance, recovery, deployment costs
 * and ecosystem efficiency. Computes platform value generation.
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
const RESULT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-economic-model-result.json');

const COST_UNITS = {
  baseInfrastructure: 100,
  perExecution: 2,
  perRecovery: 5,
  perDeploy: 10,
  governanceOverhead: 15,
  monitoringFixed: 20,
  idlePenalty: 1,
};

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function calculateOperationalCost(serviceState, supervisor) {
  const executions = supervisor?.totalExecutions ?? 0;
  const blocked = supervisor?.totalBlocked ?? 0;

  const executionCost = executions * COST_UNITS.perExecution;
  const wastedCost = blocked * COST_UNITS.perExecution * 0.5;

  return {
    executionCost,
    wastedCost,
    totalExecutions: executions,
    blockedExecutions: blocked,
    total: executionCost + wastedCost,
  };
}

function calculateGovernanceCost(envState) {
  const govPressure = envState?.pressure?.governance ?? 0;
  const baseCost = COST_UNITS.governanceOverhead;
  const pressurePenalty = Math.round(govPressure * 0.3);

  return {
    baseCost,
    pressurePenalty,
    total: baseCost + pressurePenalty,
  };
}

function calculateRecoveryCost(serviceState) {
  const recoveries = serviceState?.recovery?.recoveryCount ?? 0;
  const crashes = serviceState?.crash?.crashCount ?? 0;

  const recoveryCost = recoveries * COST_UNITS.perRecovery;
  const crashCost = crashes * COST_UNITS.perRecovery * 3;

  return {
    recoveries,
    crashes,
    recoveryCost,
    crashCost,
    total: recoveryCost + crashCost,
  };
}

function calculateDeploymentCost(supervisor) {
  const deploys = supervisor?.totalExecutions ?? 0;
  const cost = deploys * COST_UNITS.perDeploy;

  return {
    deploys,
    perDeployCost: COST_UNITS.perDeploy,
    total: cost,
  };
}

function calculateEcosystemEfficiency(operational, governance, recovery, deployment) {
  const totalCost = COST_UNITS.baseInfrastructure + COST_UNITS.monitoringFixed +
    operational.total + governance.total + recovery.total + deployment.total;

  const productiveCost = operational.executionCost + deployment.total;
  const overheadCost = totalCost - productiveCost;

  const efficiency = totalCost > 0 ? Math.round((productiveCost / totalCost) * 100) : 0;

  return {
    totalCost,
    productiveCost,
    overheadCost,
    efficiency,
    infrastructureBase: COST_UNITS.baseInfrastructure,
    monitoringFixed: COST_UNITS.monitoringFixed,
  };
}

function calculatePlatformValue(ecosystem, efficiency) {
  const services = ecosystem?.serviceDomains?.length ?? 0;
  const providers = ecosystem?.providers?.length ?? 0;
  const revenueStreams = ecosystem?.revenueFlows?.length ?? 0;

  const serviceValue = services * 50;
  const providerValue = providers * 30;
  const revenueValue = revenueStreams * 40;
  const efficiencyBonus = Math.round(efficiency.efficiency * 0.5);

  const totalValue = serviceValue + providerValue + revenueValue + efficiencyBonus;

  return {
    serviceValue,
    providerValue,
    revenueValue,
    efficiencyBonus,
    totalValue,
    valueToCostratio: efficiency.totalCost > 0 ? Math.round((totalValue / efficiency.totalCost) * 100) / 100 : 0,
  };
}

export function runEconomicModel() {
  const now = new Date().toISOString();

  const ecosystem = loadJson(ECOSYSTEM_PATH);
  const serviceState = loadJson(SERVICE_STATE_PATH);
  const envState = loadJson(ENV_STATE_PATH);
  const supervisor = loadJson(SUPERVISOR_PATH);

  const operational = calculateOperationalCost(serviceState, supervisor);
  const governance = calculateGovernanceCost(envState);
  const recovery = calculateRecoveryCost(serviceState);
  const deployment = calculateDeploymentCost(supervisor);
  const efficiency = calculateEcosystemEfficiency(operational, governance, recovery, deployment);
  const platformValue = calculatePlatformValue(ecosystem, efficiency);

  const result = {
    costs: { operational, governance, recovery, deployment },
    efficiency,
    platformValue,
    summary: {
      totalCost: efficiency.totalCost,
      productiveCost: efficiency.productiveCost,
      overheadCost: efficiency.overheadCost,
      efficiency: efficiency.efficiency,
      platformValue: platformValue.totalValue,
      valueToCostratio: platformValue.valueToCostratio,
    },
    timestamp: now,
  };

  saveJson(RESULT_PATH, result);
  return result;
}

if (process.argv[1]?.endsWith('runtimeEconomicModelEngine.mjs')) {
  console.log('[economic] Runtime Economic Model Engine');
  console.log('='.repeat(55));

  const r = runEconomicModel();

  console.log('\n  Costs:');
  console.log(`    Operational: ${r.costs.operational.total} (exec: ${r.costs.operational.executionCost}, waste: ${r.costs.operational.wastedCost})`);
  console.log(`    Governance: ${r.costs.governance.total} (base: ${r.costs.governance.baseCost}, pressure: ${r.costs.governance.pressurePenalty})`);
  console.log(`    Recovery: ${r.costs.recovery.total} (recovery: ${r.costs.recovery.recoveryCost}, crash: ${r.costs.recovery.crashCost})`);
  console.log(`    Deployment: ${r.costs.deployment.total} (${r.costs.deployment.deploys} deploys)`);

  console.log('\n  Efficiency:');
  console.log(`    Total cost: ${r.efficiency.totalCost}`);
  console.log(`    Productive: ${r.efficiency.productiveCost}`);
  console.log(`    Overhead: ${r.efficiency.overheadCost}`);
  console.log(`    Efficiency: ${r.efficiency.efficiency}%`);

  console.log('\n  Platform value:');
  console.log(`    Value: ${r.platformValue.totalValue}`);
  console.log(`    Value/cost ratio: ${r.platformValue.valueToCostratio}`);

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[economic] ${r.efficiency.efficiency >= 50 ? 'ECOSYSTEM ECONOMICALLY VIABLE' : 'ECOSYSTEM NEEDS OPTIMIZATION'}`);
  console.log('\n' + JSON.stringify({ ok: true, ...r }, null, 2));
}
