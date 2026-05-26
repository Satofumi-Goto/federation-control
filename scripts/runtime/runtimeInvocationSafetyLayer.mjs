#!/usr/bin/env node
/**
 * Runtime Invocation Safety Layer
 *
 * Validates payloads and instructions against forbidden operations
 * before Cursor Agent invocation.
 */

export const FORBIDDEN_OPERATIONS = [
  { id: 'delete-registry', pattern: /delete\s+(runtime\s+)?registry/i, reason: 'Destructive: Runtime Registry deletion' },
  { id: 'delete-memory', pattern: /delete\s+(runtime\s+)?federation\s+memory/i, reason: 'Destructive: Federation Memory deletion' },
  { id: 'delete-routes', pattern: /delete\s+(runtime\s+)?canonical\s+routes/i, reason: 'Destructive: Canonical routes deletion' },
  { id: 'repo-wide-delete', pattern: /rm\s+-rf\s+[./]/i, reason: 'Destructive: Repo-wide recursive delete' },
  { id: 'force-push', pattern: /git\s+push\s+--force/i, reason: 'Destructive: Force push' },
  { id: 'hard-reset', pattern: /git\s+reset\s+--hard/i, reason: 'Destructive: Hard reset' },
  { id: 'obsolete-panel', pattern: /reintroduce\s+.*(?:obsolete|placeholder)\s+panel/i, reason: 'Forbidden: Obsolete panel reintroduction' },
  { id: 'viewpanel-401', pattern: /viewPanel\s*=\s*401/i, reason: 'Forbidden: viewPanel=401 routing' },
  { id: 'window-location', pattern: /window\.location/i, reason: 'Forbidden: window.location usage' },
  { id: 'window-open', pattern: /window\.open/i, reason: 'Forbidden: window.open usage' },
  { id: 'credential-expose', pattern: /(?:print|echo|log|console\.log)\s*\(?\s*(?:token|secret|password|api[_-]?key|GRAFANA_TOKEN|GITHUB_TOKEN)/i, reason: 'Security: Credential exposure' },
  { id: 'env-commit', pattern: /git\s+add\s+.*\.env(?!\.example)/i, reason: 'Security: Committing .env file' },
  { id: 'cross-repo', pattern: /(?:cd|pushd)\s+(?:~|\/|\\)(?!.*federation-control)/i, reason: 'Scope: Cross-repository access attempt' },
  { id: 'deploy-no-verify', pattern: /deploy\s+(?:--skip-verify|--no-verify|--force)/i, reason: 'Safety: Deploy without verification' },
];

const MANUAL_REVIEW_PATTERNS = [
  { id: 'destructive-delete', pattern: /(?:rm|del|remove)\s+(?:-[rf]+\s+)?(?:src|scripts|grafana|runtime_data)\//i, reason: 'Destructive delete in core directory' },
  { id: 'schema-migration', pattern: /schema\s+migrat/i, reason: 'Schema migration detected' },
  { id: 'repo-rewrite', pattern: /(?:rewrite|refactor)\s+(?:entire|all|whole)\s+(?:repo|codebase|project)/i, reason: 'Repository-wide rewrite' },
  { id: 'credential-change', pattern: /(?:change|update|rotate)\s+(?:token|credential|api[_-]?key|secret)/i, reason: 'Credential change operation' },
  { id: 'deploy-credential', pattern: /(?:change|update)\s+(?:deploy|grafana|github)\s+(?:token|credential)/i, reason: 'Deploy credential change' },
];

/**
 * Validate an instruction string against forbidden operations.
 */
export function validateInstruction(instruction) {
  if (!instruction || typeof instruction !== 'string') {
    return { safe: false, blocked: [{ id: 'empty', reason: 'Empty or invalid instruction' }], review: [] };
  }

  const blocked = [];
  const review = [];

  for (const rule of FORBIDDEN_OPERATIONS) {
    if (rule.pattern.test(instruction)) {
      blocked.push({ id: rule.id, reason: rule.reason });
    }
  }

  for (const rule of MANUAL_REVIEW_PATTERNS) {
    if (rule.pattern.test(instruction)) {
      review.push({ id: rule.id, reason: rule.reason });
    }
  }

  return {
    safe: blocked.length === 0,
    blocked,
    review,
    requiresManualReview: review.length > 0,
  };
}

/**
 * Validate a payload object against forbidden operations.
 */
export function validatePayload(payload) {
  if (!payload) {
    return { safe: false, blocked: [{ id: 'empty-payload', reason: 'No payload provided' }], review: [] };
  }

  const blocked = [];
  const review = [];

  if (payload.repository && payload.repository !== 'federation-control') {
    blocked.push({ id: 'wrong-repo', reason: `Payload targets wrong repository: ${payload.repository}` });
  }

  if (payload.forbiddenOperations?.length > 0) {
    for (const op of payload.forbiddenOperations) {
      if (payload.allowedOperations?.includes(op)) {
        blocked.push({ id: 'conflict', reason: `Operation "${op}" is in both allowed and forbidden lists` });
      }
    }
  }

  const allText = JSON.stringify(payload);
  for (const rule of FORBIDDEN_OPERATIONS) {
    if (rule.pattern.test(allText)) {
      blocked.push({ id: rule.id, reason: rule.reason });
    }
  }

  for (const rule of MANUAL_REVIEW_PATTERNS) {
    if (rule.pattern.test(allText)) {
      review.push({ id: rule.id, reason: rule.reason });
    }
  }

  return {
    safe: blocked.length === 0,
    blocked,
    review,
    requiresManualReview: review.length > 0,
  };
}

if (process.argv[1]?.endsWith('runtimeInvocationSafetyLayer.mjs')) {
  console.log('[safety] Runtime Invocation Safety Layer');
  console.log(`[safety] Forbidden operations: ${FORBIDDEN_OPERATIONS.length}`);
  console.log(`[safety] Manual review patterns: ${MANUAL_REVIEW_PATTERNS.length}`);

  const testInstruction = 'Build the runtime workspace and verify topology links.';
  const result = validateInstruction(testInstruction);
  console.log(`\n[safety] Test instruction: "${testInstruction}"`);
  console.log(`[safety] Safe: ${result.safe}`);
  console.log(`[safety] Blocked: ${result.blocked.length}`);
  console.log(`[safety] Review: ${result.review.length}`);

  console.log('\n' + JSON.stringify(result, null, 2));
}
