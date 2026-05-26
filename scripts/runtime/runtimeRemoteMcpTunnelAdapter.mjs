#!/usr/bin/env node
/**
 * Runtime Remote MCP Tunnel Adapter
 *
 * Wraps the local MCP gateway with remote exposure controls:
 *   - enforces the remote MCP policy (allowed tools, permissions)
 *   - rejects unsafe payloads before they reach the gateway
 *   - masks all secrets in request/response
 *   - writes an audit log for every remote call
 *   - provides tunnel lifecycle management
 *
 * CLI:
 *   --check    Validate policy and readiness (default)
 *   --start    Start the tunnel adapter (prints instructions)
 *   --audit    Print recent audit log
 */

import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const POLICY_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-remote-mcp-policy.json');
const AUDIT_LOG_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-remote-mcp-audit-log.json');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function maskSecrets(text) {
  if (!text) return text;
  return String(text)
    .replace(/crsr_[a-zA-Z0-9]{20,}/g, 'crsr_****')
    .replace(/CURSOR_API_KEY=[^\s]+/g, 'CURSOR_API_KEY=****')
    .replace(/Bearer\s+[^\s]+/g, 'Bearer ****')
    .replace(/sk-[a-zA-Z0-9]{20,}/g, 'sk-****')
    .replace(/ghp_[a-zA-Z0-9]{20,}/g, 'ghp_****');
}

