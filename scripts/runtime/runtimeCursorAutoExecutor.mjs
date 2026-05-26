#!/usr/bin/env node
/**
 * Runtime Cursor Auto Executor
 *
 * Full pipeline: detect payload → safety lock → invoke Cursor Agent →
 * build → verify → collect results → update session state.
 *
 * Does NOT bypass safety, validation, workspace binding, or governance.
 */

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateTrigger } from './runtimeInvocationTrigger.mjs';
import { evaluateSafetyLock, LOCK_DECISIONS } from './runtimeInvocationSafetyLock.mjs';
import { collectAndSave } from './runtimeExecutionResultCollector.mjs';
import { translateToPrompt } from './runtimeCursorPayloadTranslator.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const SESSION_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-cursor-session-state.json');
const CAPABILITY_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-cursor-capability-report.json');
const EXEC_LOG_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-cursor-execution-log.json');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function run(cmd) {
  try {
    return { ok: true, output: execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 30000 }).trim() };
  } catch (e) {
    return { ok: false, output: e.stderr?.trim() ?? e.message };
  }
}

function updateSession(fields) {
  const session = loadJson(SESSION_PATH) ?? {};
  Object.assign(session, fields, { timestamp: new Date().toISOString() });
  saveJson(SESSION_PATH, session);
  return session;
}

function appendExecutionLog(entry) {
  const log = loadJson(EXEC_LOG_PATH) ?? [];
  log.push(entry);
  saveJson(EXEC_LOG_PATH, log.slice(-50));
}

function resolveCursorExecutable() {
  const capability = loadJson(CAPABILITY_PATH);
  if (capability?.primaryExecutable?.path) return capability.primaryExecutable.path;
  return null;
}

