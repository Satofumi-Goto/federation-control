#!/usr/bin/env node
/**
 * Runtime Local Trigger Daemon
 *
 * Watches the ChatGPT→Cursor inbox file for new instructions,
 * validates safety gates, and automatically triggers headless
 * Cursor Agent execution via the Runtime Headless Executor.
 *
 * Usage:
 *   node scripts/runtime/runtimeLocalTriggerDaemon.mjs          # start daemon
 *   node scripts/runtime/runtimeLocalTriggerDaemon.mjs --once    # single check
 *   node scripts/runtime/runtimeLocalTriggerDaemon.mjs --status  # show state
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluateTriggerSafety } from './runtimeTriggerSafetyLayer.mjs';
import { checkSupervisor, recordExecution } from './runtimeTriggerLoopSupervisor.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const INBOX_PATH = path.resolve(REPO_ROOT, '.cursor/tasks/chatgpt-runtime-inbox.md');
const WATCH_STATE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-trigger-watch-state.json');
const PAYLOAD_PATH = path.resolve(REPO_ROOT, '.cursor/tasks/runtime-bridge-payload.json');
const PROMPT_PATH = path.resolve(REPO_ROOT, '.cursor/tasks/chatgpt-runtime-agent-prompt.md');
const DAEMON_LOG_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-trigger-daemon-log.json');

const DEBOUNCE_MS = 3_000;
const POLL_INTERVAL_MS = 5_000;

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function readFile(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch { return null; }
}

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
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

function extractInstruction(content) {
  return content
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^#\s+ChatGPT.*$/m, '')
    .replace(/_No pending instruction\._/g, '')
    .trim();
}

function loadWatchState() {
  return loadJson(WATCH_STATE_PATH) ?? {
    lastInstructionHash: null,
    lastTriggerTimestamp: null,
    lastExecutionTimestamp: null,
    lastExecutionStatus: null,
    lastExecutionMode: null,
    debounce: { active: false, pendingSince: null },
    watcher: { active: false, startedAt: null, pid: null },
  };
}

function saveWatchState(state) {
  saveJson(WATCH_STATE_PATH, state);
}

function appendLog(entry) {
  const log = loadJson(DAEMON_LOG_PATH) ?? { entries: [] };
  log.entries.push(entry);
  if (log.entries.length > 100) log.entries = log.entries.slice(-100);
  saveJson(DAEMON_LOG_PATH, log);
}

function tryExec(cmd, opts = {}) {
  try {
    const output = execSync(cmd, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      timeout: opts.timeout ?? 120_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { ok: true, output: output.trim() };
  } catch (err) {
    return { ok: false, output: err.stdout?.trim() ?? '', error: err.stderr?.trim() ?? err.message };
  }
}

function generatePayload(instruction, hash) {
  const payload = {
    instructionId: new Date().toISOString().replace(/[:.]/g, '-'),
    instruction,
    normalizedInstruction: `Execute the following instruction in federation-control:\n\n${instruction}\n\nAfter implementation:\n1. node scripts/build-runtime-workspace-v2.mjs\n2. node scripts/verify-registry-migration.mjs\n3. node scripts/verify-runtime-topology-links.mjs\n4. git status\n5. Report: panels, version, PASS/FAIL per verification, files changed`,
    instructionHash: hash,
    source: 'trigger-daemon',
    executionMode: 'automatic',
    allowedOperations: ['build', 'verify', 'repair'],
    requiredValidation: ['build', 'registry-migration', 'topology-links'],
    timestamp: new Date().toISOString(),
  };

  saveJson(PAYLOAD_PATH, payload);
  return payload;
}

function generatePrompt(instruction) {
  const prompt = `# Cursor Agent Execution Prompt
# Generated: ${new Date().toISOString()}
# Source: trigger-daemon (automatic)

Execute the following instruction in federation-control:

${instruction}

After implementation:
1. node scripts/build-runtime-workspace-v2.mjs
2. node scripts/verify-registry-migration.mjs
3. node scripts/verify-runtime-topology-links.mjs
4. node scripts/verify-federation-semantic.mjs
5. git status
6. Report: panels, version, PASS/FAIL per verification, files changed
`;

  fs.mkdirSync(path.dirname(PROMPT_PATH), { recursive: true });
  fs.writeFileSync(PROMPT_PATH, prompt, 'utf8');
  return prompt;
}

async function triggerExecution(instruction, hash) {
  const now = new Date().toISOString();
  const state = loadWatchState();

  console.log(`[daemon] New instruction detected (hash: ${hash})`);
  console.log(`[daemon] Instruction: ${instruction.slice(0, 100)}${instruction.length > 100 ? '...' : ''}`);

  // 1. Supervisor check
  const supervisor = checkSupervisor();
  if (!supervisor.allowed) {
    console.log(`[daemon] BLOCKED by supervisor: ${supervisor.reason}`);
    appendLog({ type: 'blocked', reason: `supervisor:${supervisor.reason}`, hash, timestamp: now });
    state.lastTriggerTimestamp = now;
    state.lastExecutionStatus = `blocked:${supervisor.reason}`;
    saveWatchState(state);
    return { triggered: false, reason: supervisor.reason };
  }

  // 2. Safety layer check
  const safety = evaluateTriggerSafety(instruction);
  if (safety.decision === 'block') {
    console.log(`[daemon] BLOCKED by safety layer:`);
    for (const b of safety.blockers) console.log(`  → ${b}`);
    appendLog({ type: 'blocked', reason: 'safety', blockers: safety.blockers, hash, timestamp: now });
    state.lastTriggerTimestamp = now;
    state.lastExecutionStatus = 'blocked:safety';
    saveWatchState(state);
    return { triggered: false, reason: 'safety', blockers: safety.blockers };
  }

  if (safety.decision === 'manual-approval') {
    console.log(`[daemon] REQUIRES MANUAL APPROVAL:`);
    for (const a of safety.approvals) console.log(`  → ${a}`);
    appendLog({ type: 'manual-approval', approvals: safety.approvals, hash, timestamp: now });
    state.lastTriggerTimestamp = now;
    state.lastExecutionStatus = 'manual-approval';
    saveWatchState(state);
    return { triggered: false, reason: 'manual-approval', approvals: safety.approvals };
  }

  // 3. Generate payload and prompt
  console.log('[daemon] Generating execution payload...');
  generatePayload(instruction, hash);
  generatePrompt(instruction);

  // 4. Run bridge to validate
  console.log('[daemon] Running bridge validation...');
  const bridge = tryExec('node scripts/chatgpt-runtime-bridge.mjs --agent-prompt', { timeout: 30_000 });
  if (!bridge.ok) {
    console.log(`[daemon] Bridge validation failed: ${bridge.error}`);
    appendLog({ type: 'bridge-failed', error: bridge.error, hash, timestamp: now });
    recordExecution(false);
    state.lastTriggerTimestamp = now;
    state.lastExecutionStatus = 'bridge-failed';
    saveWatchState(state);
    return { triggered: false, reason: 'bridge-failed' };
  }

  // 5. Invoke headless executor
  console.log('[daemon] Invoking headless executor...');
  state.lastTriggerTimestamp = now;
  state.lastExecutionMode = 'headless-sdk';
  saveWatchState(state);

  const exec = tryExec('node scripts/runtime/runtimeHeadlessCursorExecutor.mjs --execute', { timeout: 300_000 });
  const success = exec.ok;

  console.log(`[daemon] Execution ${success ? 'COMPLETED' : 'FAILED'}`);
  if (!success) console.log(`[daemon] Error: ${exec.error?.slice(0, 200)}`);

  recordExecution(success);

  state.lastExecutionTimestamp = new Date().toISOString();
  state.lastExecutionStatus = success ? 'completed' : 'failed';
  state.lastInstructionHash = hash;
  saveWatchState(state);

  appendLog({
    type: success ? 'executed' : 'execution-failed',
    hash,
    duration: null,
    timestamp: new Date().toISOString(),
  });

  // 6. Clear inbox on success
  if (success) {
    console.log('[daemon] Clearing inbox...');
    const inboxClear = `# ChatGPT → Cursor Runtime Inbox\n\n_No pending instruction._\n\n<!-- ChatGPT writes the next instruction here. -->\n<!-- Cursor Agent reads and executes from this file. -->\n`;
    fs.writeFileSync(INBOX_PATH, inboxClear, 'utf8');
  }

  return { triggered: true, success, hash };
}

function checkOnce() {
  const content = readFile(INBOX_PATH);
  if (!content || isInboxEmpty(content)) {
    return { changed: false, reason: 'inbox-empty' };
  }

  const instruction = extractInstruction(content);
  const hash = hashContent(instruction);
  const state = loadWatchState();

  if (hash === state.lastInstructionHash) {
    return { changed: false, reason: 'same-instruction', hash };
  }

  return { changed: true, instruction, hash };
}

async function runOnce() {
  console.log('[daemon] Runtime Local Trigger Daemon — SINGLE CHECK');
  console.log('='.repeat(55));

  const check = checkOnce();
  if (!check.changed) {
    console.log(`[daemon] No new instruction (${check.reason})`);
    console.log('\n' + JSON.stringify({ ok: true, triggered: false, reason: check.reason, timestamp: new Date().toISOString() }, null, 2));
    return;
  }

  const result = await triggerExecution(check.instruction, check.hash);
  console.log(`\n${'='.repeat(55)}`);
  console.log(`[daemon] ${result.triggered ? (result.success ? 'EXECUTION COMPLETE' : 'EXECUTION FAILED') : `NOT TRIGGERED: ${result.reason}`}`);
  console.log('\n' + JSON.stringify({ ok: true, ...result, timestamp: new Date().toISOString() }, null, 2));
}

function showStatus() {
  console.log('[daemon] Runtime Local Trigger Daemon — STATUS');
  console.log('='.repeat(55));

  const state = loadWatchState();
  const content = readFile(INBOX_PATH);
  const inboxEmpty = isInboxEmpty(content);
  const supervisor = checkSupervisor();

  console.log(`\n  Inbox: ${inboxEmpty ? 'empty' : 'has instruction'}`);
  if (!inboxEmpty) {
    const instruction = extractInstruction(content);
    const hash = hashContent(instruction);
    console.log(`  Instruction hash: ${hash}`);
    console.log(`  Preview: ${instruction.slice(0, 80)}${instruction.length > 80 ? '...' : ''}`);
    console.log(`  Same as last: ${hash === state.lastInstructionHash}`);
  }

  console.log(`\n  Last instruction hash: ${state.lastInstructionHash ?? '(none)'}`);
  console.log(`  Last trigger: ${state.lastTriggerTimestamp ?? '(never)'}`);
  console.log(`  Last execution: ${state.lastExecutionTimestamp ?? '(never)'}`);
  console.log(`  Last status: ${state.lastExecutionStatus ?? '(none)'}`);
  console.log(`  Last mode: ${state.lastExecutionMode ?? '(none)'}`);
  console.log(`  Watcher active: ${state.watcher.active}`);
  console.log(`  Supervisor allows: ${supervisor.allowed}`);
  if (!supervisor.allowed) console.log(`  Supervisor reason: ${supervisor.reason}`);

  console.log('\n' + JSON.stringify({
    ok: true,
    mode: 'status',
    inboxEmpty,
    state,
    supervisorAllowed: supervisor.allowed,
    timestamp: new Date().toISOString(),
  }, null, 2));
}

async function runDaemon() {
  console.log('[daemon] Runtime Local Trigger Daemon — WATCHING');
  console.log('='.repeat(55));
  console.log(`  Inbox: ${INBOX_PATH}`);
  console.log(`  Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`  Debounce: ${DEBOUNCE_MS}ms`);
  console.log('');

  const state = loadWatchState();
  state.watcher.active = true;
  state.watcher.startedAt = new Date().toISOString();
  state.watcher.pid = process.pid;
  saveWatchState(state);

  let debounceTimer = null;
  let pendingHash = null;
  let pendingInstruction = null;

  async function processChange() {
    if (!pendingInstruction || !pendingHash) return;
    const instruction = pendingInstruction;
    const hash = pendingHash;
    pendingInstruction = null;
    pendingHash = null;

    await triggerExecution(instruction, hash);
  }

  function poll() {
    const check = checkOnce();
    if (!check.changed) return;

    const ws = loadWatchState();
    ws.debounce.active = true;
    ws.debounce.pendingSince = new Date().toISOString();
    saveWatchState(ws);

    pendingHash = check.hash;
    pendingInstruction = check.instruction;

    console.log(`[daemon] Change detected (hash: ${check.hash}), debouncing ${DEBOUNCE_MS}ms...`);

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      debounceTimer = null;
      const ws2 = loadWatchState();
      ws2.debounce.active = false;
      ws2.debounce.pendingSince = null;
      saveWatchState(ws2);
      await processChange();
    }, DEBOUNCE_MS);
  }

  // Use fs.watch if available, fall back to polling
  let watcher = null;
  try {
    watcher = fs.watch(INBOX_PATH, { persistent: true }, () => poll());
    console.log('[daemon] Using fs.watch for inbox monitoring');
  } catch {
    console.log('[daemon] fs.watch unavailable, falling back to polling');
  }

  // Also poll periodically as backup
  const pollTimer = setInterval(() => poll(), POLL_INTERVAL_MS);

  process.on('SIGINT', () => {
    console.log('\n[daemon] Shutting down...');
    if (watcher) watcher.close();
    clearInterval(pollTimer);
    if (debounceTimer) clearTimeout(debounceTimer);
    const ws = loadWatchState();
    ws.watcher.active = false;
    saveWatchState(ws);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    if (watcher) watcher.close();
    clearInterval(pollTimer);
    if (debounceTimer) clearTimeout(debounceTimer);
    const ws = loadWatchState();
    ws.watcher.active = false;
    saveWatchState(ws);
    process.exit(0);
  });

  // Initial check
  poll();
}

const args = process.argv.slice(2);
const flag = args[0];

if (flag === '--once') {
  runOnce();
} else if (flag === '--status') {
  showStatus();
} else {
  runDaemon();
}