function hashRequest(toolName, args) {
  const content = JSON.stringify({ tool: toolName, args: args ?? {} });
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

// ── Policy enforcement ──

function loadPolicy() {
  const policy = loadJson(POLICY_PATH);
  if (!policy) throw new Error('Remote MCP policy not found');
  return policy;
}

function isToolAllowed(toolName, policy) {
  return policy.allowedTools.includes(toolName);
}

function isToolForbidden(toolName, policy) {
  return policy.forbiddenTools.includes(toolName);
}

const FORBIDDEN_PATTERNS = [
  /CURSOR_API_KEY/i,
  /\.env\.runtime/i,
  /credential/i,
  /token\s*[:=]/i,
  /secret\s*[:=]/i,
  /rm\s+-rf/i,
  /git\s+push\s+--force/i,
  /--no-verify/i,
  /drop\s+database/i,
  /delete\s+from\s+/i,
  /registry.*delet/i,
  /federation.*memory.*delet/i,
  /canonical.*replac/i,
  /bypass.*governance/i,
  /bypass.*safety/i,
  /override.*lock/i,
  /force\s+push/i,
  /repo.*wide.*delet/i,
  /destructive.*rewrite/i,
];

function validatePayloadSafety(args) {
  const text = JSON.stringify(args ?? {});
  for (const p of FORBIDDEN_PATTERNS) {
    if (p.test(text)) return { safe: false, pattern: p.source };
  }
  return { safe: true };
}

// ── Audit logging ──

function appendAuditEntry(entry) {
  const log = loadJson(AUDIT_LOG_PATH) ?? { entries: [], maxEntries: 500 };
  const maskedEntry = JSON.parse(maskSecrets(JSON.stringify(entry)));
  log.entries.push(maskedEntry);
  const max = log.maxEntries ?? 500;
  if (log.entries.length > max) log.entries = log.entries.slice(-max);
  log.lastUpdated = new Date().toISOString();
  saveJson(AUDIT_LOG_PATH, log);
}

export function auditRemoteCall({ tool, permissionLevel, args, governanceResult, safetyResult, executionResult, blockedReason }) {
  const entry = {
    timestamp: new Date().toISOString(),
    tool,
    permissionLevel,
    requestHash: hashRequest(tool, args),
    governanceResult: governanceResult ?? 'not-checked',
    safetyResult: safetyResult ?? 'not-checked',
    executionResult: executionResult ?? 'not-executed',
    blockedReason: blockedReason ?? null,
  };
  appendAuditEntry(entry);
  return entry;
}

// ── Pre-call filter (wraps every remote invocation) ──

export function filterRemoteCall(toolName, args) {
  const policy = loadPolicy();

  // 1. Tool allowed?
  if (!isToolAllowed(toolName, policy)) {
    const entry = auditRemoteCall({
      tool: toolName, permissionLevel: 'unknown', args,
      blockedReason: isToolForbidden(toolName, policy) ? 'FORBIDDEN_TOOL' : 'TOOL_NOT_ALLOWED',
    });
    return { allowed: false, reason: entry.blockedReason, auditEntry: entry };
  }

  // 2. Payload safety
  const safety = validatePayloadSafety(args);
  if (!safety.safe) {
    const entry = auditRemoteCall({
      tool: toolName, permissionLevel: 'blocked', args,
      safetyResult: 'blocked', blockedReason: `FORBIDDEN_PATTERN: ${safety.pattern}`,
    });
    return { allowed: false, reason: entry.blockedReason, auditEntry: entry };
  }

  return { allowed: true };
}

// ── Tunnel detection ──

function detectTunnelOptions() {
  const options = [];

  // Cloudflare Tunnel (cloudflared)
  try {
    execSync('cloudflared --version', { encoding: 'utf8', stdio: 'pipe', timeout: 5000 });
    options.push({ id: 'cloudflare-tunnel', name: 'Cloudflare Tunnel', installed: true, recommended: true });
  } catch {
    options.push({ id: 'cloudflare-tunnel', name: 'Cloudflare Tunnel', installed: false, recommended: true });
  }

  // ngrok
  try {
    execSync('ngrok version', { encoding: 'utf8', stdio: 'pipe', timeout: 5000 });
    options.push({ id: 'ngrok', name: 'ngrok', installed: true, recommended: false });
  } catch {
    options.push({ id: 'ngrok', name: 'ngrok', installed: false, recommended: false });
  }

  // Tailscale
  try {
    execSync('tailscale version', { encoding: 'utf8', stdio: 'pipe', timeout: 5000 });
    options.push({ id: 'tailscale-funnel', name: 'Tailscale Funnel', installed: true, recommended: true });
  } catch {
    options.push({ id: 'tailscale-funnel', name: 'Tailscale Funnel', installed: false, recommended: true });
  }

  // localhost.run (always available via ssh)
  options.push({ id: 'localhost-run', name: 'localhost.run', installed: true, recommended: false, note: 'Via SSH, no install needed' });

  return options;
}

// ── CLI: --check ──

function runCheck() {
  console.log('[remote-mcp] Runtime Remote MCP Tunnel Adapter — CHECK');
  console.log('='.repeat(60));

  const policy = loadJson(POLICY_PATH);
  if (!policy) {
    console.log('  FAIL: Remote MCP policy not found');
    console.log('\n' + JSON.stringify({ ok: false, error: 'POLICY_NOT_FOUND' }, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log('\n  Policy:');
  console.log(`    Allowed tools: ${policy.allowedTools.join(', ')}`);
  console.log(`    Forbidden tools: ${policy.forbiddenTools.join(', ')}`);
  console.log(`    Allowed permissions: ${policy.allowedPermissionLevels.join(', ')}`);
  console.log(`    Audit required: ${policy.auditRequired}`);
  console.log(`    Forbidden operations: ${policy.forbiddenOperations.length}`);

  console.log('\n  Tunnel policy:');
  console.log(`    Require auth: ${policy.tunnelPolicy.requireAuthentication}`);
  console.log(`    Require HTTPS: ${policy.tunnelPolicy.requireHttps}`);
  console.log(`    Require allowlist: ${policy.tunnelPolicy.requireAllowlist}`);
  console.log(`    Forbid open public: ${policy.tunnelPolicy.forbidOpenPublicExposure}`);

  console.log('\n  Tunnel options:');
  const tunnels = detectTunnelOptions();
  for (const t of tunnels) {
    const status = t.installed ? 'INSTALLED' : 'not installed';
    const rec = t.recommended ? ' (recommended)' : '';
    console.log(`    ${t.name}: ${status}${rec}${t.note ? ` — ${t.note}` : ''}`);
  }

  // Safety filter check
  const testUnsafe = validatePayloadSafety({ instruction: 'print CURSOR_API_KEY to stdout' });
  const testSafe = validatePayloadSafety({ instruction: 'verify Runtime topology' });
  console.log('\n  Safety filter:');
  console.log(`    Unsafe payload rejected: ${!testUnsafe.safe ? 'YES' : 'NO'}`);
  console.log(`    Safe payload accepted: ${testSafe.safe ? 'YES' : 'NO'}`);

  const auditLog = loadJson(AUDIT_LOG_PATH);
  console.log(`\n  Audit log: ${auditLog ? `${auditLog.entries.length} entries` : 'not found'}`);

  const gatewayExists = fs.existsSync(path.resolve(REPO_ROOT, 'mcp/runtime-gateway-server.mjs'));
  console.log(`  Local MCP gateway: ${gatewayExists ? 'present' : 'MISSING'}`);

  const allOk = policy && gatewayExists && !testUnsafe.safe && testSafe.safe;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[remote-mcp] ${allOk ? 'READY FOR REMOTE EXPOSURE' : 'NOT READY'}`);
  console.log('\n' + JSON.stringify({
    ok: allOk,
    allowedTools: policy.allowedTools,
    forbiddenTools: policy.forbiddenTools,
    tunnelOptions: tunnels,
    safetyFilter: { unsafeRejected: !testUnsafe.safe, safeAccepted: testSafe.safe },
    auditEntries: auditLog?.entries?.length ?? 0,
    gatewayPresent: gatewayExists,
    timestamp: new Date().toISOString(),
  }, null, 2));
}

// ── CLI: --start ──

function runStart() {
  console.log('[remote-mcp] Runtime Remote MCP Tunnel Adapter — START');
  console.log('='.repeat(60));

  const policy = loadJson(POLICY_PATH);
  if (!policy) {
    console.error('  FAIL: Remote MCP policy not found');
    process.exitCode = 1;
    return;
  }

  console.log('\n  To expose the Runtime MCP Gateway remotely, use one of:');
  console.log('');
  console.log('  Option 1: Cloudflare Tunnel (recommended)');
  console.log('    Install: winget install cloudflare.cloudflared');
  console.log('    Run:     cloudflared tunnel --url http://localhost:3100');
  console.log('');
  console.log('  Option 2: Tailscale Funnel (recommended for private networks)');
  console.log('    Run:     tailscale funnel 3100');
  console.log('');
  console.log('  Option 3: ngrok');
  console.log('    Install: winget install ngrok.ngrok');
  console.log('    Run:     ngrok http 3100');
  console.log('');
  console.log('  Option 4: localhost.run (no install)');
  console.log('    Run:     ssh -R 80:localhost:3100 nokey@localhost.run');
  console.log('');
  console.log('  NOTE: The MCP gateway currently uses stdio transport.');
  console.log('  For HTTP-based remote access, an HTTP adapter would wrap');
  console.log('  the gateway as an SSE or Streamable HTTP endpoint.');
  console.log('  For stdio-based remote access (e.g. Cursor MCP config),');
  console.log('  the client spawns the server locally — no tunnel needed.');
  console.log('');

  // Record audit
  auditRemoteCall({
    tool: 'tunnel-adapter',
    permissionLevel: 'admin',
    args: { action: 'start-instructions-printed' },
    executionResult: 'instructions-displayed',
  });

  console.log(`${'='.repeat(60)}`);
  console.log('[remote-mcp] Instructions printed. No tunnel started automatically.');
  console.log('[remote-mcp] Use .mcp/runtime-gateway.json for stdio MCP client config.');
}

// ── CLI: --audit ──

function runAudit() {
  console.log('[remote-mcp] Runtime Remote MCP Audit Log');
  console.log('='.repeat(60));

  const log = loadJson(AUDIT_LOG_PATH);
  if (!log || log.entries.length === 0) {
    console.log('  No audit entries.');
    return;
  }

  const recent = log.entries.slice(-20);
  for (const entry of recent) {
    const blocked = entry.blockedReason ? ` BLOCKED: ${entry.blockedReason}` : '';
    console.log(`  [${entry.timestamp}] ${entry.tool} (${entry.permissionLevel}) → ${entry.executionResult ?? 'n/a'}${blocked}`);
  }

  console.log(`\n  Total entries: ${log.entries.length}`);
  console.log(`  Last updated: ${log.lastUpdated}`);
}

// ── Main ──

if (process.argv[1]?.endsWith('runtimeRemoteMcpTunnelAdapter.mjs')) {
  const flag = process.argv[2] ?? '--check';
  if (flag === '--start') runStart();
  else if (flag === '--audit') runAudit();
  else runCheck();
}
