#!/usr/bin/env node
/**
 * Runtime Intelligence Engine
 *
 * Analyzes operational patterns, detects anomalies, generates
 * optimization recommendations, and produces operational forecasts
 * from event history, audit log, and orchestration state.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const EVENT_LOG = path.resolve(REPO_ROOT, 'runtime_data/runtime-event-log.json');
const AUDIT_LOG = path.resolve(REPO_ROOT, 'runtime_data/runtime-repair-audit-log.json');
const ORCHESTRATION = path.resolve(REPO_ROOT, 'runtime_data/runtime-orchestration-state.json');
const HEALTH_GRAPH = path.resolve(REPO_ROOT, 'runtime_data/runtime-federation-health-graph.json');
const PATTERN_MEMORY = path.resolve(REPO_ROOT, 'runtime_data/runtime-pattern-memory.json');
const INTEL_GRAPH = path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-intelligence-graph.json');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return []; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function analyzePatterns(events, auditLog) {
  const patterns = {
    recurringFailures: [],
    recurringDrift: [],
    recurringCongestion: [],
    recurringRepair: [],
    deployInstability: [],
    recoveryEffectiveness: [],
    operationalHotspots: [],
  };

  const failEvents = events.filter(e => e.type === 'runtime.failed');
  if (failEvents.length >= 2) {
    patterns.recurringFailures.push({ count: failEvents.length, pattern: 'repeated_failure', trend: failEvents.length > 3 ? 'escalating' : 'stable' });
  }

  const driftEvents = events.filter(e => e.type === 'runtime.drift');
  if (driftEvents.length >= 2) {
    patterns.recurringDrift.push({ count: driftEvents.length, pattern: 'repeated_drift', trend: driftEvents.length > 5 ? 'escalating' : 'stable' });
  }

  const pressureSpikes = events.filter(e => e.type === 'runtime.pressure_spike');
  if (pressureSpikes.length >= 2) {
    patterns.recurringCongestion.push({ count: pressureSpikes.length, pattern: 'pressure_spikes' });
  }

  const repairEvents = events.filter(e => e.type === 'runtime.repaired');
  if (repairEvents.length >= 2) {
    patterns.recurringRepair.push({ count: repairEvents.length, pattern: 'repeated_repair' });
  }

  const deployEvents = events.filter(e => e.type === 'runtime.deployed');
  const rollbackEvents = events.filter(e => e.type === 'runtime.rollback');
  if (rollbackEvents.length > 0 && deployEvents.length > 0) {
    const ratio = rollbackEvents.length / Math.max(deployEvents.length, 1);
    patterns.deployInstability.push({ deploys: deployEvents.length, rollbacks: rollbackEvents.length, ratio: Math.round(ratio * 100) / 100 });
  }

  const recoveredEvents = events.filter(e => e.type === 'runtime.recovered');
  const successRate = auditLog.length > 0 ? auditLog.filter(a => a.verificationPass).length / auditLog.length : 1;
  patterns.recoveryEffectiveness.push({ recoveries: recoveredEvents.length, auditEntries: auditLog.length, successRate: Math.round(successRate * 100) });

  const typeCounts = {};
  for (const e of events) {
    typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
  }
  const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  patterns.operationalHotspots = sorted.slice(0, 5).map(([type, count]) => ({ type, count }));

  return patterns;
}

function detectAnomalies(events, orchestration) {
  const anomalies = [];

  const stormEvents = events.filter(e => e.type === 'runtime.storm_detected');
  if (stormEvents.length > 0) {
    anomalies.push({ type: 'event_storm', severity: 'high', count: stormEvents.length });
  }

  const blockEvents = events.filter(e => e.type === 'runtime.blocked');
  if (blockEvents.length > 2) {
    anomalies.push({ type: 'repeated_blocks', severity: 'medium', count: blockEvents.length });
  }

  if (orchestration?.pressureScore > 60) {
    anomalies.push({ type: 'elevated_pressure', severity: 'medium', value: orchestration.pressureScore });
  }

  if (orchestration?.violations > 0) {
    anomalies.push({ type: 'active_violations', severity: 'high', count: orchestration.violations });
  }

  return anomalies;
}

function generateRecommendations(patterns, anomalies, orchestration) {
  const recommendations = [];

  if (patterns.recurringFailures.length > 0) {
    recommendations.push({ domain: 'reliability', action: 'Investigate recurring failure root cause', priority: 'high' });
  }
  if (patterns.recurringDrift.length > 0 && patterns.recurringDrift[0].trend === 'escalating') {
    recommendations.push({ domain: 'drift', action: 'Escalating drift pattern — review topology consistency', priority: 'high' });
  }
  if (patterns.deployInstability.length > 0 && patterns.deployInstability[0].ratio > 0.3) {
    recommendations.push({ domain: 'deploy', action: 'High rollback ratio — strengthen pre-deploy verification', priority: 'medium' });
  }
  if (orchestration?.pressureScore > 40) {
    recommendations.push({ domain: 'pressure', action: 'Elevated governance pressure — consider throttling non-critical operations', priority: 'medium' });
  }
  if (patterns.recurringRepair.length > 0 && patterns.recurringRepair[0].count > 3) {
    recommendations.push({ domain: 'repair', action: 'Frequent repairs suggest underlying structural issue', priority: 'high' });
  }

  if (recommendations.length === 0) {
    recommendations.push({ domain: 'general', action: 'Runtime operating within normal parameters', priority: 'low' });
  }

  return recommendations;
}

function deriveAdaptiveMode(anomalies, orchestration, patterns) {
  if (anomalies.some(a => a.severity === 'high')) return 'stabilizing';
  if (patterns.recurringFailures.length > 0 || patterns.recurringDrift.length > 0) return 'adaptive';
  if (orchestration?.pressureScore > 50) return 'degraded-adaptive';
  if (patterns.operationalHotspots.length === 0) return 'self-optimizing';
  return 'predictive';
}

function buildIntelligenceGraph(patterns, orchestration, healthGraph) {
  const nodes = [
    { id: 'registry', layer: 'data', health: healthGraph?.nodes?.find(n => n.id === 'registry')?.health ?? 'unknown' },
    { id: 'memory', layer: 'data', health: 'operational' },
    { id: 'pressure', layer: 'governance', value: orchestration?.pressureScore ?? 0 },
    { id: 'drift', layer: 'monitoring', state: orchestration?.driftState ?? 'unknown' },
    { id: 'repair', layer: 'execution', state: orchestration?.activeRepairState ?? 'idle' },
    { id: 'deployment', layer: 'execution', state: orchestration?.activeDeployState ?? 'idle' },
    { id: 'governance', layer: 'governance', mode: orchestration?.governanceState ?? 'normal' },
    { id: 'recovery', layer: 'execution', state: orchestration?.recoveryState ?? null },
    { id: 'throughput', layer: 'performance', loopCount: orchestration?.loopCount ?? 0 },
  ];

  const edges = [
    { from: 'registry', to: 'drift', relation: 'monitors' },
    { from: 'drift', to: 'repair', relation: 'triggers' },
    { from: 'repair', to: 'deployment', relation: 'gates' },
    { from: 'deployment', to: 'governance', relation: 'reports_to' },
    { from: 'governance', to: 'pressure', relation: 'computes' },
    { from: 'pressure', to: 'throughput', relation: 'constrains' },
    { from: 'memory', to: 'registry', relation: 'syncs_with' },
    { from: 'recovery', to: 'repair', relation: 'feeds' },
    { from: 'throughput', to: 'governance', relation: 'informs' },
  ];

  return { nodes, edges, timestamp: new Date().toISOString() };
}

export function runIntelligence() {
  const events = loadJson(EVENT_LOG) ?? [];
  const auditLog = loadJson(AUDIT_LOG) ?? [];
  const orchestration = Array.isArray(loadJson(ORCHESTRATION)) ? {} : loadJson(ORCHESTRATION);
  const healthGraph = Array.isArray(loadJson(HEALTH_GRAPH)) ? {} : loadJson(HEALTH_GRAPH);

  const patterns = analyzePatterns(events, auditLog);
  const anomalies = detectAnomalies(events, orchestration);
  const recommendations = generateRecommendations(patterns, anomalies, orchestration);
  const adaptiveMode = deriveAdaptiveMode(anomalies, orchestration, patterns);
  const intelligenceGraph = buildIntelligenceGraph(patterns, orchestration, healthGraph);

  saveJson(PATTERN_MEMORY, { patterns, analysisTimestamp: new Date().toISOString(), eventCount: events.length, auditCount: auditLog.length });
  saveJson(INTEL_GRAPH, intelligenceGraph);

  return { patterns, anomalies, recommendations, adaptiveMode, intelligenceGraph, eventCount: events.length, auditCount: auditLog.length };
}

if (process.argv[1]?.endsWith('runtimeIntelligenceEngine.mjs')) {
  console.log('[intelligence] Runtime Intelligence Engine');
  console.log('='.repeat(60));

  const result = runIntelligence();

  console.log(`\n  Adaptive Mode: ${result.adaptiveMode}`);
  console.log(`  Events analyzed: ${result.eventCount}`);
  console.log(`  Audit entries: ${result.auditCount}`);

  console.log('\n  Patterns:');
  for (const [key, val] of Object.entries(result.patterns)) {
    if (val.length > 0) console.log(`    ${key}: ${JSON.stringify(val)}`);
    else console.log(`    ${key}: (none)`);
  }

  console.log(`\n  Anomalies: ${result.anomalies.length}`);
  for (const a of result.anomalies) console.log(`    [${a.severity}] ${a.type}`);

  console.log('\n  Recommendations:');
  for (const r of result.recommendations) console.log(`    [${r.priority}] ${r.domain}: ${r.action}`);

  console.log(`\n  Intelligence Graph: ${result.intelligenceGraph.nodes.length} nodes, ${result.intelligenceGraph.edges.length} edges`);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[intelligence] Mode: ${result.adaptiveMode.toUpperCase()}`);
  console.log('\n' + JSON.stringify(result, null, 2));
}
