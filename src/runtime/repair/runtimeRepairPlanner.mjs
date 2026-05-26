/**
 * Runtime Repair Planner
 *
 * Detects drift, topology failure, dependency inconsistency,
 * execution lock, and governance degradation from the latest
 * snapshot, then generates ranked repair proposals.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const STATE_DIR = path.resolve(REPO_ROOT, 'runtime_data/state');
const REPAIR_DIR = path.resolve(REPO_ROOT, 'runtime_data/repair');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function loadSnapshot() { return loadJson(path.resolve(STATE_DIR, 'runtime-snapshot-latest.json')); }
function loadDriftTimeline() { return loadJson(path.resolve(STATE_DIR, 'runtime-drift-timeline.json')); }
function loadRepairHistory() { return loadJson(path.resolve(STATE_DIR, 'runtime-repair-history.json')); }

function detectIssues(snapshot) {
  if (!snapshot) return [];
  const issues = [];
  const gov = snapshot.governance ?? {};
  const exec = snapshot.execution ?? {};
  const health = snapshot.health ?? {};
  const drift = snapshot.drift ?? {};
  const verify = snapshot.verification ?? {};
  const repair = snapshot.repair ?? {};

  if (!verify.topology?.ok) issues.push({ type: 'topology-failure', severity: 'high', detail: 'トポロジー検証失敗' });
  if (!verify.semantic?.ok) issues.push({ type: 'semantic-failure', severity: 'high', detail: 'セマンティック検証失敗' });
  if (drift.state !== 'healthy') issues.push({ type: 'drift-detected', severity: 'medium', detail: `ドリフト状態: ${drift.state}`, domains: drift.degradedDomains });
  if ((drift.degradedDomains?.length ?? 0) > 0) issues.push({ type: 'domain-degradation', severity: 'medium', detail: `劣化ドメイン: ${drift.degradedDomains.join(', ')}`, domains: drift.degradedDomains });
  if (gov.lockDecision === 'blocked') issues.push({ type: 'execution-locked', severity: 'high', detail: 'ガバナンスロック: blocked' });
  if ((gov.pressureScore ?? 0) > 30) issues.push({ type: 'governance-pressure', severity: 'medium', detail: `ガバナンス圧力: ${gov.pressureScore}` });
  if ((gov.violations ?? 0) > 0) issues.push({ type: 'governance-violation', severity: 'high', detail: `違反検出: ${gov.violations}` });
  if (exec.deployState === 'blocked') issues.push({ type: 'deploy-blocked', severity: 'medium', detail: 'デプロイブロック中' });
  if ((health.propagationSeverity ?? 0) > 20) issues.push({ type: 'propagation-risk', severity: 'high', detail: `伝播深刻度: ${health.propagationSeverity}` });
  if (drift.congestionLevel !== 'none' && drift.congestionLevel) issues.push({ type: 'congestion', severity: 'low', detail: `渋滞レベル: ${drift.congestionLevel}` });

  return issues;
}

function generateProposal(issue, snapshot, index) {
  const actionMap = {
    'topology-failure': { actions: ['rebuild-topology', 'verify-routing'], verifyReqs: ['topology', 'semantic'] },
    'semantic-failure': { actions: ['rebuild-semantic-map', 'verify-semantic'], verifyReqs: ['semantic'] },
    'drift-detected': { actions: ['sync-drift-domains', 'recalibrate-state'], verifyReqs: ['topology', 'semantic'] },
    'domain-degradation': { actions: ['repair-degraded-domains', 'verify-health'], verifyReqs: ['topology'] },
    'execution-locked': { actions: ['evaluate-lock-reason', 'request-unlock'], verifyReqs: ['governance'] },
    'governance-pressure': { actions: ['reduce-pressure', 'throttle-operations'], verifyReqs: ['governance'] },
    'governance-violation': { actions: ['resolve-violation', 'policy-review'], verifyReqs: ['governance', 'topology'] },
    'deploy-blocked': { actions: ['evaluate-deploy-block', 'request-deploy-unlock'], verifyReqs: ['governance'] },
    'propagation-risk': { actions: ['isolate-propagation', 'repair-source'], verifyReqs: ['topology', 'semantic'] },
    'congestion': { actions: ['relax-throttle', 'redistribute-load'], verifyReqs: ['topology'] },
  };

  const template = actionMap[issue.type] ?? { actions: ['investigate'], verifyReqs: ['topology'] };
  const riskScore = issue.severity === 'high' ? 70 : issue.severity === 'medium' ? 40 : 15;

  return {
    id: crypto.randomUUID(),
    repairIndex: index,
    timestamp: new Date().toISOString(),
    snapshotId: snapshot?.id ?? null,
    issue: { type: issue.type, severity: issue.severity, detail: issue.detail },
    targetDomains: issue.domains ?? [],
    requiredActions: template.actions,
    verifyRequirements: template.verifyReqs,
    dependencyRequirements: (issue.domains ?? []).length > 0 ? ['domain-health-check'] : [],
    rollbackReadiness: riskScore < 50,
    estimatedRisk: riskScore,
    priority: issue.severity === 'high' ? 1 : issue.severity === 'medium' ? 2 : 3,
    status: 'proposed',
  };
}

export function planRepairs() {
  const snapshot = loadSnapshot();
  const issues = detectIssues(snapshot);
  const proposals = issues.map((issue, i) => generateProposal(issue, snapshot, i));
  proposals.sort((a, b) => a.priority - b.priority || b.estimatedRisk - a.estimatedRisk);

  const plan = {
    timestamp: new Date().toISOString(),
    snapshotId: snapshot?.id ?? null,
    issueCount: issues.length,
    proposalCount: proposals.length,
    issues,
    proposals,
  };

  fs.mkdirSync(REPAIR_DIR, { recursive: true });
  fs.writeFileSync(path.resolve(REPAIR_DIR, 'runtime-repair-plan.json'), JSON.stringify(plan, null, 2) + '\n');
  return plan;
}

// ── CLI ──
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  console.log('[repair-planner] Generating repair plan...');
  const plan = planRepairs();
  console.log(`[repair-planner] Issues: ${plan.issueCount}, Proposals: ${plan.proposalCount}`);
  for (const p of plan.proposals) {
    console.log(`  [${p.issue.severity}] ${p.issue.type}: ${p.issue.detail} → risk:${p.estimatedRisk}`);
  }
}
