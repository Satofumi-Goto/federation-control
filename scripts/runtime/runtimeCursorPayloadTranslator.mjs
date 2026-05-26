#!/usr/bin/env node
/**
 * Runtime Cursor Payload Translator
 *
 * Converts runtime-bridge-payload.json into a Cursor Agent-ready
 * prompt payload, invocation-safe execution prompt, and
 * local execution package.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const PAYLOAD_PATH = path.resolve(REPO_ROOT, '.cursor/tasks/runtime-bridge-payload.json');
const PROMPT_OUTPUT_PATH = path.resolve(REPO_ROOT, '.cursor/tasks/runtime-cursor-agent-prompt.md');
const EXEC_PACKAGE_PATH = path.resolve(REPO_ROOT, '.cursor/tasks/runtime-execution-package.json');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
}

function saveJson(p, data) {
  saveFile(p, JSON.stringify(data, null, 2) + '\n');
}

function buildValidationCommands(validations) {
  const cmdMap = {
    'registry-migration': 'node scripts/verify-registry-migration.mjs',
    'runtime-topology': 'node scripts/verify-runtime-topology-links.mjs',
    'federation-semantic': 'node scripts/verify-federation-semantic.mjs',
    'federation-governance': 'node scripts/verify-federation-governance.mjs',
    'runtime-build': 'node scripts/build-runtime-workspace-v2.mjs',
  };
  return validations.map(v => cmdMap[v]).filter(Boolean);
}

function buildSafetyConstraints(payload) {
  const constraints = [];
  for (const op of payload.forbiddenOperations ?? []) {
    switch (op) {
      case 'delete-registry': constraints.push('Do NOT delete Runtime Registry'); break;
      case 'delete-memory': constraints.push('Do NOT delete Federation Memory'); break;
      case 'delete-routes': constraints.push('Do NOT delete canonical Runtime routes'); break;
      case 'force-push': constraints.push('Do NOT use git push --force'); break;
      case 'hard-reset': constraints.push('Do NOT use git reset --hard'); break;
      case 'credential-expose': constraints.push('Do NOT print or log tokens/credentials'); break;
      case 'deploy-no-verify': constraints.push('Do NOT deploy without verification'); break;
    }
  }
  return constraints;
}

/**
 * Translate payload into a Cursor Agent prompt (markdown).
 */
export function translateToPrompt(payload) {
  const validationCmds = buildValidationCommands(payload.requiredValidation ?? []);
  const constraints = buildSafetyConstraints(payload);

  const targetFilesSection = payload.targetFiles?.length > 0
    ? `## Target Files\n\n${payload.targetFiles.map(f => `- \`${f}\``).join('\n')}\n`
    : '';

  const prompt = `# Cursor Agent Execution Prompt
# Generated: ${new Date().toISOString()}
# Instruction ID: ${payload.instructionId}
# Execution Mode: ${payload.executionMode}

---

## Repository

federation-control (local workspace)

${targetFilesSection}
## Instruction

${payload.instruction}

---

## Required Validations

${validationCmds.map((cmd, i) => `${i + 1}. \`${cmd}\``).join('\n')}

## Safety Constraints

${constraints.map(c => `- ${c}`).join('\n')}

## Allowed Operations

${(payload.allowedOperations ?? []).map(op => `- ${op}`).join('\n')}

---

## Execution Checklist

- [ ] Read target files
- [ ] Implement instruction
- [ ] Run all required validations
- [ ] Confirm all verifications pass
- [ ] Report: files changed, verification results, git status
`;

  return prompt;
}

/**
 * Translate payload into a CLI invocation arguments object.
 */
export function translateToInvocationArgs(payload, executablePath) {
  const prompt = translateToPrompt(payload);
  const oneLinePrompt = payload.instruction?.replace(/\n/g, ' ').trim() ?? '';

  return {
    executable: executablePath ?? 'agent',
    args: ['-p', '--force', '--workspace', '.'],
    prompt: oneLinePrompt,
    fullPrompt: prompt,
    mode: payload.executionMode === 'dry-run' ? 'ask' : 'agent',
    workingDirectory: REPO_ROOT,
  };
}

/**
 * Build a local execution package combining payload, prompt, and invocation args.
 */
export function buildExecutionPackage(payload) {
  const prompt = translateToPrompt(payload);
  const invocation = translateToInvocationArgs(payload);

  return {
    instructionId: payload.instructionId,
    repository: payload.repository,
    executionMode: payload.executionMode,
    prompt,
    invocation: {
      executable: invocation.executable,
      args: invocation.args,
      mode: invocation.mode,
      workingDirectory: invocation.workingDirectory,
    },
    validationCommands: buildValidationCommands(payload.requiredValidation ?? []),
    safetyConstraints: buildSafetyConstraints(payload),
    timestamp: new Date().toISOString(),
  };
}

function main() {
  console.log('[translator] Runtime Cursor Payload Translator');
  console.log('='.repeat(55));

  const payload = loadJson(PAYLOAD_PATH);

  if (!payload) {
    console.log('[translator] No payload found at', PAYLOAD_PATH);
    console.log('[translator] Run runtime:cursor-bridge first to generate a payload.');
    const result = { ok: true, status: 'no-payload', timestamp: new Date().toISOString() };
    console.log('\n' + JSON.stringify(result, null, 2));
    return;
  }

  console.log(`\n[translator] Payload: ${payload.instructionId}`);
  console.log(`[translator] Mode: ${payload.executionMode}`);
  console.log(`[translator] Target files: ${payload.targetFiles?.length ?? 0}`);

  // 1. Generate prompt
  console.log('\n[translator] Generating Agent prompt...');
  const prompt = translateToPrompt(payload);
  saveFile(PROMPT_OUTPUT_PATH, prompt);
  console.log(`  Prompt saved: ${PROMPT_OUTPUT_PATH}`);
  console.log(`  Prompt length: ${prompt.length} chars`);

  // 2. Build execution package
  console.log('\n[translator] Building execution package...');
  const execPkg = buildExecutionPackage(payload);
  saveJson(EXEC_PACKAGE_PATH, execPkg);
  console.log(`  Package saved: ${EXEC_PACKAGE_PATH}`);

  // 3. Generate invocation args
  const invocation = translateToInvocationArgs(payload);
  console.log('\n[translator] Invocation command:');
  console.log(`  ${invocation.executable} ${invocation.args.join(' ')} --mode ${invocation.mode}`);

  const report = {
    ok: true,
    status: 'translated',
    instructionId: payload.instructionId,
    executionMode: payload.executionMode,
    promptPath: PROMPT_OUTPUT_PATH,
    promptLength: prompt.length,
    packagePath: EXEC_PACKAGE_PATH,
    invocationCommand: `${invocation.executable} ${invocation.args.join(' ')} --mode ${invocation.mode}`,
    validationCommands: execPkg.validationCommands.length,
    safetyConstraints: execPkg.safetyConstraints.length,
    timestamp: new Date().toISOString(),
  };

  console.log(`\n${'='.repeat(55)}`);
  console.log('[translator] Status: TRANSLATION COMPLETE');
  console.log('\n' + JSON.stringify(report, null, 2));
}

main();
