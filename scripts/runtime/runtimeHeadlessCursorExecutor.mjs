#!/usr/bin/env node
/**
 * Runtime Headless Cursor Executor
 *
 * Detects available Cursor executable modes, determines the best
 * headless invocation path, and provides execution capabilities
 * for ChatGPT → Cursor autonomous pipeline.
 *
 * CLI flags:
 *   --check     Detection report only (default)
 *   --dry-run   Simulate full execution pipeline without Agent.prompt()
 *   --execute   Real execution via @cursor/sdk Agent.prompt()
 *
 * Safety:
 *   --execute requires CURSOR_API_KEY, workspace binding, safety lock,
 *   and governance policy pass. No auto-push unless explicitly instructed.
 */

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveCursorApiKey } from './runtimeCredentialResolver.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const REPORT_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-headless-invocation-report.json');
const PAYLOAD_PATH = path.resolve(REPO_ROOT, '.cursor/tasks/runtime-bridge-payload.json');
const SESSION_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-headless-session.json');
const PROMPT_PATH = path.resolve(REPO_ROOT, '.cursor/tasks/runtime-cursor-agent-prompt.md');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function tryExec(cmd, opts = {}) {
  try {
    const output = execSync(cmd, {
      encoding: 'utf8',
      timeout: opts.timeout ?? 10000,
      cwd: REPO_ROOT,
      stdio: 'pipe',
      ...opts,
    });
    return { ok: true, output: output.trim() };
  } catch (e) {
    return { ok: false, output: e.stderr?.trim() ?? e.message };
  }
}

// ── Auth fallback detection ──

/**
 * The @cursor/sdk auth model (from source analysis):
 *
 * CLOUD agents: function f(t) resolves apiKey via:
 *   1. Explicit apiKey parameter
 *   2. process.env.CURSOR_API_KEY
 *   Throws "API key is required for cloud operations" if neither present.
 *
 * LOCAL agents: createLocalExecutor accepts optional apiKey.
 *   The local runtime exchanges the API key for an access token internally
 *   via a gRPC call to Cursor's backend. There is NO desktop session reuse,
 *   NO browser cookie reuse, NO local token cache fallback.
 *   The API key is always required for model access authentication.
 *
 * Cursor Desktop stores session data in %APPDATA%\Cursor but uses
 * Electron-internal auth (IndexedDB, encrypted credential store)
 * that the SDK cannot access. The SDK is designed as an external
 * programmatic interface, not an extension of the Desktop session.
 */
function detectAuthSources() {
  const sources = {
    apiKeyEnv: false,
    apiKeyMasked: '(not set)',
    desktopSessionDetected: false,
    desktopAppInstalled: false,
    browserSessionDetected: false,
    localTokenCache: false,
    fallbackAvailable: false,
  };

  // Source 1: CURSOR_API_KEY environment variable
  const cred = resolveCursorApiKey();
  sources.apiKeyEnv = cred.available;
  sources.apiKeyMasked = cred.masked.key;

  // Source 2: Cursor Desktop session (informational only — not usable by SDK)
  const cursorAppData = path.join(process.env.APPDATA ?? '', 'Cursor');
  const userDir = path.join(cursorAppData, 'User');
  if (fs.existsSync(cursorAppData) && fs.existsSync(userDir)) {
    sources.desktopSessionDetected = true;
    sources.desktopAppInstalled = true;
  } else {
    const cursorExe = path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'cursor', 'Cursor.exe');
    sources.desktopAppInstalled = fs.existsSync(cursorExe);
  }

  // Source 3: .env.runtime file
  const envRuntimePath = path.resolve(REPO_ROOT, '.env.runtime');
  if (fs.existsSync(envRuntimePath)) {
    try {
      const content = fs.readFileSync(envRuntimePath, 'utf8');
      const match = content.match(/^CURSOR_API_KEY=(.+)$/m);
      if (match && match[1].trim().length > 0) {
        sources.envRuntimeFile = true;
      }
    } catch { /* ignore */ }
  }

  // No fallback auth path exists in the SDK
  sources.fallbackAvailable = false;

  return sources;
}

