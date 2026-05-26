#!/usr/bin/env node
/**
 * Runtime Cursor Bridge Service
 *
 * Monitors the ChatGPT inbox, normalizes instruction payloads,
 * validates safety, and writes structured execution payloads
 * for Cursor Agent consumption.
 *
 * This is the payload bridge only — no auto-execution.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateInstruction, validatePayload } from './runtimeInvocationSafetyLayer.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const INBOX_PATH = path.resolve(REPO_ROOT, '.cursor/tasks/chatgpt-runtime-inbox.md');
const PAYLOAD_PATH = path.resolve(REPO_ROOT, '.cursor/tasks/runtime-bridge-payload.json');
const SCHEMA_PATH = path.resolve(REPO_ROOT, '.cursor/tasks/runtime-bridge-payload-schema.json');

function readFile(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch { return null; }
}

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
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
    .replace(/^#\s+ChatGPT.*$/m, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/_No pending instruction\._/g, '')
    .trim();
}

function inferTargetFiles(instruction) {
  const targets = [];
  const filePatterns = [
    /(?:create|modify|update|edit)\s+[`"]?([a-zA-Z0-9_/.-]+\.\w+)[`"]?/gi,
    /(?:scripts|src|grafana|runtime_data)\/[\w/.-]+\.\w+/g,
  ];
  for (const pattern of filePatterns) {
    let match;
    while ((match = pattern.exec(instruction)) !== null) {
      const file = match[1] || match[0];
      if (!targets.includes(file)) targets.push(file);
    }
  }
  return targets;
}

function inferValidation(instruction) {
  const validations = [];
  const lower = instruction.toLowerCase();
  if (lower.includes('registry') || lower.includes('card')) validations.push('registry-migration');
  if (lower.includes('topology') || lower.includes('route')) validations.push('runtime-topology');
  if (lower.includes('semantic') || lower.includes('naming')) validations.push('federation-semantic');
  if (lower.includes('governance')) validations.push('federation-governance');
  if (lower.includes('build') || lower.includes('dashboard') || lower.includes('panel')) validations.push('runtime-build');
  if (validations.length === 0) {
    validations.push('registry-migration', 'runtime-topology', 'federation-semantic', 'runtime-build');
  }
  return validations;
}

function inferAllowedOps(instruction) {
  const ops = ['read', 'write', 'build', 'verify'];
  const lower = instruction.toLowerCase();
  if (lower.includes('commit')) ops.push('git-commit');
  if (lower.includes('push')) ops.push('git-push');
  if (lower.includes('deploy')) ops.push('deploy');
  return ops;
}

function generatePayload(instruction) {
  const safety = validateInstruction(instruction);

  const payload = {
    instructionId: new Date().toISOString().replace(/[:.]/g, '-'),
    repository: 'federation-control',
    targetFiles: inferTargetFiles(instruction),
    requiredValidation: inferValidation(instruction),
    allowedOperations: inferAllowedOps(instruction),
    forbiddenOperations: ['delete-registry', 'delete-memory', 'delete-routes', 'force-push', 'hard-reset', 'credential-expose'],
    executionMode: safety.safe ? 'safe-apply' : (safety.requiresManualReview ? 'manual-review' : 'dry-run'),
    instruction,
    timestamp: new Date().toISOString(),
    safetyValidation: safety,
  };

  return payload;
}

function validateAgainstSchema(payload) {
  const schema = loadJson(SCHEMA_PATH);
  if (!schema) return { valid: true, errors: ['Schema file not found — skipping schema validation'] };

  const errors = [];
  const required = schema.required ?? [];
  for (const field of required) {
    if (payload[field] === undefined || payload[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (payload.repository && payload.repository !== 'federation-control') {
    errors.push(`Repository must be federation-control, got: ${payload.repository}`);
  }

  if (payload.executionMode && !['safe-apply', 'dry-run', 'manual-review'].includes(payload.executionMode)) {
    errors.push(`Invalid executionMode: ${payload.executionMode}`);
  }

  return { valid: errors.length === 0, errors };
}

function main() {
  console.log('[bridge] Runtime Cursor Bridge Service');
  console.log('='.repeat(55));

  // 1. Read inbox
  const inboxContent = readFile(INBOX_PATH);
  const empty = isInboxEmpty(inboxContent);
  console.log(`\n[bridge] Inbox: ${empty ? 'empty' : 'has instruction'}`);

  if (empty) {
    console.log('[bridge] No instruction to process.');
    const result = { ok: true, status: 'idle', inbox: 'empty', timestamp: new Date().toISOString() };
    console.log('\n' + JSON.stringify(result, null, 2));
    return;
  }

  // 2. Extract and normalize instruction
  const instruction = extractInstruction(inboxContent);
  console.log(`[bridge] Instruction length: ${instruction.length} chars`);
  console.log(`[bridge] Preview: ${instruction.slice(0, 100)}${instruction.length > 100 ? '...' : ''}`);

  // 3. Safety validation
  console.log('\n[bridge] Safety Validation:');
  const safety = validateInstruction(instruction);
  console.log(`  Safe: ${safety.safe}`);
  if (safety.blocked.length > 0) {
    console.log(`  Blocked (${safety.blocked.length}):`);
    for (const b of safety.blocked) console.log(`    ✕ ${b.reason}`);
  }
  if (safety.review.length > 0) {
    console.log(`  Manual review (${safety.review.length}):`);
    for (const r of safety.review) console.log(`    ◐ ${r.reason}`);
  }
  if (safety.safe && safety.review.length === 0) {
    console.log('  All safety checks passed');
  }

  // 4. Generate payload
  console.log('\n[bridge] Generating payload...');
  const payload = generatePayload(instruction);

  // 5. Schema validation
  const schemaResult = validateAgainstSchema(payload);
  console.log(`[bridge] Schema valid: ${schemaResult.valid}`);
  if (!schemaResult.valid) {
    for (const e of schemaResult.errors) console.log(`  ✕ ${e}`);
  }

  // 6. Payload-level safety validation
  const payloadSafety = validatePayload(payload);
  console.log(`[bridge] Payload safe: ${payloadSafety.safe}`);

  // 7. Write payload
  if (safety.safe) {
    saveJson(PAYLOAD_PATH, payload);
    console.log(`[bridge] Payload written: ${PAYLOAD_PATH}`);
  } else {
    console.log('[bridge] Payload NOT written — safety blocked');
  }

  // Report
  const report = {
    ok: safety.safe && schemaResult.valid,
    status: safety.safe ? 'payload-ready' : 'blocked',
    inbox: 'has-instruction',
    instructionLength: instruction.length,
    targetFiles: payload.targetFiles,
    requiredValidation: payload.requiredValidation,
    executionMode: payload.executionMode,
    safety: { safe: safety.safe, blocked: safety.blocked.length, review: safety.review.length },
    schemaValid: schemaResult.valid,
    payloadPath: safety.safe ? PAYLOAD_PATH : null,
    timestamp: new Date().toISOString(),
  };

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[bridge] Status: ${report.status.toUpperCase()}`);
  console.log('\n' + JSON.stringify(report, null, 2));
}

main();