function invokeCursorAgent(executable, prompt) {
  console.log(`  Executable: ${executable}`);
  console.log(`  Prompt length: ${prompt.length} chars`);

  try {
    const result = spawnSync(executable, ['-p', '--force'], {
      cwd: REPO_ROOT,
      input: prompt,
      encoding: 'utf8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return {
      ok: result.status === 0,
      exitCode: result.status,
      stdout: result.stdout?.slice(-2000) ?? '',
      stderr: result.stderr?.slice(-1000) ?? '',
    };
  } catch (e) {
    return { ok: false, exitCode: -1, stdout: '', stderr: e.message };
  }
}

function main() {
  console.log('[auto-executor] Runtime Cursor Auto Executor');
  console.log('='.repeat(60));

  // Phase 1: Trigger evaluation
  console.log('\n[auto-executor] Phase 1: Trigger Evaluation');
  const trigger = evaluateTrigger();
  console.log(`  Ready: ${trigger.ready}`);
  console.log(`  Lock: ${trigger.lockDecision}`);

  if (!trigger.ready) {
    console.log(`  Reason: ${trigger.reason}`);

    if (trigger.issues.includes('no-payload')) {
      console.log('\n[auto-executor] No payload — running build + verify as health check');
      updateSession({ executionState: 'health-check' });

      const buildResult = run('node scripts/build-runtime-workspace-v2.mjs');
      console.log(`  Build: ${buildResult.ok ? 'PASS' : 'FAIL'}`);

      const verifyResult = run('node scripts/runtime/runtimeAutoVerificationPipeline.mjs');
      console.log(`  Auto-verify: ${verifyResult.ok ? 'ALL PASS' : 'SOME FAILED'}`);

      const results = collectAndSave();
      updateSession({
        executionState: 'idle',
        executionResult: { healthCheck: true, build: buildResult.ok, verify: verifyResult.ok },
        executionEndTime: new Date().toISOString(),
      });

      const report = {
        ok: buildResult.ok && verifyResult.ok,
        mode: 'health-check',
        build: buildResult.ok,
        verification: results.verificationPass,
        timestamp: new Date().toISOString(),
      };
      console.log(`\n${'='.repeat(60)}`);
      console.log(`[auto-executor] Health Check: ${report.ok ? 'PASS' : 'ISSUES'}`);
      console.log('\n' + JSON.stringify(report, null, 2));
      return;
    }

    updateSession({ executionState: 'blocked', executionResult: { reason: trigger.reason } });
    const report = { ok: false, mode: 'blocked', reason: trigger.reason, issues: trigger.issues, timestamp: new Date().toISOString() };
    console.log(`\n${'='.repeat(60)}`);
    console.log('[auto-executor] BLOCKED');
    console.log('\n' + JSON.stringify(report, null, 2));
    return;
  }

  const payload = trigger.payload;
  console.log(`  Payload: ${payload.instructionId}`);
  console.log(`  Mode: ${payload.executionMode}`);

  // Phase 2: Safety lock
  console.log('\n[auto-executor] Phase 2: Safety Lock');
  const lock = evaluateSafetyLock(payload);
  console.log(`  Decision: ${lock.decision}`);

  if (lock.decision === LOCK_DECISIONS.BLOCKED) {
    console.log('  BLOCKED by safety lock');
    updateSession({ executionState: 'blocked', activePayload: payload.instructionId });
    const report = { ok: false, mode: 'safety-blocked', lock, timestamp: new Date().toISOString() };
    console.log('\n' + JSON.stringify(report, null, 2));
    return;
  }

  if (lock.decision === LOCK_DECISIONS.MANUAL_APPROVAL) {
    console.log('  MANUAL APPROVAL required');
    updateSession({ executionState: 'awaiting-approval', activePayload: payload.instructionId });
    const report = { ok: false, mode: 'awaiting-approval', lock, timestamp: new Date().toISOString() };
    console.log(`\n${'='.repeat(60)}`);
    console.log('[auto-executor] AWAITING MANUAL APPROVAL');
    console.log('\n' + JSON.stringify(report, null, 2));
    return;
  }

  // Phase 3: Cursor Agent invocation
  console.log('\n[auto-executor] Phase 3: Cursor Agent Invocation');
  updateSession({
    executionState: 'executing',
    activePayload: payload.instructionId,
    lastInstructionId: payload.instructionId,
    lastTriggerTime: new Date().toISOString(),
    executionStartTime: new Date().toISOString(),
  });

  const executable = resolveCursorExecutable();
  let agentResult;

  if (executable) {
    const prompt = translateToPrompt(payload);
    console.log('  Invoking Cursor Agent...');
    agentResult = invokeCursorAgent(executable, prompt);
    console.log(`  Exit code: ${agentResult.exitCode}`);
    console.log(`  Success: ${agentResult.ok}`);
  } else {
    console.log('  Cursor CLI not available — executing build+verify fallback');
    const buildR = run('node scripts/build-runtime-workspace-v2.mjs');
    const verifyR = run('node scripts/runtime/runtimeAutoVerificationPipeline.mjs');
    agentResult = { ok: buildR.ok && verifyR.ok, exitCode: 0, stdout: 'Fallback execution', stderr: '', fallback: true };
    console.log(`  Fallback build: ${buildR.ok ? 'PASS' : 'FAIL'}`);
    console.log(`  Fallback verify: ${verifyR.ok ? 'PASS' : 'FAIL'}`);
  }

  // Phase 4: Build
  console.log('\n[auto-executor] Phase 4: Build');
  const buildResult = run('node scripts/build-runtime-workspace-v2.mjs');
  console.log(`  Build: ${buildResult.ok ? 'PASS' : 'FAIL'}`);

  // Phase 5: Verification
  console.log('\n[auto-executor] Phase 5: Verification');
  const verifyResult = run('node scripts/runtime/runtimeAutoVerificationPipeline.mjs');
  console.log(`  Verify: ${verifyResult.ok ? 'ALL PASS' : 'SOME FAILED'}`);

  // Phase 6: Collect results
  console.log('\n[auto-executor] Phase 6: Result Collection');
  const results = collectAndSave();
  console.log(`  Changed files: ${results.changedFileCount}`);
  console.log(`  Build: ${results.build.ok ? 'PASS' : 'FAIL'} (v${results.build.version})`);
  console.log(`  Verification: ${results.verificationPass ? 'ALL PASS' : 'SOME FAILED'}`);
  console.log(`  Health: ${results.health.state}`);

  // Phase 7: Update session
  const endTime = new Date().toISOString();
  updateSession({
    executionState: 'completed',
    executionEndTime: endTime,
    executionResult: {
      agentOk: agentResult.ok,
      agentFallback: agentResult.fallback ?? false,
      buildOk: results.build.ok,
      verifyOk: results.verificationPass,
    },
    verificationResult: results.verification,
    deployResult: null,
    rollbackState: null,
  });

  // Execution log
  appendExecutionLog({
    instructionId: payload.instructionId,
    executionMode: payload.executionMode,
    agentOk: agentResult.ok,
    agentFallback: agentResult.fallback ?? false,
    buildOk: results.build.ok,
    verifyOk: results.verificationPass,
    changedFiles: results.changedFileCount,
    startTime: payload.timestamp,
    endTime,
  });

  // Final report
  const allOk = results.build.ok && results.verificationPass;
  const report = {
    ok: allOk,
    mode: 'execution',
    instructionId: payload.instructionId,
    executionMode: payload.executionMode,
    agent: { ok: agentResult.ok, fallback: agentResult.fallback ?? false, exitCode: agentResult.exitCode },
    build: results.build,
    verification: results.verification,
    verificationPass: results.verificationPass,
    changedFiles: results.changedFileCount,
    git: results.git,
    health: results.health,
    timestamp: endTime,
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[auto-executor] Result: ${allOk ? 'EXECUTION COMPLETE' : 'EXECUTION WITH ISSUES'}`);
  console.log('\n' + JSON.stringify(report, null, 2));
}

main();