// ── Mode 1: Cursor SDK detection ──

function detectCursorSDK() {
  const result = { available: false, version: null, installed: false, apiKeyConfigured: false };

  const localPkg = loadJson(path.resolve(REPO_ROOT, 'node_modules/@cursor/sdk/package.json'));
  if (localPkg) {
    result.installed = true;
    result.version = localPkg.version;
  }

  if (!result.installed) {
    const npmCheck = tryExec('npm view @cursor/sdk version', { timeout: 15000 });
    if (npmCheck.ok) result.registryVersion = npmCheck.output;
  }

  const authSources = detectAuthSources();
  result.apiKeyConfigured = authSources.apiKeyEnv;
  result.apiKeyMasked = authSources.apiKeyMasked;
  result.authSources = authSources;

  result.available = result.installed && result.apiKeyConfigured;
  result.installCommand = 'npm install @cursor/sdk';
  result.capabilities = {
    headless: true,
    programmatic: true,
    stdinPrompt: true,
    workspaceTargeting: true,
    streaming: true,
    multiTurn: true,
    modelSelection: true,
  };

  return result;
}

// ── Mode 2: cursor.cmd agent subcommand ──

function detectCursorCmdAgent() {
  const result = { available: false, executablePath: null, agentSubcommand: false, version: null };

  const cursorDir = path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'cursor');
  const cursorExe = path.join(cursorDir, 'Cursor.exe');
  const cliJs = path.join(cursorDir, 'resources', 'app', 'out', 'cli.js');
  const cursorCmd = path.join(cursorDir, 'resources', 'app', 'bin', 'cursor.cmd');

  if (!fs.existsSync(cursorExe)) return result;
  result.executablePath = cursorExe;

  const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
  const versionResult = tryExec(`"${cursorExe}" "${cliJs}" --version`, { env });
  if (versionResult.ok) result.version = versionResult.output.split('\n')[0]?.trim();

  const helpResult = tryExec(`"${cursorExe}" "${cliJs}" --help`, { env });
  if (helpResult.ok && helpResult.output.includes('agent')) result.agentSubcommand = true;

  result.cliJsPath = cliJs;
  result.cursorCmdPath = fs.existsSync(cursorCmd) ? cursorCmd : null;
  result.available = result.agentSubcommand;
  result.invocationMethod = 'ELECTRON_RUN_AS_NODE=1 Cursor.exe cli.js agent';
  result.capabilities = {
    headless: false,
    terminalAgent: true,
    stdinPrompt: false,
    workspaceTargeting: true,
    requiresDisplay: true,
  };

  return result;
}

// ── Mode 3: cursor-tunnel.exe standalone CLI ──

function detectCursorTunnel() {
  const result = { available: false, executablePath: null, version: null };

  const tunnelPaths = [
    path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'cursor', 'resources', 'app', 'bin', 'cursor-tunnel.exe'),
    path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'cursor', '_', 'resources', 'app', 'bin', 'cursor-tunnel.exe'),
  ];

  for (const p of tunnelPaths) {
    if (fs.existsSync(p)) { result.executablePath = p; break; }
  }

  if (!result.executablePath) return result;

  const helpResult = tryExec(`"${result.executablePath}" --help`);
  if (helpResult.ok) {
    const vMatch = helpResult.output.match(/(\d+\.\d+\.\d+)/);
    if (vMatch) result.version = vMatch[1];
    result.hasAgentSubcommand = helpResult.output.includes('agent');
    result.hasTunnelSubcommand = helpResult.output.includes('tunnel');
  }

  result.available = true;
  result.capabilities = { headless: true, tunnel: true, agentSubcommand: result.hasAgentSubcommand ?? false, stdinPrompt: false, workspaceTargeting: false };
  return result;
}

// ── Mode 4: File-trigger execution ──

