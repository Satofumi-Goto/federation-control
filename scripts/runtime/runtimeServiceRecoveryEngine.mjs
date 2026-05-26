#!/usr/bin/env node
/**
 * Runtime Service Recovery Engine
 *
 * Detects service crashes and restores Runtime state:
 * execution queue, governance, trigger daemon, and operational snapshot.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const SERVICE_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-service-state.json');
const WATCH_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-trigger-watch-state.json');
const QUEUE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-execution-queue.json');
const SUPERVISOR_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-trigger-supervisor-state.json');

const MAX_RESTART_ATTEMPTS = 5;

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function isPidAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; }
  catch { return false; }
}

export function detectCrash() {
  const state = loadJson(SERVICE_STATE_PATH);
  if (!state) return { crashed: false, reason: 'no-state-file' };

  if (!state.service.active) return { crashed: false, reason: 'service-not-active' };

  if (state.service.pid && !isPidAlive(state.service.pid)) {
    return { crashed: true, reason: 'pid-dead', pid: state.service.pid, lastActive: state.service.startupTime };
  }

  return { crashed: false, reason: 'service-running' };
}

export function recoverTriggerState() {
  const watch = loadJson(WATCH_STATE_PATH);
  if (!watch) return { recovered: false, reason: 'no-watch-state' };

  const fixes = [];

  if (watch.watcher.active) {
    watch.watcher.active = false;
    fixes.push('reset-watcher-active-flag');
  }

  if (watch.debounce.active) {
    watch.debounce.active = false;
    watch.debounce.pendingSince = null;
    fixes.push('reset-debounce');
  }

  if (fixes.length > 0) saveJson(WATCH_STATE_PATH, watch);
  return { recovered: true, fixes };
}

export function recoverExecutionQueue() {
  const queue = loadJson(QUEUE_PATH);
  if (!queue) return { recovered: false, reason: 'no-queue-file' };

  const fixes = [];

  if (queue.active) {
    queue.active.status = 'interrupted';
    queue.active.completedAt = new Date().toISOString();
    queue.items.unshift(queue.active);
    queue.active = null;
    fixes.push('requeued-interrupted-execution');
  }

  if (fixes.length > 0) saveJson(QUEUE_PATH, queue);
  return { recovered: true, fixes, queueDepth: queue.items.length };
}

export function recoverSupervisorState() {
  const supervisor = loadJson(SUPERVISOR_STATE_PATH);
  if (!supervisor) return { recovered: false, reason: 'no-supervisor-state' };

  const fixes = [];

  if (supervisor.paused && supervisor.pausedUntil) {
    const now = Date.now();
    if (now >= supervisor.pausedUntil) {
      supervisor.paused = false;
      supervisor.pausedUntil = null;
      fixes.push('cleared-expired-pause');
    }
  }

  if (fixes.length > 0) saveJson(SUPERVISOR_STATE_PATH, supervisor);
  return { recovered: true, fixes };
}

export function recoverServiceState() {
  const state = loadJson(SERVICE_STATE_PATH) ?? {
    service: { active: false, startupTime: null, restartCount: 0, pid: null },
    execution: { active: false, currentInstructionHash: null, queueDepth: 0 },
    orchestration: { active: false, mode: null },
    monitor: { active: false, lastCheck: null },
    recovery: { lastEvent: null, lastEventType: null, recoveryCount: 0 },
    crash: { lastEvent: null, lastReason: null, crashCount: 0 },
  };

  state.service.active = false;
  state.service.pid = null;
  state.execution.active = false;
  state.orchestration.active = false;
  state.monitor.active = false;

  saveJson(SERVICE_STATE_PATH, state);
  return state;
}

export function runFullRecovery() {
  const now = new Date().toISOString();
  const results = { timestamp: now, steps: [] };

  // 1. Detect crash
  const crash = detectCrash();
  results.steps.push({ step: 'crash-detect', ...crash });

  // 2. Recover service state
  const serviceState = recoverServiceState();
  results.steps.push({ step: 'service-state', recovered: true });

  // 3. Recover trigger state
  const trigger = recoverTriggerState();
  results.steps.push({ step: 'trigger-state', ...trigger });

  // 4. Recover execution queue
  const queue = recoverExecutionQueue();
  results.steps.push({ step: 'execution-queue', ...queue });

  // 5. Recover supervisor state
  const supervisor = recoverSupervisorState();
  results.steps.push({ step: 'supervisor-state', ...supervisor });

  // 6. Update recovery counters
  if (crash.crashed) {
    serviceState.crash.lastEvent = now;
    serviceState.crash.lastReason = crash.reason;
    serviceState.crash.crashCount++;
  }
  serviceState.recovery.lastEvent = now;
  serviceState.recovery.lastEventType = crash.crashed ? 'crash-recovery' : 'clean-recovery';
  serviceState.recovery.recoveryCount++;
  saveJson(SERVICE_STATE_PATH, serviceState);

  // 7. Check restart limit
  const canRestart = serviceState.service.restartCount < MAX_RESTART_ATTEMPTS;
  results.canRestart = canRestart;
  results.restartCount = serviceState.service.restartCount;
  results.maxRestarts = MAX_RESTART_ATTEMPTS;

  return results;
}

if (process.argv[1]?.endsWith('runtimeServiceRecoveryEngine.mjs')) {
  console.log('[recovery] Runtime Service Recovery Engine');
  console.log('='.repeat(55));

  const results = runFullRecovery();

  for (const step of results.steps) {
    const status = step.crashed !== undefined ? (step.crashed ? 'CRASHED' : 'OK') : (step.recovered ? 'RECOVERED' : 'SKIPPED');
    console.log(`  [${status}] ${step.step}${step.reason ? ` — ${step.reason}` : ''}${step.fixes?.length ? ` (${step.fixes.join(', ')})` : ''}`);
  }

  console.log(`\n  Can restart: ${results.canRestart}`);
  console.log(`  Restart count: ${results.restartCount}/${results.maxRestarts}`);

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[recovery] ${results.canRestart ? 'RECOVERY COMPLETE — ready to restart' : 'RESTART LIMIT REACHED — manual intervention required'}`);
  console.log('\n' + JSON.stringify({ ok: true, ...results }, null, 2));
}
