#!/usr/bin/env node
/**
 * Runtime Remote MCP Endpoint Validator
 *
 * Validates the remote MCP registration package:
 *   - registration manifest completeness
 *   - endpoint format (HTTPS required)
 *   - auth token configured
 *   - only allowed tools in manifest
 *   - no destructive tools
 *   - governance metadata present
 *   - local infrastructure readiness
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function tryExec(cmd) {
  try {
    execSync(cmd, { encoding: 'utf8', timeout: 30000, cwd: REPO_ROOT, stdio: 'pipe' });
    return true;
  } catch { return false; }
}

const results = [];
let passCount = 0;

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  if (pass) passCount++;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
}

function run() {
  console.log('[endpoint-validator] Runtime Remote MCP Endpoint Validator');
  console.log('='.repeat(60));

  // ── Registration manifest ──

  console.log('\n  Registration manifest:');

  const reg = loadJson(path.resolve(REPO_ROOT, 'runtime_data/chatgpt-remote-mcp-registration.json'));
  record('Registration manifest exists', !!reg);

  if (reg) {
    record('App name defined', !!reg.appName, reg.appName);
    record('Version defined', !!reg.version, reg.version);
    record('Description present', reg.description?.length > 20);

    // Endpoint format
    const ep = reg.remoteMcpEndpoint;
    record('Endpoint section present', !!ep);
    if (ep) {
      const urlValid = ep.url?.startsWith('https://') || ep.placeholder === true;
      record('Endpoint HTTPS or placeholder', urlValid,
        ep.placeholder ? 'placeholder (pending tunnel)' : ep.url);
      record('Tools list path defined', !!ep.toolsListPath, ep.toolsListPath);
      record('Tools call path defined', !!ep.toolsCallPath, ep.toolsCallPath);
    }

    // Auth
    const auth = reg.authentication;
    record('Auth section present', !!auth);
    if (auth) {
      record('Auth type is bearer', auth.type === 'bearer');
      record('Auth required flag', auth.required === true);
    }

    // Allowed tools
    const allowed = reg.allowedTools ?? [];
    const expectedTools = ['runtime_status', 'runtime_dry_run', 'runtime_verify', 'runtime_execute_safe'];
    const toolNames = allowed.map(t => t.name);
    const allPresent = expectedTools.every(t => toolNames.includes(t));
    record('All 4 allowed tools present', allPresent && toolNames.length === 4,
      `${toolNames.join(', ')}`);

    // No destructive tools
    const forbidden = reg.forbiddenTools ?? [];
    record('Forbidden tools listed', forbidden.length >= 3, `${forbidden.length} forbidden`);
    record('Destructive tools not exposed', reg.destructiveToolsExposed === false);
    record('Secrets not exposed', reg.secretsExposed === false);

    // Governance
    record('Governance mode enforced', reg.governanceMode === 'enforced');
    record('Permission mode is execute-safe', reg.permissionMode === 'execute-safe');
    record('Max permission is execute-safe', reg.maximumPermission === 'execute-safe');
    record('Audit enabled', reg.auditEnabled === true);
    record('Safety disclaimer present', reg.safetyDisclaimer?.length > 50);
  }

  // ── Setup guide ──

  console.log('\n  Documentation:');

  record('Setup guide exists',
    fs.existsSync(path.resolve(REPO_ROOT, 'docs/chatgpt-remote-mcp-setup-guide.md')));
  record('Final checklist exists',
    fs.existsSync(path.resolve(REPO_ROOT, 'docs/runtime-remote-mcp-final-checklist.md')));
  record('Tunnel runbook exists',
    fs.existsSync(path.resolve(REPO_ROOT, 'docs/runtime-remote-mcp-tunnel-runbook.md')));
  record('Exposure options documented',
    fs.existsSync(path.resolve(REPO_ROOT, 'docs/runtime-remote-mcp-exposure-options.md')));
  record('Invocation contract exists',
    fs.existsSync(path.resolve(REPO_ROOT, 'docs/runtime-external-invocation-contract.md')));

  // ── Auth token ──

  console.log('\n  Auth configuration:');

  let tokenConfigured = false;
  const envPath = path.resolve(REPO_ROOT, '.env.runtime');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^REMOTE_MCP_AUTH_TOKEN=(.+)$/m);
    tokenConfigured = match && match[1].trim().length >= 16;
  }
  record('REMOTE_MCP_AUTH_TOKEN configured', tokenConfigured,
    tokenConfigured ? 'Token present (>= 16 chars)' : 'Not set or too short');

  let cursorKeyConfigured = false;
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^CURSOR_API_KEY=(.+)$/m);
    cursorKeyConfigured = match && match[1].trim().length > 10;
  }
  record('CURSOR_API_KEY configured', cursorKeyConfigured);

  // ── Infrastructure ──

  console.log('\n  Infrastructure:');

  record('MCP gateway server exists',
    fs.existsSync(path.resolve(REPO_ROOT, 'mcp/runtime-gateway-server.mjs')));
  record('HTTP bridge exists',
    fs.existsSync(path.resolve(REPO_ROOT, 'scripts/runtime/runtimeMcpHttpBridge.mjs')));
  record('Auth layer exists',
    fs.existsSync(path.resolve(REPO_ROOT, 'scripts/runtime/runtimeRemoteMcpAuth.mjs')));
  record('Remote MCP policy exists',
    fs.existsSync(path.resolve(REPO_ROOT, 'runtime_data/runtime-remote-mcp-policy.json')));
  record('Remote audit log exists',
    fs.existsSync(path.resolve(REPO_ROOT, 'runtime_data/runtime-remote-mcp-audit-log.json')));
  record('Headless executor exists',
    fs.existsSync(path.resolve(REPO_ROOT, 'scripts/runtime/runtimeHeadlessCursorExecutor.mjs')));

  // ── Policy consistency ──

  console.log('\n  Policy consistency:');

  const policy = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-remote-mcp-policy.json'));
  if (policy && reg) {
    const policyTools = new Set(policy.allowedTools);
    const regTools = new Set((reg.allowedTools ?? []).map(t => t.name));
    const match = [...policyTools].every(t => regTools.has(t)) && [...regTools].every(t => policyTools.has(t));
    record('Policy and manifest tools match', match);

    const policyForbidden = new Set(policy.forbiddenTools);
    const regForbidden = new Set(reg.forbiddenTools);
    const forbidMatch = [...policyForbidden].every(t => regForbidden.has(t));
    record('Policy and manifest forbidden match', forbidMatch);
  }

  // ── Governance engine ──

  console.log('\n  Governance:');

  const govOk = tryExec('node scripts/runtime/runtimePolicyEngine.mjs');
  record('Governance engine operational', govOk);

  const safetyOk = tryExec('node scripts/runtime/runtimeInvocationSafetyLock.mjs');
  record('Safety lock operational', safetyOk);

  // ── Summary ──

  const total = results.length;
  const allPass = passCount === total;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[endpoint-validator] ${passCount}/${total} checks passed — ${allPass ? 'ALL PASS' : 'ISSUES FOUND'}`);
  console.log('\n' + JSON.stringify({
    ok: allPass,
    passed: passCount,
    total,
    failures: results.filter(r => !r.pass).map(r => r.name),
    registrationStatus: reg?.registrationStatus ?? 'unknown',
    tunnelActivated: !(reg?.remoteMcpEndpoint?.placeholder),
    timestamp: new Date().toISOString(),
  }, null, 2));

  if (!allPass) process.exitCode = 1;
}

run();
