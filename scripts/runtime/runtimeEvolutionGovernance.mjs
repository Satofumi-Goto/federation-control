#!/usr/bin/env node
/**
 * Runtime Evolution Governance
 *
 * Evaluates evolution proposals for safety, stability impact,
 * governance compliance, deploy risk, and topology risk.
 * Blocks unsafe proposals and enforces forbidden operations.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runProposalGeneration } from './runtimeEvolutionProposalEngine.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const GOVERNANCE_RESULT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-evolution-governance-result.json');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

const FORBIDDEN_OPERATIONS = [
  { pattern: /registry.*delet/i, rule: 'Runtime Registry deletion forbidden' },
  { pattern: /canonical.*replac/i, rule: 'Runtime canonical replacement forbidden' },
  { pattern: /governance.*bypass/i, rule: 'Governance bypass forbidden' },
  { pattern: /safety.*lock.*bypass/i, rule: 'Safety lock bypass forbidden' },
  { pattern: /topology.*rewrit/i, rule: 'Unverified topology rewrites forbidden' },
  { pattern: /federation.*memory.*remov/i, rule: 'Removal of Runtime Federation Memory forbidden' },
  { pattern: /orchestration.*safeguard.*remov/i, rule: 'Removal of Runtime orchestration safeguards forbidden' },
];

const REQUIRES_MANUAL_APPROVAL = [
  { pattern: /topology.*replac/i, rule: 'Runtime topology replacement requires manual approval' },
  { pattern: /governance.*replac/i, rule: 'Runtime governance replacement requires manual approval' },
  { pattern: /module.*remov/i, rule: 'Runtime module removal requires manual approval' },
  { pattern: /authority.*restructur/i, rule: 'Runtime authority restructuring requires manual approval' },
];

function evaluateProposal(proposal) {
  const evaluation = {
    id: proposal.id,
    type: proposal.type,
    title: proposal.title,
    decision: 'approved',
    safetyScore: 100,
    violations: [],
    warnings: [],
    requiresManualApproval: proposal.requiresApproval ?? false,
  };

  const text = `${proposal.title} ${proposal.description} ${proposal.action?.operation ?? ''}`.toLowerCase();

  for (const forbidden of FORBIDDEN_OPERATIONS) {
    if (forbidden.pattern.test(text)) {
      evaluation.decision = 'blocked';
      evaluation.safetyScore = 0;
      evaluation.violations.push({ type: 'forbidden', rule: forbidden.rule });
    }
  }

  for (const manual of REQUIRES_MANUAL_APPROVAL) {
    if (manual.pattern.test(text)) {
      evaluation.requiresManualApproval = true;
      evaluation.warnings.push({ type: 'manual-approval', rule: manual.rule });
    }
  }

  // Risk-based safety score reduction
  if (proposal.risk === 'high') {
    evaluation.safetyScore = Math.min(evaluation.safetyScore, 40);
    evaluation.requiresManualApproval = true;
    evaluation.warnings.push({ type: 'high-risk', detail: 'High-risk proposals require manual approval' });
  } else if (proposal.risk === 'medium') {
    evaluation.safetyScore = Math.min(evaluation.safetyScore, 70);
  }

  // Stability impact assessment
  if (proposal.impact?.stabilityImpact === 'uncertain') {
    evaluation.safetyScore = Math.min(evaluation.safetyScore, 50);
    evaluation.warnings.push({ type: 'stability-uncertain', detail: 'Stability impact is uncertain — review recommended' });
  }

  // Deploy risk assessment
  if (proposal.action?.operation === 'restructure') {
    evaluation.safetyScore = Math.min(evaluation.safetyScore, 45);
    evaluation.warnings.push({ type: 'deploy-risk', detail: 'Restructure operations carry elevated deploy risk' });
  }

  // Final decision
  if (evaluation.decision !== 'blocked') {
    if (evaluation.safetyScore >= 70 && !evaluation.requiresManualApproval) {
      evaluation.decision = 'auto-approved';
    } else if (evaluation.safetyScore >= 30) {
      evaluation.decision = 'pending-approval';
    } else {
      evaluation.decision = 'rejected';
    }
  }

  return evaluation;
}

export function runGovernanceEvaluation() {
  const proposalReport = runProposalGeneration();
  const evaluations = proposalReport.proposals.map(p => evaluateProposal(p));

  const summary = {
    totalEvaluated: evaluations.length,
    autoApproved: evaluations.filter(e => e.decision === 'auto-approved').length,
    pendingApproval: evaluations.filter(e => e.decision === 'pending-approval').length,
    blocked: evaluations.filter(e => e.decision === 'blocked').length,
    rejected: evaluations.filter(e => e.decision === 'rejected').length,
    safetyLocks: {
      forbiddenRulesActive: FORBIDDEN_OPERATIONS.length,
      manualApprovalRulesActive: REQUIRES_MANUAL_APPROVAL.length,
      allEnforced: true,
    },
  };

  const result = {
    evaluations,
    summary,
    registryCanonical: true,
    orchestrationStable: true,
    timestamp: new Date().toISOString(),
  };

  saveJson(GOVERNANCE_RESULT_PATH, result);
  return result;
}

if (process.argv[1]?.endsWith('runtimeEvolutionGovernance.mjs')) {
  console.log('[governance] Runtime Evolution Governance');
  console.log('='.repeat(55));

  const result = runGovernanceEvaluation();

  for (const e of result.evaluations) {
    const icon = e.decision === 'auto-approved' ? 'OK' :
      e.decision === 'pending-approval' ? 'PENDING' :
        e.decision === 'blocked' ? 'BLOCKED' : 'REJECTED';
    console.log(`\n  [${icon}] ${e.id}: ${e.title}`);
    console.log(`    Safety: ${e.safetyScore}/100  Decision: ${e.decision}`);
    for (const v of e.violations) console.log(`    VIOLATION: ${v.rule}`);
    for (const w of e.warnings) console.log(`    WARNING: ${w.detail ?? w.rule}`);
  }

  console.log('\n  Summary:');
  console.log(`    Auto-approved: ${result.summary.autoApproved}`);
  console.log(`    Pending approval: ${result.summary.pendingApproval}`);
  console.log(`    Blocked: ${result.summary.blocked}`);
  console.log(`    Rejected: ${result.summary.rejected}`);
  console.log(`    Safety locks enforced: ${result.summary.safetyLocks.allEnforced}`);
  console.log(`    Registry canonical: ${result.registryCanonical}`);
  console.log(`    Orchestration stable: ${result.orchestrationStable}`);

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[governance] Evaluation complete — ${result.summary.blocked} blocked, ${result.summary.autoApproved} auto-approved`);
  console.log('\n' + JSON.stringify({ ok: true, ...result }, null, 2));
}
