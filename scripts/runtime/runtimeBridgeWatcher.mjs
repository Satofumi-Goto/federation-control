#!/usr/bin/env node
/**
 * Runtime Bridge Watcher
 *
 * Detects inbox updates, payload generation, stale instructions,
 * malformed payloads, missing repo context, and forbidden operations.
 *
 * Single-pass check mode (no persistent watch loop in this phase).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePayload } from './runtimeInvocationSafetyLayer.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const INBOX_PATH = path.resolve(REPO_ROOT, '.cursor/tasks/chatgpt-runtime-inbox.md');
const PAYLOAD_PATH = path.resolve(REPO_ROOT, '.cursor/tasks/runtime-bridge-payload.json');
const SCHEMA_PATH = path.resolve(REPO_ROOT, '.cursor/tasks/runtime-bridge-payload-schema.json');
const SNAPSHOT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-snapshot.json');

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function readFile(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch { return null; }
}

function fileStat(p) {
  try { return fs.statSync(p); }
  catch { return null; }
}

function isInboxEmpty(content) {
  if (!content) return true;
  const stripped = content
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^#.*$/gm, '')
    .replace(/_No pending instruction\._/g, '')
    .trim();
  return stripped.length === 0;
}

function checkInbox() {
  const content = readFile(INBOX_PATH);
  const stat = fileStat(INBOX_PATH);
  const empty = isInboxEmpty(content);

  const result = { exists: !!content, empty, stale: false };

  if (stat && !empty) {
    const age = Date.now() - stat.mtimeMs;
    result.stale = age > STALE_THRESHOLD_MS;
    result.ageHours = Math.round(age / (60 * 60 * 1000) * 10) / 10;
  }

  return result;
}

function checkPayload() {
  const payload = loadJson(PAYLOAD_PATH);
  if (!payload) return { exists: false, valid: false, errors: ['Payload file not found'] };

  const errors = [];

  if (!payload.instructionId) errors.push('Missing instructionId');
  if (!payload.repository) errors.push('Missing repository');
  if (payload.repository && payload.repository !== 'federation-control') errors.push(`Wrong repository: ${payload.repository}`);
  if (!payload.executionMode) errors.push('Missing executionMode');
  if (!['safe-apply', 'dry-run', 'manual-review'].includes(payload.executionMode)) errors.push(`Invalid executionMode: ${payload.executionMode}`);
  if (!Array.isArray(payload.targetFiles)) errors.push('targetFiles is not an array');
  if (!Array.isArray(payload.requiredValidation)) errors.push('requiredValidation is not an array');
  if (!Array.isArray(payload.allowedOperations)) errors.push('allowedOperations is not an array');
  if (!Array.isArray(payload.forbiddenOperations)) errors.push('forbiddenOperations is not an array');

  const safety = validatePayload(payload);

  const stat = fileStat(PAYLOAD_PATH);
  const stale = stat ? (Date.now() - stat.mtimeMs) > STALE_THRESHOLD_MS : false;

  return {
    exists: true,
    valid: errors.length === 0,
    errors,
    safe: safety.safe,
    blocked: safety.blocked,
    review: safety.review,
    stale,
    executionMode: payload.executionMode,
    targetFiles: payload.targetFiles?.length ?? 0,
  };
}

function checkRepoContext() {
  const errors = [];

  const pkg = loadJson(path.resolve(REPO_ROOT, 'package.json'));
  if (!pkg) errors.push('package.json not found');
  else if (pkg.name !== 'federation-control') errors.push(`Wrong package name: ${pkg.name}`);

  const registry = loadJson(path.resolve(REPO_ROOT, 'src/runtime/registry/runtimeRegistryData.json'));
  if (!registry) errors.push('Runtime Registry not found');

  const dashboard = loadJson(path.resolve(REPO_ROOT, 'grafana/runtime-workspace-v2.json'));
  if (!dashboard) errors.push('Runtime dashboard not found');

  const snapshot = loadJson(SNAPSHOT_PATH);
  if (!snapshot) errors.push('Operational snapshot not found');

  return { valid: errors.length === 0, errors, snapshot: snapshot?.state ?? 'unknown' };
}

function main() {
  console.log('[watcher] Runtime Bridge Watcher');
  console.log('='.repeat(55));

  // 1. Inbox check
  console.log('\n[watcher] Inbox Check:');
  const inbox = checkInbox();
  console.log(`  Exists: ${inbox.exists}`);
  console.log(`  Empty: ${inbox.empty}`);
  console.log(`  Stale: ${inbox.stale}${inbox.ageHours ? ` (${inbox.ageHours}h)` : ''}`);

  // 2. Payload check
  console.log('\n[watcher] Payload Check:');
  const payload = checkPayload();
  console.log(`  Exists: ${payload.exists}`);
  console.log(`  Valid: ${payload.valid}`);
  console.log(`  Safe: ${payload.safe ?? 'n/a'}`);
  if (payload.errors?.length > 0) {
    for (const e of payload.errors) console.log(`    ✕ ${e}`);
  }
  if (payload.blocked?.length > 0) {
    console.log(`  Blocked operations (${payload.blocked.length}):`);
    for (const b of payload.blocked) console.log(`    ✕ ${b.reason}`);
  }
  if (payload.review?.length > 0) {
    console.log(`  Manual review (${payload.review.length}):`);
    for (const r of payload.review) console.log(`    ◐ ${r.reason}`);
  }
  if (payload.stale) console.log('  ⚠ Payload is stale (>24h old)');

  // 3. Repo context check
  console.log('\n[watcher] Repo Context Check:');
  const repo = checkRepoContext();
  console.log(`  Valid: ${repo.valid}`);
  console.log(`  Runtime state: ${repo.snapshot}`);
  if (repo.errors.length > 0) {
    for (const e of repo.errors) console.log(`    ✕ ${e}`);
  }

  // 4. Overall assessment
  const issues = [];
  if (inbox.stale) issues.push('Stale inbox instruction');
  if (payload.exists && !payload.valid) issues.push('Malformed payload');
  if (payload.exists && !payload.safe) issues.push('Unsafe payload — forbidden operations detected');
  if (!repo.valid) issues.push('Missing repo context');
  if (inbox.exists && !inbox.empty && !payload.exists) issues.push('Inbox has instruction but no payload generated');

  const report = {
    ok: issues.length === 0,
    inbox: { empty: inbox.empty, stale: inbox.stale },
    payload: { exists: payload.exists, valid: payload.valid, safe: payload.safe ?? false },
    repoContext: { valid: repo.valid, runtimeState: repo.snapshot },
    issues,
    timestamp: new Date().toISOString(),
  };

  console.log(`\n${'='.repeat(55)}`);
  if (issues.length === 0) {
    console.log('[watcher] Status: ALL CLEAR');
  } else {
    console.log(`[watcher] Issues (${issues.length}):`);
    for (const i of issues) console.log(`  - ${i}`);
  }

  console.log('\n' + JSON.stringify(report, null, 2));
}

main();
