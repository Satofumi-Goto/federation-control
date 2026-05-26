#!/usr/bin/env node
/**
 * Runtime Trigger Loop Supervisor
 *
 * Prevents execution storms, infinite trigger loops, and repeated
 * failed execution attempts. Enforces throttling and cooldown periods.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const SUPERVISOR_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-trigger-supervisor-state.json');

const LIMITS = {
  maxExecutionsPerHour: 10,
  maxConsecutiveFailures: 3,
  minIntervalMs: 30_000,
  cooldownAfterFailureMs: 120_000,
  stormWindowMs: 60_000,
  stormThreshold: 5,
  pauseDurationMs: 300_000,
};

function loadState() {
  try { return JSON.parse(fs.readFileSync(SUPERVISOR_STATE_PATH, 'utf8')); }
  catch {
    return {
      executions: [],
      consecutiveFailures: 0,
      paused: false,
      pausedUntil: null,
      lastExecution: null,
      totalExecutions: 0,
      totalBlocked: 0,
    };
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(SUPERVISOR_STATE_PATH), { recursive: true });
  fs.writeFileSync(SUPERVISOR_STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function pruneOldExecutions(executions) {
  const cutoff = Date.now() - 3_600_000;
  return executions.filter(e => e.timestamp > cutoff);
}

export function checkSupervisor() {
  const state = loadState();
  const now = Date.now();
  const issues = [];

  // Prune old entries
  state.executions = pruneOldExecutions(state.executions);

  // 1. Pause check
  if (state.paused) {
    if (state.pausedUntil && now < state.pausedUntil) {
      const remaining = Math.ceil((state.pausedUntil - now) / 1000);
      issues.push({ check: 'paused', detail: `Auto-trigger paused for ${remaining}s` });
      saveState(state);
      return { allowed: false, reason: 'paused', issues, state };
    }
    state.paused = false;
    state.pausedUntil = null;
  }

  // 2. Rate limit — max per hour
  if (state.executions.length >= LIMITS.maxExecutionsPerHour) {
    issues.push({ check: 'rate-limit', detail: `${state.executions.length}/${LIMITS.maxExecutionsPerHour} executions this hour` });
    state.paused = true;
    state.pausedUntil = now + LIMITS.pauseDurationMs;
    state.totalBlocked++;
    saveState(state);
    return { allowed: false, reason: 'rate-limit', issues, state };
  }

  // 3. Minimum interval
  if (state.lastExecution) {
    const elapsed = now - state.lastExecution;
    if (elapsed < LIMITS.minIntervalMs) {
      const wait = Math.ceil((LIMITS.minIntervalMs - elapsed) / 1000);
      issues.push({ check: 'min-interval', detail: `Must wait ${wait}s before next execution` });
      state.totalBlocked++;
      saveState(state);
      return { allowed: false, reason: 'min-interval', issues, state };
    }
  }

  // 4. Consecutive failure cooldown
  if (state.consecutiveFailures >= LIMITS.maxConsecutiveFailures) {
    if (state.lastExecution) {
      const elapsed = now - state.lastExecution;
      if (elapsed < LIMITS.cooldownAfterFailureMs) {
        const wait = Math.ceil((LIMITS.cooldownAfterFailureMs - elapsed) / 1000);
        issues.push({ check: 'failure-cooldown', detail: `${state.consecutiveFailures} consecutive failures — cooldown ${wait}s` });
        state.totalBlocked++;
        saveState(state);
        return { allowed: false, reason: 'failure-cooldown', issues, state };
      }
    }
    state.consecutiveFailures = 0;
  }

  // 5. Storm detection
  const stormWindow = state.executions.filter(e => e.timestamp > now - LIMITS.stormWindowMs);
  if (stormWindow.length >= LIMITS.stormThreshold) {
    issues.push({ check: 'storm', detail: `${stormWindow.length} executions in ${LIMITS.stormWindowMs / 1000}s — storm detected` });
    state.paused = true;
    state.pausedUntil = now + LIMITS.pauseDurationMs;
    state.totalBlocked++;
    saveState(state);
    return { allowed: false, reason: 'storm', issues, state };
  }

  saveState(state);
  return { allowed: true, reason: null, issues, state };
}

export function recordExecution(success) {
  const state = loadState();
  const now = Date.now();

  state.executions = pruneOldExecutions(state.executions);
  state.executions.push({ timestamp: now, success });
  state.lastExecution = now;
  state.totalExecutions++;

  if (success) {
    state.consecutiveFailures = 0;
  } else {
    state.consecutiveFailures++;
    if (state.consecutiveFailures >= LIMITS.maxConsecutiveFailures) {
      state.paused = true;
      state.pausedUntil = now + LIMITS.pauseDurationMs;
    }
  }

  saveState(state);
  return state;
}

export function resetSupervisor() {
  const state = {
    executions: [],
    consecutiveFailures: 0,
    paused: false,
    pausedUntil: null,
    lastExecution: null,
    totalExecutions: 0,
    totalBlocked: 0,
  };
  saveState(state);
  return state;
}

if (process.argv[1]?.endsWith('runtimeTriggerLoopSupervisor.mjs')) {
  const args = process.argv.slice(2);

  if (args.includes('--reset')) {
    resetSupervisor();
    console.log('[supervisor] State reset');
    console.log('\n' + JSON.stringify({ ok: true, action: 'reset', timestamp: new Date().toISOString() }, null, 2));
  } else {
    console.log('[supervisor] Runtime Trigger Loop Supervisor');
    console.log('='.repeat(55));

    const check = checkSupervisor();
    console.log(`\n  Allowed: ${check.allowed}`);
    if (check.reason) console.log(`  Reason: ${check.reason}`);
    for (const i of check.issues) {
      console.log(`  [${i.check}] ${i.detail}`);
    }

    const { state } = check;
    console.log(`\n  Executions (1h): ${state.executions.length}/${LIMITS.maxExecutionsPerHour}`);
    console.log(`  Consecutive failures: ${state.consecutiveFailures}/${LIMITS.maxConsecutiveFailures}`);
    console.log(`  Paused: ${state.paused}`);
    console.log(`  Total executions: ${state.totalExecutions}`);
    console.log(`  Total blocked: ${state.totalBlocked}`);

    console.log(`\n${'='.repeat(55)}`);
    console.log(`[supervisor] ${check.allowed ? 'EXECUTION ALLOWED' : `BLOCKED: ${check.reason}`}`);
    console.log('\n' + JSON.stringify({
      ok: true,
      allowed: check.allowed,
      reason: check.reason,
      limits: LIMITS,
      state: {
        executionsThisHour: state.executions.length,
        consecutiveFailures: state.consecutiveFailures,
        paused: state.paused,
        totalExecutions: state.totalExecutions,
        totalBlocked: state.totalBlocked,
      },
      timestamp: new Date().toISOString(),
    }, null, 2));
  }
}
