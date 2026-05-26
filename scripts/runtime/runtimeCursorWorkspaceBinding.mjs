#!/usr/bin/env node
/**
 * Runtime Cursor Workspace Binding Layer
 *
 * Binds invocation exclusively to federation-control.
 * Validates workspace, repo, branch, and canonical Runtime files.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const CANONICAL_FILES = [
  'grafana/runtime-workspace-routes.json',
  'runtime_data/runtime-federation-memory.json',
  'src/runtime/registry/runtimeRegistryData.json',
  'scripts/build-runtime-workspace-v2.mjs',
];

const STALE_THRESHOLD_DAYS = 7;

function tryExec(cmd) {
  try { return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 5000 }).trim(); }
  catch { return null; }
}

function fileExists(rel) {
  return fs.existsSync(path.resolve(REPO_ROOT, rel));
}

function fileStat(rel) {
  try { return fs.statSync(path.resolve(REPO_ROOT, rel)); }
  catch { return null; }
}

/**
 * Validate workspace binding. Returns { bound, errors }.
 */
export function validateWorkspaceBinding() {
  const errors = [];

  // 1. Package identity
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(REPO_ROOT, 'package.json'), 'utf8'));
    if (pkg.name !== 'federation-control') {
      errors.push({ check: 'package-identity', reason: `Expected federation-control, got ${pkg.name}` });
    }
  } catch {
    errors.push({ check: 'package-identity', reason: 'package.json not found or unreadable' });
  }

  // 2. Git repository
  const remote = tryExec('git remote get-url origin');
  if (!remote) {
    errors.push({ check: 'git-remote', reason: 'No git remote detected' });
  } else if (!remote.includes('federation-control')) {
    errors.push({ check: 'git-remote', reason: `Remote does not reference federation-control: ${remote}` });
  }

  // 3. Active branch
  const branch = tryExec('git branch --show-current');
  if (!branch) {
    errors.push({ check: 'active-branch', reason: 'Cannot determine active branch' });
  }

  // 4. Workspace freshness
  const lastCommitDate = tryExec('git log -1 --format=%ci');
  if (lastCommitDate) {
    const age = Date.now() - new Date(lastCommitDate).getTime();
    const ageDays = age / (24 * 60 * 60 * 1000);
    if (ageDays > STALE_THRESHOLD_DAYS) {
      errors.push({ check: 'workspace-freshness', reason: `Last commit is ${Math.round(ageDays)} days old (threshold: ${STALE_THRESHOLD_DAYS})` });
    }
  }

  // 5. Canonical Runtime files
  for (const file of CANONICAL_FILES) {
    if (!fileExists(file)) {
      errors.push({ check: 'canonical-file', reason: `Missing: ${file}` });
    }
  }

  // 6. Dirty state (warning only, not blocking)
  const porcelain = tryExec('git status --porcelain');
  const dirtyCount = porcelain ? porcelain.split('\n').filter(Boolean).length : 0;

  return {
    bound: errors.length === 0,
    workspace: REPO_ROOT,
    branch,
    remote,
    dirtyFiles: dirtyCount,
    canonicalFilesPresent: CANONICAL_FILES.filter(f => fileExists(f)).length,
    canonicalFilesRequired: CANONICAL_FILES.length,
    errors,
  };
}

/**
 * Reject a payload if workspace binding fails.
 */
export function enforceBinding(payload) {
  const binding = validateWorkspaceBinding();

  if (!binding.bound) {
    return { allowed: false, reason: 'Workspace binding failed', binding };
  }

  if (payload?.repository && payload.repository !== 'federation-control') {
    return { allowed: false, reason: `Payload targets ${payload.repository}, not federation-control`, binding };
  }

  return { allowed: true, binding };
}

if (process.argv[1]?.endsWith('runtimeCursorWorkspaceBinding.mjs')) {
  console.log('[binding] Runtime Cursor Workspace Binding');
  console.log('='.repeat(55));

  const binding = validateWorkspaceBinding();

  console.log(`\n  Bound: ${binding.bound}`);
  console.log(`  Workspace: ${binding.workspace}`);
  console.log(`  Branch: ${binding.branch}`);
  console.log(`  Dirty files: ${binding.dirtyFiles}`);
  console.log(`  Canonical files: ${binding.canonicalFilesPresent}/${binding.canonicalFilesRequired}`);

  if (binding.errors.length > 0) {
    console.log('\n  Errors:');
    for (const e of binding.errors) console.log(`    ✕ [${e.check}] ${e.reason}`);
  }

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[binding] Status: ${binding.bound ? 'BOUND' : 'REJECTED'}`);
  console.log('\n' + JSON.stringify(binding, null, 2));
}
