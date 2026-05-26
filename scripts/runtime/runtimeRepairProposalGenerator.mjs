#!/usr/bin/env node
/**
 * Runtime Repair Proposal Generator
 *
 * Maps detected failures, drifts, and forbidden content
 * into actionable repair proposals.
 */

export const REPAIR_ACTIONS = {
  REBUILD: 'rebuild',
  REVERIFY: 'reverify',
  REGISTRY_CORRECT: 'registry-correct',
  REMOVE_OBSOLETE: 'remove-obsolete',
  REDEPLOY: 'redeploy',
  RESTORE_SNAPSHOT: 'restore-snapshot',
  MANUAL_FIX: 'manual-fix',
};

const FAILURE_MAP = [
  { match: (d) => d.type === 'forbidden-reappearance', action: REPAIR_ACTIONS.REMOVE_OBSOLETE, severity: 'high' },
  { match: (d) => d.type === 'missing-card', action: REPAIR_ACTIONS.REBUILD, severity: 'high' },
  { match: (d) => d.type === 'unresolved-route', action: REPAIR_ACTIONS.REBUILD, severity: 'medium' },
  { match: (d) => d.type === 'registry-memory-gap', action: REPAIR_ACTIONS.REGISTRY_CORRECT, severity: 'medium' },
  { match: (d) => d.type === 'missing-artifact', action: REPAIR_ACTIONS.REBUILD, severity: 'critical' },
  { match: (d) => d.type === 'invalid-version', action: REPAIR_ACTIONS.REBUILD, severity: 'medium' },
];

const MONITOR_FAILURE_MAP = [
  { match: (s) => !s.build?.ok, action: REPAIR_ACTIONS.REBUILD, severity: 'critical', detail: 'Build failed' },
  { match: (s) => s.verification && !Object.values(s.verification).every(Boolean), action: REPAIR_ACTIONS.REVERIFY, severity: 'high', detail: 'Verification failed' },
  { match: (s) => s.contentGuard && !Object.values(s.contentGuard).every(Boolean), action: REPAIR_ACTIONS.REMOVE_OBSOLETE, severity: 'high', detail: 'Forbidden content detected' },
  { match: (s) => s.drift?.versionDrift, action: REPAIR_ACTIONS.REDEPLOY, severity: 'medium', detail: 'Version drift detected' },
  { match: (s) => s.drift?.commitDrift, action: REPAIR_ACTIONS.REDEPLOY, severity: 'low', detail: 'Commit drift detected' },
];

/**
 * Generate repair proposals from drift monitor results.
 */
export function generateFromDrifts(drifts = []) {
  const proposals = [];
  for (const drift of drifts) {
    for (const rule of FAILURE_MAP) {
      if (rule.match(drift)) {
        proposals.push({
          source: 'drift',
          trigger: drift,
          action: rule.action,
          severity: rule.severity,
          description: `${rule.action}: ${drift.detail}`,
        });
        break;
      }
    }
  }
  return proposals;
}

/**
 * Generate repair proposals from monitor check results.
 */
export function generateFromMonitor(checks = {}) {
  const proposals = [];
  for (const rule of MONITOR_FAILURE_MAP) {
    if (rule.match(checks)) {
      proposals.push({
        source: 'monitor',
        action: rule.action,
        severity: rule.severity,
        description: rule.detail,
      });
    }
  }
  return proposals;
}

/**
 * Generate all repair proposals from combined inputs.
 */
export function generateProposals(drifts = [], monitorChecks = {}) {
  const fromDrifts = generateFromDrifts(drifts);
  const fromMonitor = generateFromMonitor(monitorChecks);
  const all = [...fromDrifts, ...fromMonitor];

  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  all.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));

  return all;
}

if (process.argv[1]?.endsWith('runtimeRepairProposalGenerator.mjs')) {
  console.log('[proposals] Runtime Repair Proposal Generator');
  console.log('[proposals] No direct invocation — use via runtimeSelfRepairOrchestrator.mjs');
}
