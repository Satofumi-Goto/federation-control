/**
 * Runtime Repair Graph
 *
 * Builds a graph from the complete repair chain:
 * repair dependency, execution chain, blast radius,
 * rollback lineage, recovery flow, and affected runtime domains.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DATA_ROOT = path.resolve(REPO_ROOT, 'runtime_data');
const REPAIR_DIR = path.resolve(DATA_ROOT, 'repair');
const STATE_DIR = path.resolve(DATA_ROOT, 'state');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

export function buildRepairGraph() {
  const plan = loadJson(path.resolve(REPAIR_DIR, 'runtime-repair-plan.json'));
  const blastRadius = loadJson(path.resolve(REPAIR_DIR, 'runtime-blast-radius.json'));
  const collapse = loadJson(path.resolve(REPAIR_DIR, 'runtime-collapse-prediction.json'));
  const orchestration = loadJson(path.resolve(REPAIR_DIR, 'runtime-orchestration-result.json'));
  const safetyGate = loadJson(path.resolve(REPAIR_DIR, 'runtime-safety-gate-result.json'));
  const queue = loadJson(path.resolve(REPAIR_DIR, 'runtime-repair-queue.json'));
  const recovery = loadJson(path.resolve(REPAIR_DIR, 'runtime-recovery-evaluation.json'));
  const rollback = loadJson(path.resolve(STATE_DIR, 'runtime-rollback-lineage.json'));
  const twin = loadJson(path.resolve(DATA_ROOT, 'runtime-operational-digital-twin-graph.json'));

  const nodes = [];
  const edges = [];

  // Repair proposal nodes
  for (const proposal of plan?.proposals ?? []) {
    nodes.push({
      id: `repair:${proposal.id}`,
      type: 'repair-proposal',
      label: `修復: ${proposal.issue?.type ?? 'unknown'}`,
      severity: proposal.issue?.severity ?? 'unknown',
      risk: proposal.estimatedRisk ?? 0,
      status: proposal.status,
    });

    for (const domain of proposal.targetDomains ?? []) {
      edges.push({
        from: `repair:${proposal.id}`,
        to: `domain:${domain}`,
        type: 'targets',
      });
    }
  }

  // Blast radius nodes
  const affected = new Set([
    ...(blastRadius?.directlyAffected ?? []),
    ...(blastRadius?.secondaryAffected ?? []),
  ]);
  for (const domain of affected) {
    const existing = nodes.find(n => n.id === `domain:${domain}`);
    if (!existing) {
      nodes.push({
        id: `domain:${domain}`,
        type: 'runtime-domain',
        label: domain,
        affected: blastRadius?.directlyAffected?.includes(domain) ? 'direct' : 'secondary',
      });
    }
  }

  // Dashboard impact nodes
  for (const db of blastRadius?.affectedDashboards ?? []) {
    nodes.push({ id: `dashboard:${db}`, type: 'dashboard', label: db });
    for (const d of blastRadius.directlyAffected ?? []) {
      edges.push({ from: `domain:${d}`, to: `dashboard:${db}`, type: 'impacts' });
    }
  }

  // Orchestration edges
  for (const o of orchestration?.orchestrated ?? []) {
    const decision = o.decision;
    nodes.push({
      id: `gate:${o.repairId}`,
      type: 'governance-gate',
      label: `ゲート: ${decision}`,
      decision,
    });
    edges.push({ from: `repair:${o.repairId}`, to: `gate:${o.repairId}`, type: 'orchestration' });
  }

  // Queue state nodes
  for (const item of queue?.items ?? []) {
    nodes.push({
      id: `queue:${item.repairId}`,
      type: 'queue-entry',
      label: item.stateLabel ?? item.state,
      state: item.state,
    });
    edges.push({ from: `repair:${item.repairId}`, to: `queue:${item.repairId}`, type: 'queued' });
  }

  // Collapse prediction node
  if (collapse) {
    nodes.push({
      id: 'collapse:overall',
      type: 'collapse-prediction',
      label: `崩壊予測: ${collapse.overallLevel}`,
      score: collapse.overallScore,
      level: collapse.overallLevel,
    });
    for (const pred of collapse.predictions ?? []) {
      if (pred.level === 'critical' || pred.level === 'warning') {
        nodes.push({
          id: `prediction:${pred.label}`,
          type: 'prediction-factor',
          label: pred.label,
          score: pred.score,
          level: pred.level,
        });
        edges.push({ from: `prediction:${pred.label}`, to: 'collapse:overall', type: 'contributes' });
      }
    }
  }

  // Recovery node
  if (recovery) {
    nodes.push({
      id: 'recovery:evaluation',
      type: 'recovery',
      label: recovery.verdictLabel ?? recovery.verdict,
      verdict: recovery.verdict,
      passCount: recovery.passCount,
      totalChecks: recovery.totalChecks,
    });
  }

  // Rollback lineage
  const safepoints = rollback?.safepoints ?? [];
  if (safepoints.length > 0) {
    const latest = safepoints[safepoints.length - 1];
    nodes.push({
      id: `rollback:${latest.snapshotId ?? 'latest'}`,
      type: 'rollback-safepoint',
      label: 'ロールバック安全点',
      snapshotId: latest.snapshotId,
    });
  }

  const graph = {
    timestamp: new Date().toISOString(),
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes,
    edges,
    summary: {
      repairProposals: (plan?.proposals ?? []).length,
      blastRadiusScore: blastRadius?.blastRadiusScore ?? 0,
      collapseLevel: collapse?.overallLevel ?? 'unknown',
      queueSize: (queue?.items ?? []).length,
      recoveryVerdict: recovery?.verdict ?? 'unknown',
    },
  };

  fs.mkdirSync(REPAIR_DIR, { recursive: true });
  fs.writeFileSync(
    path.resolve(REPAIR_DIR, 'runtime-repair-graph.json'),
    JSON.stringify(graph, null, 2) + '\n',
  );
  return graph;
}

// ── CLI ──
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  console.log('[repair-graph] Building repair graph...');
  const graph = buildRepairGraph();
  console.log(`[repair-graph] Nodes: ${graph.nodeCount}, Edges: ${graph.edgeCount}`);
  console.log(`[repair-graph] Summary:`, JSON.stringify(graph.summary, null, 2));
}
