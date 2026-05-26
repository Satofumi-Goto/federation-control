/**
 * Federation State Memory
 *
 * Append-only snapshot history with safe fallback on corruption.
 * Stores the latest N snapshots, computes diffs between consecutive
 * entries, and extracts trend indicators.
 *
 * NEVER stores secrets/tokens/credentials.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureSnapshot, loadLatestSnapshot } from './runtimeSnapshotEngine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const STATE_DIR = path.resolve(REPO_ROOT, 'runtime_data/state');
const HISTORY_PATH = path.resolve(STATE_DIR, 'runtime-state-history.json');
const MAX_ENTRIES = 50;

function loadHistory() {
  try {
    const raw = fs.readFileSync(HISTORY_PATH, 'utf8');
    const data = JSON.parse(raw);
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

export function appendSnapshot(snapshot) {
  const history = loadHistory();
  history.entries.push({
    id: snapshot.id,
    timestamp: snapshot.timestamp,
    commitSha: snapshot.commitSha,
    summary: {
      governanceMode: snapshot.governance?.mode,
      pressureScore: snapshot.governance?.pressureScore ?? 0,
      executionMode: snapshot.execution?.mode,
      queueDepth: snapshot.execution?.queueDepth ?? 0,
      healthLevel: snapshot.health?.overallLevel,
      driftState: snapshot.drift?.state,
      degradedCount: snapshot.drift?.degradedDomains?.length ?? 0,
      repairCycles: snapshot.repair?.totalCycles ?? 0,
      slaStatus: snapshot.sla?.overallStatus,
      slaRisks: snapshot.sla?.riskCount ?? 0,
      verifyTopology: snapshot.verification?.topology?.ok ?? false,
      verifySemantic: snapshot.verification?.semantic?.ok ?? false,
      deployVersion: snapshot.deploy?.version ?? 0,
      environmentHealth: snapshot.environment?.healthScore ?? 0,
    },
  });
  saveHistory(history);
  return history;
}

export function computeDiff(prevSummary, currSummary) {
  if (!prevSummary || !currSummary) return null;
  const diff = {};
  for (const key of Object.keys(currSummary)) {
    const prev = prevSummary[key];
    const curr = currSummary[key];
    if (typeof curr === 'number' && typeof prev === 'number') {
      const delta = curr - prev;
      if (delta !== 0) diff[key] = { prev, curr, delta, direction: delta > 0 ? 'up' : 'down' };
    } else if (prev !== curr) {
      diff[key] = { prev, curr, changed: true };
    }
  }
  return Object.keys(diff).length > 0 ? diff : null;
}

export function getLatestDiff() {
  const history = loadHistory();
  const entries = history.entries;
  if (entries.length < 2) return null;
  const prev = entries[entries.length - 2].summary;
  const curr = entries[entries.length - 1].summary;
  return computeDiff(prev, curr);
}

export function getTrend(field, windowSize = 5) {
  const history = loadHistory();
  const entries = history.entries.slice(-windowSize);
  if (entries.length < 2) return { trend: 'insufficient', values: [] };

  const values = entries.map(e => e.summary?.[field]).filter(v => typeof v === 'number');
  if (values.length < 2) return { trend: 'insufficient', values };

  let rising = 0, falling = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[i - 1]) rising++;
    else if (values[i] < values[i - 1]) falling++;
  }

  const trend = rising > falling ? 'rising' : falling > rising ? 'falling' : 'stable';
  return { trend, values, rising, falling };
}

export function getHistorySummary() {
  const history = loadHistory();
  return {
    totalEntries: history.entries.length,
    maxEntries: MAX_ENTRIES,
    oldestTimestamp: history.entries[0]?.timestamp ?? null,
    newestTimestamp: history.entries[history.entries.length - 1]?.timestamp ?? null,
    latestDiff: getLatestDiff(),
  };
}

// ── CLI ──
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const mode = process.argv[2] ?? 'capture';

  if (mode === 'capture') {
    console.log('[state-memory] Capturing snapshot and appending to history...');
    const snapshot = captureSnapshot();
    const history = appendSnapshot(snapshot);
    const diff = getLatestDiff();
    console.log(`[state-memory] History: ${history.entries.length}/${MAX_ENTRIES} entries`);
    if (diff) {
      console.log('[state-memory] Diff from previous:');
      for (const [k, v] of Object.entries(diff)) {
        console.log(`  ${k}: ${JSON.stringify(v)}`);
      }
    } else {
      console.log('[state-memory] No previous entry for diff');
    }
  } else if (mode === 'summary') {
    const summary = getHistorySummary();
    console.log(JSON.stringify(summary, null, 2));
  }
}
