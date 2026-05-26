#!/usr/bin/env node
/**
 * Runtime Evolution Proposal Engine
 *
 * Generates concrete evolution proposals based on analysis
 * from the Evolution Engine. Each proposal includes impact
 * assessment and safety classification.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runEvolutionAnalysis } from './runtimeEvolutionEngine.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const PROPOSALS_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-evolution-proposals.json');

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

const PROPOSAL_TYPES = {
  'module-restructure':    { risk: 'medium', requiresApproval: true },
  'queue-optimization':    { risk: 'low',    requiresApproval: false },
  'propagation-optimize':  { risk: 'low',    requiresApproval: false },
  'governance-optimize':   { risk: 'medium', requiresApproval: true },
  'recovery-optimize':     { risk: 'low',    requiresApproval: false },
  'topology-restructure':  { risk: 'high',   requiresApproval: true },
  'orchestration-balance': { risk: 'medium', requiresApproval: false },
  'pressure-relief':       { risk: 'low',    requiresApproval: false },
};

function generateProposals(analysis) {
  const proposals = [];
  let seq = 1;

  // Queue bottleneck → queue optimization
  for (const b of analysis.bottlenecks) {
    if (b.area === 'queue' || b.area === 'queue-pressure') {
      proposals.push({
        id: `evo-${seq++}`,
        type: 'queue-optimization',
        title: 'Queue throughput optimization',
        description: `Queue bottleneck detected: ${b.detail}. Propose increasing maxExecutionsPerHour or reducing minIntervalMs.`,
        impact: { area: 'execution-queue', risk: 'low', stabilityImpact: 'positive' },
        action: { target: 'runtime_data/runtime-trigger-supervisor-state.json', operation: 'parameter-adjust' },
        ...PROPOSAL_TYPES['queue-optimization'],
      });
    }

    if (b.area === 'memory') {
      proposals.push({
        id: `evo-${seq++}`,
        type: 'pressure-relief',
        title: 'Memory pressure relief',
        description: `${b.detail}. Propose pruning execution history and reducing queue retention.`,
        impact: { area: 'environment', risk: 'low', stabilityImpact: 'positive' },
        action: { target: 'runtime_data', operation: 'prune-history' },
        ...PROPOSAL_TYPES['pressure-relief'],
      });
    }

    if (b.area === 'execution') {
      proposals.push({
        id: `evo-${seq++}`,
        type: 'recovery-optimize',
        title: 'Execution failure recovery',
        description: `${b.detail}. Propose extending cooldown and adding retry backoff.`,
        impact: { area: 'execution', risk: 'low', stabilityImpact: 'positive' },
        action: { target: 'loop-supervisor', operation: 'parameter-adjust' },
        ...PROPOSAL_TYPES['recovery-optimize'],
      });
    }
  }

  // Repair inefficiency → orchestration balancing
  if (!analysis.repairEfficiency.efficient) {
    for (const issue of analysis.repairEfficiency.issues) {
      if (issue.issue === 'repair-dominated') {
        proposals.push({
          id: `evo-${seq++}`,
          type: 'orchestration-balance',
          title: 'Reduce repair-dominated execution',
          description: `${issue.detail}. Propose capping autonomous repair cycles and prioritizing build/verify.`,
          impact: { area: 'orchestration', risk: 'medium', stabilityImpact: 'positive' },
          action: { target: 'execution-queue', operation: 'priority-rebalance' },
          ...PROPOSAL_TYPES['orchestration-balance'],
        });
      }
      if (issue.issue === 'high-block-rate') {
        proposals.push({
          id: `evo-${seq++}`,
          type: 'queue-optimization',
          title: 'Reduce execution block rate',
          description: `${issue.detail}. Propose relaxing throttling when consecutive failures are zero.`,
          impact: { area: 'execution-queue', risk: 'low', stabilityImpact: 'positive' },
          action: { target: 'loop-supervisor', operation: 'parameter-adjust' },
          ...PROPOSAL_TYPES['queue-optimization'],
        });
      }
    }
  }

  // Instability → governance or recovery optimization
  for (const signal of analysis.instability) {
    if (signal.type === 'crash-history' || signal.type === 'recovery-frequency') {
      proposals.push({
        id: `evo-${seq++}`,
        type: 'recovery-optimize',
        title: `Address ${signal.type}`,
        description: `${signal.detail}. Propose adding crash root-cause analysis and extending recovery cooldown.`,
        impact: { area: 'recovery', risk: 'low', stabilityImpact: 'positive' },
        action: { target: 'recovery-engine', operation: 'enhance' },
        ...PROPOSAL_TYPES['recovery-optimize'],
      });
    }
    if (signal.type === 'governance-pressure') {
      proposals.push({
        id: `evo-${seq++}`,
        type: 'governance-optimize',
        title: 'Governance pressure reduction',
        description: `${signal.detail}. Propose rebalancing governance evaluation frequency.`,
        impact: { area: 'governance', risk: 'medium', stabilityImpact: 'neutral' },
        action: { target: 'governance-orchestrator', operation: 'parameter-adjust' },
        ...PROPOSAL_TYPES['governance-optimize'],
      });
    }
  }

  // Topology issues
  for (const issue of analysis.topologyAnalysis.issues) {
    proposals.push({
      id: `evo-${seq++}`,
      type: 'topology-restructure',
      title: `Topology: ${issue.issue}`,
      description: `${issue.detail}. Propose selective edge pruning to reduce cascade risk.`,
      impact: { area: 'topology', risk: 'high', stabilityImpact: 'uncertain' },
      action: { target: 'topology-graph', operation: 'restructure' },
      ...PROPOSAL_TYPES['topology-restructure'],
    });
  }

  // Stable system → no proposals needed, generate health report
  if (proposals.length === 0 && analysis.overallHealth) {
    proposals.push({
      id: `evo-${seq++}`,
      type: 'orchestration-balance',
      title: 'System stable — no evolution needed',
      description: 'All subsystems operating within normal parameters. No bottlenecks, instability, or inefficiency detected.',
      impact: { area: 'none', risk: 'none', stabilityImpact: 'positive' },
      action: null,
      risk: 'none',
      requiresApproval: false,
    });
  }

  return proposals;
}

export function runProposalGeneration() {
  const analysis = runEvolutionAnalysis();
  const proposals = generateProposals(analysis);

  const report = {
    proposals,
    totalProposals: proposals.length,
    requiresApproval: proposals.filter(p => p.requiresApproval).length,
    autoApplicable: proposals.filter(p => !p.requiresApproval).length,
    riskSummary: {
      high: proposals.filter(p => p.risk === 'high').length,
      medium: proposals.filter(p => p.risk === 'medium').length,
      low: proposals.filter(p => p.risk === 'low').length,
      none: proposals.filter(p => p.risk === 'none').length,
    },
    analysis: { bottlenecks: analysis.bottlenecks.length, instability: analysis.instability.length, overallHealth: analysis.overallHealth },
    timestamp: new Date().toISOString(),
  };

  saveJson(PROPOSALS_PATH, report);
  return report;
}

if (process.argv[1]?.endsWith('runtimeEvolutionProposalEngine.mjs')) {
  console.log('[proposals] Runtime Evolution Proposal Engine');
  console.log('='.repeat(55));

  const report = runProposalGeneration();

  for (const p of report.proposals) {
    const approval = p.requiresApproval ? 'MANUAL' : 'AUTO';
    console.log(`\n  [${p.risk?.toUpperCase() ?? 'NONE'}] ${p.id}: ${p.title} (${approval})`);
    console.log(`    ${p.description.slice(0, 120)}${p.description.length > 120 ? '...' : ''}`);
  }

  console.log(`\n  Total: ${report.totalProposals}`);
  console.log(`  Requires approval: ${report.requiresApproval}`);
  console.log(`  Auto-applicable: ${report.autoApplicable}`);
  console.log(`  Risk: high=${report.riskSummary.high} medium=${report.riskSummary.medium} low=${report.riskSummary.low}`);

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[proposals] ${report.totalProposals} proposal(s) generated`);
  console.log('\n' + JSON.stringify({ ok: true, ...report }, null, 2));
}
