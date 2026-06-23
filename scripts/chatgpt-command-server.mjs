#!/usr/bin/env node
/**
 * ChatGPT Command Server
 *
 * Local API endpoint used by Federation Studio and external ChatGPT bridges.
 * POST /api/chatgpt-command
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.PORT || process.env.FEDERATION_CONTROL_PORT || 8000);
const ROOT = process.cwd();
const COMMAND_LOG = path.resolve(ROOT, 'runtime_data/chatgpt-command-log.json');
const INBOX = path.resolve(ROOT, '.cursor/tasks/chatgpt-runtime-inbox.md');

const FIXED_TARGET_REPOSITORY = 'Satofumi-Goto/federation-portal';
const DEFAULT_TARGET_BRANCH = process.env.FEDERATION_PORTAL_BRANCH || 'main';
const DEFAULT_WORKFLOW_FILE = process.env.FEDERATION_PORTAL_WORKFLOW || 'chatgpt-command.yml';
const GITHUB_API_BASE = process.env.GITHUB_API_BASE || 'https://api.github.com';
const EXECUTION_MODES = new Set(['draft', 'python-engine', 'github-workflow', 'commit-push']);

function saveJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function parsePayload(body, contentType = '') {
  if (!body) return {};
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(body);
    return Object.fromEntries(params.entries());
  }
  if (contentType.includes('text/plain')) {
    try { return JSON.parse(body); } catch { return { request: body }; }
  }
  return JSON.parse(body);
}

function normalizePayload(rawPayload) {
  const executionMode = rawPayload.executionMode || 'commit-push';
  if (!EXECUTION_MODES.has(executionMode)) {
    throw new Error(`unsupported_execution_mode:${executionMode}`);
  }

  return {
    ...rawPayload,
    targetRepository: FIXED_TARGET_REPOSITORY,
    targetArea: rawPayload.targetArea || 'federation-portal',
    targetBranch: rawPayload.targetBranch || DEFAULT_TARGET_BRANCH,
    executionMode,
    commandId: rawPayload.commandId || `fc-${Date.now()}`
  };
}

function writeInbox(payload) {
  fs.mkdirSync(path.dirname(INBOX), { recursive: true });
  fs.writeFileSync(INBOX, [
    '# ChatGPT Runtime Inbox',
    '',
    `commandId: ${payload.commandId}`,
    `targetRepository: ${payload.targetRepository}`,
    `targetArea: ${payload.targetArea}`,
    `targetBranch: ${payload.targetBranch}`,
    `executionMode: ${payload.executionMode}`,
    '',
    payload.request || payload.message || ''
  ].join('\n'));
}

function buildWorkflowRequest(payload) {
  const request = payload.request || payload.message || '';
  return [
    '[Federation ChatGPT Command]',
    `commandId: ${payload.commandId}`,
    `executionMode: ${payload.executionMode}`,
    `targetRepository: ${FIXED_TARGET_REPOSITORY}`,
    `targetBranch: ${payload.targetBranch}`,
    '',
    request
  ].join('\n');
}

function buildWorkflowInputs(payload) {
  // The existing federation-portal workflow currently declares only `request`.
  // Keep dispatch deterministic by sending only declared input and embedding
  // command metadata inside the request body.
  return { request: buildWorkflowRequest(payload) };
}

async function dispatchPortalWorkflow(payload) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN_missing: commit-push/github-workflow requires GITHUB_TOKEN or GH_TOKEN on federation-control');
  }

  const workflowFile = payload.workflowFile || DEFAULT_WORKFLOW_FILE;
  const url = `${GITHUB_API_BASE}/repos/${FIXED_TARGET_REPOSITORY}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'federation-chatgpt-command-server'
    },
    body: JSON.stringify({
      ref: payload.targetBranch,
      inputs: buildWorkflowInputs(payload)
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`workflow_dispatch_failed:${response.status}:${errorText}`);
  }

  return {
    dispatched: true,
    skipped: false,
    workflowFile,
    targetRepository: FIXED_TARGET_REPOSITORY,
    targetBranch: payload.targetBranch,
    commandId: payload.commandId
  };
}

function shouldDispatch(payload) {
  return payload.executionMode === 'github-workflow' || payload.executionMode === 'commit-push';
}

function health() {
  return {
    ok: true,
    service: 'chatgpt-command-server',
    targetRepository: FIXED_TARGET_REPOSITORY,
    targetBranch: DEFAULT_TARGET_BRANCH,
    workflowFile: DEFAULT_WORKFLOW_FILE,
    modes: [...EXECUTION_MODES],
    canDispatch: Boolean(process.env.GITHUB_TOKEN || process.env.GH_TOKEN),
    endpoints: ['/health', '/api/health', '/api/chatgpt-command', '/api/chatgpt-command/status']
  };
}

function corsHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Access-Control-Request-Private-Network',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Private-Network': 'true',
    'Vary': 'Origin, Access-Control-Request-Headers, Access-Control-Request-Private-Network'
  };
}

function json(res, status, data) {
  res.writeHead(status, corsHeaders());
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  console.log(`[chatgpt-command-server] ${req.method} ${req.url}`);
  if (req.method === 'OPTIONS') return json(res, 204, { ok: true });
  if (req.method === 'GET' && (req.url === '/health' || req.url === '/api/health')) return json(res, 200, health());
  if (req.method === 'GET' && req.url === '/api/chatgpt-command/status') return json(res, 200, { ok: true, lastCommand: readJson(COMMAND_LOG), health: health() });
  if (req.method !== 'POST' || req.url !== '/api/chatgpt-command') return json(res, 404, { ok: false, error: 'not_found' });

  try {
    const body = await readBody(req);
    const rawPayload = parsePayload(body, req.headers['content-type'] || '');
    if (!rawPayload.request && !rawPayload.message) return json(res, 400, { ok: false, error: 'request_required' });

    const payload = normalizePayload(rawPayload);
    const dispatchResult = shouldDispatch(payload)
      ? await dispatchPortalWorkflow(payload)
      : { dispatched: false, skipped: true, reason: 'executionMode_does_not_dispatch', commandId: payload.commandId };

    const record = {
      ...payload,
      receivedAt: new Date().toISOString(),
      status: dispatchResult.dispatched ? 'dispatched' : 'accepted',
      dispatchResult
    };
    saveJson(COMMAND_LOG, record);
    writeInbox(payload);

    return json(res, 200, {
      ok: true,
      status: dispatchResult.dispatched ? 'dispatched' : 'accepted',
      inboxPath: '.cursor/tasks/chatgpt-runtime-inbox.md',
      targetRepository: FIXED_TARGET_REPOSITORY,
      targetBranch: payload.targetBranch,
      executionMode: payload.executionMode,
      commandId: payload.commandId,
      ...dispatchResult
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json(res, 500, { ok: false, error: message, health: health() });
  }
});

server.listen(PORT, () => {
  console.log(`[chatgpt-command-server] listening on ${PORT}`);
});
