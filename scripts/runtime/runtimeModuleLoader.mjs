#!/usr/bin/env node
/**
 * Runtime Module Loader
 *
 * Dynamically loads, validates, and manages Runtime modules.
 * Resolves dependency graphs, isolates failures, and supports
 * module health reporting.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const PROFILE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-startup-profile.json');
const ENV_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-environment-state.json');

const MODULE_REGISTRY = {
  'governance':        { script: 'scripts/runtime/runtimeGovernanceOrchestrator.mjs',      critical: true  },
  'safety-layer':      { script: 'scripts/runtime/runtimeTriggerSafetyLayer.mjs',          critical: true  },
  'loop-supervisor':   { script: 'scripts/runtime/runtimeTriggerLoopSupervisor.mjs',       critical: true  },
  'trigger-daemon':    { script: 'scripts/runtime/runtimeLocalTriggerDaemon.mjs',          critical: true  },
  'execution-queue':   { script: 'scripts/runtime/runtimeAutonomousExecutionQueue.mjs',    critical: true  },
  'headless-executor': { script: 'scripts/runtime/runtimeHeadlessCursorExecutor.mjs',      critical: true  },
  'watchdog':          { script: 'scripts/runtime/runtimeContinuousWatchdog.mjs',          critical: false },
  'monitor':           { script: 'scripts/runtime/runtimeContinuousMonitor.mjs',           critical: false },
  'recovery-engine':   { script: 'scripts/runtime/runtimeServiceRecoveryEngine.mjs',       critical: false },
  'policy-engine':     { script: 'scripts/runtime/runtimePolicyEngine.mjs',                critical: true  },
  'pressure-engine':   { script: 'scripts/runtime/runtimeGovernancePressureEngine.mjs',    critical: false },
  'event-bus':         { script: 'scripts/runtime/runtimeEventBus.mjs',                    critical: false },
};

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function validateModuleFile(moduleId) {
  const entry = MODULE_REGISTRY[moduleId];
  if (!entry) return { valid: false, reason: `Unknown module: ${moduleId}` };

  const fullPath = path.resolve(REPO_ROOT, entry.script);
  if (!fs.existsSync(fullPath)) return { valid: false, reason: `Script not found: ${entry.script}` };

  return { valid: true, path: fullPath, critical: entry.critical };
}

function resolveDependencyOrder(enabledModules, dependencyGraph) {
  const resolved = [];
  const visited = new Set();
  const visiting = new Set();

  function visit(mod) {
    if (visited.has(mod)) return true;
    if (visiting.has(mod)) return false; // circular dependency

    visiting.add(mod);
    const deps = dependencyGraph[mod] ?? [];
    for (const dep of deps) {
      if (enabledModules.includes(dep) && !visit(dep)) return false;
    }
    visiting.delete(mod);
    visited.add(mod);
    resolved.push(mod);
    return true;
  }

  for (const mod of enabledModules) {
    if (!visit(mod)) return { ok: false, reason: `Circular dependency involving ${mod}`, order: resolved };
  }

  return { ok: true, order: resolved };
}

export function loadModules(mode = 'standard') {
  const profile = loadJson(PROFILE_PATH);
  if (!profile) return { ok: false, reason: 'No startup profile found' };

  const modeConfigs = {
    minimal:    ['governance', 'safety-layer', 'policy-engine'],
    standard:   profile.modules.enabled,
    full:       Object.keys(MODULE_REGISTRY),
    repair:     ['governance', 'safety-layer', 'recovery-engine', 'policy-engine'],
    recovery:   ['recovery-engine', 'safety-layer', 'policy-engine'],
    'safe-mode': ['governance', 'safety-layer', 'policy-engine', 'monitor'],
    diagnostic: Object.keys(MODULE_REGISTRY),
  };

  const enabledModules = modeConfigs[mode] ?? modeConfigs.standard;
  const depGraph = profile.dependencyOrder ?? {};

  // Resolve load order
  const depResult = resolveDependencyOrder(enabledModules, depGraph);
  if (!depResult.ok) return { ok: false, reason: depResult.reason };

  const loaded = [];
  const failed = [];

  for (const moduleId of depResult.order) {
    const validation = validateModuleFile(moduleId);
    if (validation.valid) {
      loaded.push({ id: moduleId, path: validation.path, critical: validation.critical, status: 'loaded' });
    } else {
      failed.push({ id: moduleId, reason: validation.reason, critical: validation.critical ?? false });
      if (validation.critical) {
        return {
          ok: false,
          reason: `Critical module failed: ${moduleId} — ${validation.reason}`,
          loaded,
          failed,
          loadOrder: depResult.order,
        };
      }
    }
  }

  // Update environment state
  const envState = loadJson(ENV_STATE_PATH) ?? {};
  envState.activeModules = loaded.map(m => m.id);
  envState.moduleFailures = failed;
  envState.startupMode = mode;
  saveJson(ENV_STATE_PATH, envState);

  // Update profile health
  profile.health = {
    status: failed.length === 0 ? 'healthy' : 'degraded',
    checkedAt: new Date().toISOString(),
    modulesLoaded: loaded.length,
    modulesFailed: failed.length,
  };
  saveJson(PROFILE_PATH, profile);

  return {
    ok: true,
    mode,
    loaded: loaded.map(m => m.id),
    failed: failed.map(m => m.id),
    loadOrder: depResult.order,
    totalLoaded: loaded.length,
    totalFailed: failed.length,
    health: profile.health,
  };
}

export function getModuleStatus() {
  const results = {};
  for (const [id, entry] of Object.entries(MODULE_REGISTRY)) {
    const fullPath = path.resolve(REPO_ROOT, entry.script);
    results[id] = {
      exists: fs.existsSync(fullPath),
      critical: entry.critical,
      script: entry.script,
    };
  }
  return results;
}

if (process.argv[1]?.endsWith('runtimeModuleLoader.mjs')) {
  const args = process.argv.slice(2);
  const mode = args[0] ?? 'standard';

  console.log('[modules] Runtime Module Loader');
  console.log('='.repeat(55));
  console.log(`  Mode: ${mode}`);

  const result = loadModules(mode);

  if (result.ok) {
    console.log(`\n  Load order:`);
    for (const mod of result.loadOrder) {
      const status = result.loaded.includes(mod) ? 'OK' : 'FAIL';
      console.log(`    [${status}] ${mod}`);
    }
    console.log(`\n  Loaded: ${result.totalLoaded}`);
    console.log(`  Failed: ${result.totalFailed}`);
    console.log(`  Health: ${result.health.status}`);
  } else {
    console.log(`\n  ERROR: ${result.reason}`);
    if (result.loaded) {
      console.log(`  Loaded before failure: ${result.loaded.map(m => m.id).join(', ')}`);
    }
  }

  // Module file status
  console.log('\n  Module registry:');
  const status = getModuleStatus();
  for (const [id, info] of Object.entries(status)) {
    console.log(`    ${info.exists ? 'EXISTS' : 'MISSING'} ${info.critical ? '[critical]' : '[optional]'} ${id}`);
  }

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[modules] ${result.ok ? `${result.totalLoaded} modules loaded (${mode})` : `LOAD FAILED: ${result.reason}`}`);
  console.log('\n' + JSON.stringify({ ok: result.ok, ...result, timestamp: new Date().toISOString() }, null, 2));
}
