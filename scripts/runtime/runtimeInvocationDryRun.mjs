#!/usr/bin/env node
/**
 * Runtime Invocation Dry-Run Engine
 *
 * Simulates the full Cursor invocation pipeline without executing
 * any real modifications. Detects blockers, malformed payloads,
 * and missing bindings.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateWorkspaceBinding } from './runtimeCursorWorkspaceBinding.mjs';
import { validatePayload } from './runtimeInvocationSafetyLayer.mjs';
import { translateToPrompt, translateToInvocationArgs } from './runtimeCursorPayloadTranslator.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const PAYLOAD_PATH = path.resolve(REPO_ROOT, '.cursor/tasks/runtime-bridge-payload.json');
const CAPABILITY_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-cursor-capability-report.json');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function main() {
  console.log('[dry-run] Runtime Invocation Dry-Run Engine');
  console.log('='.repeat(55));

  const steps = [];
  let blocked = false;

  // Step 1: Workspace binding
  console.log('\n[dry-run] Step 1: Workspace Binding');
  const binding = validateWorkspaceBinding();
  steps.push({ step: 'workspace-binding', pass: binding.bound, detail: binding.bound ? 'Workspace bound to federation-control' : `${binding.errors.length} binding error(s)` });
  console.log(`  ${binding.bound ? 'PASS' : 'FAIL'}: ${steps[0].detail}`);
  if (!binding.bound) blocked = true;

  // Step 2: Capability check
  console.log('\n[dry-run] Step 2: Cursor Capability');
  const capability = loadJson(CAPABILITY_PATH);
  if (!capability) {
    steps.push({ step: 'capability-check', pass: false, detail: 'No capability report — run runtime:cursor-capability first' });
    console.log('  FAIL: No capability report found');
  } else {
    const hasExec = capability.invocationSupported;
    steps.push({ step: 'capability-check', pass: true, detail: hasExec ? `CLI available: ${capability.primaryExecutable?.name ?? 'agent'}` : 'CLI not found (will need manual invocation)' });
    console.log(`  ${hasExec ? 'PASS' : 'WARN'}: ${steps[steps.length - 1].detail}`);
  }

  // Step 3: Payload existence
  console.log('\n[dry-run] Step 3: Payload Check');
  const payload = loadJson(PAYLOAD_PATH);
  if (!payload) {
    steps.push({ step: 'payload-exists', pass: false, detail: 'No payload found — run runtime:cursor-bridge first' });
    console.log('  FAIL: No payload found');
    blocked = true;
  } else {
    steps.push({ step: 'payload-exists', pass: true, detail: `Payload: ${payload.instructionId}` });
    console.log(`  PASS: ${steps[steps.length - 1].detail}`);
  }

  // Step 4: Payload schema validation
  console.log('\n[dry-run] Step 4: Payload Schema');
  if (payload) {
    const schemaErrors = [];
    const required = ['instructionId', 'repository', 'targetFiles', 'requiredValidation', 'allowedOperations', 'forbiddenOperations', 'executionMode'];
    for (const f of required) {
      if (payload[f] === undefined) schemaErrors.push(`Missing: ${f}`);
    }
    if (payload.repository && payload.repository !== 'federation-control') schemaErrors.push(`Wrong repo: ${payload.repository}`);
    if (payload.executionMode && !['safe-apply', 'dry-run', 'manual-review'].includes(payload.executionMode)) schemaErrors.push(`Invalid mode: ${payload.executionMode}`);

    const schemaOk = schemaErrors.length === 0;
    steps.push({ step: 'payload-schema', pass: schemaOk, detail: schemaOk ? 'Schema valid' : `${schemaErrors.length} error(s)` });
    console.log(`  ${schemaOk ? 'PASS' : 'FAIL'}: ${steps[steps.length - 1].detail}`);
    if (!schemaOk) {
      for (const e of schemaErrors) console.log(`    ✕ ${e}`);
      blocked = true;
    }
  } else {
    steps.push({ step: 'payload-schema', pass: false, detail: 'Skipped — no payload' });
    console.log('  SKIP: No payload');
  }

  // Step 5: Safety validation
  console.log('\n[dry-run] Step 5: Safety Validation');
  if (payload) {
    const safety = validatePayload(payload);
    steps.push({ step: 'safety-validation', pass: safety.safe, detail: safety.safe ? 'All safety checks passed' : `${safety.blocked.length} blocked operation(s)` });
    console.log(`  ${safety.safe ? 'PASS' : 'FAIL'}: ${steps[steps.length - 1].detail}`);
    if (!safety.safe) {
      for (const b of safety.blocked) console.log(`    ✕ ${b.reason}`);
      blocked = true;
    }
    if (safety.review.length > 0) {
      console.log(`  REVIEW: ${safety.review.length} item(s) need manual review`);
      for (const r of safety.review) console.log(`    ◐ ${r.reason}`);
    }
  } else {
    steps.push({ step: 'safety-validation', pass: false, detail: 'Skipped — no payload' });
    console.log('  SKIP: No payload');
  }

  // Step 6: Prompt translation
  console.log('\n[dry-run] Step 6: Prompt Translation');
  let prompt = null;
  if (payload) {
    try {
      prompt = translateToPrompt(payload);
      steps.push({ step: 'prompt-translation', pass: true, detail: `Prompt generated (${prompt.length} chars)` });
      console.log(`  PASS: ${steps[steps.length - 1].detail}`);
    } catch (e) {
      steps.push({ step: 'prompt-translation', pass: false, detail: `Translation failed: ${e.message}` });
      console.log(`  FAIL: ${steps[steps.length - 1].detail}`);
      blocked = true;
    }
  } else {
    steps.push({ step: 'prompt-translation', pass: false, detail: 'Skipped — no payload' });
    console.log('  SKIP: No payload');
  }

  // Step 7: Invocation args
  console.log('\n[dry-run] Step 7: Invocation Arguments');
  if (payload) {
    const args = translateToInvocationArgs(payload, capability?.primaryExecutable?.path);
    steps.push({ step: 'invocation-args', pass: true, detail: `${args.executable} ${args.args.join(' ')} --mode ${args.mode}` });
    console.log(`  PASS: ${steps[steps.length - 1].detail}`);
  } else {
    steps.push({ step: 'invocation-args', pass: false, detail: 'Skipped — no payload' });
    console.log('  SKIP: No payload');
  }

  // Step 8: Execution path simulation
  console.log('\n[dry-run] Step 8: Execution Path');
  const execPath = [
    'Read inbox → Extract instruction',
    'Generate bridge payload',
    'Validate safety layer',
    'Translate to Agent prompt',
    'Build invocation arguments',
    'Invoke Cursor Agent (simulated)',
    'Agent executes instruction',
    'Run required validations',
    'Capture execution report',
  ];
  for (const step of execPath) {
    console.log(`  → ${step}`);
  }
  steps.push({ step: 'execution-path', pass: !blocked, detail: blocked ? 'Path blocked — see errors above' : 'Full execution path clear' });

  // Blockers summary
  const blockers = steps.filter(s => !s.pass);
  const warnings = [];
  if (capability && !capability.invocationSupported) {
    warnings.push('Cursor CLI not installed — manual invocation required');
  }

  const report = {
    ok: !blocked,
    status: blocked ? 'blocked' : 'dry-run-pass',
    steps,
    blockers: blockers.map(b => ({ step: b.step, detail: b.detail })),
    warnings,
    workspace: { bound: binding.bound, branch: binding.branch },
    payload: payload ? { id: payload.instructionId, mode: payload.executionMode } : null,
    cursorAvailable: capability?.invocationSupported ?? false,
    timestamp: new Date().toISOString(),
  };

  console.log(`\n${'='.repeat(55)}`);
  console.log(`[dry-run] Result: ${blocked ? 'BLOCKED' : 'DRY-RUN PASS'}`);
  if (blockers.length > 0) {
    console.log(`[dry-run] Blockers (${blockers.length}):`);
    for (const b of blockers) console.log(`  - [${b.step}] ${b.detail}`);
  }
  if (warnings.length > 0) {
    console.log(`[dry-run] Warnings (${warnings.length}):`);
    for (const w of warnings) console.log(`  - ${w}`);
  }

  console.log('\n' + JSON.stringify(report, null, 2));
}

main();
