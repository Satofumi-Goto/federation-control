#!/usr/bin/env node
/**
 * Runtime Governance Pressure Engine
 *
 * Computes federation governance pressure from queue, drift,
 * deploy instability, repair load, congestion, and dependency failures.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const SNAPSHOT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-snapshot.json');
const AUDIT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-repair-audit-log.json');
const HEALTH_GRAPH_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-federation-health-graph.json');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Compute per-dimension pressure scores (0-100).
 */
export function computePressure(snapshot, auditLog) {
  const scores = {};
  const recent = (auditLog ?? []).slice(-10);

  // Queue pressure: based on proposal count and unresolved state
  const proposals = snapshot?.repairProposals ?? 0;
  scores.queue = clamp(proposals * 20);

  // Drift pressure: based on verification failures and state
  const verifyFail = snapshot?.verificationPass === false;
  const contentFail = snapshot?.contentGuardPass === false;
  scores.drift = clamp((verifyFail ? 40 : 0) + (contentFail ? 30 : 0) + (snapshot?.state === 'drifting' ? 30 : 0));

  // Deploy instability: based on recent audit decision variance
  const recentDecisions = recent.map(e => e.decision).filter(Boolean);
  const uniqueDecisions = new Set(recentDecisions).size;
  const hasRollback = recentDecisions.includes('rollback');
  const hasBlock = recentDecisions.includes('block');
  scores.deployInstability = clamp(uniqueDecisions * 10 + (hasRollback ? 30 : 0) + (hasBlock ? 40 : 0));

  // Repair load: based on recent repairs applied
  const repairsApplied = recent.filter(e => e.applied).length;
  scores.repairLoad = clamp(repairsApplied * 15);

  // Congestion: dirty files as proxy
  const dirtyFiles = snapshot?.dirtyFiles ?? 0;
  scores.congestion = clamp(dirtyFiles > 30 ? 80 : dirtyFiles > 15 ? 40 : dirtyFiles > 5 ? 15 : 0);

  // Dependency failures: based on verification sub-check failures
  const verifyState = snapshot?.verificationPass;
  scores.dependencyFailures = verifyState === false ? 60 : 0;

  return scores;
}

/**
 * Aggregate individual pressures into a single governance pressure score.
 */
export function computeGovernancePressure(scores) {
  const weights = {
    queue: 0.15,
    drift: 0.20,
    deployInstability: 0.25,
    repairLoad: 0.10,
    congestion: 0.10,
    dependencyFailures: 0.20,
  };

  let total = 0;
  for (const [key, weight] of Object.entries(weights)) {
    total += (scores[key] ?? 0) * weight;
  }

  const pressure = Math.round(clamp(total));

  let level;
  if (pressure <= 10) level = 'nominal';
  else if (pressure <= 30) level = 'low';
  else if (pressure <= 55) level = 'moderate';
  else if (pressure <= 80) level = 'high';
  else level = 'critical';

  return { pressure, level, scores };
}

/**
 * Update the federation health graph with current pressure data.
 */
function updateHealthGraph(pressureResult, snapshot) {
  const nodes = [
    { id: 'registry', health: snapshot?.verificationPass ? 'healthy' : 'degraded', pressure: pressureResult.scores.queue },
    { id: 'topology', health: snapshot?.verificationPass ? 'healthy' : 'degraded', pressure: pressureResult.scores.drift },
    { id: 'deploy', health: snapshot?.state === 'healthy' ? 'healthy' : 'warning', pressure: pressureResult.scores.deployInstability },
    { id: 'repair', health: 'operational', pressure: pressureResult.scores.repairLoad },
    { id: 'governance', health: pressureResult.level === 'nominal' || pressureResult.level === 'low' ? 'healthy' : 'stressed', pressure: pressureResult.pressure },
  ];

  const healthGraph = {
    governancePressure: pressureResult.pressure,
    governanceLevel: pressureResult.level,
    nodes,
    executionPressure: pressureResult.scores.queue,
    repairPressure: pressureResult.scores.repairLoad,
    deployPressure: pressureResult.scores.deployInstability,
    propagationSeverity: pressureResult.scores.drift,
    dependencyHealth: pressureResult.scores.dependencyFailures === 0 ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
  };

  saveJson(HEALTH_GRAPH_PATH, healthGraph);
  return healthGraph;
}

export function runPressureEngine() {
  const snapshot = loadJson(SNAPSHOT_PATH);
  const auditLog = loadJson(AUDIT_PATH) ?? [];

  const scores = computePressure(snapshot, auditLog);
  const result = computeGovernancePressure(scores);
  const healthGraph = updateHealthGraph(result, snapshot);

  return { ...result, healthGraph };
}

if (process.argv[1]?.endsWith('runtimeGovernancePressureEngine.mjs')) {
  console.log('[pressure] Runtime Governance Pressure Engine');
  console.log('='.repeat(50));

  const result = runPressureEngine();

  console.log(`\n  Governance Pressure: ${result.pressure}/100 (${result.level})`);
  console.log('\n  Dimension Scores:');
  for (const [dim, score] of Object.entries(result.scores)) {
    const bar = '█'.repeat(Math.round(score / 5)) + '░'.repeat(20 - Math.round(score / 5));
    console.log(`    ${dim.padEnd(22)} ${bar} ${score}`);
  }

  console.log('\n  Health Graph:');
  for (const node of result.healthGraph.nodes) {
    console.log(`    ${node.id.padEnd(15)} health=${node.health.padEnd(10)} pressure=${node.pressure}`);
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`[pressure] Level: ${result.level.toUpperCase()}`);
  console.log('\n' + JSON.stringify(result, null, 2));
}
