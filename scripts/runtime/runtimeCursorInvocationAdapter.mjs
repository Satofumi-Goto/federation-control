#!/usr/bin/env node
/**
 * Runtime Cursor Invocation Adapter
 *
 * Detects available Cursor executables, CLI invocation support,
 * agent subcommand capability, process spawn support,
 * workspace/repo context, and normalizes invocation arguments.
 *
 * Capability adapter only — no execution.
 */

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const CAPABILITY_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-cursor-capability-report.json');

const IS_WIN = process.platform === 'win32';

function tryExec(cmd, timeout = 5000) {
  try {
    return { ok: true, output: execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', timeout, stdio: ['pipe', 'pipe', 'pipe'] }).trim() };
  } catch (e) {
    return { ok: false, output: e.stderr?.trim() ?? e.message ?? null };
  }
}

function detectExecutable(name) {
  const cmd = IS_WIN
    ? `powershell -NoProfile -Command "Get-Command ${name} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source"`
    : `which ${name} 2>/dev/null`;
  const result = tryExec(cmd, 8000);
  const detected = result.ok && !!result.output && !result.output.includes('not recognized');
  return {
    name,
    detected,
    path: detected ? result.output.split('\n')[0].trim() : null,
  };
}

function detectCursorVersion(execPath) {
  if (!execPath) return null;
  const result = tryExec(`"${execPath}" --version`);
  if (!result.ok) return null;
  return result.output.split('\n')[0].trim();
}

function detectAgentSubcommand(cursorPath) {
  if (!cursorPath) return { available: false, reason: 'No cursor executable' };

  const helpResult = tryExec(`"${cursorPath}" --help`);
  const helpText = helpResult.output ?? '';
  const hasAgentLine = /^\s*agent\b/m.test(helpText);

  if (!hasAgentLine) {
    return { available: false, reason: 'No agent subcommand in cursor help output' };
  }

  // Detected in help, but test if it actually works
  // cursor agent -p requires stdin, so test with a simple spawn
  const spawnResult = spawnSync(cursorPath, ['agent', '--help'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 10000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const agentHelp = (spawnResult.stdout ?? '') + (spawnResult.stderr ?? '');
  const hasAgentFlags = agentHelp.includes('-p') || agentHelp.includes('--print') || agentHelp.includes('--force');

  // On current Windows build, cursor.cmd passes through ELECTRON_RUN_AS_NODE
  // which means agent subcommand may show generic help instead of agent-specific
  const isGuiCliWrapper = agentHelp.includes('Electron/Chromium') || agentHelp.includes('ELECTRON_RUN_AS_NODE');

  return {
    available: hasAgentLine,
    listedInHelp: true,
    agentHelpWorks: hasAgentFlags,
    isGuiCliWrapper,
    reason: hasAgentFlags
      ? 'Agent subcommand fully functional'
      : isGuiCliWrapper
        ? 'Agent listed but GUI CLI wrapper blocks -p flag; standalone agent binary needed'
        : 'Agent listed in help but subcommand may need standalone binary',
  };
}

function detectStandaloneCli(cursorPath) {
  if (!cursorPath) return { detected: false };

  const cursorDir = path.dirname(cursorPath);
  const candidates = [
    path.resolve(cursorDir, 'cursor-tunnel.exe'),
    path.resolve(cursorDir, 'cursor-tunnel'),
    path.resolve(cursorDir, 'code-tunnel.exe'),
    path.resolve(cursorDir, 'code-tunnel'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const helpResult = tryExec(`"${candidate}" --help`);
      const helpText = helpResult.output ?? '';
      const hasAgent = /agent/i.test(helpText);
      return {
        detected: true,
        path: candidate,
        hasAgentSubcommand: hasAgent,
        version: helpText.match(/(\d+\.\d+\.\d+)/)?.[1] ?? null,
      };
    }
  }
  return { detected: false };
}

function detectSpawnCapability() {
  const result = spawnSync('node', ['-e', 'console.log("spawn-ok")'], {
    encoding: 'utf8',
    timeout: 5000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return {
    supported: result.status === 0 && result.stdout?.includes('spawn-ok'),
    mechanism: 'child_process.spawnSync',
  };
}

function detectWorkspace() {
  const pkgPath = path.resolve(REPO_ROOT, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return {
      detected: true,
      root: REPO_ROOT,
      name: pkg.name,
      isFederationControl: pkg.name === 'federation-control',
    };
  } catch {
    return { detected: false, root: REPO_ROOT, name: null, isFederationControl: false };
  }
}

function detectRepository() {
  const branch = tryExec('git branch --show-current');
  const remote = tryExec('git remote get-url origin');
  const lastCommit = tryExec('git log -1 --format=%h');

  return {
    gitDetected: branch.ok,
    branch: branch.output,
    remote: remote.output,
    lastCommit: lastCommit.output,
    isFederationControl: remote.output?.includes('federation-control') ?? false,
  };
}

function buildCapabilityReport() {
  console.log('[adapter] Runtime Cursor Invocation Adapter');
  console.log('='.repeat(60));

  // 1. Executable detection
  console.log('\n[adapter] Executable Detection:');
  const cursorExec = detectExecutable('cursor');
  const agentExec = detectExecutable('agent');
  const cursorAgentExec = detectExecutable('cursor-agent');

  for (const e of [cursorExec, agentExec, cursorAgentExec]) {
    console.log(`  ${e.name}: ${e.detected ? `FOUND (${e.path})` : 'NOT FOUND'}`);
  }

  // 2. Version
  let version = null;
  if (cursorExec.detected) {
    version = detectCursorVersion(cursorExec.path);
    console.log(`  Cursor version: ${version ?? 'unknown'}`);
  }

  // 3. Agent subcommand detection
  console.log('\n[adapter] Agent Subcommand Detection:');
  const agentSubcmd = detectAgentSubcommand(cursorExec.path);
  console.log(`  Listed in help: ${agentSubcmd.listedInHelp ?? false}`);
  console.log(`  Agent help works: ${agentSubcmd.agentHelpWorks ?? false}`);
  console.log(`  GUI CLI wrapper: ${agentSubcmd.isGuiCliWrapper ?? false}`);
  console.log(`  Status: ${agentSubcmd.reason}`);

  // 4. Standalone CLI detection
  console.log('\n[adapter] Standalone CLI Detection:');
  const standalone = detectStandaloneCli(cursorExec.path);
  console.log(`  Detected: ${standalone.detected}`);
  if (standalone.detected) {
    console.log(`  Path: ${standalone.path}`);
    console.log(`  Has agent: ${standalone.hasAgentSubcommand}`);
    console.log(`  Version: ${standalone.version ?? 'unknown'}`);
  }

  // 5. Spawn capability
  console.log('\n[adapter] Spawn Capability:');
  const spawn = detectSpawnCapability();
  console.log(`  Supported: ${spawn.supported}`);
  console.log(`  Mechanism: ${spawn.mechanism}`);

  // 6. Workspace
  console.log('\n[adapter] Workspace:');
  const workspace = detectWorkspace();
  console.log(`  Detected: ${workspace.detected}`);
  console.log(`  Name: ${workspace.name}`);
  console.log(`  federation-control: ${workspace.isFederationControl}`);

  // 7. Repository
  console.log('\n[adapter] Repository:');
  const repo = detectRepository();
  console.log(`  Git: ${repo.gitDetected}`);
  console.log(`  Branch: ${repo.branch}`);
  console.log(`  Last commit: ${repo.lastCommit}`);

  // Determine primary executable and invocation readiness
  const primaryExec = agentExec.detected ? agentExec
    : cursorAgentExec.detected ? cursorAgentExec
    : cursorExec.detected ? cursorExec
    : null;

  const headlessAgentReady = agentExec.detected || cursorAgentExec.detected || agentSubcmd.agentHelpWorks;
  const localInvocationReady = cursorExec.detected && workspace.isFederationControl && repo.gitDetected && spawn.supported;

  // Unsupported
  const unsupported = [];
  if (!cursorExec.detected) unsupported.push('Cursor executable not found');
  if (!agentExec.detected && !cursorAgentExec.detected) unsupported.push('Standalone agent binary not installed');
  if (agentSubcmd.isGuiCliWrapper) unsupported.push('cursor agent -p blocked by GUI CLI wrapper (needs standalone agent binary)');
  if (!headlessAgentReady) unsupported.push('Headless agent invocation not available');

  // Build report
  const report = {
    cursorExecutable: { detected: cursorExec.detected, path: cursorExec.path },
    cursorVersion: version,
    agentExecutable: { detected: agentExec.detected, path: agentExec.path },
    cursorAgentExecutable: { detected: cursorAgentExec.detected, path: cursorAgentExec.path },
    primaryExecutable: primaryExec ? { name: primaryExec.name, path: primaryExec.path } : null,
    agentSubcommand: agentSubcmd,
    standaloneCli: standalone,
    spawnSupported: spawn.supported,
    workspace,
    repository: repo,
    headlessAgentReady,
    localInvocationReady,
    invocationMethod: headlessAgentReady
      ? 'cursor agent -p --force'
      : localInvocationReady
        ? 'fallback (build+verify pipeline)'
        : 'not-available',
    unsupported,
    timestamp: new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(CAPABILITY_PATH), { recursive: true });
  fs.writeFileSync(CAPABILITY_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[adapter] Cursor executable: ${cursorExec.detected ? 'DETECTED' : 'NOT FOUND'}`);
  console.log(`[adapter] Agent standalone: ${agentExec.detected || cursorAgentExec.detected ? 'DETECTED' : 'NOT FOUND'}`);
  console.log(`[adapter] Agent subcommand: ${agentSubcmd.available ? 'LISTED' : 'NO'}${agentSubcmd.isGuiCliWrapper ? ' (GUI wrapper — blocked)' : ''}`);
  console.log(`[adapter] Spawn: ${spawn.supported ? 'SUPPORTED' : 'NOT SUPPORTED'}`);
  console.log(`[adapter] Local invocation: ${localInvocationReady ? 'READY' : 'NOT READY'}`);
  console.log(`[adapter] Headless agent: ${headlessAgentReady ? 'READY' : 'NOT READY — install standalone agent binary'}`);

  if (unsupported.length > 0) {
    console.log('\n[adapter] Blockers:');
    for (const u of unsupported) console.log(`  - ${u}`);
  }

  console.log('\n' + JSON.stringify(report, null, 2));
}

buildCapabilityReport();
