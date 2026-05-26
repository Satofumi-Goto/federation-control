#!/usr/bin/env node
/**
 * Runtime Tool Exposure Layer
 *
 * Exposes the fully operational Cursor Runtime execution pipeline as
 * callable external entrypoints. Each tool is a governed, safety-locked
 * function that can be invoked by an external caller (ChatGPT, MCP, CI).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const MANIFEST_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-tool-manifest.json');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ── Permission levels ──

export const PERMISSION_LEVELS = {
  DRY_RUN:           'dry-run',
  VERIFY_ONLY:       'verify-only',
  EXECUTE_SAFE:      'execute-safe',
  EXECUTE_REVIEWED:  'execute-reviewed',
  EXECUTE_EMERGENCY: 'execute-emergency',
};

const PERMISSION_RANK = {
  [PERMISSION_LEVELS.DRY_RUN]: 0,
  [PERMISSION_LEVELS.VERIFY_ONLY]: 1,
  [PERMISSION_LEVELS.EXECUTE_SAFE]: 2,
  [PERMISSION_LEVELS.EXECUTE_REVIEWED]: 3,
  [PERMISSION_LEVELS.EXECUTE_EMERGENCY]: 4,
};

function hasPermission(required, granted) {
  return (PERMISSION_RANK[granted] ?? -1) >= (PERMISSION_RANK[required] ?? 99);
}

// ── Tool definitions ──

const TOOLS = [
  {
    id: 'runtime-execute',
    name: 'Runtime Execute',
    description: 'Execute a governed prompt via @cursor/sdk Agent.prompt()',
    entrypoint: 'scripts/runtime/runtimeHeadlessCursorExecutor.mjs --execute',
    requiredPermission: PERMISSION_LEVELS.EXECUTE_SAFE,
    governanceRequired: true,
    safetyLockRequired: true,
    approvalRequired: false,
  },
  {
    id: 'runtime-dry-run',
    name: 'Runtime Dry-Run',
    description: 'Simulate execution pipeline without invoking Agent.prompt()',
    entrypoint: 'scripts/runtime/runtimeHeadlessCursorExecutor.mjs --dry-run',
    requiredPermission: PERMISSION_LEVELS.DRY_RUN,
    governanceRequired: false,
    safetyLockRequired: false,
    approvalRequired: false,
  },
  {
    id: 'runtime-verify',
    name: 'Runtime Verify',
    description: 'Run auto-verification pipeline (topology, semantic, build)',
    entrypoint: 'scripts/runtime/runtimeAutoVerificationPipeline.mjs',
    requiredPermission: PERMISSION_LEVELS.VERIFY_ONLY,
    governanceRequired: false,
    safetyLockRequired: false,
    approvalRequired: false,
  },
  {
    id: 'runtime-deploy',
    name: 'Runtime Deploy',
    description: 'Deploy Grafana dashboards via deploy pipeline',
    entrypoint: 'scripts/runtime/runtimeDeployPipeline.mjs',
    requiredPermission: PERMISSION_LEVELS.EXECUTE_REVIEWED,
    governanceRequired: true,
    safetyLockRequired: true,
    approvalRequired: true,
  },
  {
    id: 'runtime-governance',
    name: 'Runtime Governance',
    description: 'Run governance orchestrator and policy evaluation',
    entrypoint: 'scripts/runtime/runtimeGovernanceOrchestrator.mjs',
    requiredPermission: PERMISSION_LEVELS.VERIFY_ONLY,
    governanceRequired: false,
    safetyLockRequired: false,
    approvalRequired: false,
  },
  {
    id: 'runtime-status',
    name: 'Runtime Orchestration Status',
    description: 'Read current orchestration state, environment, and pressure',
    entrypoint: null,
    requiredPermission: PERMISSION_LEVELS.DRY_RUN,
    governanceRequired: false,
    safetyLockRequired: false,
    approvalRequired: false,
  },
  {
    id: 'runtime-result',
    name: 'Runtime Execution Result',
    description: 'Read the latest execution result and session state',
    entrypoint: null,
    requiredPermission: PERMISSION_LEVELS.DRY_RUN,
    governanceRequired: false,
    safetyLockRequired: false,
    approvalRequired: false,
  },
];

// ── Tool invocation ──

export function listTools(grantedPermission = PERMISSION_LEVELS.DRY_RUN) {
  return TOOLS.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    accessible: hasPermission(t.requiredPermission, grantedPermission),
    requiredPermission: t.requiredPermission,
    governanceRequired: t.governanceRequired,
    safetyLockRequired: t.safetyLockRequired,
    approvalRequired: t.approvalRequired,
  }));
}

export function getToolById(toolId) {
  return TOOLS.find(t => t.id === toolId) ?? null;
}

export function resolveOrchestrationStatus() {
  const snapshot = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-snapshot.json'));
  const envState = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-environment-state.json'));
  const serviceState = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-service-state.json'));
  const session = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-headless-session.json'));

  return {
    orchestration: snapshot ? 'operational' : 'no-snapshot',
    environment: envState?.status ?? 'unknown',
    service: serviceState?.status ?? 'unknown',
    lastSession: session ? {
      status: session.status,
      startTime: session.startTime,
      endTime: session.endTime,
    } : null,
    timestamp: new Date().toISOString(),
  };
}

export function resolveExecutionResult() {
  const session = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-headless-session.json'));
  const execResult = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-execution-result.json'));

  return {
    session: session ?? null,
    executionResult: execResult ?? null,
    timestamp: new Date().toISOString(),
  };
}

// ── Manifest sync ──

function syncManifest() {
  const manifest = loadJson(MANIFEST_PATH) ?? {};
  manifest.tools = TOOLS.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    entrypoint: t.entrypoint,
    requiredPermission: t.requiredPermission,
    governanceRequired: t.governanceRequired,
    safetyLockRequired: t.safetyLockRequired,
    approvalRequired: t.approvalRequired,
  }));
  manifest.permissionLevels = Object.values(PERMISSION_LEVELS);
  manifest.lastSync = new Date().toISOString();
  saveJson(MANIFEST_PATH, manifest);
  return manifest;
}

// ── CLI ──

if (process.argv[1]?.endsWith('runtimeToolExposureLayer.mjs')) {
  console.log('[tool-exposure] Runtime Tool Exposure Layer');
  console.log('='.repeat(60));

  const manifest = syncManifest();

  console.log(`\n  Tools exposed: ${TOOLS.length}`);
  console.log(`  Permission levels: ${Object.values(PERMISSION_LEVELS).join(', ')}`);
  console.log('\n  Available tools:');

  for (const t of TOOLS) {
    const govTag = t.governanceRequired ? ' [GOV]' : '';
    const safeTag = t.safetyLockRequired ? ' [SAFE]' : '';
    const approveTag = t.approvalRequired ? ' [APPROVE]' : '';
    console.log(`    ${t.id} — ${t.description} (${t.requiredPermission})${govTag}${safeTag}${approveTag}`);
  }

  const status = resolveOrchestrationStatus();
  console.log('\n  Orchestration status:');
  console.log(`    Orchestration: ${status.orchestration}`);
  console.log(`    Environment: ${status.environment}`);
  console.log(`    Service: ${status.service}`);
  if (status.lastSession) {
    console.log(`    Last session: ${status.lastSession.status} (${status.lastSession.endTime ?? 'in progress'})`);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('[tool-exposure] OPERATIONAL');
  console.log('\n' + JSON.stringify({ ok: true, toolCount: TOOLS.length, status, manifest: { lastSync: manifest.lastSync }, timestamp: new Date().toISOString() }, null, 2));
}