function detectFileTrigger() {
  const inboxPath = path.resolve(REPO_ROOT, '.cursor/tasks/chatgpt-runtime-inbox.md');
  return {
    available: true,
    payloadPath: PAYLOAD_PATH,
    inboxPath,
    payloadExists: fs.existsSync(PAYLOAD_PATH),
    inboxExists: fs.existsSync(inboxPath),
    capabilities: { headless: false, requiresRunningCursor: true, stdinPrompt: false, workspaceTargeting: true, asyncOnly: true },
  };
}

// ── Spawn capability ──

function detectSpawnCapability() {
  const result = spawnSync('node', ['--version'], { encoding: 'utf8', timeout: 5000 });
  return { available: result.status === 0, nodeVersion: result.stdout?.trim(), spawnSync: true, spawn: true, execSync: true };
}

// ── Build detection report ──

export function buildHeadlessReport() {
  const sdk = detectCursorSDK();
  const cmdAgent = detectCursorCmdAgent();
  const tunnel = detectCursorTunnel();
  const fileTrigger = detectFileTrigger();
  const spawn = detectSpawnCapability();

  const modes = [
    { id: 'cursor-sdk', label: 'Cursor SDK (@cursor/sdk)', ...sdk, priority: 1, recommended: true },
    { id: 'cursor-cmd-agent', label: 'cursor.cmd agent subcommand', ...cmdAgent, priority: 2, recommended: false },
    { id: 'cursor-tunnel', label: 'cursor-tunnel.exe standalone', ...tunnel, priority: 3, recommended: false },
    { id: 'file-trigger', label: 'File-trigger execution', ...fileTrigger, priority: 4, recommended: false },
  ];

  const bestMode = modes.find(m => m.available) ?? null;
  const availableModes = modes.filter(m => m.available);

  const blockers = [];
  if (!sdk.installed) blockers.push('Cursor SDK not installed locally (run: npm install @cursor/sdk)');
  if (!sdk.apiKeyConfigured) blockers.push('CURSOR_API_KEY not set in environment');

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      bestMode: bestMode?.id ?? 'none',
      availableModeCount: availableModes.length,
      fullyHeadless: sdk.available,
      sdkInstalled: sdk.installed,
      sdkVersion: sdk.version,
      apiKeyConfigured: sdk.apiKeyConfigured,
      apiKeyMasked: sdk.apiKeyMasked,
      blockerCount: blockers.length,
    },
    modes,
    spawn,
    blockers,
    recommendation: sdk.available
      ? 'Cursor SDK ready — fully headless execution available via Agent.prompt().'
      : sdk.installed
        ? 'Cursor SDK installed. Set CURSOR_API_KEY to enable fully headless execution.'
        : 'Install @cursor/sdk (npm install @cursor/sdk) and set CURSOR_API_KEY.',
  };

  saveJson(REPORT_PATH, report);
  return report;
}

// ── Pre-flight gate checks ──

function runPreflightGates() {
  const gates = [];

  // Gate 1: Workspace binding
  const binding = tryExec('node scripts/runtime/runtimeCursorWorkspaceBinding.mjs');
  gates.push({ gate: 'workspace-binding', pass: binding.ok, detail: binding.ok ? 'Bound to federation-control' : 'Binding failed' });

  // Gate 2: Safety lock
  const safetyLock = tryExec('node scripts/runtime/runtimeInvocationSafetyLock.mjs');
  gates.push({ gate: 'safety-lock', pass: safetyLock.ok, detail: safetyLock.ok ? 'Safety lock evaluated' : 'Safety lock blocked' });

  // Gate 3: SDK installed
  const sdkPkg = loadJson(path.resolve(REPO_ROOT, 'node_modules/@cursor/sdk/package.json'));
  gates.push({ gate: 'sdk-installed', pass: !!sdkPkg, detail: sdkPkg ? `@cursor/sdk v${sdkPkg.version}` : 'SDK not installed' });

  // Gate 4: API key
  const cred = resolveCursorApiKey();
  gates.push({ gate: 'api-key', pass: cred.available, detail: cred.available ? `Key: ${cred.masked.key}` : 'CURSOR_API_KEY not set' });

  // Gate 5: Governance policy
  const governance = tryExec('node scripts/runtime/runtimePolicyEngine.mjs');
  gates.push({ gate: 'governance-policy', pass: governance.ok, detail: governance.ok ? 'Governance policies active' : 'Governance check failed' });

  // Gate 6: Payload available
  const payload = loadJson(PAYLOAD_PATH);
  gates.push({ gate: 'payload', pass: payload != null, detail: payload ? `Payload: ${payload.instructionId ?? 'present'}` : 'No payload found' });

  const allPass = gates.every(g => g.pass);
  return { gates, allPass, passed: gates.filter(g => g.pass).length, total: gates.length };
}

