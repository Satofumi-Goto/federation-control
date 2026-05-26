#!/usr/bin/env node
/**
 * Runtime Autonomous Execution Queue
 *
 * Serializes ChatGPT Runtime instructions into an ordered queue,
 * preventing execution conflicts and overlapping deploys.
 * Enforces governance ordering and priority.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const QUEUE_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-execution-queue.json');

const LIMITS = {
  maxQueueDepth: 20,
  maxConcurrentExecutions: 1,
  maxAutonomousRepairCycles: 5,
  maxAutonomousDeployCycles: 3,
};

const PRIORITY = {
  emergency: 0,
  governance: 1,
  repair: 2,
  build: 3,
  verify: 4,
  deploy: 5,
  normal: 6,
};

function loadQueue() {
  try { return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8')); }
  catch {
    return {
      items: [],
      active: null,
      counters: { repair: 0, deploy: 0, total: 0 },
      paused: false,
      pauseReason: null,
    };
  }
}

function saveQueue(q) {
  fs.mkdirSync(path.dirname(QUEUE_PATH), { recursive: true });
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(q, null, 2) + '\n', 'utf8');
}

function classifyInstruction(instruction) {
  const lower = instruction.toLowerCase();
  if (/emergency|critical|halt/i.test(lower)) return 'emergency';
  if (/governance|policy|permission/i.test(lower)) return 'governance';
  if (/repair|fix|patch|hotfix/i.test(lower)) return 'repair';
  if (/build|compile/i.test(lower)) return 'build';
  if (/verify|check|validate|test/i.test(lower)) return 'verify';
  if (/deploy|push|release/i.test(lower)) return 'deploy';
  return 'normal';
}

export function enqueue(instruction, hash, source = 'trigger-daemon') {
  const q = loadQueue();

  if (q.paused) {
    return { enqueued: false, reason: `Queue paused: ${q.pauseReason}` };
  }

  if (q.items.length >= LIMITS.maxQueueDepth) {
    return { enqueued: false, reason: `Queue full (${LIMITS.maxQueueDepth} items)` };
  }

  if (q.items.some(i => i.hash === hash) || (q.active && q.active.hash === hash)) {
    return { enqueued: false, reason: 'Duplicate instruction already queued' };
  }

  const category = classifyInstruction(instruction);
  const priority = PRIORITY[category] ?? PRIORITY.normal;

  const item = {
    id: `q-${Date.now().toString(36)}`,
    hash,
    instruction: instruction.slice(0, 500),
    category,
    priority,
    source,
    enqueuedAt: new Date().toISOString(),
    status: 'pending',
  };

  q.items.push(item);
  q.items.sort((a, b) => a.priority - b.priority);
  saveQueue(q);

  return { enqueued: true, id: item.id, position: q.items.indexOf(item) + 1, category, priority };
}

export function dequeue() {
  const q = loadQueue();

  if (q.paused) return { item: null, reason: 'paused' };
  if (q.active) return { item: null, reason: 'execution-in-progress' };
  if (q.items.length === 0) return { item: null, reason: 'empty' };

  const category = q.items[0].category;
  if (category === 'repair' && q.counters.repair >= LIMITS.maxAutonomousRepairCycles) {
    q.paused = true;
    q.pauseReason = `Repair cycle limit reached (${LIMITS.maxAutonomousRepairCycles})`;
    saveQueue(q);
    return { item: null, reason: q.pauseReason };
  }
  if (category === 'deploy' && q.counters.deploy >= LIMITS.maxAutonomousDeployCycles) {
    q.paused = true;
    q.pauseReason = `Deploy cycle limit reached (${LIMITS.maxAutonomousDeployCycles})`;
    saveQueue(q);
    return { item: null, reason: q.pauseReason };
  }

  const item = q.items.shift();
  item.status = 'executing';
  item.startedAt = new Date().toISOString();
  q.active = item;
  saveQueue(q);

  return { item };
}

export function complete(success) {
  const q = loadQueue();
  if (!q.active) return { ok: false, reason: 'no-active-item' };

  const item = q.active;
  item.status = success ? 'completed' : 'failed';
  item.completedAt = new Date().toISOString();

  q.counters.total++;
  if (item.category === 'repair') q.counters.repair++;
  if (item.category === 'deploy') q.counters.deploy++;

  q.active = null;
  saveQueue(q);

  return { ok: true, item };
}

export function getQueueStatus() {
  const q = loadQueue();
  return {
    depth: q.items.length,
    active: q.active ? { id: q.active.id, category: q.active.category, hash: q.active.hash } : null,
    paused: q.paused,
    pauseReason: q.pauseReason,
    counters: q.counters,
    limits: LIMITS,
    items: q.items.map(i => ({ id: i.id, category: i.category, priority: i.priority, status: i.status })),
  };
}

export function resetQueue() {
  const q = {
    items: [],
    active: null,
    counters: { repair: 0, deploy: 0, total: 0 },
    paused: false,
    pauseReason: null,
  };
  saveQueue(q);
  return q;
}

export function unpause() {
  const q = loadQueue();
  q.paused = false;
  q.pauseReason = null;
  saveQueue(q);
  return { ok: true };
}

export { LIMITS as QUEUE_LIMITS };

if (process.argv[1]?.endsWith('runtimeAutonomousExecutionQueue.mjs')) {
  const args = process.argv.slice(2);

  if (args.includes('--reset')) {
    resetQueue();
    console.log('[queue] Queue reset');
    console.log('\n' + JSON.stringify({ ok: true, action: 'reset', timestamp: new Date().toISOString() }, null, 2));
  } else if (args.includes('--unpause')) {
    unpause();
    console.log('[queue] Queue unpaused');
  } else {
    console.log('[queue] Runtime Autonomous Execution Queue');
    console.log('='.repeat(55));

    const status = getQueueStatus();
    console.log(`\n  Queue depth: ${status.depth}/${status.limits.maxQueueDepth}`);
    console.log(`  Active: ${status.active ? `${status.active.id} (${status.active.category})` : 'none'}`);
    console.log(`  Paused: ${status.paused}${status.pauseReason ? ` — ${status.pauseReason}` : ''}`);
    console.log(`  Repairs: ${status.counters.repair}/${status.limits.maxAutonomousRepairCycles}`);
    console.log(`  Deploys: ${status.counters.deploy}/${status.limits.maxAutonomousDeployCycles}`);
    console.log(`  Total: ${status.counters.total}`);

    if (status.items.length > 0) {
      console.log('\n  Queued items:');
      for (const i of status.items) {
        console.log(`    [${i.priority}] ${i.id} (${i.category}) — ${i.status}`);
      }
    }

    console.log(`\n${'='.repeat(55)}`);
    console.log(`[queue] ${status.paused ? 'PAUSED' : status.active ? 'EXECUTING' : status.depth > 0 ? 'READY' : 'IDLE'}`);
    console.log('\n' + JSON.stringify({ ok: true, ...status, timestamp: new Date().toISOString() }, null, 2));
  }
}
