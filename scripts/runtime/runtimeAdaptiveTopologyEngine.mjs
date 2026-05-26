#!/usr/bin/env node
/**
 * Runtime Adaptive Topology Engine
 *
 * Dynamically rebalances Runtime topology, execution queues,
 * governance pressure, and orchestration pressure based on
 * evolution analysis and governance evaluations.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runEvolutionAnalysis } from './runtimeEvolutionEngine.mjs';
import { runGovernanceEvaluation } from './runtimeEvolutionGovernance.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const TOPOLOGY_RESULT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-adaptive-topology-result.json');
const EVOLUTION_MODEL_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-structural-evolution-model.json');
const ENV_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-environment-state.json');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function rebalanceTopology(analysis) {
  const actions = [];
  const topo = analysis.topologyAnalysis;

  if (topo.density > 0.7) {
    actions.push({ type: 'edge-pruning', target: 'topology-graph', detail: `Density ${topo.density} exceeds 0.7 — recommend pruning low-weight edges`, priority: 'medium' });
  }

  if (topo.nodes > 30) {
    actions.push({ type: 'node-clustering', target: 'topology-graph', detail: `${topo.nodes} nodes — recommend clustering related modules`, priority: 'low' });
  }

  return actions;
}

function rebalanceExecution(analysis) {
  const actions = [];

  const queueBottlenecks = analysis.bottlenecks.filter(b => b.area === 'queue' || b.area === 'queue-pressure');
  if (queueBottlenecks.length > 0) {
    actions.push({ type: 'queue-scale', target: 'execution-queue', detail: 'Increase queue throughput capacity', priority: 'high' });
  }

  const executionBottlenecks = analysis.bottlenecks.filter(b => b.area === 'execution');
  if (executionBottlenecks.length > 0) {
    actions.push({ type: 'execution-backoff', target: 'loop-supervisor', detail: 'Apply progressive backoff for consecutive failures', priority: 'medium' });
  }

  return actions;
}

function rebalanceQueues(analysis) {
  const actions = [];

  if (!analysis.repairEfficiency.efficient) {
    const repairIssue = analysis.repairEfficiency.issues.find(i => i.issue === 'repair-dominated');
    if (repairIssue) {
      actions.push({ type: 'priority-shift', target: 'execution-queue', detail: `Repair ratio ${repairIssue.ratio}% — shift priority to build/verify`, priority: 'medium' });
    }

    const blockIssue = analysis.repairEfficiency.issues.find(i => i.issue === 'high-block-rate');
    if (blockIssue) {
      actions.push({ type: 'throttle-relax', target: 'loop-supervisor', detail: `Block rate ${blockIssue.rate}% — relax throttling during healthy periods`, priority: 'low' });
    }
  }

  return actions;
}

function rebalanceGovernancePressure(analysis) {
  const actions = [];
  const pressure = analysis.pressure;

  if (pressure.deploy > 60) {
    actions.push({ type: 'deploy-throttle', target: 'governance', detail: `Deploy pressure ${pressure.deploy}% — throttle deploy frequency`, priority: 'high' });
  }

  if (pressure.recovery > 60) {
    actions.push({ type: 'recovery-cooldown', target: 'recovery-engine', detail: `Recovery pressure ${pressure.recovery}% — extend recovery cooldown`, priority: 'medium' });
  }

  if (pressure.governance > 60) {
    actions.push({ type: 'governance-frequency', target: 'governance', detail: `Governance pressure ${pressure.governance ?? 0}% — reduce evaluation frequency`, priority: 'low' });
  }

  return actions;
}

function rebalanceOrchestrationPressure(analysis) {
  const actions = [];

  const crashSignal = analysis.instability.find(s => s.type === 'crash-history');
  if (crashSignal) {
    actions.push({ type: 'orchestration-safety', target: 'orchestration', detail: 'Crash history detected — increase safety margins for orchestration', priority: 'high' });
  }

  const restartSignal = analysis.instability.find(s => s.type === 'restart-frequency');
  if (restartSignal) {
    actions.push({ type: 'restart-analysis', target: 'orchestration', detail: 'Excessive restarts — investigate root cause before rebalancing', priority: 'medium' });
  }

  return actions;
}

export function runAdaptiveTopology() {
  const now = new Date().toISOString();
  const analysis = runEvolutionAnalysis();
  const governance = runGovernanceEvaluation();

  const topologyActions = rebalanceTopology(analysis);
  const executionActions = rebalanceExecution(analysis);
  const queueActions = rebalanceQueues(analysis);
  const governancePressureActions = rebalanceGovernancePressure(analysis);
  const orchestrationActions = rebalanceOrchestrationPressure(analysis);

  const allActions = [
    ...topologyActions,
    ...executionActions,
    ...queueActions,
    ...governancePressureActions,
    ...orchestrationActions,
  ];

  const blockedProposals = governance.evaluations.filter(e => e.decision === 'blocked');

  // Update evolution model with topology snapshot
  const model = loadJson(EVOLUTION_MODEL_PATH) ?? {};
  model.orchestration = model.orchestration ?? {};
  model.orchestration.lastRebalance = now;
  model.orchestration.actionCount = allActions.length;
  model.lastUpdated = now;
  saveJson(EVOLUTION_MODEL_PATH, model);

  const result = {
    actions: allActions,
    totalActions: allActions.length,
    actionsByArea: {
      topology: topologyActions.length,
      execution: executionActions.length,
      queues: queueActions.length,
      governancePressure: governancePressureActions.length,
      orchestration: orchestrationActions.length,
    },
    prioritySummary: {
      high: allActions.filter(a => a.priority === 'high').length,
      medium: allActions.filter(a => a.priority === 'medium').length,
      low: allActions.filter(a => a.priority === 'low').length,
    },
    governanceBlocked: blockedProposals.length,
    safetyLocksEnforced: governance.summary.safetyLocks.allEnforced,
    registryCanonical: governance.registryCanonical,
    orchestrationStable: allActions.filter(a => a.priority === 'high').length === 0,
    timestamp: now,
  };

  saveJson(TOPOLOGY_RESULT_PATH, result);
  return result;
}

if (process.argv[1]?.endsWith('runtimeAdaptiveTopologyEngine.mjs')) {
  console.log('[topology] Runtime Adaptive Topology Engine');
  console.log('='.repeat(55));

  const result = runAdaptiveTopology();

  if (result.totalActions === 0) {
    console.log('\n  (no rebalancing actions needed — all subsystems balanced)');
  } else {
    for (const a of result.actions) {
      console.log(`\n  [${a.priority.toUpperCase()}] ${a.type} → ${a.target}`);
      console.log(`    ${a.detail}`);
    }
  }

  console.log('\n  Summary:');
  console.log(`    Total actions: ${result.totalActions}`);
  console.log(`    Topology: ${result.actionsByArea.topology}`);
  console.log(`    Execution: ${result.actionsByArea.execution}`);
  console.log(`    Queues: ${result.actionsByArea.queues}`);
  console.log(`    Governance pressure: ${result.actionsByArea.governancePressure}`);
  console.log(`    Orchestration: ${result.actionsByArea.orchestration}`);
  console.log(`    Priority: high=${result.prioritySummary.high} medium=${result.prioritySummary.medium} low=${result.prioritySummary.low}`);
  console.log(`    Governance blocked: ${result.governanceBlocked}`);
  console.log(`    Safety locks enforced: ${result.safetyLocksEnforced}`);
  console.log(`    Registry canonical: ${result.registryCanonical}`);
  console.log(`    Orchestration stable: ${result.orchestrationStable}`);

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[topology] ${result.orchestrationStable ? 'ORCHESTRATION STABLE' : 'REBALANCING RECOMMENDED'}`);
  console.log('\n' + JSON.stringify({ ok: true, ...result }, null, 2));
}