// ── Resolve prompt for execution ──

function resolvePrompt() {
  // Try payload-generated prompt first
  if (fs.existsSync(PROMPT_PATH)) {
    return fs.readFileSync(PROMPT_PATH, 'utf8').trim();
  }

  // Fall back to payload instruction
  const payload = loadJson(PAYLOAD_PATH);
  if (payload?.normalizedInstruction) return payload.normalizedInstruction;

  return 'Verify Runtime Registry consistency and run build verification.';
}

// ── SDK Execution ──

async function executeWithSDK(prompt) {
  const { Agent } = await import('@cursor/sdk');
  const apiKey = process.env.CURSOR_API_KEY;

  const session = {
    startTime: new Date().toISOString(),
    prompt: prompt.slice(0, 200) + (prompt.length > 200 ? '...' : ''),
    mode: 'headless-sdk',
    model: 'composer-2.5',
    cwd: REPO_ROOT,
    status: 'executing',
    result: null,
    endTime: null,
  };
  saveJson(SESSION_PATH, session);

  console.log('  Invoking Agent.prompt()...');
  console.log(`  Model: composer-2.5`);
  console.log(`  CWD: ${REPO_ROOT}`);
  console.log(`  Prompt length: ${prompt.length} chars`);

  try {
    const result = await Agent.prompt(prompt, {
      apiKey,
      model: { id: 'composer-2.5' },
      local: { cwd: REPO_ROOT },
    });

    session.status = result.status === 'error' ? 'agent-error' : 'completed';
    session.result = { status: result.status, id: result.id ?? null };
    session.endTime = new Date().toISOString();
    saveJson(SESSION_PATH, session);

    return { ok: result.status !== 'error', status: result.status, id: result.id ?? null, result: result.result ?? null };
  } catch (err) {
    session.status = 'sdk-error';
    session.result = { error: err.message, retryable: err.isRetryable ?? false };
    session.endTime = new Date().toISOString();
    saveJson(SESSION_PATH, session);

    return { ok: false, status: 'sdk-error', error: err.message, retryable: err.isRetryable ?? false };
  }
}

// ── Post-execution verification ──

function runPostExecution() {
  console.log('\n[headless] Post-execution verification');
  const build = tryExec('node scripts/build-runtime-workspace-v2.mjs');
  console.log(`  Build: ${build.ok ? 'PASS' : 'FAIL'}`);

  const verify = tryExec('node scripts/runtime/runtimeAutoVerificationPipeline.mjs');
  console.log(`  Verify: ${verify.ok ? 'PASS' : 'FAIL'}`);

  return { buildOk: build.ok, verifyOk: verify.ok };
}

// ── CLI: --check ──

