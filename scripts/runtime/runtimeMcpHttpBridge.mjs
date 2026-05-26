#!/usr/bin/env node
/**
 * Runtime MCP HTTP Bridge
 *
 * Translates HTTP requests into governed MCP tool calls, providing the
 * remote-accessible surface for the Federation Runtime MCP Gateway.
 *
 * Listens on 127.0.0.1:3100 only (tunnel provides external HTTPS).
 *
 * Endpoints:
 *   GET  /mcp/tools/list   — list available tools
 *   POST /mcp/tools/call   — invoke a tool
 *   GET  /health            — liveness check
 *
 * Every request requires Bearer token authentication.
 * Only tools listed in the remote MCP policy are exposed.
 */

import http from 'node:http';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateAuth, isAuthConfigured, maskedToken } from './runtimeRemoteMcpAuth.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const POLICY_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-remote-mcp-policy.json');
const AUDIT_LOG_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-remote-mcp-audit-log.json');
const PORT = parseInt(process.env.MCP_HTTP_PORT ?? '3100', 10);
const HOST = '127.0.0.1';

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
    .replace(/REMOTE_MCP_AUTH_TOKEN=[^\s]+/g, 'REMOTE_MCP_AUTH_TOKEN=****')
    .replace(/Bearer\s+[^\s]+/g, 'Bearer ****')
    .replace(/sk-[a-zA-Z0-9]{20,}/g, 'sk-****')
    .replace(/ghp_[a-zA-Z0-9]{20,}/g, 'ghp_****');
}

function tryExec(cmd) {
  try {
    const output = execSync(cmd, { encoding: 'utf8', timeout: 60000, cwd: REPO_ROOT, stdio: 'pipe' });
    return { ok: true, output: maskSecrets(output.trim()) };
  } catch (e) {
    return { ok: false, output: maskSecrets(e.stderr?.trim() ?? e.message) };
  }
}

// ── Forbidden patterns ──

const FORBIDDEN_PATTERNS = [
  /CURSOR_API_KEY/i, /\.env\.runtime/i, /credential/i,
  /token\s*[:=]/i, /secret\s*[:=]/i, /rm\s+-rf/i,
  /git\s+push\s+--force/i, /--no-verify/i, /drop\s+database/i,
  /delete\s+from\s+/i, /registry.*delet/i, /federation.*memory.*delet/i,
  /canonical.*replac/i, /bypass.*governance/i, /bypass.*safety/i,
  /override.*lock/i, /force\s+push/i, /repo.*wide.*delet/i,
  /destructive.*rewrite/i,
];

function rejectForbidden(text) {
  if (!text) return null;
  for (const p of FORBIDDEN_PATTERNS) {
    if (p.test(text)) return p.source;
  }
  return null;
}

// ── Audit ──

function appendAudit(entry) {
  const log = loadJson(AUDIT_LOG_PATH) ?? { entries: [], maxEntries: 500 };
  const masked = JSON.parse(maskSecrets(JSON.stringify(entry)));
  log.entries.push(masked);
  if (log.entries.length > 500) log.entries = log.entries.slice(-500);
  log.lastUpdated = new Date().toISOString();
  saveJson(AUDIT_LOG_PATH, log);
}

// ── Tool definitions (mirror of runtime-gateway-server.mjs) ──

const TOOL_DEFS = [
  {
    name: 'runtime_status',
    description: 'Read current Runtime orchestration state, latest execution result, and tool count',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'runtime_dry_run',
    description: 'Simulate Runtime execution pipeline without invoking Agent.prompt()',
    inputSchema: {
      type: 'object',
      properties: { instruction: { type: 'string', description: 'Optional instruction to dry-run' } },
    },
  },
  {
    name: 'runtime_verify',
    description: 'Run verification pipeline (topology, semantic, tool validation)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'runtime_execute_safe',
    description: 'Execute a governed prompt via @cursor/sdk Agent.prompt(). Requires governance and safety lock pass.',
    inputSchema: {
      type: 'object',
      properties: { instruction: { type: 'string', description: 'The Runtime instruction to execute' } },
      required: ['instruction'],
    },
  },
];

