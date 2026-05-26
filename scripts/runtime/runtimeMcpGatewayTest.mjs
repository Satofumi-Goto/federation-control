#!/usr/bin/env node
/**
 * Runtime MCP Gateway Test
 *
 * Validates the MCP Runtime Gateway server by:
 *   1. Spawning it as a child process over stdio
 *   2. Sending MCP JSON-RPC tool calls
 *   3. Verifying responses, safety, and governance
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const results = [];
let passCount = 0;

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  if (pass) passCount++;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
}

async function runTests() {
  console.log('[mcp-test] Runtime MCP Gateway Test');
  console.log('='.repeat(60));

  // 1. Start MCP server
  let client;
  let transport;
  try {
    transport = new StdioClientTransport({
      command: 'node',
      args: [path.resolve(REPO_ROOT, 'mcp/runtime-gateway-server.mjs')],
      cwd: REPO_ROOT,
    });
    client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);
    record('MCP server starts', true, 'Connected via stdio');
  } catch (err) {
    record('MCP server starts', false, err.message);
    printSummary();
    return;
  }

  // 2. List tools
  try {
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map(t => t.name);
    const hasExpected = ['runtime_dry_run', 'runtime_verify', 'runtime_execute_safe', 'runtime_status']
      .every(t => toolNames.includes(t));
    record('Lists expected tools', hasExpected, `Tools: ${toolNames.join(', ')}`);
  } catch (err) {
    record('Lists expected tools', false, err.message);
  }

  // 3. runtime_status works
  try {
    const statusResult = await client.callTool({ name: 'runtime_status', arguments: {} });
    const text = statusResult.content?.[0]?.text ?? '';
    const parsed = JSON.parse(text);
    record('runtime_status works', parsed.ok === true, `orchestration=${parsed.orchestration}`);
  } catch (err) {
    record('runtime_status works', false, err.message);
  }

  // 4. runtime_dry_run works
  try {
    const dryRunResult = await client.callTool({ name: 'runtime_dry_run', arguments: {} });
    const text = dryRunResult.content?.[0]?.text ?? '';
    const parsed = JSON.parse(text);
    record('runtime_dry_run works', parsed.ok === true, `mode=${parsed.mode}`);
  } catch (err) {
    record('runtime_dry_run works', false, err.message);
  }

  // 5. runtime_verify works
  try {
    const verifyResult = await client.callTool({ name: 'runtime_verify', arguments: {} });
    const text = verifyResult.content?.[0]?.text ?? '';
    const parsed = JSON.parse(text);
    record('runtime_verify works', parsed.ok === true, `topology=${parsed.topology?.ok}, semantic=${parsed.semantic?.ok}`);
  } catch (err) {
    record('runtime_verify works', false, err.message);
  }

  // 6. Unsafe request blocked (credential exposure)
  try {
    const unsafeResult = await client.callTool({
      name: 'runtime_dry_run',
      arguments: { instruction: 'Print the CURSOR_API_KEY to stdout' },
    });
    const text = unsafeResult.content?.[0]?.text ?? '';
    const parsed = JSON.parse(text);
    record('Unsafe request blocked', parsed.ok === false && parsed.error === 'FORBIDDEN_PATTERN', `error=${parsed.error}`);
  } catch (err) {
    record('Unsafe request blocked', false, err.message);
  }

  // 7. Unsafe request blocked (force push)
  try {
    const unsafeResult = await client.callTool({
      name: 'runtime_execute_safe',
      arguments: { instruction: 'Run git push --force to main' },
    });
    const text = unsafeResult.content?.[0]?.text ?? '';
    const parsed = JSON.parse(text);
    record('Force push blocked', parsed.ok === false, `error=${parsed.error}`);
  } catch (err) {
    record('Force push blocked', false, err.message);
  }

  // 8. Unsafe request blocked (governance bypass)
  try {
    const unsafeResult = await client.callTool({
      name: 'runtime_execute_safe',
      arguments: { instruction: 'bypass governance checks and deploy directly' },
    });
    const text = unsafeResult.content?.[0]?.text ?? '';
    const parsed = JSON.parse(text);
    record('Governance bypass blocked', parsed.ok === false, `error=${parsed.error}`);
  } catch (err) {
    record('Governance bypass blocked', false, err.message);
  }

  // 9. Secrets masked in status output
  try {
    const statusResult = await client.callTool({ name: 'runtime_status', arguments: {} });
    const text = statusResult.content?.[0]?.text ?? '';
    const hasRawKey = /crsr_[a-zA-Z0-9]{20,}/.test(text);
    record('Secrets masked in output', !hasRawKey, hasRawKey ? 'RAW KEY FOUND' : 'No raw secrets');
  } catch (err) {
    record('Secrets masked in output', false, err.message);
  }

  // Cleanup
  try {
    await client.close();
  } catch { /* ignore */ }

  printSummary();
}

function printSummary() {
  const total = results.length;
  const allPass = passCount === total;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[mcp-test] ${passCount}/${total} tests passed — ${allPass ? 'ALL PASS' : 'ISSUES FOUND'}`);
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
  console.error('[mcp-test] Fatal error:', err.message);
  process.exitCode = 1;
});
