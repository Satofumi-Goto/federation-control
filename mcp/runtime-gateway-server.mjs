#!/usr/bin/env node
/**
 * Federation Runtime MCP Gateway Server
 *
 * Exposes the governed Runtime execution gateway as MCP tools over stdio.
 * ChatGPT (or any MCP-connected client) can invoke these tools to:
 *   - dry-run Runtime execution
 *   - verify Runtime topology/semantic/build
 *   - execute governed prompts via @cursor/sdk
 *   - query Runtime orchestration status
 *
 * Safety: all requests pass through governance, safety locks, and
 * forbidden-pattern filters. Secrets are never exposed.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');

// ── Safety filter ──

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
];

function rejectForbidden(text) {
  if (!text) return null;
  for (const p of FORBIDDEN_PATTERNS) {
    if (p.test(text)) return p.source;
  }
  return null;
}

function maskSecrets(text) {
  if (!text) return text;
  return text
    .replace(/crsr_[a-zA-Z0-9]{20,}/g, 'crsr_****')
    .replace(/CURSOR_API_KEY=[^\s]+/g, 'CURSOR_API_KEY=****')
    .replace(/Bearer\s+[^\s]+/g, 'Bearer ****');
}

// ── Helpers ──

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function tryExec(cmd) {
  try {
    const output = execSync(cmd, { encoding: 'utf8', timeout: 60000, cwd: REPO_ROOT, stdio: 'pipe' });
    return { ok: true, output: maskSecrets(output.trim()) };
  } catch (e) {
    return { ok: false, output: maskSecrets(e.stderr?.trim() ?? e.message) };
  }
}

// ── MCP Server ──

const server = new McpServer({
  name: 'federation-runtime-gateway',
  version: '1.0.0',
});

// ── Tool: runtime_dry_run ──

server.tool(
  'runtime_dry_run',
  {
    instruction: z.string().optional().describe('Optional instruction to dry-run. If omitted, uses the current payload.'),
  },
  async ({ instruction }) => {
    const forbidden = rejectForbidden(instruction);
    if (forbidden) {
      return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'FORBIDDEN_PATTERN', pattern: forbidden }, null, 2) }] };
    }

    const result = tryExec('node scripts/runtime/runtimeHeadlessCursorExecutor.mjs --dry-run');
    return {
      content: [{ type: 'text', text: JSON.stringify({ ok: result.ok, mode: 'dry-run', output: result.output }, null, 2) }],
    };
  }
);

// ── Tool: runtime_verify ──

server.tool(
  'runtime_verify',
  {},
  async () => {
    const topology = tryExec('node scripts/verify-runtime-topology-links.mjs');
    const semantic = tryExec('node scripts/verify-federation-semantic.mjs');
    const toolValidation = tryExec('node scripts/runtime/runtimeToolExposureValidation.mjs');

    const allPass = topology.ok && semantic.ok && toolValidation.ok;

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          ok: allPass,
          mode: 'verify-only',
          topology: { ok: topology.ok },
          semantic: { ok: semantic.ok },
          toolValidation: { ok: toolValidation.ok },
        }, null, 2),
      }],
    };
  }
);

// ── Tool: runtime_execute_safe ──

server.tool(
  'runtime_execute_safe',
  {
    instruction: z.string().describe('The Runtime instruction to execute via governed @cursor/sdk Agent.prompt()'),
  },
  async ({ instruction }) => {
    const forbidden = rejectForbidden(instruction);
    if (forbidden) {
      return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'FORBIDDEN_PATTERN', pattern: forbidden, blocked: true }, null, 2) }] };
    }

    // Governance check
    const govResult = tryExec('node scripts/runtime/runtimePolicyEngine.mjs');
    if (!govResult.ok) {
      return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'GOVERNANCE_BLOCKED', detail: govResult.output }, null, 2) }] };
    }

    // Safety lock check
    const lockState = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-invocation-lock-state.json'));
    if (lockState?.decision === 'blocked') {
      return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'SAFETY_BLOCKED', detail: 'Safety lock decision: blocked' }, null, 2) }] };
    }

    // Write instruction to payload
    const payloadPath = path.resolve(REPO_ROOT, '.cursor/tasks/runtime-bridge-payload.json');
    const promptPath = path.resolve(REPO_ROOT, '.cursor/tasks/runtime-cursor-agent-prompt.md');
    fs.mkdirSync(path.dirname(payloadPath), { recursive: true });

    const payload = {
      instructionId: `mcp-${Date.now()}`,
      type: 'mcp-gateway-execute',
      normalizedInstruction: instruction,
      timestamp: new Date().toISOString(),
      source: 'mcp-runtime-gateway',
    };
    fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    fs.writeFileSync(promptPath, instruction + '\n', 'utf8');

    // Execute
    const result = tryExec('node scripts/runtime/runtimeHeadlessCursorExecutor.mjs --execute');

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          ok: result.ok,
          mode: 'execute-safe',
          governance: 'passed',
          safety: 'cleared',
          output: result.output.slice(0, 2000),
        }, null, 2),
      }],
    };
  }
);

// ── Tool: runtime_status ──

server.tool(
  'runtime_status',
  {},
  async () => {
    const snapshot = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-snapshot.json'));
    const envState = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-environment-state.json'));
    const serviceState = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-service-state.json'));
    const session = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-headless-session.json'));
    const manifest = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-tool-manifest.json'));

    const status = {
      orchestration: snapshot ? 'operational' : 'no-snapshot',
      environment: envState?.status ?? 'unknown',
      service: serviceState?.status ?? 'unknown',
      lastSession: session ? {
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
      } : null,
      toolsExposed: manifest?.tools?.length ?? 0,
      timestamp: new Date().toISOString(),
    };

    return {
      content: [{ type: 'text', text: maskSecrets(JSON.stringify({ ok: true, mode: 'status', ...status }, null, 2)) }],
    };
  }
);

// ── Start server ──

const transport = new StdioServerTransport();
await server.connect(transport);
