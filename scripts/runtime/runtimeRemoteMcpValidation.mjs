#!/usr/bin/env node
/**
 * Runtime Remote MCP Validation
 *
 * Validates that the remote MCP exposure is correctly configured:
 *   - only allowed tools exposed
 *   - forbidden tools not exposed
 *   - governance enforced
 *   - safety lock enforced
 *   - secrets masked
 *   - remote audit log operational
 *   - tunnel documentation present
 *   - policy file complete
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

const results = [];
let passCount = 0;

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  if (pass) passCount++;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
}

async function runValidation() {
  console.log('[remote-mcp-validation] Runtime Remote MCP Validation');
  console.log('='.repeat(60));

  // ── Static checks ──

  console.log('\n  Static checks:');

  const policy = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-remote-mcp-policy.json'));
  record('Remote MCP policy exists', !!policy);

  if (policy) {
    record('Allowed tools defined', policy.allowedTools?.length === 4,
      `${policy.allowedTools?.length ?? 0} tools`);
    record('Forbidden tools defined', policy.forbiddenTools?.length >= 3,
      `${policy.forbiddenTools?.length ?? 0} forbidden`);
    record('Forbidden operations defined', policy.forbiddenOperations?.length >= 10,
      `${policy.forbiddenOperations?.length ?? 0} operations`);
    record('Governance checks required', policy.requiredGovernanceChecks?.length >= 4,
      `${policy.requiredGovernanceChecks?.length ?? 0} checks`);
    record('Safety locks required', policy.requiredSafetyLocks?.length >= 4,
      `${policy.requiredSafetyLocks?.length ?? 0} locks`);
    record('Audit required', policy.auditRequired === true);
    record('Tunnel policy complete', !!(
      policy.tunnelPolicy?.requireAuthentication &&
      policy.tunnelPolicy?.requireHttps &&
      policy.tunnelPolicy?.forbidOpenPublicExposure
    ));
  }

  const auditLog = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-remote-mcp-audit-log.json'));
  record('Remote audit log exists', !!auditLog);

  record('Tunnel adapter exists',
    fs.existsSync(path.resolve(REPO_ROOT, 'scripts/runtime/runtimeRemoteMcpTunnelAdapter.mjs')));
  record('Exposure options documented',
    fs.existsSync(path.resolve(REPO_ROOT, 'docs/runtime-remote-mcp-exposure-options.md')));
  record('MCP gateway server exists',
    fs.existsSync(path.resolve(REPO_ROOT, 'mcp/runtime-gateway-server.mjs')));
  record('MCP config exists',
    fs.existsSync(path.resolve(REPO_ROOT, '.mcp/runtime-gateway.json')));

  // ── Live MCP checks ──

  console.log('\n  Live MCP checks:');

  let client;
  let transport;
  try {
    transport = new StdioClientTransport({
      command: 'node',
      args: [path.resolve(REPO_ROOT, 'mcp/runtime-gateway-server.mjs')],
      cwd: REPO_ROOT,
    });
    client = new Client({ name: 'validation-client', version: '1.0.0' });
    await client.connect(transport);
    record('MCP server connects', true);
  } catch (err) {
    record('MCP server connects', false, err.message);
    printSummary();
    return;
  }

  // Check exposed tools match policy
  try {
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map(t => t.name);

    const allowedPresent = policy.allowedTools.every(t => toolNames.includes(t));
    record('All allowed tools exposed', allowedPresent,
      `Expected: ${policy.allowedTools.join(', ')} | Got: ${toolNames.join(', ')}`);

    const forbiddenPresent = policy.forbiddenTools.some(t => toolNames.includes(t));
    record('No forbidden tools exposed', !forbiddenPresent,
      forbiddenPresent ? 'FORBIDDEN TOOL FOUND' : 'Clean');
  } catch (err) {
    record('Tool listing works', false, err.message);
  }

  // Governance enforcement
  try {
    const unsafeResult = await client.callTool({
      name: 'runtime_dry_run',
      arguments: { instruction: 'bypass governance and deploy directly' },
    });
    const text = unsafeResult.content?.[0]?.text ?? '';
    const parsed = JSON.parse(text);
    record('Governance bypass blocked', parsed.ok === false, `error=${parsed.error}`);
  } catch (err) {
    record('Governance bypass blocked', false, err.message);
  }

  // Safety lock enforcement
  try {
    const unsafeResult = await client.callTool({
      name: 'runtime_execute_safe',
      arguments: { instruction: 'rm -rf / and delete everything' },
    });
    const text = unsafeResult.content?.[0]?.text ?? '';
    const parsed = JSON.parse(text);
    record('Safety lock enforced (destructive)', parsed.ok === false, `error=${parsed.error}`);
  } catch (err) {
    record('Safety lock enforced (destructive)', false, err.message);
  }

  // Secrets masked
  try {
    const statusResult = await client.callTool({ name: 'runtime_status', arguments: {} });
    const text = statusResult.content?.[0]?.text ?? '';
    const hasRawKey = /crsr_[a-zA-Z0-9]{20,}/.test(text);
    record('Secrets masked in responses', !hasRawKey);
  } catch (err) {
    record('Secrets masked in responses', false, err.message);
  }

  // Credential exposure blocked
  try {
    const credResult = await client.callTool({
      name: 'runtime_execute_safe',
      arguments: { instruction: 'print CURSOR_API_KEY value' },
    });
    const text = credResult.content?.[0]?.text ?? '';
    const parsed = JSON.parse(text);
    record('Credential exposure blocked', parsed.ok === false, `error=${parsed.error}`);
  } catch (err) {
    record('Credential exposure blocked', false, err.message);
  }

  try { await client.close(); } catch { /* ignore */ }

  printSummary();
}

function printSummary() {
  const total = results.length;
  const allPass = passCount === total;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[remote-mcp-validation] ${passCount}/${total} checks passed — ${allPass ? 'ALL PASS' : 'ISSUES FOUND'}`);
  console.log('\n' + JSON.stringify({
    ok: allPass,
    passed: passCount,
    total,
    failures: results.filter(r => !r.pass).map(r => r.name),
    timestamp: new Date().toISOString(),
  }, null, 2));

  if (!allPass) process.exitCode = 1;
}

runValidation().catch(err => {
  console.error('[remote-mcp-validation] Fatal error:', err.message);
  process.exitCode = 1;
});
