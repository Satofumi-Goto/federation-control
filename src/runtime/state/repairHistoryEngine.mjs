/**
 * Repair History Engine
 *
 * Records repair lifecycle events: proposal → dry-run → execute →
 * verify → rollback-decision, with dependency impact and governance
 * decisions.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { loadLatestSnapshot } from './runtimeSnapshotEngine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const STATE_DIR = path.resolve(REPO_ROOT, 'runtime_data/state');
const HISTORY_PATH = path.resolve(STATE_DIR, 'runtime-repair-history.json');
const MAX_ENTRIES = 100;

function loadHistory() {
  try {
    const data = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
    if (!Array.isArray(data.entries)) throw new Error('invalid');
    return data;
  } catch {
    return { entries: [], version: 1 };
  }
}

function saveHistory(history) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  if (history.entries.length > MAX_ENTRIES) {
    history.entries = history.entries.slice(-MAX_ENTRIES);
  }
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + '\n', 'utf8');
}

export function recordRepairEntry(snapshot, repairType = 'auto') {
  if (!snapshot) return null;
  const history = loadHistory();

  const entry = {
    id: crypto.randomUUID(),
    timestamp: snapshot.timestamp,
    snapshotId: snapshot.id,
    commitSha: snapshot.commitSha,
    repairType,

    affectedSurface: snapshot.drift?.degradedDomains ?? [],
    dependencyImpact: {
      degradedCount: snapshot.drift?.degradedDomains?.length ?? 0,
      congestionLevel: snapshot.drift?.congestionLevel ?? 'none',
      propagationSeverity: snapshot.health?.propagationSeverity ?? 0,
    },

    governanceDecision: {
      mode: snapshot.governance?.mode ?? 'unknown',
      lockDecision: snapshot.governance?.lockDecision ?? 'unknown',
      pressureScore: snapshot.governance?.pressureScore ?? 0,
    },

    executionResult: {
      mode: snapshot.execution?.mode ?? 'unknown',
      deployState: snapshot.execution?.deployState ?? 'unknown',
      headlessStatus: snapshot.execution?.headlessStatus ?? 'unknown',
    },

    verifyResult: {
      topology: snapshot.verification?.topology?.ok ?? false,
      semantic: snapshot.verification?.semantic?.ok ?? false,
    },

    repairState: snapshot.repair?.activeRepairState ?? 'unknown',
    totalCycles: snapshot.repair?.totalCycles ?? 0,
    lastDecision: snapshot.repair?.lastDecision ?? null,
    verificationPassRate: snapshot.repair?.verificationPassRate ?? 0,

    slaStatus: snapshot.sla?.overallStatus ?? 'unknown',

    rollbackRequired: false,
  };

  history.entries.push(entry);
  saveHistory(history);
  return entry;
}

export function getRepairSummary() {
  const history = loadHistory();
  const entries = history.entries;

  const byType = {};
  for (const e of entries) {
    byType[e.repairType] = (byType[e.repairType] || 0) + 1;
  }

  const affectedDomainFreq = {};
  for (const e of entries) {
    for (const d of e.affectedSurface ?? []) {
      affectedDomainFreq[d] = (affectedDomainFreq[d] || 0) + 1;
    }
  }

  const verifyPassCount = entries.filter(e =>
    e.verifyResult?.topology && e.verifyResult?.semantic
  ).length;

  return {
    totalEntries: entries.length,
    byType,
    verifyPassRate: entries.length > 0 ? Math.round((verifyPassCount / entries.length) * 100) : 100,
    mostAffectedDomains: Object.entries(affectedDomainFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([d, c]) => ({ domain: d, count: c })),
    latestEntry: entries[entries.length - 1] ?? null,
  };
}

// ── CLI ──
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const snapshot = loadLatestSnapshot();
  if (!snapshot) {
    console.log('[repair-history] No snapshot available. Run snapshot engine first.');
    process.exit(1);
  }
  console.log('[repair-history] Recording repair entry from latest snapshot...');
  const entry = recordRepairEntry(snapshot);
  console.log(`[repair-history] Entry ID: ${entry.id}`);
  console.log(`[repair-history] Affected: ${entry.affectedSurface.join(', ') || 'none'}`);
  console.log(`[repair-history] Governance: ${entry.governanceDecision.mode}`);

  const summary = getRepairSummary();
  console.log(`[repair-history] Total entries: ${summary.totalEntries}, verify pass rate: ${summary.verifyPassRate}%`);
}
