#!/usr/bin/env node
/**
 * Runtime Boot Manager
 *
 * Bootstraps the always-on Federation Runtime environment.
 * Loads modules, validates readiness, and starts all services.
 *
 * Usage:
 *   node scripts/runtime/runtimeBootManager.mjs                    # boot standard
 *   node scripts/runtime/runtimeBootManager.mjs minimal            # boot minimal
 *   node scripts/runtime/runtimeBootManager.mjs --status           # show boot status
 *   node scripts/runtime/runtimeBootManager.mjs --validate         # validate only
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadModules, getModuleStatus } from './runtimeModuleLoader.mjs';
import { assessEnvironment } from './runtimeEnvironmentSupervisor.mjs';
import { runFullRecovery } from './runtimeServiceRecoveryEngine.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const ENV_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-environment-state.json');
const PROFILE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-startup-profile.json');
const SERVICE_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-service-state.json');

const STARTUP_MODES = ['minimal', 'standard', 'full', 'repair', 'recovery', 'safe-mode', 'diagnostic'];

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function tryExec(cmd, timeout = 30_000) {
  try {
    const output = execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', timeout, stdio: ['pipe', 'pipe', 'pipe'] });
    return { ok: true, output: output.trim() };
  } catch (err) {
    return { ok: false, output: err.stdout?.trim() ?? '', error: err.stderr?.trim() ?? err.message };
  }
}

function validatePreBoot() {
  const checks = [];

  // 1. Repository identity
  const pkg = loadJson(path.resolve(REPO_ROOT, 'package.json'));
  checks.push({ check: 'repo-identity', pass: pkg?.name === 'federation-control', detail: pkg?.name ?? 'unknown' });

  // 2. Node.js version
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1));
  checks.push({ check: 'node-version', pass: major >= 18, detail: nodeVersion });

  // 3. SDK installed
  const sdkPkg = loadJson(path.resolve(REPO_ROOT, 'node_modules/@cursor/sdk/package.json'));
  checks.push({ check: 'sdk-installed', pass: !!sdkPkg, detail: sdkPkg ? `v${sdkPkg.version}` : 'not installed' });

  // 4. Runtime data directory
  const dataDir = path.resolve(REPO_ROOT, 'runtime_data');
  checks.push({ check: 'data-directory', pass: fs.existsSync(dataDir), detail: dataDir });

  // 5. Registry exists
  const registry = loadJson(path.resolve(REPO_ROOT, 'src/runtime/registry/runtimeRegistryData.json'));
  checks.push({ check: 'registry', pass: Array.isArray(registry) && registry.length >= 5, detail: `${registry?.length ?? 0} cards` });

  // 6. Governance
  const governance = tryExec('node scripts/runtime/runtimePolicyEngine.mjs', 15_000);
  checks.push({ check: 'governance', pass: governance.ok, detail: governance.ok ? 'active' : 'failed' });

  return { checks, allPass: checks.every(c => c.pass) };
}

function boot(mode) {
  const startTime = Date.now();
  const results = { mode, steps: [], timestamp: new Date().toISOString() };

  console.log(`[boot] Runtime Boot Manager — ${mode.toUpperCase()}`);
  console.log('='.repeat(55));

  // Step 1: Recovery check
  console.log('\n[boot] Step 1: Recovery check');
  const recovery = runFullRecovery();
  const crashDetected = recovery.steps.some(s => s.crashed);
  results.steps.push({ step: 'recovery', crashDetected, canRestart: recovery.canRestart });
  console.log(`  Crash detected: ${crashDetected}`);
  console.log(`  Can restart: ${recovery.canRestart}`);

  if (!recovery.canRestart) {
    console.log('\n[boot] BOOT ABORTED — restart limit reached');
    results.aborted = true;
    results.reason = 'restart-limit';
    console.log('\n' + JSON.stringify({ ok: false, ...results }, null, 2));
    return results;
  }

  // Step 2: Pre-boot validation
  console.log('\n[boot] Step 2: Pre-boot validation');
  const preBoot = validatePreBoot();
  for (const c of preBoot.checks) {
    console.log(`  ${c.pass ? 'PASS' : 'FAIL'}: [${c.check}] ${c.detail}`);
  }
  results.steps.push({ step: 'pre-boot', allPass: preBoot.allPass, checks: preBoot.checks.length });

  if (!preBoot.allPass && mode !== 'diagnostic') {
    console.log('\n[boot] BOOT ABORTED — pre-boot validation failed');
    results.aborted = true;
    results.reason = 'pre-boot-failed';
    console.log('\n' + JSON.stringify({ ok: false, ...results }, null, 2));
    return results;
  }

  // Step 3: Module loading
  console.log(`\n[boot] Step 3: Module loading (${mode})`);
  const modules = loadModules(mode);
  if (modules.ok) {
    console.log(`  Loaded: ${modules.totalLoaded} modules`);
    console.log(`  Failed: ${modules.totalFailed} modules`);
    console.log(`  Order: ${modules.loadOrder.join(' → ')}`);
  } else {
    console.log(`  ERROR: ${modules.reason}`);
  }
  results.steps.push({ step: 'module-load', ok: modules.ok, loaded: modules.totalLoaded ?? 0, failed: modules.totalFailed ?? 0 });

  if (!modules.ok && mode !== 'diagnostic') {
    console.log('\n[boot] BOOT ABORTED — critical module load failed');
    results.aborted = true;
    results.reason = 'module-load-failed';
    console.log('\n' + JSON.stringify({ ok: false, ...results }, null, 2));
    return results;
  }

  // Step 4: Environment assessment
  console.log('\n[boot] Step 4: Environment assessment');
  const env = assessEnvironment();
  console.log(`  Health: ${env.health} (score: ${env.healthScore})`);
  console.log(`  Pressure: ${env.pressure.composite}%`);
  if (env.autonomousPause) console.log(`  WARNING: ${env.pauseReason}`);
  results.steps.push({ step: 'environment', health: env.health, score: env.healthScore, pressure: env.pressure.composite });

  // Step 5: Update service state
  const serviceState = loadJson(SERVICE_STATE_PATH) ?? {};
  serviceState.service = serviceState.service ?? {};
  serviceState.service.active = true;
  serviceState.service.startupTime = new Date().toISOString();
  serviceState.service.restartCount = (serviceState.service.restartCount ?? 0) + 1;
  serviceState.service.pid = process.pid;
  serviceState.orchestration = { active: true, mode };
  serviceState.monitor = { active: true, lastCheck: new Date().toISOString() };
  saveJson(SERVICE_STATE_PATH, serviceState);

  // Step 6: Update environment state
  const envState = loadJson(ENV_STATE_PATH) ?? {};
  envState.boot = {
    state: 'completed',
    startedAt: results.timestamp,
    completedAt: new Date().toISOString(),
    duration: Date.now() - startTime,
  };
  envState.startupMode = mode;
  saveJson(ENV_STATE_PATH, envState);

  // Step 7: Update startup profile
  const profile = loadJson(PROFILE_PATH) ?? {};
  profile.startupMode = mode;
  profile.duration = { lastBootMs: Date.now() - startTime, lastBootAt: new Date().toISOString() };
  saveJson(PROFILE_PATH, profile);

  const bootDuration = Date.now() - startTime;
  results.steps.push({ step: 'boot-complete', durationMs: bootDuration });
  results.ok = true;
  results.durationMs = bootDuration;
  results.modulesLoaded = modules.totalLoaded ?? 0;
  results.health = env.health;
  results.healthScore = env.healthScore;

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[boot] BOOT COMPLETE — ${mode} mode, ${modules.totalLoaded ?? 0} modules, ${env.health} (${bootDuration}ms)`);
  console.log('\n' + JSON.stringify({ ok: true, ...results }, null, 2));

  return results;
}

function showStatus() {
  console.log('[boot] Runtime Boot Manager — STATUS');
  console.log('='.repeat(55));

  const serviceState = loadJson(SERVICE_STATE_PATH);
  const envState = loadJson(ENV_STATE_PATH);
  const profile = loadJson(PROFILE_PATH);

  console.log(`\n  Service active: ${serviceState?.service?.active ?? false}`);
  console.log(`  Startup time: ${serviceState?.service?.startupTime ?? '(never)'}`);
  console.log(`  Restart count: ${serviceState?.service?.restartCount ?? 0}`);
  console.log(`  PID: ${serviceState?.service?.pid ?? '(none)'}`);

  console.log(`\n  Startup mode: ${envState?.startupMode ?? '(none)'}`);
  console.log(`  Boot state: ${envState?.boot?.state ?? 'idle'}`);
  console.log(`  Boot duration: ${profile?.duration?.lastBootMs ?? '(none)'}ms`);
  console.log(`  Health: ${envState?.health?.status ?? 'unknown'} (score: ${envState?.health?.score ?? 0})`);
  console.log(`  Active modules: ${envState?.activeModules?.length ?? 0}`);

  if (envState?.activeModules?.length > 0) {
    console.log(`  Modules: ${envState.activeModules.join(', ')}`);
  }

  console.log('\n' + JSON.stringify({
    ok: true,
    mode: 'status',
    service: serviceState?.service,
    boot: envState?.boot,
    health: envState?.health,
    activeModules: envState?.activeModules,
    pressure: envState?.pressure,
    timestamp: new Date().toISOString(),
  }, null, 2));
}

function showValidate() {
  console.log('[boot] Runtime Boot Manager — VALIDATE');
  console.log('='.repeat(55));

  const preBoot = validatePreBoot();
  for (const c of preBoot.checks) {
    console.log(`  ${c.pass ? 'PASS' : 'FAIL'}: [${c.check}] ${c.detail}`);
  }

  const moduleStatus = getModuleStatus();
  console.log('\n  Module availability:');
  for (const [id, info] of Object.entries(moduleStatus)) {
    console.log(`    ${info.exists ? 'OK' : 'MISSING'} ${info.critical ? '[critical]' : '[optional]'} ${id}`);
  }

  const allModulesExist = Object.values(moduleStatus).filter(m => m.critical).every(m => m.exists);

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[boot] ${preBoot.allPass && allModulesExist ? 'READY TO BOOT' : 'NOT READY'}`);
  console.log('\n' + JSON.stringify({
    ok: preBoot.allPass && allModulesExist,
    preBoot: preBoot.allPass,
    criticalModules: allModulesExist,
    modes: STARTUP_MODES,
    timestamp: new Date().toISOString(),
  }, null, 2));
}

const args = process.argv.slice(2);

if (args.includes('--status')) {
  showStatus();
} else if (args.includes('--validate')) {
  showValidate();
} else {
  const mode = args.find(a => STARTUP_MODES.includes(a)) ?? 'standard';
  boot(mode);
}
