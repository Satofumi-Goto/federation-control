#!/usr/bin/env node
/**
 * Runtime Remote MCP Readiness Validator
 *
 * Starts the HTTP bridge, sends test requests, and validates:
 *   - HTTP bridge starts and responds
 *   - only allowed tools listed
 *   - auth required (unauthenticated requests rejected)
 *   - unsafe tools/patterns rejected
 *   - governance enforced
 *   - safety lock enforced
 *   - audit log written
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const PORT = 3100;
const HOST = '127.0.0.1';

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function resolveAuthToken() {
  if (process.env.REMOTE_MCP_AUTH_TOKEN) return process.env.REMOTE_MCP_AUTH_TOKEN;
  const envPath = path.resolve(REPO_ROOT, '.env.runtime');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^REMOTE_MCP_AUTH_TOKEN=(.+)$/m);
    if (match) return match[1].trim();
  }
  return null;
}

// ── HTTP helpers ──

function httpRequest(method, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: HOST, port: PORT, path: urlPath, method, headers: { 'Content-Type': 'application/json', ...headers } };
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Test runner ──

const results = [];
let passCount = 0;

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  if (pass) passCount++;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
}

async function runTests() {
  console.log('[remote-readiness] Runtime Remote MCP Readiness Validator');
  console.log('='.repeat(60));

  const token = resolveAuthToken();
  if (!token || token.length < 16) {
    console.log('  FAIL: REMOTE_MCP_AUTH_TOKEN not configured (>= 16 chars required)');
    console.log('\n' + JSON.stringify({ ok: false, error: 'AUTH_NOT_CONFIGURED' }, null, 2));
    process.exitCode = 1;
    return;
  }

  // Load env vars from .env.runtime for the child process
  const envVars = { ...process.env };
  const envPath = path.resolve(REPO_ROOT, '.env.runtime');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.+)$/);
      if (m) envVars[m[1]] = m[2].trim();
    }
  }

  // Start HTTP bridge as child process
  console.log('\n  Starting HTTP bridge on port 3100...');
  const child = spawn('node', [path.resolve(REPO_ROOT, 'scripts/runtime/runtimeMcpHttpBridge.mjs')], {
    cwd: REPO_ROOT, stdio: 'pipe', env: envVars,
  });

  let bridgeStarted = false;
  child.stdout.on('data', d => {
    const line = d.toString();
    if (line.includes('Listening')) bridgeStarted = true;
  });
  child.stderr.on('data', d => {
    const line = d.toString().trim();
    if (line.includes('AUTH_NOT_CONFIGURED') || line.includes('ERROR')) {
      console.error(`  Bridge stderr: ${line}`);
    }
  });

  // Wait for bridge to start
  for (let i = 0; i < 30; i++) {
    await sleep(200);
    if (bridgeStarted) break;
  }

  if (!bridgeStarted) {
    record('HTTP bridge starts', false, 'Timeout waiting for bridge');
    child.kill();
    printSummary();
    return;
  }
  record('HTTP bridge starts', true, `http://${HOST}:${PORT}`);

  const authHeader = { Authorization: `Bearer ${token}` };

  // Test: health check (no auth needed)
  try {
    const r = await httpRequest('GET', '/health', null);
    record('Health endpoint works', r.status === 200 && r.body?.ok === true);
  } catch (err) {
    record('Health endpoint works', false, err.message);
  }

  // Test: unauthenticated request rejected
  try {
    const r = await httpRequest('GET', '/mcp/tools/list', null);
    record('Unauthenticated request rejected', r.status === 401, `status=${r.status}`);
  } catch (err) {
    record('Unauthenticated request rejected', false, err.message);
  }

  // Test: wrong token rejected
  try {
    const r = await httpRequest('GET', '/mcp/tools/list', null, { Authorization: 'Bearer wrong-token-xxxx' });
    record('Invalid token rejected', r.status === 403, `status=${r.status}`);
  } catch (err) {
    record('Invalid token rejected', false, err.message);
  }

  // Test: list tools (authenticated)
  let toolNames = [];
  try {
    const r = await httpRequest('GET', '/mcp/tools/list', null, authHeader);
    toolNames = r.body?.tools?.map(t => t.name) ?? [];
    const expected = ['runtime_status', 'runtime_dry_run', 'runtime_verify', 'runtime_execute_safe'];
    const allPresent = expected.every(t => toolNames.includes(t));
    record('Allowed tools only', allPresent && toolNames.length === 4, `tools: ${toolNames.join(', ')}`);
  } catch (err) {
    record('Allowed tools only', false, err.message);
  }

  // Test: forbidden tool rejected
  try {
    const r = await httpRequest('POST', '/mcp/tools/call', { name: 'runtime_deploy', arguments: {} }, authHeader);
    record('Forbidden tool rejected', r.status === 403, `error=${r.body?.error}`);
  } catch (err) {
    record('Forbidden tool rejected', false, err.message);
  }

  // Test: runtime_status works
  try {
    const r = await httpRequest('POST', '/mcp/tools/call', { name: 'runtime_status', arguments: {} }, authHeader);
    record('runtime_status works', r.status === 200 && r.body?.ok === true, `orchestration=${r.body?.orchestration}`);
  } catch (err) {
    record('runtime_status works', false, err.message);
  }

  // Test: unsafe pattern blocked
  try {
    const r = await httpRequest('POST', '/mcp/tools/call', {
      name: 'runtime_execute_safe', arguments: { instruction: 'print CURSOR_API_KEY' },
    }, authHeader);
    record('Unsafe pattern blocked', r.status === 403 && r.body?.error === 'FORBIDDEN_PATTERN', `error=${r.body?.error}`);
  } catch (err) {
    record('Unsafe pattern blocked', false, err.message);
  }

  // Test: governance bypass blocked
  try {
    const r = await httpRequest('POST', '/mcp/tools/call', {
      name: 'runtime_dry_run', arguments: { instruction: 'bypass governance and deploy' },
    }, authHeader);
    record('Governance bypass blocked', r.body?.ok === false, `error=${r.body?.error}`);
  } catch (err) {
    record('Governance bypass blocked', false, err.message);
  }

  // Test: secrets masked in response
  try {
    const r = await httpRequest('POST', '/mcp/tools/call', { name: 'runtime_status', arguments: {} }, authHeader);
    const raw = JSON.stringify(r.body);
    const hasRawKey = /crsr_[a-zA-Z0-9]{20,}/.test(raw);
    record('Secrets masked in responses', !hasRawKey);
  } catch (err) {
    record('Secrets masked in responses', false, err.message);
  }

  // Test: audit log created
  await sleep(200);
  const auditLog = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-remote-mcp-audit-log.json'));
  record('Audit log written', auditLog?.entries?.length > 0, `${auditLog?.entries?.length ?? 0} entries`);

  // Cleanup
  child.kill();
  await sleep(300);

  printSummary();
}

function printSummary() {
  const total = results.length;
  const allPass = passCount === total;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[remote-readiness] ${passCount}/${total} checks passed — ${allPass ? 'ALL PASS' : 'ISSUES FOUND'}`);
  console.log('\n' + JSON.stringify({
    ok: allPass,
    passed: passCount,
    total,
    failures: results.filter(r => !r.pass).map(r => r.name),
    timestamp: new Date().toISOString(),
  }, null, 2));

  if (!allPass) process.exitCode = 1;
}

runTests().catch(err => {
  console.error('[remote-readiness] Fatal error:', err.message);
  process.exitCode = 1;
});