// ── Tool execution ──

function executeTool(toolName, args) {
  switch (toolName) {
    case 'runtime_status': {
      const snapshot = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-snapshot.json'));
      const session = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-headless-session.json'));
      const manifest = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-tool-manifest.json'));
      return {
        ok: true, mode: 'status',
        orchestration: snapshot ? 'operational' : 'no-snapshot',
        lastSession: session ? { status: session.status, endTime: session.endTime } : null,
        toolsExposed: manifest?.tools?.length ?? 0,
        timestamp: new Date().toISOString(),
      };
    }

    case 'runtime_dry_run': {
      const forbidden = rejectForbidden(args?.instruction);
      if (forbidden) return { ok: false, error: 'FORBIDDEN_PATTERN', pattern: forbidden };
      const result = tryExec('node scripts/runtime/runtimeHeadlessCursorExecutor.mjs --dry-run');
      return { ok: result.ok, mode: 'dry-run', output: result.output?.slice(0, 2000) };
    }

    case 'runtime_verify': {
      const topo = tryExec('node scripts/verify-runtime-topology-links.mjs');
      const sem = tryExec('node scripts/verify-federation-semantic.mjs');
      return {
        ok: topo.ok && sem.ok, mode: 'verify-only',
        topology: { ok: topo.ok }, semantic: { ok: sem.ok },
      };
    }

    case 'runtime_execute_safe': {
      const instruction = args?.instruction;
      if (!instruction) return { ok: false, error: 'MISSING_INSTRUCTION' };

      const forbidden = rejectForbidden(instruction);
      if (forbidden) return { ok: false, error: 'FORBIDDEN_PATTERN', pattern: forbidden, blocked: true };

      const govResult = tryExec('node scripts/runtime/runtimePolicyEngine.mjs');
      if (!govResult.ok) return { ok: false, error: 'GOVERNANCE_BLOCKED', detail: govResult.output };

      const lockState = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-invocation-lock-state.json'));
      if (lockState?.decision === 'blocked') return { ok: false, error: 'SAFETY_BLOCKED' };

      const payloadPath = path.resolve(REPO_ROOT, '.cursor/tasks/runtime-bridge-payload.json');
      const promptPath = path.resolve(REPO_ROOT, '.cursor/tasks/runtime-cursor-agent-prompt.md');
      fs.mkdirSync(path.dirname(payloadPath), { recursive: true });
      fs.writeFileSync(payloadPath, JSON.stringify({
        instructionId: `remote-mcp-${Date.now()}`,
        type: 'remote-mcp-execute',
        normalizedInstruction: instruction,
        timestamp: new Date().toISOString(),
        source: 'remote-mcp-http-bridge',
      }, null, 2) + '\n', 'utf8');
      fs.writeFileSync(promptPath, instruction + '\n', 'utf8');

      const result = tryExec('node scripts/runtime/runtimeHeadlessCursorExecutor.mjs --execute');
      return {
        ok: result.ok, mode: 'execute-safe',
        governance: 'passed', safety: 'cleared',
        output: result.output?.slice(0, 2000),
      };
    }

    default:
      return { ok: false, error: 'UNKNOWN_TOOL' };
  }
}

// ── HTTP helpers ──

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { resolve(null); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'X-Runtime-MCP': 'federation-runtime-gateway',
  });
  res.end(body);
}