function runCheck() {
  console.log('[headless] Runtime Headless Cursor Executor — CHECK');
  console.log('='.repeat(65));

  const report = buildHeadlessReport();

  for (const mode of report.modes) {
    const status = mode.available ? 'AVAILABLE' : 'NOT AVAILABLE';
    console.log(`\n  [${status}] ${mode.label} (priority ${mode.priority})`);
    if (mode.executablePath) console.log(`    Path: ${mode.executablePath}`);
    if (mode.version) console.log(`    Version: ${mode.version}`);
    if (mode.capabilities) {
      const caps = Object.entries(mode.capabilities).filter(([, v]) => v === true).map(([k]) => k);
      if (caps.length > 0) console.log(`    Capabilities: ${caps.join(', ')}`);
    }
  }

  console.log(`\n  Node: ${report.spawn.nodeVersion}`);
  console.log(`  SDK installed: ${report.summary.sdkInstalled}`);
  console.log(`  SDK version: ${report.summary.sdkVersion ?? 'N/A'}`);
  console.log(`  API key: ${report.summary.apiKeyConfigured ? report.summary.apiKeyMasked : '(not set)'}`);

  // Auth source analysis
  const sdkMode = report.modes.find(m => m.id === 'cursor-sdk');
  const auth = sdkMode?.authSources;
  if (auth) {
    console.log('\n  Auth Source Analysis:');
    console.log(`    CURSOR_API_KEY env: ${auth.apiKeyEnv ? `YES (${auth.apiKeyMasked})` : 'NO'}`);
    console.log(`    .env.runtime file: ${auth.envRuntimeFile ? 'YES' : 'NO'}`);
    console.log(`    Desktop app installed: ${auth.desktopAppInstalled ? 'YES' : 'NO'}`);
    console.log(`    Desktop session data: ${auth.desktopSessionDetected ? 'DETECTED (not usable by SDK)' : 'NOT DETECTED'}`);
    console.log(`    Browser session reuse: NO (SDK cannot access browser cookies)`);
    console.log(`    Local token cache: NO (SDK has no local credential cache)`);
    console.log(`    Fallback auth: ${auth.fallbackAvailable ? 'YES' : 'NOT AVAILABLE'}`);
    console.log(`\n    Verdict: ${auth.apiKeyEnv
      ? 'API key available — SDK auth will succeed'
      : 'CURSOR_API_KEY required — no fallback exists in SDK architecture'}`);
  }

  if (report.blockers.length > 0) {
    console.log('\n  Blockers:');
    for (const b of report.blockers) console.log(`    BLOCKER: ${b}`);
  }

  console.log(`\n${'='.repeat(65)}`);
  console.log(`[headless] ${report.summary.fullyHeadless ? 'FULLY HEADLESS READY' : `${report.blockers.length} blocker(s)`}`);
  console.log('\n' + JSON.stringify({
    ok: true,
    sdkInstalled: report.summary.sdkInstalled,
    sdkVersion: report.summary.sdkVersion,
    apiKeyConfigured: report.summary.apiKeyConfigured,
    fullyHeadless: report.summary.fullyHeadless,
    bestMode: report.summary.bestMode,
    authSources: auth,
    blockers: report.blockers,
    timestamp: new Date().toISOString(),
  }, null, 2));
}

// ── CLI: --dry-run ──

