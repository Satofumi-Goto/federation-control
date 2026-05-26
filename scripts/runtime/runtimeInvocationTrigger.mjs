#!/usr/bin/env node
/**
 * Runtime Invocation Trigger
 *
 * Watches for runtime payload changes and triggers Cursor execution.
 * Single-pass check mode (no persistent watch loop).
 * Enforces debounce, rejects malformed/stale/unauthorized payloads.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePayload } from './runtimeInvocationSafetyLayer.mjs';
import { evaluateSafetyLock, LOCK_DECISIONS } from './runtimeInvocationSafetyLock.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const PAYLOAD_PATH = path.resolve(REPO_ROOT, '.cursor/tasks/runtime-bridge-payload.json');
const SESSION_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-cursor-session-state.json');

const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
const DEBOUNCE_MS = 10 * 1000; // 10 seconds

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function fileStat(p) {
  try { return fs.statSync(p); }
  catch { return null; }
}

function isPayloadStale(payload, stat) {
  if (!payload?.timestamp) return true;
  const payloadAge = Date.now() - new Date(payload.timestamp).getTime();
  const fileAge = stat ? Date.now() - stat.mtimeMs : Infinity;
  return payloadAge > STALE_THRESHOLD_MS || fileAge > STALE_THRESHOLD_MS;
}

function isDebounced(session) {
  if (!session?.lastTriggerTime) return false;
  return Date.now() - new Date(session.lastTriggerTime).getTime() < DEBOUNCE_MS;
}

function isAlreadyExecuted(payload, session) {
  if (!session?.lastInstructionId) return false;
  return session.lastInstructionId === payload?.instructionId && session.executionState === 'completed';
}

/**
 * Evaluate trigger readiness. Returns { ready, reason, payload }.
 */
export function evaluateTrigger() {
  const issues = [];

  // 1. Check payload existence
  const payload = loadJson(PAYLOAD_PATH);
  if (!payload) {
    return { ready: false, reason: 'No payload found', issues: ['no-payload'] };
  }

  // 2. Check staleness
  const stat = fileStat(PAYLOAD_PATH);
  if (isPayloadStale(payload, stat)) {
    issues.push('stale-payload');
  }

  // 3. Check debounce
  const session = loadJson(SESSION_PATH);
  if (isDebounced(session)) {
    issues.push('debounced');
  }

  // 4. Check already executed
  if (isAlreadyExecuted(payload, session)) {
    issues.push('already-executed');
  }

  // 5. Schema validation
  const required = ['instructionId', 'repository', 'executionMode', 'instruction'];
  for (const field of required) {
    if (!payload[field]) issues.push(`malformed-missing-${field}`);
  }
  if (payload.repository !== 'federation-control') {
    issues.push('wrong-repository');
  }

  // 6. Safety validation
  const safety = validatePayload(payload);
  if (!safety.safe) {
    issues.push('safety-blocked');
  }

  // 7. Safety lock
  const lock = evaluateSafetyLock(payload);
  if (lock.decision === LOCK_DECISIONS.BLOCKED) {
    issues.push('lock-blocked');
  } else if (lock.decision === LOCK_DECISIONS.MANUAL_APPROVAL) {
    issues.push('requires-manual-approval');
  }

  const blocking = issues.filter(i => !['stale-payload', 'debounced', 'already-executed', 'requires-manual-approval'].includes(i));
  const ready = blocking.length === 0 && !issues.includes('already-executed') && !issues.includes('debounced');

  return {
    ready,
    requiresApproval: issues.includes('requires-manual-approval'),
    reason: ready ? 'Trigger ready' : issues.join(', '),
    issues,
    payload: ready ? payload : null,
    lockDecision: lock.decision,
  };
}

if (process.argv[1]?.endsWith('runtimeInvocationTrigger.mjs')) {
  console.log('[trigger] Runtime Invocation Trigger');
  console.log('='.repeat(55));

  const trigger = evaluateTrigger();

  console.log(`\n  Ready: ${trigger.ready}`);
  console.log(`  Lock: ${trigger.lockDecision}`);
  console.log(`  Reason: ${trigger.reason}`);

  if (trigger.issues.length > 0) {
    console.log(`  Issues (${trigger.issues.length}):`);
    for (const i of trigger.issues) console.log(`    - ${i}`);
  }

  if (trigger.requiresApproval) {
    console.log('\n  ⚠ Manual approval required before execution');
  }

  if (trigger.ready) {
    console.log(`\n  Payload: ${trigger.payload.instructionId}`);
    console.log(`  Mode: ${trigger.payload.executionMode}`);
    console.log('  → Ready for auto-executor');
  }

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[trigger] Status: ${trigger.ready ? 'TRIGGER READY' : 'NOT READY'}`);
  console.log('\n' + JSON.stringify(trigger, null, 2));
}
