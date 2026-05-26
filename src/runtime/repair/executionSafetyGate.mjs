/**
 * Execution Safety Gate
 *
 * Blocks destructive actions, forbidden patterns, unsafe routing,
 * force push, registry replacement, governance bypass, and
 * unresolved dependency repairs.
 *
 * Returns: SAFE | REVIEW_REQUIRED | BLOCKED
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DATA_ROOT = path.resolve(REPO_ROOT, 'runtime_data');
const REPAIR_DIR = path.resolve(DATA_ROOT, 'repair');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

const FORBIDDEN_PATTERNS = [
  /force[- ]?push/i,
  /--force/i,
  /--no-verify/i,
  /reset\s+--hard/i,
  /clean\s+-fd/i,
  /execute[- ]?emergency/i,
  /registry[- ]?replace/i,
  /registry[- ]?destroy/i,
  /governance[- ]?bypass/i,
  /auto[- ]?delete/i,
  /credential[- ]?(modify|delete|expose)/i,
  /env[- ]?(modify|delete|expose)/i,
  /topology[- ]?destroy/i,
  /\.env\.runtime/i,
  /CURSOR_API_KEY/i,
  /REMOTE_MCP_AUTH_TOKEN/i,
];

const UNSAFE_ROUTING_PATTERNS = [
  /viewPanel=401/i,
  /\/d\/sa8ljn4/i,
  /window\.location/i,
  /localhost.*public/i,
];

function checkForbiddenPatterns(actions) {
  const violations = [];
  for (const action of actions) {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(action)) {
        violations.push({ action, pattern: pattern.source, rule: '禁止パターン検出' });
      }
    }
  }
  return violations;
}

function checkUnsafeRouting(actions) {
  const violations = [];
  for (const action of actions) {
    for (const pattern of UNSAFE_ROUTING_PATTERNS) {
      if (pattern.test(action)) {
        violations.push({ action, pattern: pattern.source, rule: '危険ルーティング検出' });
      }
    }
  }
  return violations;
}

function checkUnresolvedDependencies(proposal, blastRadius) {
  const unstable = blastRadius?.unstableDependencies ?? [];
  if (unstable.length > 3) {
    return { status: 'BLOCKED', detail: `未解決依存関係 ${unstable.length} 件` };
  }
  if (unstable.length > 0) {
    return { status: 'REVIEW_REQUIRED', detail: `未解決依存関係 ${unstable.length} 件` };
  }
  return { status: 'SAFE', detail: '未解決依存関係なし' };
}

export function evaluateSafety(proposal, blastRadius) {
  const actions = proposal?.requiredActions ?? [];
  const allText = [...actions, JSON.stringify(proposal)];

  const forbiddenViolations = checkForbiddenPatterns(allText);
  const routingViolations = checkUnsafeRouting(allText);
  const depCheck = checkUnresolvedDependencies(proposal, blastRadius);

  const allViolations = [
    ...forbiddenViolations.map(v => ({ ...v, category: 'forbidden' })),
    ...routingViolations.map(v => ({ ...v, category: 'routing' })),
  ];

  let decision = 'SAFE';
  const reasons = [];

  if (allViolations.length > 0) {
    decision = 'BLOCKED';
    reasons.push(...allViolations.map(v => `[${v.category}] ${v.rule}: ${v.action?.substring(0, 80)}`));
  }

  if (depCheck.status === 'BLOCKED') {
    decision = 'BLOCKED';
    reasons.push(depCheck.detail);
  } else if (depCheck.status === 'REVIEW_REQUIRED' && decision === 'SAFE') {
    decision = 'REVIEW_REQUIRED';
    reasons.push(depCheck.detail);
  }

  if ((proposal?.estimatedRisk ?? 0) > 70 && decision === 'SAFE') {
    decision = 'REVIEW_REQUIRED';
    reasons.push(`高リスクスコア: ${proposal.estimatedRisk}`);
  }

  return {
    repairId: proposal?.id ?? null,
    decision,
    reasons,
    forbiddenViolations: forbiddenViolations.length,
    routingViolations: routingViolations.length,
    dependencyStatus: depCheck.status,
    timestamp: new Date().toISOString(),
  };
}

export function evaluateAllProposals() {
  const plan = loadJson(path.resolve(REPAIR_DIR, 'runtime-repair-plan.json'));
  const blastRadius = loadJson(path.resolve(REPAIR_DIR, 'runtime-blast-radius.json'));
  const proposals = plan?.proposals ?? [];

  const results = proposals.map(p => evaluateSafety(p, blastRadius));

  const safeCount = results.filter(r => r.decision === 'SAFE').length;
  const reviewCount = results.filter(r => r.decision === 'REVIEW_REQUIRED').length;
  const blockedCount = results.filter(r => r.decision === 'BLOCKED').length;

  const output = {
    timestamp: new Date().toISOString(),
    total: results.length,
    safeCount,
    reviewCount,
    blockedCount,
    results,
  };

  fs.mkdirSync(REPAIR_DIR, { recursive: true });
  fs.writeFileSync(
    path.resolve(REPAIR_DIR, 'runtime-safety-gate-result.json'),
    JSON.stringify(output, null, 2) + '\n',
  );
  return output;
}

// ── CLI ──
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  console.log('[safety-gate] Evaluating proposals...');
  const result = evaluateAllProposals();
  console.log(`[safety-gate] SAFE: ${result.safeCount}, REVIEW: ${result.reviewCount}, BLOCKED: ${result.blockedCount}`);
  for (const r of result.results) {
    console.log(`  [${r.repairId?.substring(0, 8) ?? 'unknown'}] → ${r.decision}`);
  }
}
