#!/usr/bin/env node
/**
 * Runtime Environment Supervisor
 *
 * Supervises the always-on Runtime environment: memory, queue saturation,
 * CPU pressure, deploy stability, and recovery pressure.
 *
 * Usage:
 *   node scripts/runtime/runtimeEnvironmentSupervisor.mjs           # run supervisor
 *   node scripts/runtime/runtimeEnvironmentSupervisor.mjs --check   # single check
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const ENV_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-environment-state.json');
const QUEUE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-execution-queue.json');
const SUPERVISOR_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-trigger-supervisor-state.json');
const SERVICE_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-service-state.json');
const SNAPSHOT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-snapshot.json');

const THRESHOLDS = {
  memoryMb: 512,
  queueDepth: 15,
  consecutiveFailures: 3,
  deployFailures: 3,
  recoveryCount: 10,
  pressureComposite: 75,
};

const CHECK_INTERVAL_MS = 60_000;

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export function assessEnvironment() {
  const checks = [];
  const pressure = { memory: 0, cpu: 0, queue: 0, deploy: 0, recovery: 0, composite: 0 };

  // 1. Memory
  const memUsage = process.memoryUsage();
  const heapMb = Math.round(memUsage.heapUsed / 1024 / 1024);
  pressure.memory = Math.min(100, Math.round((heapMb / THRESHOLDS.memoryMb) * 100));
  checks.push({
    check: 'memory',
    pass: heapMb < THRESHOLDS.memoryMb,
    detail: `Heap: ${heapMb}MB / ${THRESHOLDS.memoryMb}MB`,
    pressure: pressure.memory,
  });

  // 2. Queue saturation
  const queue = loadJson(QUEUE_PATH);
  const queueDepth = queue?.items?.length ?? 0;
  const queuePaused = queue?.paused ?? false;
  pressure.queue = Math.min(100, Math.round((queueDepth / THRESHOLDS.queueDepth) * 100));
  checks.push({
    check: 'queue-saturation',
    pass: queueDepth < THRESHOLDS.queueDepth && !queuePaused,
    detail: `Queue: ${queueDepth}/${THRESHOLDS.queueDepth}${queuePaused ? ' (PAUSED)' : ''}`,
    pressure: pressure.queue,
  });

  // 3. Execution stability (consecutive failures)
  const supervisor = loadJson(SUPERVISOR_STATE_PATH);
  const failures = supervisor?.consecutiveFailures ?? 0;
  const failPressure = Math.min(100, Math.round((failures / THRESHOLDS.consecutiveFailures) * 100));
  pressure.deploy = failPressure;
  checks.push({
    check: 'execution-stability',
    pass: failures < THRESHOLDS.consecutiveFailures,
    detail: `Consecutive failures: ${failures}/${THRESHOLDS.consecutiveFailures}`,
    pressure: failPressure,
  });

  // 4. Recovery pressure
  const serviceState = loadJson(SERVICE_STATE_PATH);
  const recoveryCount = serviceState?.recovery?.recoveryCount ?? 0;
  pressure.recovery = Math.min(100, Math.round((recoveryCount / THRESHOLDS.recoveryCount) * 100));
  checks.push({
    check: 'recovery-pressure',
    pass: recoveryCount < THRESHOLDS.recoveryCount,
    detail: `Recoveries: ${recoveryCount}/${THRESHOLDS.recoveryCount}`,
    pressure: pressure.recovery,
  });

  // 5. Governance pressure
  const snapshot = loadJson(SNAPSHOT_PATH);
  const govPressure = snapshot?.governancePressure?.composite ?? 0;
  checks.push({
    check: 'governance-pressure',
    pass: govPressure < THRESHOLDS.pressureComposite,
    detail: `Governance pressure: ${govPressure}/${THRESHOLDS.pressureComposite}`,
    pressure: govPressure,
  });

  // Composite
  pressure.composite = Math.round(
    (pressure.memory * 0.15) +
    (pressure.queue * 0.25) +
    (pressure.deploy * 0.25) +
    (pressure.recovery * 0.15) +
    (govPressure * 0.20)
  );

  const allPass = checks.every(c => c.pass);
  const healthStatus = allPass ? 'healthy' : pressure.composite > 80 ? 'critical' : 'degraded';

  // Determine if autonomous pause needed
  let autonomousPause = false;
  let pauseReason = null;
  if (pressure.composite > 80) {
    autonomousPause = true;
    pauseReason = `Composite pressure ${pressure.composite} exceeds threshold`;
  }
  if (failures >= THRESHOLDS.consecutiveFailures) {
    autonomousPause = true;
    pauseReason = `${failures} consecutive failures — manual review required`;
  }

  // Persist state
  const envState = loadJson(ENV_STATE_PATH) ?? {};
  envState.pressure = pressure;
  envState.health = { status: healthStatus, score: 100 - pressure.composite, lastCheck: new Date().toISOString() };
  saveJson(ENV_STATE_PATH, envState);

  return {
    checks,
    pressure,
    health: healthStatus,
    healthScore: 100 - pressure.composite,
    allPass,
    autonomousPause,
    pauseReason,
    timestamp: new Date().toISOString(),
  };
}

function runCheck() {
  console.log('[environment] Runtime Environment Supervisor — CHECK');
  console.log('='.repeat(55));

  const result = assessEnvironment();

  for (const c of result.checks) {
    console.log(`  ${c.pass ? 'PASS' : 'WARN'}: [${c.check}] ${c.detail} (pressure: ${c.pressure}%)`);
  }

  console.log(`\n  Composite pressure: ${result.pressure.composite}%`);
  console.log(`  Health: ${result.health} (score: ${result.healthScore})`);
  if (result.autonomousPause) console.log(`  AUTONOMOUS PAUSE: ${result.pauseReason}`);

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[environment] ${result.health.toUpperCase()}`);
  console.log('\n' + JSON.stringify({ ok: true, ...result }, null, 2));
}

function runSupervisor() {
  console.log('[environment] Runtime Environment Supervisor — RUNNING');
  console.log('='.repeat(55));
  console.log(`  Check interval: ${CHECK_INTERVAL_MS}ms`);
  console.log('');

  function tick() {
    const result = assessEnvironment();
    const now = new Date().toISOString();
    if (!result.allPass || result.autonomousPause) {
      console.log(`[environment] ${now} — ${result.health} (pressure: ${result.pressure.composite}%)${result.autonomousPause ? ' — PAUSE TRIGGERED' : ''}`);
    }
  }

  tick();
  const timer = setInterval(tick, CHECK_INTERVAL_MS);

  process.on('SIGINT', () => {
    console.log('\n[environment] Shutting down...');
    clearInterval(timer);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    clearInterval(timer);
    process.exit(0);
  });
}

if (process.argv[1]?.endsWith('runtimeEnvironmentSupervisor.mjs')) {
  const args = process.argv.slice(2);
  if (args.includes('--check')) {
    runCheck();
  } else {
    runSupervisor();
  }
}
