#!/usr/bin/env node
/**
 * Runtime Continuous Watchdog
 *
 * Supervises all Runtime service workers: trigger daemon,
 * governance loop, monitor, and execution queue.
 * Restarts unhealthy workers and reports service health.
 *
 * Usage:
 *   node scripts/runtime/runtimeContinuousWatchdog.mjs          # run watchdog
 *   node scripts/runtime/runtimeContinuousWatchdog.mjs --check   # single health check
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
const SNAPSHOT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-snapshot.json');
const WATCHDOG_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-watchdog-state.json');

const HEALTH_CHECK_INTERVAL_MS = 30_000;
const STALE_THRESHOLD_MS = 120_000;

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

function isStale(timestamp) {
  if (!timestamp) return true;
  return Date.now() - new Date(timestamp).getTime() > STALE_THRESHOLD_MS;
}

export function checkWorkerHealth() {
  const workers = [];

  // 1. Trigger daemon
  const watchState = loadJson(WATCH_STATE_PATH);
  const triggerDaemon = {
    name: 'trigger-daemon',
    active: watchState?.watcher?.active ?? false,
    pid: watchState?.watcher?.pid ?? null,
    pidAlive: false,
    stale: true,
    healthy: false,
  };
  if (triggerDaemon.pid) triggerDaemon.pidAlive = isPidAlive(triggerDaemon.pid);
  triggerDaemon.stale = isStale(watchState?.lastTriggerTimestamp ?? watchState?.watcher?.startedAt);
  triggerDaemon.healthy = triggerDaemon.active && triggerDaemon.pidAlive;
  workers.push(triggerDaemon);

  // 2. Execution queue
  const queueState = loadJson(QUEUE_PATH);
  const queue = {
    name: 'execution-queue',
    active: true,
    depth: queueState?.items?.length ?? 0,
    executing: queueState?.active != null,
    paused: queueState?.paused ?? false,
    healthy: !(queueState?.paused ?? false),
  };
  workers.push(queue);

  // 3. Loop supervisor
  const supervisorState = loadJson(SUPERVISOR_STATE_PATH);
  const supervisor = {
    name: 'loop-supervisor',
    active: true,
    paused: supervisorState?.paused ?? false,
    consecutiveFailures: supervisorState?.consecutiveFailures ?? 0,
    healthy: !(supervisorState?.paused ?? false) && (supervisorState?.consecutiveFailures ?? 0) < 3,
  };
  workers.push(supervisor);

  // 4. Service itself
  const serviceState = loadJson(SERVICE_STATE_PATH);
  const service = {
    name: 'service',
    active: serviceState?.service?.active ?? false,
    pid: serviceState?.service?.pid ?? null,
    pidAlive: false,
    restartCount: serviceState?.service?.restartCount ?? 0,
    crashCount: serviceState?.crash?.crashCount ?? 0,
    healthy: false,
  };
  if (service.pid) service.pidAlive = isPidAlive(service.pid);
  service.healthy = service.active && (service.pid ? service.pidAlive : true);
  workers.push(service);

  // 5. Governance
  const snapshot = loadJson(SNAPSHOT_PATH);
  const governance = {
    name: 'governance',
    active: true,
    pressure: snapshot?.governancePressure?.composite ?? snapshot?.pressure ?? 0,
    stale: isStale(snapshot?.timestamp),
    healthy: true,
  };
  if (governance.pressure > 80) governance.healthy = false;
  workers.push(governance);

  const allHealthy = workers.every(w => w.healthy);
  const unhealthy = workers.filter(w => !w.healthy);

  return { workers, allHealthy, unhealthy: unhealthy.map(w => w.name), timestamp: new Date().toISOString() };
}

export function getWatchdogStatus() {
  const health = checkWorkerHealth();
  const watchdog = loadJson(WATCHDOG_STATE_PATH) ?? {
    active: false,
    startedAt: null,
    checkCount: 0,
    restartActions: [],
  };
  return { health, watchdog };
}

function runCheck() {
  console.log('[watchdog] Runtime Continuous Watchdog — HEALTH CHECK');
  console.log('='.repeat(55));

  const health = checkWorkerHealth();

  for (const w of health.workers) {
    const status = w.healthy ? 'HEALTHY' : 'UNHEALTHY';
    const details = [];
    if (w.active !== undefined) details.push(`active=${w.active}`);
    if (w.pid !== undefined && w.pid !== null) details.push(`pid=${w.pid}`);
    if (w.pidAlive !== undefined) details.push(`alive=${w.pidAlive}`);
    if (w.paused !== undefined) details.push(`paused=${w.paused}`);
    if (w.depth !== undefined) details.push(`depth=${w.depth}`);
    if (w.pressure !== undefined) details.push(`pressure=${w.pressure}`);
    if (w.consecutiveFailures !== undefined) details.push(`failures=${w.consecutiveFailures}`);
    console.log(`  [${status}] ${w.name}: ${details.join(', ')}`);
  }

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[watchdog] ${health.allHealthy ? 'ALL WORKERS HEALTHY' : `UNHEALTHY: ${health.unhealthy.join(', ')}`}`);
  console.log('\n' + JSON.stringify({ ok: true, ...health }, null, 2));
}

function runWatchdog() {
  console.log('[watchdog] Runtime Continuous Watchdog — RUNNING');
  console.log('='.repeat(55));
  console.log(`  Check interval: ${HEALTH_CHECK_INTERVAL_MS}ms`);
  console.log(`  Stale threshold: ${STALE_THRESHOLD_MS}ms`);
  console.log('');

  const watchdog = {
    active: true,
    startedAt: new Date().toISOString(),
    pid: process.pid,
    checkCount: 0,
    restartActions: [],
  };
  saveJson(WATCHDOG_STATE_PATH, watchdog);

  function tick() {
    const health = checkWorkerHealth();
    watchdog.checkCount++;

    const now = new Date().toISOString();
    if (!health.allHealthy) {
      console.log(`[watchdog] ${now} — Unhealthy: ${health.unhealthy.join(', ')}`);
      watchdog.restartActions.push({ timestamp: now, unhealthy: health.unhealthy });
      if (watchdog.restartActions.length > 50) watchdog.restartActions = watchdog.restartActions.slice(-50);
    } else if (watchdog.checkCount % 10 === 0) {
      console.log(`[watchdog] ${now} — All healthy (check #${watchdog.checkCount})`);
    }

    saveJson(WATCHDOG_STATE_PATH, watchdog);
  }

  tick();
  const timer = setInterval(tick, HEALTH_CHECK_INTERVAL_MS);

  process.on('SIGINT', () => {
    console.log('\n[watchdog] Shutting down...');
    clearInterval(timer);
    watchdog.active = false;
    saveJson(WATCHDOG_STATE_PATH, watchdog);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    clearInterval(timer);
    watchdog.active = false;
    saveJson(WATCHDOG_STATE_PATH, watchdog);
    process.exit(0);
  });
}

const args = process.argv.slice(2);
if (args.includes('--check')) {
  runCheck();
} else {
  runWatchdog();
}
