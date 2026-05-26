/**
 * Drift Timeline Engine
 *
 * Records drift events with origin, affected domains, duration,
 * recovery events, and recurrence detection.
 *
 * Data sources:
 *   - Runtime snapshots (drift state)
 *   - Repair audit log
 *   - Digital twin graph (domain states)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { loadLatestSnapshot } from './runtimeSnapshotEngine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const STATE_DIR = path.resolve(REPO_ROOT, 'runtime_data/state');
const TIMELINE_PATH = path.resolve(STATE_DIR, 'runtime-drift-timeline.json');
const MAX_EVENTS = 100;

function loadTimeline() {
  try {
    const data = JSON.parse(fs.readFileSync(TIMELINE_PATH, 'utf8'));
    if (!Array.isArray(data.events)) throw new Error('invalid');
    return data;
  } catch {
    return { events: [], version: 1 };
  }
}

function saveTimeline(timeline) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  if (timeline.events.length > MAX_EVENTS) {
    timeline.events = timeline.events.slice(-MAX_EVENTS);
  }
  fs.writeFileSync(TIMELINE_PATH, JSON.stringify(timeline, null, 2) + '\n', 'utf8');
}

export function recordDriftEvent(snapshot) {
  if (!snapshot) return null;

  const timeline = loadTimeline();
  const drift = snapshot.drift ?? {};
  const health = snapshot.health ?? {};

  const isDrifting = drift.state !== 'healthy' || (drift.degradedDomains?.length ?? 0) > 0;
  const lastEvent = timeline.events[timeline.events.length - 1];
  const isNewEvent = !lastEvent || lastEvent.resolved || lastEvent.driftState !== drift.state;

  if (isDrifting && isNewEvent) {
    const event = {
      id: crypto.randomUUID(),
      type: 'drift_detected',
      timestamp: snapshot.timestamp,
      snapshotId: snapshot.id,
      driftState: drift.state,
      affectedDomains: drift.degradedDomains ?? [],
      congestionLevel: drift.congestionLevel ?? 'none',
      hotspots: drift.hotspots ?? [],
      governancePressure: health.governancePressure ?? 0,
      propagationSeverity: health.propagationSeverity ?? 0,
      resolved: false,
      resolvedAt: null,
      durationMs: null,
      recurrence: detectRecurrence(timeline, drift.degradedDomains ?? []),
    };
    timeline.events.push(event);
    saveTimeline(timeline);
    return event;
  }

  if (!isDrifting && lastEvent && !lastEvent.resolved) {
    lastEvent.resolved = true;
    lastEvent.resolvedAt = snapshot.timestamp;
    lastEvent.durationMs = new Date(snapshot.timestamp) - new Date(lastEvent.timestamp);
    lastEvent.type = 'drift_recovered';
    saveTimeline(timeline);
    return lastEvent;
  }

  if (isDrifting && lastEvent && !lastEvent.resolved) {
    lastEvent.affectedDomains = [...new Set([
      ...(lastEvent.affectedDomains ?? []),
      ...(drift.degradedDomains ?? []),
    ])];
    lastEvent.governancePressure = health.governancePressure ?? lastEvent.governancePressure;
    saveTimeline(timeline);
  }

  return null;
}

function detectRecurrence(timeline, domains) {
  const resolved = timeline.events.filter(e => e.resolved);
  const matching = resolved.filter(e =>
    e.affectedDomains?.some(d => domains.includes(d))
  );
  return {
    count: matching.length,
    isRecurrent: matching.length >= 2,
    lastOccurrence: matching[matching.length - 1]?.timestamp ?? null,
  };
}

export function getDriftSummary() {
  const timeline = loadTimeline();
  const events = timeline.events;
  const active = events.filter(e => !e.resolved);
  const resolved = events.filter(e => e.resolved);
  const durations = resolved.filter(e => e.durationMs).map(e => e.durationMs);
  const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

  const domainFrequency = {};
  for (const e of events) {
    for (const d of e.affectedDomains ?? []) {
      domainFrequency[d] = (domainFrequency[d] || 0) + 1;
    }
  }

  return {
    totalEvents: events.length,
    activeEvents: active.length,
    resolvedEvents: resolved.length,
    avgRecoveryMs: avgDuration,
    recurrentDomains: Object.entries(domainFrequency)
      .filter(([, c]) => c >= 2)
      .map(([d, c]) => ({ domain: d, count: c })),
  };
}

// ── CLI ──
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const snapshot = loadLatestSnapshot();
  if (!snapshot) {
    console.log('[drift-timeline] No snapshot available. Run snapshot engine first.');
    process.exit(1);
  }
  console.log('[drift-timeline] Recording drift event from latest snapshot...');
  const event = recordDriftEvent(snapshot);
  if (event) {
    console.log(`[drift-timeline] Event: ${event.type} (${event.id})`);
    console.log(`  Affected: ${event.affectedDomains?.join(', ') || 'none'}`);
  } else {
    console.log('[drift-timeline] No new drift event recorded');
  }
  const summary = getDriftSummary();
  console.log(`[drift-timeline] Summary: ${summary.totalEvents} total, ${summary.activeEvents} active, ${summary.resolvedEvents} resolved`);
}
