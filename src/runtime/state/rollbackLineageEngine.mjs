/**
 * Rollback Lineage Engine
 *
 * Tracks which snapshot/commit is a safe rollback target, and
 * estimates rollback blast radius and safety. Does NOT execute
 * any rollback — only manages lineage and readiness.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const STATE_DIR = path.resolve(REPO_ROOT, 'runtime_data/state');
const HISTORY_PATH = path.resolve(STATE_DIR, 'runtime-state-history.json');
const LINEAGE_PATH = path.resolve(STATE_DIR, 'runtime-rollback-lineage.json');

function loadHistory() {
  try {
    const data = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
    return data.entries ?? [];
  } catch { return []; }
}

function loadLineage() {
  try {
    const data = JSON.parse(fs.readFileSync(LINEAGE_PATH, 'utf8'));
    if (!Array.isArray(data.safepoints)) throw new Error('invalid');
    return data;
  } catch {
    return { safepoints: [], version: 1 };
  }
}

function saveLineage(lineage) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(LINEAGE_PATH, JSON.stringify(lineage, null, 2) + '\n', 'utf8');
}

function isSnapshotSafe(summary) {
  return summary.verifyTopology === true
    && summary.verifySemantic === true
    && summary.degradedCount === 0
    && (summary.healthLevel === 'nominal' || summary.healthLevel === 'healthy')
    && summary.pressureScore <= 10;
}

export function updateLineage() {
  const entries = loadHistory();
  const lineage = loadLineage();
  const existingIds = new Set(lineage.safepoints.map(s => s.snapshotId));

  for (const entry of entries) {
    if (existingIds.has(entry.id)) continue;
    if (isSnapshotSafe(entry.summary)) {
      lineage.safepoints.push({
        snapshotId: entry.id,
        timestamp: entry.timestamp,
        commitSha: entry.commitSha,
        safe: true,
        reason: 'all-verify-pass-no-degradation',
        summary: {
          healthLevel: entry.summary.healthLevel,
          pressureScore: entry.summary.pressureScore,
          deployVersion: entry.summary.deployVersion,
        },
      });
    }
  }

  if (lineage.safepoints.length > 20) {
    lineage.safepoints = lineage.safepoints.slice(-20);
  }

  saveLineage(lineage);
  return lineage;
}

export function getRollbackReadiness() {
  const lineage = updateLineage();
  const entries = loadHistory();
  const current = entries[entries.length - 1];
  const safepoints = lineage.safepoints;
  const latest = safepoints[safepoints.length - 1];

  const isCurrSafe = current ? isSnapshotSafe(current.summary) : false;

  const blastRadius = (() => {
    if (!current || !latest) return { estimatedFiles: 0, risk: 'unknown' };
    const versionDelta = (current.summary?.deployVersion ?? 0) - (latest.summary?.deployVersion ?? 0);
    if (versionDelta <= 0) return { estimatedFiles: 0, risk: 'none' };
    if (versionDelta <= 2) return { estimatedFiles: versionDelta * 5, risk: 'low' };
    if (versionDelta <= 5) return { estimatedFiles: versionDelta * 8, risk: 'medium' };
    return { estimatedFiles: versionDelta * 12, risk: 'high' };
  })();

  return {
    currentSnapshotSafe: isCurrSafe,
    safepointCount: safepoints.length,
    latestSafepoint: latest ?? null,
    rollbackAvailable: safepoints.length > 0,
    blastRadius,
    recommendation: isCurrSafe ? 'no-rollback-needed' : safepoints.length > 0 ? 'rollback-available' : 'no-safepoint',
  };
}

// ── CLI ──
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  console.log('[rollback-lineage] Updating lineage from state history...');
  const lineage = updateLineage();
  console.log(`[rollback-lineage] Safepoints: ${lineage.safepoints.length}`);

  const readiness = getRollbackReadiness();
  console.log(`[rollback-lineage] Current safe: ${readiness.currentSnapshotSafe}`);
  console.log(`[rollback-lineage] Rollback available: ${readiness.rollbackAvailable}`);
  console.log(`[rollback-lineage] Blast radius: ${readiness.blastRadius.risk}`);
  console.log(`[rollback-lineage] Recommendation: ${readiness.recommendation}`);
}
