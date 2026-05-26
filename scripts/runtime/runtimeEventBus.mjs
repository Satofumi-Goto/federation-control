#!/usr/bin/env node
/**
 * Runtime Event Bus
 *
 * Propagates runtime events across the orchestration pipeline.
 * Stores events persistently and provides query capabilities.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const EVENT_LOG_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-event-log.json');

export const EVENT_TYPES = {
  CREATED: 'runtime.created',
  UPDATED: 'runtime.updated',
  FAILED: 'runtime.failed',
  REPAIRED: 'runtime.repaired',
  DEPLOYED: 'runtime.deployed',
  ROLLBACK: 'runtime.rollback',
  DRIFT: 'runtime.drift',
  BLOCKED: 'runtime.blocked',
  RECOVERED: 'runtime.recovered',
  GOVERNANCE_CHANGE: 'runtime.governance_change',
  PRESSURE_SPIKE: 'runtime.pressure_spike',
  MODE_CHANGE: 'runtime.mode_change',
  LOOP_TICK: 'runtime.loop_tick',
  STORM_DETECTED: 'runtime.storm_detected',
  THROTTLED: 'runtime.throttled',
};

const MAX_EVENTS = 500;

function loadEvents() {
  try { return JSON.parse(fs.readFileSync(EVENT_LOG_PATH, 'utf8')); }
  catch { return []; }
}

function saveEvents(events) {
  fs.mkdirSync(path.dirname(EVENT_LOG_PATH), { recursive: true });
  fs.writeFileSync(EVENT_LOG_PATH, JSON.stringify(events, null, 2) + '\n', 'utf8');
}

/**
 * Emit a runtime event.
 */
export function emit(type, data = {}) {
  const event = {
    type,
    data,
    timestamp: new Date().toISOString(),
  };

  const events = loadEvents();
  events.push(event);
  const trimmed = events.slice(-MAX_EVENTS);
  saveEvents(trimmed);

  return event;
}

/**
 * Query recent events by type.
 */
export function query(type, limit = 10) {
  const events = loadEvents();
  const filtered = type ? events.filter(e => e.type === type) : events;
  return filtered.slice(-limit);
}

/**
 * Count events of a given type within a time window.
 */
export function countSince(type, sinceMs) {
  const events = loadEvents();
  const cutoff = Date.now() - sinceMs;
  return events.filter(e => e.type === type && new Date(e.timestamp).getTime() > cutoff).length;
}

/**
 * Get event frequency (events per minute) for a type within a window.
 */
export function frequency(type, windowMs = 60 * 60 * 1000) {
  const count = countSince(type, windowMs);
  const minutes = windowMs / (60 * 1000);
  return Math.round((count / minutes) * 100) / 100;
}

/**
 * Get a summary of all event types and their counts.
 */
export function summary() {
  const events = loadEvents();
  const counts = {};
  for (const e of events) {
    counts[e.type] = (counts[e.type] || 0) + 1;
  }
  return { total: events.length, types: counts, oldest: events[0]?.timestamp, newest: events[events.length - 1]?.timestamp };
}

/**
 * Detect event storms (too many events of one type in a short window).
 */
export function detectStorm(windowMs = 5 * 60 * 1000, threshold = 20) {
  const events = loadEvents();
  const cutoff = Date.now() - windowMs;
  const recent = events.filter(e => new Date(e.timestamp).getTime() > cutoff);

  const counts = {};
  for (const e of recent) {
    counts[e.type] = (counts[e.type] || 0) + 1;
  }

  const storms = [];
  for (const [type, count] of Object.entries(counts)) {
    if (count >= threshold) {
      storms.push({ type, count, threshold });
    }
  }

  return { detected: storms.length > 0, storms, recentTotal: recent.length };
}

if (process.argv[1]?.endsWith('runtimeEventBus.mjs')) {
  console.log('[event-bus] Runtime Event Bus');
  console.log('='.repeat(55));

  emit(EVENT_TYPES.LOOP_TICK, { source: 'event-bus-test', mode: 'diagnostic' });

  const s = summary();
  console.log(`\n  Total events: ${s.total}`);
  console.log('  Event types:');
  for (const [type, count] of Object.entries(s.types)) {
    console.log(`    ${type}: ${count}`);
  }

  const storm = detectStorm();
  console.log(`\n  Storm detection: ${storm.detected ? 'STORM DETECTED' : 'clear'}`);
  console.log(`  Recent events (5min): ${storm.recentTotal}`);

  const recentTicks = query(EVENT_TYPES.LOOP_TICK, 3);
  console.log(`\n  Recent loop ticks: ${recentTicks.length}`);

  console.log(`\n${'='.repeat(55)}`);
  console.log('[event-bus] Status: OPERATIONAL');
  console.log('\n' + JSON.stringify({ ok: true, summary: s, storm, timestamp: new Date().toISOString() }, null, 2));
}
