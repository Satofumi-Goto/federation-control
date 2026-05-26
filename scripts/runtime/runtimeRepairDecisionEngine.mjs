#!/usr/bin/env node
/**
 * Runtime Repair Decision Engine
 *
 * Evaluates repair proposals and decides on the safest action.
 */

export const DECISIONS = {
  NO_ACTION: 'no_action',
  SAFE_APPLY: 'safe_apply',
  MANUAL_REVIEW: 'manual_review',
  ROLLBACK: 'rollback',
  REDEPLOY: 'redeploy',
  BLOCK: 'block',
};

const FORBIDDEN_AUTO_ACTIONS = [
  'delete-registry',
  'delete-federation-memory',
  'delete-canonical-routes',
  'reintroduce-obsolete',
  'reintroduce-viewpanel-401',
  'schema-migration',
  'repository-rewrite',
  'credential-change',
];

/**
 * Decide on a single repair proposal.
 */
export function decideProposal(proposal) {
  if (!proposal) return { decision: DECISIONS.NO_ACTION, reason: 'No proposal' };

  if (FORBIDDEN_AUTO_ACTIONS.some((f) => proposal.action?.includes(f) || proposal.description?.includes(f))) {
    return { decision: DECISIONS.BLOCK, reason: 'Forbidden automatic action' };
  }

  switch (proposal.action) {
    case 'rebuild':
      return proposal.severity === 'critical'
        ? { decision: DECISIONS.SAFE_APPLY, reason: 'Critical rebuild needed' }
        : { decision: DECISIONS.SAFE_APPLY, reason: 'Rebuild needed' };

    case 'reverify':
      return { decision: DECISIONS.SAFE_APPLY, reason: 'Re-verification needed' };

    case 'remove-obsolete':
      return { decision: DECISIONS.MANUAL_REVIEW, reason: 'Obsolete content removal requires review' };

    case 'registry-correct':
      return { decision: DECISIONS.MANUAL_REVIEW, reason: 'Registry correction requires review' };

    case 'redeploy':
      return { decision: DECISIONS.SAFE_APPLY, reason: 'Redeployment needed' };

    case 'restore-snapshot':
      return { decision: DECISIONS.ROLLBACK, reason: 'Snapshot restoration = rollback' };

    case 'manual-fix':
      return { decision: DECISIONS.MANUAL_REVIEW, reason: 'Manual intervention required' };

    default:
      return { decision: DECISIONS.MANUAL_REVIEW, reason: `Unknown action: ${proposal.action}` };
  }
}

/**
 * Decide on a batch of proposals. Returns the highest-priority decision.
 */
export function decideBatch(proposals = []) {
  if (proposals.length === 0) {
    return { overall: DECISIONS.NO_ACTION, decisions: [], reason: 'No proposals to evaluate' };
  }

  const decisions = proposals.map((p) => ({
    proposal: p,
    ...decideProposal(p),
  }));

  const priority = [DECISIONS.BLOCK, DECISIONS.ROLLBACK, DECISIONS.MANUAL_REVIEW, DECISIONS.REDEPLOY, DECISIONS.SAFE_APPLY, DECISIONS.NO_ACTION];
  let overall = DECISIONS.NO_ACTION;
  for (const d of decisions) {
    if (priority.indexOf(d.decision) < priority.indexOf(overall)) {
      overall = d.decision;
    }
  }

  const autoApplicable = decisions.filter((d) => d.decision === DECISIONS.SAFE_APPLY);
  const blocked = decisions.filter((d) => d.decision === DECISIONS.BLOCK);
  const needsReview = decisions.filter((d) => d.decision === DECISIONS.MANUAL_REVIEW);

  return {
    overall,
    decisions,
    summary: {
      total: decisions.length,
      safeApply: autoApplicable.length,
      manualReview: needsReview.length,
      blocked: blocked.length,
    },
    reason: `${autoApplicable.length} safe-apply, ${needsReview.length} review, ${blocked.length} blocked`,
  };
}

if (process.argv[1]?.endsWith('runtimeRepairDecisionEngine.mjs')) {
  console.log('[decision] Runtime Repair Decision Engine');
  console.log('[decision] No direct invocation — use via runtimeSelfRepairOrchestrator.mjs');
}
