#!/usr/bin/env node
/**
 * Runtime Evolution Engine
 *
 * Analyzes Runtime operational history to identify bottlenecks,
 * instability patterns, and repair inefficiencies. Generates
 * evolution signals for the proposal engine.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const EVOLUTION_MODEL_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-structural-evolution-model.json');
const SNAPSHOT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-snapshot.json');
const SERVICE_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-service-state.json');
const QUEUE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-execution-queue.json');
const SUPERVISOR_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-trigger-supervisor-state.json');
const ENV_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-environment-state.json');
const PROFILE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-startup-profile.json');
const TOPOLOGY_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-intelligence-graph.json');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function analyzeBottlenecks() {
  const bottlenecks = [];

  const queue = loadJson(QUEUE_PATH);
  if (queue) {
    if (queue.items?.length > 10) bottlenecks.push({ area: 'queue', severity: 'high', detail: `Queue depth ${queue.items.length} — execution throughput bottleneck` });
    if (queue.paused) bottlenecks.push({ area: 'queue', severity: 'critical', detail: `Queue paused: ${queue.pauseReason}` });
    if (queue.counters?.repair > 3) bottlenecks.push({ area: 'repair', severity: 'medium', detail: `${queue.counters.repair} repair cycles — possible repair loop` });
  }

  const supervisor = loadJson(SUPERVISOR_PATH);
  if (supervisor) {
    if (supervisor.consecutiveFailures > 0) bottlenecks.push({ area: 'execution', severity: supervisor.consecutiveFailures >= 3 ? 'high' : 'low', detail: `${supervisor.consecutiveFailures} consecutive failures` });
    if (supervisor.paused) bottlenecks.push({ area: 'execution', severity: 'high', detail: 'Execution supervisor paused' });
  }

  const envState = loadJson(ENV_STATE_PATH);
  if (envState?.pressure) {
    const p = envState.pressure;
    if (p.queue > 50) bottlenecks.push({ area: 'queue-pressure', severity: 'medium', detail: `Queue pressure ${p.queue}%` });
    if (p.deploy > 50) bottlenecks.push({ area: 'deploy-pressure', severity: 'medium', detail: `Deploy pressure ${p.deploy}%` });
    if (p.recovery > 50) bottlenecks.push({ area: 'recovery-pressure', severity: 'medium', detail: `Recovery pressure ${p.recovery}%` });
    if (p.memory > 70) bottlenecks.push({ area: 'memory', severity: 'high', detail: `Memory pressure ${p.memory}%` });
  }

  return bottlenecks;
}

function analyzeInstability() {
  const signals = [];

  const serviceState = loadJson(SERVICE_STATE_PATH);
  if (serviceState) {
    if (serviceState.crash?.crashCount > 0) signals.push({ type: 'crash-history', severity: 'high', detail: `${serviceState.crash.crashCount} crashes recorded` });
    if (serviceState.service?.restartCount > 3) signals.push({ type: 'restart-frequency', severity: 'medium', detail: `${serviceState.service.restartCount} restarts` });
    if (serviceState.recovery?.recoveryCount > 5) signals.push({ type: 'recovery-frequency', severity: 'high', detail: `${serviceState.recovery.recoveryCount} recoveries` });
  }

  const snapshot = loadJson(SNAPSHOT_PATH);
  if (snapshot) {
    const govPressure = snapshot.governancePressure?.composite ?? 0;
    if (govPressure > 60) signals.push({ type: 'governance-pressure', severity: 'medium', detail: `Governance pressure at ${govPressure}` });
  }

  return signals;
}

function analyzeRepairEfficiency() {
  const analysis = { efficient: true, issues: [] };

  const supervisor = loadJson(SUPERVISOR_PATH);
  if (supervisor) {
    const total = supervisor.totalExecutions ?? 0;
    const blocked = supervisor.totalBlocked ?? 0;
    if (total > 0) {
      const blockRate = blocked / (total + blocked);
      if (blockRate > 0.3) {
        analysis.efficient = false;
        analysis.issues.push({ issue: 'high-block-rate', rate: Math.round(blockRate * 100), detail: `${Math.round(blockRate * 100)}% of execution attempts blocked` });
      }
    }
  }

  const queue = loadJson(QUEUE_PATH);
  if (queue?.counters) {
    if (queue.counters.repair > 0 && queue.counters.total > 0) {
      const repairRatio = queue.counters.repair / queue.counters.total;
      if (repairRatio > 0.5) {
        analysis.efficient = false;
        analysis.issues.push({ issue: 'repair-dominated', ratio: Math.round(repairRatio * 100), detail: `${Math.round(repairRatio * 100)}% of executions are repairs` });
      }
    }
  }

  return analysis;
}

function analyzeTopology() {
  const topology = loadJson(TOPOLOGY_PATH);
  if (!topology) return { nodes: 0, edges: 0, density: 0, issues: [] };

  const nodes = topology.nodes?.length ?? 0;
  const edges = topology.edges?.length ?? 0;
  const maxEdges = nodes * (nodes - 1) / 2;
  const density = maxEdges > 0 ? Math.round((edges / maxEdges) * 100) / 100 : 0;

  const issues = [];
  if (density > 0.7) issues.push({ issue: 'high-density', density, detail: 'Topology is heavily interconnected — risk of cascade failures' });
  if (nodes > 30) issues.push({ issue: 'large-topology', nodes, detail: 'Large node count may impact orchestration performance' });

  return { nodes, edges, density, issues };
}

export function runEvolutionAnalysis() {
  const now = new Date().toISOString();

  const bottlenecks = analyzeBottlenecks();
  const instability = analyzeInstability();
  const repairEfficiency = analyzeRepairEfficiency();
  const topologyAnalysis = analyzeTopology();

  const profile = loadJson(PROFILE_PATH);
  const envState = loadJson(ENV_STATE_PATH);

  const overallHealth = bottlenecks.filter(b => b.severity === 'critical').length === 0 &&
    instability.filter(s => s.severity === 'high').length === 0;

  const evolutionSignals = [];
  if (bottlenecks.length > 0) evolutionSignals.push('bottleneck-detected');
  if (!repairEfficiency.efficient) evolutionSignals.push('repair-inefficiency');
  if (instability.length > 0) evolutionSignals.push('instability-detected');
  if (topologyAnalysis.issues.length > 0) evolutionSignals.push('topology-optimization-needed');

  // Update evolution model
  const model = loadJson(EVOLUTION_MODEL_PATH) ?? {};
  model.topology = model.topology ?? {};
  model.topology.currentNodes = topologyAnalysis.nodes;
  model.topology.currentEdges = topologyAnalysis.edges;
  model.modules = model.modules ?? {};
  model.modules.currentCount = envState?.activeModules?.length ?? 0;
  model.pressure = model.pressure ?? {};
  model.pressure.history = model.pressure.history ?? [];
  model.pressure.history.push({ timestamp: now, composite: envState?.pressure?.composite ?? 0 });
  if (model.pressure.history.length > 100) model.pressure.history = model.pressure.history.slice(-100);
  model.pressure.peakComposite = Math.max(model.pressure.peakComposite ?? 0, envState?.pressure?.composite ?? 0);
  model.lastUpdated = now;
  saveJson(EVOLUTION_MODEL_PATH, model);

  return {
    bottlenecks,
    instability,
    repairEfficiency,
    topologyAnalysis,
    evolutionSignals,
    overallHealth,
    activeModules: envState?.activeModules?.length ?? 0,
    startupMode: envState?.startupMode ?? 'unknown',
    pressure: envState?.pressure ?? {},
    timestamp: now,
  };
}

if (process.argv[1]?.endsWith('runtimeEvolutionEngine.mjs')) {
  console.log('[evolution] Runtime Evolution Engine');
  console.log('='.repeat(55));

  const result = runEvolutionAnalysis();

  console.log('\n  Bottlenecks:');
  if (result.bottlenecks.length === 0) console.log('    (none)');
  for (const b of result.bottlenecks) console.log(`    [${b.severity}] ${b.area}: ${b.detail}`);

  console.log('\n  Instability signals:');
  if (result.instability.length === 0) console.log('    (none)');
  for (const s of result.instability) console.log(`    [${s.severity}] ${s.type}: ${s.detail}`);

  console.log('\n  Repair efficiency:');
  console.log(`    Efficient: ${result.repairEfficiency.efficient}`);
  for (const i of result.repairEfficiency.issues) console.log(`    [${i.issue}] ${i.detail}`);

  console.log('\n  Topology:');
  console.log(`    Nodes: ${result.topologyAnalysis.nodes}, Edges: ${result.topologyAnalysis.edges}, Density: ${result.topologyAnalysis.density}`);
  for (const i of result.topologyAnalysis.issues) console.log(`    [${i.issue}] ${i.detail}`);

  console.log(`\n  Evolution signals: ${result.evolutionSignals.length > 0 ? result.evolutionSignals.join(', ') : '(none)'}`);
  console.log(`  Overall health: ${result.overallHealth ? 'STABLE' : 'NEEDS ATTENTION'}`);

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[evolution] ${result.overallHealth ? 'RUNTIME STABLE' : 'EVOLUTION RECOMMENDED'}`);
  console.log('\n' + JSON.stringify({ ok: true, ...result }, null, 2));
}
