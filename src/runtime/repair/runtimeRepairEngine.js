/**
 * Runtime Repair Engine
 *
 * Manages the repair lifecycle:
 *   Collapse detection → Proposal → Impact analysis → Execution → Validation
 */

import { propagateCollapse } from '../collapse/runtimeCollapseGraph.js';
import { computeImpactScore, traverseDependencyChain } from '../dependency/runtimeDependencyEngine.js';

const REPAIR_STORAGE_KEY = 'runtimeRepairQueue';

export const REPAIR_STATES = {
  PROPOSED: 'proposed',
  ANALYZING: 'analyzing',
  APPROVED: 'approved',
  EXECUTING: 'executing',
  VALIDATING: 'validating',
  COMPLETED: 'completed',
  ROLLED_BACK: 'rolled-back',
  REJECTED: 'rejected',
};

/**
 * Detect active collapses from console data and generate repair proposals.
 */
export function detectAndPropose(consoleData = {}) {
  const proposals = [];

  for (const [consoleName, data] of Object.entries(consoleData)) {
    const signal = data.collapseSignal;
    if (!signal || signal === 'none') continue;

    const rootNode = signalToNode(signal);
    if (!rootNode) continue;

    const chain = traverseDependencyChain(rootNode);
    const impact = computeImpactScore(chain);

    proposals.push({
      id: `repair-${consoleName}-${rootNode}-${Date.now()}`,
      state: REPAIR_STATES.PROPOSED,
      console: consoleName,
      collapseSignal: signal,
      rootNode,
      affectedNodes: chain.affectedNodes,
      impactScore: impact,
      priority: impact > 60 ? 'urgent' : impact > 30 ? 'high' : 'normal',
      proposedAt: new Date().toISOString(),
      actions: generateRepairActions(rootNode, chain),
    });
  }

  proposals.sort((a, b) => b.impactScore - a.impactScore);
  return proposals;
}

function signalToNode(signal) {
  const map = {
    'Queue delay': 'queue',
    'ETA drift': 'eta',
    'Dispatch failure': 'dispatch',
    'ODD failure': 'odd',
    'Node congestion': 'node',
    'Constraint violation': 'constraint',
  };
  return map[signal] ?? null;
}

function generateRepairActions(rootNode, chain) {
  const actions = [
    {
      step: 1,
      action: 'isolate',
      target: rootNode,
      description: `Isolate ${rootNode} from downstream propagation`,
    },
  ];

  const highImpact = chain.chain.filter((c) => c.severity === 'high');
  for (const node of highImpact) {
    actions.push({
      step: actions.length + 1,
      action: 'mitigate',
      target: node.nodeId,
      description: `Mitigate ${node.fromEdge} propagation (rate: ${Math.round(node.propagationRate * 100)}%)`,
    });
  }

  actions.push({
    step: actions.length + 1,
    action: 'restore',
    target: rootNode,
    description: `Restore ${rootNode} to operational state`,
  });

  actions.push({
    step: actions.length + 1,
    action: 'validate',
    target: 'all',
    description: 'Validate federation graph stability',
  });

  return actions;
}

/**
 * Analyze the impact of a proposed repair before execution.
 */
export function analyzeRepairImpact(proposal) {
  const downstream = propagateCollapse(proposal.rootNode);
  const sideEffects = downstream.filter(
    (d) => !proposal.affectedNodes.includes(d.nodeId),
  );

  return {
    proposalId: proposal.id,
    directImpact: proposal.affectedNodes.length,
    sideEffects: sideEffects.map((s) => s.nodeId),
    estimatedDuration: proposal.actions.length * 5,
    rollbackComplexity: proposal.impactScore > 50 ? 'high' : 'low',
    recommendation: proposal.impactScore > 60 ? 'proceed-with-caution' : 'safe-to-proceed',
  };
}

export function loadRepairQueue() {
  try {
    return JSON.parse(localStorage.getItem(REPAIR_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveRepairToQueue(proposal) {
  const queue = loadRepairQueue();
  queue.push(proposal);
  localStorage.setItem(REPAIR_STORAGE_KEY, JSON.stringify(queue));
  return queue;
}

export function updateRepairState(repairId, newState) {
  const queue = loadRepairQueue();
  const item = queue.find((r) => r.id === repairId);
  if (item) {
    item.state = newState;
    item.updatedAt = new Date().toISOString();
    localStorage.setItem(REPAIR_STORAGE_KEY, JSON.stringify(queue));
  }
  return item;
}