// ── Request handler ──

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  // Health check (no auth)
  if (url.pathname === '/health' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, service: 'federation-runtime-mcp', timestamp: new Date().toISOString() });
    return;
  }

  // Auth required for all /mcp/ routes
  if (url.pathname.startsWith('/mcp/')) {
    const authResult = validateAuth(req.headers['authorization']);
    if (!authResult.valid) {
      appendAudit({
        timestamp: new Date().toISOString(), tool: 'auth-check',
        permissionLevel: 'none', requestHash: 'n/a',
        blockedReason: authResult.reason,
      });
      sendJson(res, authResult.status, { ok: false, error: authResult.reason });
      return;
    }
  }

  // List tools
  if (url.pathname === '/mcp/tools/list' && req.method === 'GET') {
    const policy = loadJson(POLICY_PATH);
    const exposed = TOOL_DEFS.filter(t => policy?.allowedTools?.includes(t.name));
    sendJson(res, 200, { ok: true, tools: exposed });
    return;
  }

  // Call tool
  if (url.pathname === '/mcp/tools/call' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body?.name) {
      sendJson(res, 400, { ok: false, error: 'MISSING_TOOL_NAME' });
      return;
    }

    const policy = loadJson(POLICY_PATH);
    if (!policy?.allowedTools?.includes(body.name)) {
      appendAudit({
        timestamp: new Date().toISOString(), tool: body.name,
        permissionLevel: 'denied',
        requestHash: crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16),
        blockedReason: 'TOOL_NOT_ALLOWED',
      });
      sendJson(res, 403, { ok: false, error: 'TOOL_NOT_ALLOWED' });
      return;
    }

    const argsSafety = rejectForbidden(JSON.stringify(body.arguments ?? {}));
    if (argsSafety) {
      appendAudit({
        timestamp: new Date().toISOString(), tool: body.name,
        permissionLevel: 'blocked',
        requestHash: crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16),
        safetyResult: 'blocked', blockedReason: `FORBIDDEN_PATTERN: ${argsSafety}`,
      });
      sendJson(res, 403, { ok: false, error: 'FORBIDDEN_PATTERN', pattern: argsSafety });
      return;
    }

    const result = executeTool(body.name, body.arguments ?? {});

    appendAudit({
      timestamp: new Date().toISOString(), tool: body.name,
      permissionLevel: 'execute-safe',
      requestHash: crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16),
      governanceResult: result.governance ?? 'n/a',
      safetyResult: result.safety ?? 'n/a',
      executionResult: result.ok ? 'success' : 'failed',
      blockedReason: result.error ?? null,
    });

    const maskedResult = JSON.parse(maskSecrets(JSON.stringify(result)));
    sendJson(res, result.ok ? 200 : 400, maskedResult);
    return;
  }

  sendJson(res, 404, { ok: false, error: 'NOT_FOUND' });
}

// ── Server startup ──

if (process.argv[1]?.endsWith('runtimeMcpHttpBridge.mjs')) {
  if (!isAuthConfigured()) {
    console.error('[mcp-http] ERROR: REMOTE_MCP_AUTH_TOKEN not configured.');
    console.error('[mcp-http] Set it in .env.runtime or as an environment variable (>= 16 chars).');
    console.error('[mcp-http] Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    process.exitCode = 1;
  } else {
    const server = http.createServer(handleRequest);
    server.listen(PORT, HOST, () => {
      console.log(`[mcp-http] Federation Runtime MCP HTTP Bridge`);
      console.log(`[mcp-http] Listening on http://${HOST}:${PORT}`);
      console.log(`[mcp-http] Auth token: ${maskedToken()}`);
      console.log(`[mcp-http] Endpoints:`);
      console.log(`  GET  /health          — liveness check (no auth)`);
      console.log(`  GET  /mcp/tools/list  — list tools (auth required)`);
      console.log(`  POST /mcp/tools/call  — call a tool (auth required)`);
      console.log(`[mcp-http] Press Ctrl+C to stop.`);
    });

    process.on('SIGINT', () => {
      console.log('\n[mcp-http] Shutting down...');
      server.close(() => process.exit(0));
    });
  }
}

export { TOOL_DEFS, executeTool, PORT, HOST };
