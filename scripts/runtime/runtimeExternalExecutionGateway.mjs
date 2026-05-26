#!/usr/bin/env node
/**
 * Runtime External Execution Gateway
 *
 * Receives structured Runtime invocations from external callers,
 * validates governance and safety, resolves permission, and dispatches
 * to the appropriate Runtime tool entrypoint.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listTools, getToolById, PERMISSION_LEVELS, resolveOrchestrationStatus, resolveExecutionResult } from './runtimeToolExposureLayer.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const GATEWAY_LOG_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-gateway-log.json');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function tryExec(cmd) {
  try {
    const output = execSync(cmd, { encoding: 'utf8', timeout: 60000, cwd: REPO_ROOT, stdio: 'pipe' });
    return { ok: true, output: output.trim() };
  } catch (e) {
    return { ok: false, output: e.stderr?.trim() ?? e.message };
  }
}

// ── Forbidden patterns ──

const FORBIDDEN_PATTERNS = [
  /rm\s+-rf/i,
  /git\s+push\s+--force/i,
  /CURSOR_API_KEY/,
  /\.env\.runtime/,
  /drop\s+database/i,
  /delete\s+from\s+/i,
  /registry.*delet/i,
  /bypass.*governance/i,
  /override.*safety/i,
];

function validateInstructionSafety(instruction) {
  if (!instruction) return { safe: true, blocked: [] };
  const blocked = [];
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(instruction)) {
      blocked.push(pattern.source);
    }
  }
  return { safe: blocked.length === 0, blocked };
}

// ── Permission validation ──

const PERMISSION_RANK = {
  [PERMISSION_LEVELS.DRY_RUN]: 0,
  [PERMISSION_LEVELS.VERIFY_ONLY]: 1,
  [PERMISSION_LEVELS.EXECUTE_SAFE]: 2,
  [PERMISSION_LEVELS.EXECUTE_REVIEWED]: 3,
  [PERMISSION_LEVELS.EXECUTE_EMERGENCY]: 4,
};

function checkPermission(required, granted) {
  return (PERMISSION_RANK[granted] ?? -1) >= (PERMISSION_RANK[required] ?? 99);
}

// ── Governance validation ──

function validateGovernance() {
  const result = tryExec('node scripts/runtime/runtimePolicyEngine.mjs');
  return { passed: result.ok, detail: result.ok ? 'Governance policies active' : 'Governance check failed' };
}

// ── Safety lock validation ──

function validateSafetyLock() {
  const lockState = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-invocation-lock-state.json'));
  if (lockState?.decision === 'blocked') {
    return { passed: false, detail: 'Safety lock: blocked', decision: lockState.decision };
  }
  return { passed: true, detail: 'Safety lock: cleared', decision: lockState?.decision ?? 'no-state' };
}

// ── Execution scope validation ──

function validateExecutionScope(toolId, payload) {
  const scopeChecks = [];

  // Workspace must be federation-control
  const pkgJson = loadJson(path.resolve(REPO_ROOT, 'package.json'));
  const workspaceBound = pkgJson?.name === 'federation-control';
  scopeChecks.push({ check: 'workspace-bound', pass: workspaceBound });

  // Instruction safety
  const instrSafety = validateInstructionSafety(payload?.instruction ?? payload?.normalizedInstruction);
  scopeChecks.push({ check: 'instruction-safety', pass: instrSafety.safe, blocked: instrSafety.blocked });

  return { valid: scopeChecks.every(c => c.pass), checks: scopeChecks };
}

// ── Tool dispatch ──

function dispatchTool(tool) {
  if (!tool.entrypoint) {
    if (tool.id === 'runtime-status') return { ok: true, result: resolveOrchestrationStatus() };
    if (tool.id === 'runtime-result') return { ok: true, result: resolveExecutionResult() };
    return { ok: false, error: 'Tool has no entrypoint' };
  }

  const result = tryExec(`node ${tool.entrypoint}`);
  return { ok: result.ok, output: result.output };
}

// ── Main invocation pipeline ──

export function invokeToolById(toolId, options = {}) {
  const { permission = PERMISSION_LEVELS.DRY_RUN, payload = null } = options;

  const invocation = {
    toolId,
    permission,
    timestamp: new Date().toISOString(),
    checks: [],
    result: null,
    status: 'pending',
  };

  // 1. Tool resolution
  const tool = getToolById(toolId);
  if (!tool) {
    invocation.status = 'failed';
    invocation.error = 'TOOL_NOT_FOUND';
    appendLog(invocation);
    return invocation;
  }

  // 2. Permission check
  const permOk = checkPermission(tool.requiredPermission, permission);
  invocation.checks.push({ check: 'permission', pass: permOk, required: tool.requiredPermission, granted: permission });
  if (!permOk) {
    invocation.status = 'failed';
    invocation.error = 'PERMISSION_DENIED';
    appendLog(invocation);
    return invocation;
  }

  // 3. Governance check (if required)
  if (tool.governanceRequired) {
    const gov = validateGovernance();
    invocation.checks.push({ check: 'governance', pass: gov.passed, detail: gov.detail });
    if (!gov.passed) {
      invocation.status = 'failed';
      invocation.error = 'GOVERNANCE_BLOCKED';
      appendLog(invocation);
      return invocation;
    }
  }

  // 4. Safety lock (if required)
  if (tool.safetyLockRequired) {
    const safety = validateSafetyLock();
    invocation.checks.push({ check: 'safety-lock', pass: safety.passed, detail: safety.detail });
    if (!safety.passed) {
      invocation.status = 'failed';
      invocation.error = 'SAFETY_BLOCKED';
      appendLog(invocation);
      return invocation;
    }
  }

  // 5. Approval check
  if (tool.approvalRequired) {
    invocation.checks.push({ check: 'approval', pass: false, detail: 'Manual approval required — not auto-approved' });
    invocation.status = 'failed';
    invocation.error = 'APPROVAL_REQUIRED';
    appendLog(invocation);
    return invocation;
  }

  // 6. Execution scope
  const scope = validateExecutionScope(toolId, payload);
  invocation.checks.push({ check: 'execution-scope', pass: scope.valid, details: scope.checks });
  if (!scope.valid) {
    invocation.status = 'failed';
    invocation.error = 'SCOPE_INVALID';
    appendLog(invocation);
    return invocation;
  }

  // 7. Dispatch
  const dispatchResult = dispatchTool(tool);
  invocation.result = dispatchResult;
  invocation.status = dispatchResult.ok ? 'completed' : 'failed';
  if (!dispatchResult.ok) invocation.error = 'EXECUTION_FAILED';

  appendLog(invocation);
  return invocation;
}

function appendLog(entry) {
  const log = loadJson(GATEWAY_LOG_PATH) ?? { invocations: [] };
  log.invocations.push(entry);
  if (log.invocations.length > 100) log.invocations = log.invocations.slice(-100);
  log.lastUpdated = new Date().toISOString();
  saveJson(GATEWAY_LOG_PATH, log);
}

// ── CLI ──

if (process.argv[1]?.endsWith('runtimeExternalExecutionGateway.mjs')) {
  const args = process.argv.slice(2);

  if (args[0] === '--invoke' && args[1]) {
    const toolId = args[1];
    const permission = args[2] ?? PERMISSION_LEVELS.DRY_RUN;
    console.log(`[gateway] Invoking tool: ${toolId} with permission: ${permission}`);
    const result = invokeToolById(toolId, { permission });
    console.log('\n' + JSON.stringify(result, null, 2));
  } else {
    console.log('[gateway] Runtime External Execution Gateway');
    console.log('='.repeat(60));

    const tools = listTools(PERMISSION_LEVELS.EXECUTE_SAFE);
    console.log(`\n  Exposed tools: ${tools.length}`);
    for (const t of tools) {
      const accessTag = t.accessible ? 'ACCESS' : 'DENIED';
      console.log(`    [${accessTag}] ${t.id} — ${t.description}`);
    }

    const govCheck = validateGovernance();
    const safetyCheck = validateSafetyLock();
    const scopeCheck = validateExecutionScope('runtime-execute', null);

    console.log('\n  Gateway checks:');
    console.log(`    Governance: ${govCheck.passed ? 'PASS' : 'FAIL'} — ${govCheck.detail}`);
    console.log(`    Safety lock: ${safetyCheck.passed ? 'PASS' : 'FAIL'} — ${safetyCheck.detail}`);
    console.log(`    Execution scope: ${scopeCheck.valid ? 'PASS' : 'FAIL'}`);

    const allPass = govCheck.passed && safetyCheck.passed && scopeCheck.valid;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[gateway] ${allPass ? 'OPERATIONAL' : 'DEGRADED'}`);
    console.log('\n' + JSON.stringify({
      ok: allPass,
      toolCount: tools.length,
      governance: govCheck.passed,
      safety: safetyCheck.passed,
      scope: scopeCheck.valid,
      timestamp: new Date().toISOString(),
    }, null, 2));
  }
}