function runDryRun() {
  console.log('[headless] Runtime Headless Cursor Executor — DRY-RUN');
  console.log('='.repeat(65));

  const headlessReport = buildHeadlessReport();

  // Auth fallback analysis
  const authSources = detectAuthSources();
  console.log('\n[headless] Auth Fallback Analysis:');
  console.log(`  CURSOR_API_KEY env: ${authSources.apiKeyEnv ? 'YES' : 'NO'}`);
  console.log(`  Desktop session: ${authSources.desktopSessionDetected ? 'DETECTED (not usable)' : 'NOT DETECTED'}`);
  console.log(`  Desktop app: ${authSources.desktopAppInstalled ? 'INSTALLED' : 'NOT INSTALLED'}`);
  console.log(`  Browser session: NOT AVAILABLE (SDK limitation)`);
  console.log(`  Local token cache: NOT AVAILABLE (SDK limitation)`);
  console.log(`  Fallback auth: ${authSources.fallbackAvailable ? 'AVAILABLE' : 'NONE — CURSOR_API_KEY is mandatory'}`);

  console.log('\n[headless] Pre-flight Gates:');
  const preflight = runPreflightGates();
  for (const g of preflight.gates) {
    console.log(`  ${g.pass ? 'PASS' : 'FAIL'}: ${g.gate} — ${g.detail}`);
  }

  const prompt = resolvePrompt();
  console.log(`\n[headless] Resolved prompt (${prompt.length} chars):`);
  console.log(`  "${prompt.slice(0, 120)}${prompt.length > 120 ? '...' : ''}"`);

  console.log('\n[headless] Execution simulation:');
  console.log('  → Would call: Agent.prompt(prompt, { apiKey, model: "composer-2.5", local: { cwd } })');
  console.log(`  → Workspace: ${REPO_ROOT}`);
  console.log('  → Post-execution: build + verify pipeline');
  console.log('  → Auto-push: disabled (requires explicit instruction)');

  const report = {
    ok: true,
    mode: 'dry-run',
    preflight: { passed: preflight.passed, total: preflight.total, allPass: preflight.allPass },
    gates: preflight.gates,
    authFallbackAnalysis: {
      apiKeyEnv: authSources.apiKeyEnv,
      desktopSessionDetected: authSources.desktopSessionDetected,
      desktopAppInstalled: authSources.desktopAppInstalled,
      browserSessionReuse: false,
      localTokenCache: false,
      fallbackAuthAvailable: authSources.fallbackAvailable,
      verdict: authSources.apiKeyEnv
        ? 'API key present — SDK auth operational'
        : 'CURSOR_API_KEY is the only supported auth method. Desktop/browser sessions cannot be reused by @cursor/sdk.',
    },
    prompt: { length: prompt.length, preview: prompt.slice(0, 120) },
    wouldExecute: preflight.allPass,
    executionPlan: preflight.allPass ? {
      method: 'Agent.prompt()',
      sdk: '@cursor/sdk',
      runtime: 'local',
      cwd: REPO_ROOT,
      model: 'composer-2.5',
      postExecution: 'build + verify',
      autoPush: false,
    } : null,
    timestamp: new Date().toISOString(),
  };

  console.log(`\n${'='.repeat(65)}`);
  console.log(`[headless] DRY-RUN: ${preflight.passed}/${preflight.total} gates passed — ${preflight.allPass ? 'READY TO EXECUTE' : 'NOT READY'}`);
  console.log('\n' + JSON.stringify(report, null, 2));
}

// ── CLI: --execute ──

async function runExecute() {
  console.log('[headless] Runtime Headless Cursor Executor — EXECUTE');
  console.log('='.repeat(65));

  // Mandatory pre-flight
  console.log('\n[headless] Pre-flight Gates:');
  const preflight = runPreflightGates();
  for (const g of preflight.gates) {
    console.log(`  ${g.pass ? 'PASS' : 'FAIL'}: ${g.gate} — ${g.detail}`);
  }

  if (!preflight.allPass) {
    console.log(`\n${'='.repeat(65)}`);
    console.log(`[headless] BLOCKED — ${preflight.total - preflight.passed} gate(s) failed. Cannot execute.`);
    const failedGates = preflight.gates.filter(g => !g.pass).map(g => g.gate);
    console.log('\n' + JSON.stringify({ ok: false, blocked: true, failedGates, timestamp: new Date().toISOString() }, null, 2));
    process.exitCode = 1;
    return;
  }

  const prompt = resolvePrompt();
  console.log(`\n[headless] Executing Agent.prompt()`);
  console.log(`  Prompt: ${prompt.length} chars`);

  const result = await executeWithSDK(prompt);

  console.log(`\n[headless] Agent result:`);
  console.log(`  Status: ${result.status}`);
  if (result.id) console.log(`  Run ID: ${result.id}`);
  if (result.error) console.log(`  Error: ${result.error}`);

  // Post-execution verification
  const post = result.ok ? runPostExecution() : { buildOk: false, verifyOk: false };

  const report = {
    ok: result.ok,
    mode: 'execute',
    agentResult: { status: result.status, id: result.id ?? null },
    postExecution: post,
    timestamp: new Date().toISOString(),
  };

  console.log(`\n${'='.repeat(65)}`);
  console.log(`[headless] ${result.ok ? 'EXECUTION COMPLETE' : 'EXECUTION FAILED'}`);
  console.log('\n' + JSON.stringify(report, null, 2));
}

// ── Main ──

const args = process.argv.slice(2);
const flag = args[0] ?? '--check';

if (flag === '--execute') {
  runExecute();
} else if (flag === '--dry-run') {
  runDryRun();
} else {
  runCheck();
}
