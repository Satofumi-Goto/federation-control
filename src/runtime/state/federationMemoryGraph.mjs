/**
 * Federation Memory Graph
 *
 * Converts snapshot, drift timeline, repair history, rollback lineage,
 * and dependency data into a unified graph structure for visualization.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLatestSnapshot } from './runtimeSnapshotEngine.mjs';
import { getDriftSummary } from './driftTimelineEngine.mjs';
import { getRepairSummary } from './repairHistoryEngine.mjs';
import { getRollbackReadiness } from './rollbackLineageEngine.mjs';
import { getCurrentState, getTransitionHistory } from './stateTransitionEvaluator.mjs';
import { getHistorySummary } from './federationStateMemory.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const STATE_DIR = path.resolve(REPO_ROOT, 'runtime_data/state');
const GRAPH_PATH = path.resolve(STATE_DIR, 'federation-memory-graph.json');

function loadJson(relPath) {
  try { return JSON.parse(fs.readFileSync(path.resolve(REPO_ROOT, 'runtime_data', relPath), 'utf8')); }
  catch { return null; }
}

export function buildMemoryGraph() {
  const snapshot = loadLatestSnapshot();
  const driftSummary = getDriftSummary();
  const repairSummary = getRepairSummary();
  const rollback = getRollbackReadiness();
  const currentState = getCurrentState();
  const transitions = getTransitionHistory();
  const historySummary = getHistorySummary();

  const twin = loadJson('runtime-operational-digital-twin-graph.json');
  const twinNodes = twin?.nodes ?? [];
  const twinDeps = twin?.dependencies ?? [];

  const nodes = [];
  const edges = [];

  nodes.push({
    id: 'state-engine',
    type: 'core',
    label: '状態エンジン',
    state: currentState.id,
    stateLabel: currentState.label,
    severity: currentState.severity,
  });

  nodes.push({
    id: 'snapshot',
    type: 'engine',
    label: 'スナップショット',
    snapshotId: snapshot?.id ?? null,
    timestamp: snapshot?.timestamp ?? null,
    commitSha: snapshot?.commitSha ?? null,
  });
  edges.push({ from: 'state-engine', to: 'snapshot', type: 'captures' });

  nodes.push({
    id: 'drift',
    type: 'engine',
    label: 'ドリフト',
    totalEvents: driftSummary.totalEvents,
    activeEvents: driftSummary.activeEvents,
    resolvedEvents: driftSummary.resolvedEvents,
    avgRecoveryMs: driftSummary.avgRecoveryMs,
  });
  edges.push({ from: 'state-engine', to: 'drift', type: 'monitors' });

  nodes.push({
    id: 'repair',
    type: 'engine',
    label: '改修履歴',
    totalEntries: repairSummary.totalEntries,
    verifyPassRate: repairSummary.verifyPassRate,
  });
  edges.push({ from: 'state-engine', to: 'repair', type: 'tracks' });

  nodes.push({
    id: 'rollback',
    type: 'engine',
    label: 'ロールバック',
    safepointCount: rollback.safepointCount,
    rollbackAvailable: rollback.rollbackAvailable,
    blastRadius: rollback.blastRadius?.risk ?? 'unknown',
    recommendation: rollback.recommendation,
  });
  edges.push({ from: 'state-engine', to: 'rollback', type: 'manages' });

  nodes.push({
    id: 'history',
    type: 'engine',
    label: '状態メモリ',
    totalEntries: historySummary.totalEntries,
    maxEntries: historySummary.maxEntries,
  });
  edges.push({ from: 'state-engine', to: 'history', type: 'stores' });

  nodes.push({
    id: 'transitions',
    type: 'engine',
    label: '状態遷移',
    totalTransitions: transitions.totalTransitions,
    currentState: transitions.currentState,
    currentLabel: transitions.currentLabel,
    distribution: transitions.stateDistribution,
  });
  edges.push({ from: 'state-engine', to: 'transitions', type: 'evaluates' });

  for (const tn of twinNodes) {
    nodes.push({
      id: `domain-${tn.id}`,
      type: 'domain',
      label: tn.domain?.replace(/-runtime$/, '') ?? tn.id,
      state: tn.state,
      health: tn.health,
      pressure: tn.pressure,
      congestion: tn.congestion,
    });
    edges.push({ from: 'state-engine', to: `domain-${tn.id}`, type: 'observes' });
  }

  for (const td of twinDeps) {
    edges.push({
      from: `domain-${td.from}`,
      to: `domain-${td.to}`,
      type: td.type,
      healthy: td.healthy,
    });
  }

  const graph = {
    version: 1,
    timestamp: new Date().toISOString(),
    snapshotId: snapshot?.id ?? null,
    currentState: currentState.id,
    currentStateLabel: currentState.label,
    nodes,
    edges,
    summary: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      engineNodes: nodes.filter(n => n.type === 'engine').length,
      domainNodes: nodes.filter(n => n.type === 'domain').length,
    },
  };

  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(GRAPH_PATH, JSON.stringify(graph, null, 2) + '\n', 'utf8');
  return graph;
}

// ── CLI ──
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  console.log('[memory-graph] Building Federation Memory Graph...');
  const graph = buildMemoryGraph();
  console.log(`[memory-graph] State: ${graph.currentState} (${graph.currentStateLabel})`);
  console.log(`[memory-graph] Nodes: ${graph.summary.totalNodes} (${graph.summary.engineNodes} engines, ${graph.summary.domainNodes} domains)`);
  console.log(`[memory-graph] Edges: ${graph.summary.totalEdges}`);
  console.log(`[memory-graph] Saved to ${GRAPH_PATH}`);
}
