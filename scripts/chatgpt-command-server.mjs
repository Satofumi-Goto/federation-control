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

function saveJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function writeInbox(payload) {
  fs.mkdirSync(path.dirname(INBOX), { recursive: true });
  fs.writeFileSync(INBOX, [
    '# ChatGPT Runtime Inbox',
    '',
    `targetRepository: ${payload.targetRepository || 'Satofumi-Goto/federation-portal'}`,
    `targetArea: ${payload.targetArea || 'federation-portal'}`,
    `executionMode: ${payload.executionMode || 'commit-push'}`,
    '',
    payload.request || payload.message || ''
  ].join('\n'));
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
  if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true, service: 'chatgpt-command-server' });
  if (req.method !== 'POST' || req.url !== '/api/chatgpt-command') return json(res, 404, { ok: false, error: 'not_found' });

  try {
    const body = await readBody(req);
    const payload = JSON.parse(body || '{}');
    if (!payload.request && !payload.message) return json(res, 400, { ok: false, error: 'request_required' });

    const record = { ...payload, receivedAt: new Date().toISOString(), status: 'accepted' };
    saveJson(COMMAND_LOG, record);
    writeInbox(payload);

    return json(res, 200, {
      ok: true,
      status: 'accepted',
      inboxPath: '.cursor/tasks/chatgpt-runtime-inbox.md',
      next: 'run chatgpt-runtime-bridge and execution pipeline'
    });
  } catch (err) {
    return json(res, 500, { ok: false, error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`[chatgpt-command-server] listening on ${PORT}`);
});
