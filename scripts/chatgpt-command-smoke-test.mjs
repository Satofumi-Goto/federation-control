#!/usr/bin/env node
/**
 * Smoke test for Federation ChatGPT command gateway.
 *
 * Usage:
 *   FEDERATION_CONTROL_API=http://localhost:8000 node scripts/chatgpt-command-smoke-test.mjs
 */

const BASE_URL = (process.env.FEDERATION_CONTROL_API || process.env.VITE_FEDERATION_CONTROL_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const EXECUTION_MODE = process.env.EXECUTION_MODE || 'draft';
const REQUEST = process.env.REQUEST || 'Smoke test: verify Federation ChatGPT command gateway connectivity. Do not modify files.';

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function checkHealth() {
  const response = await fetch(`${BASE_URL}/api/health`);
  const data = await readJson(response);
  if (!response.ok || !data.ok) {
    throw new Error(`health_failed:${response.status}:${JSON.stringify(data)}`);
  }
  return data;
}

async function postCommand() {
  const payload = {
    request: REQUEST,
    executionMode: EXECUTION_MODE,
    targetRepository: 'Satofumi-Goto/federation-portal',
    targetArea: 'federation-portal',
    source: 'chatgpt-command-smoke-test',
    commandId: `smoke-${Date.now()}`,
  };

  const response = await fetch(`${BASE_URL}/api/chatgpt-command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await readJson(response);
  if (!response.ok || !data.ok) {
    throw new Error(`command_failed:${response.status}:${JSON.stringify(data)}`);
  }
  return data;
}

async function checkStatus() {
  const response = await fetch(`${BASE_URL}/api/chatgpt-command/status`);
  const data = await readJson(response);
  if (!response.ok || !data.ok) {
    throw new Error(`status_failed:${response.status}:${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  const health = await checkHealth();
  const command = await postCommand();
  const status = await checkStatus();
  console.log(JSON.stringify({ ok: true, baseUrl: BASE_URL, executionMode: EXECUTION_MODE, health, command, status }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, baseUrl: BASE_URL, executionMode: EXECUTION_MODE, error: error.message }, null, 2));
  process.exit(1);
});
