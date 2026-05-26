#!/usr/bin/env node
/**
 * ChatGPT → Cursor Agent Bridge
 *
 * Reads the instruction inbox, validates safety gates,
 * and generates a normalized Cursor Agent execution prompt.
 *
 * Usage:
 *   node scripts/chatgpt-runtime-bridge.mjs --agent-prompt
 */

import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const ROOT = path.dirname(__filename);
const REPO_ROOT = path.resolve(ROOT, '..');
const INBOX_PATH = path.resolve(REPO_ROOT, '.cursor/tasks/chatgpt-runtime-inbox.md');
const TEMPLATE_PATH = path.resolve(REPO_ROOT, '.cursor/tasks/chatgpt-runtime-agent-prompt-template.md');
const OUTPUT_PATH = path.resolve(REPO_ROOT, '.cursor/tasks/chatgpt-runtime-agent-prompt.md');

const FORBIDDEN_PATTERNS = [
  { pattern: /window\.location/i, reason: 'Instruction attempts to use window.location' },
  { pattern: /window\.open/i, reason: 'Instruction attempts to use window.open' },
  { pattern: /viewPanel\s*=\s*401/i, reason: 'Instruction attempts viewPanel=401 routing' },
  { pattern: /remove\s+(runtime\s+)?registry/i, reason: 'Instruction attempts to remove Runtime Registry' },
  { pattern: /delete\s+(runtime\s+)?registry/i, reason: 'Instruction attempts to delete Runtime Registry' },
  { pattern: /reintroduce\s+.*placeholder/i, reason: 'Instruction attempts to reintroduce obsolete placeholder panels' },
  { pattern: /obsolete\s+.*panel/i, reason: 'Instruction references obsolete panels for reintroduction' },
];

const REPO_NAME = 'federation-control';

function readFile(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch { return null; }
}

function isRepoValid() {
  const pkgPath = path.resolve(REPO_ROOT, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.name === REPO_NAME;
  } catch {
    return false;
  }
}

function isInboxEmpty(content) {
  if (!content) return true;
  const stripped = content
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^#.*$/gm, '')
    .replace(/_No pending instruction\._/g, '')
    .trim();
  return stripped.length === 0;
}

function checkSafetyGates(inboxContent) {
  const gates = [];

  if (!isRepoValid()) {
    gates.push({ gate: 'repo-identity', pass: false, reason: `Active repo is not ${REPO_NAME}` });
    return gates;
  }
  gates.push({ gate: 'repo-identity', pass: true, reason: `Confirmed: ${REPO_NAME}` });

  if (isInboxEmpty(inboxContent)) {
    gates.push({ gate: 'inbox-content', pass: false, reason: 'Inbox is empty — no instruction to execute' });
    return gates;
  }
  gates.push({ gate: 'inbox-content', pass: true, reason: 'Inbox contains instruction' });

  for (const fp of FORBIDDEN_PATTERNS) {
    if (fp.pattern.test(inboxContent)) {
      gates.push({ gate: 'forbidden-pattern', pass: false, reason: fp.reason });
    }
  }

  if (!gates.some((g) => g.gate === 'forbidden-pattern')) {
    gates.push({ gate: 'forbidden-pattern', pass: true, reason: 'No forbidden patterns detected' });
  }

  const otherRepoPatterns = [
    /modify\s+(another|other|different)\s+repo/i,
    /switch\s+to\s+.*(?!federation-control)\s+repo/i,
    /cd\s+~?\/?(?!federation-control)[a-zA-Z][\w-]+\s*&&/i,
  ];
  let repoSafe = true;
  for (const rp of otherRepoPatterns) {
    if (rp.test(inboxContent)) {
      gates.push({ gate: 'cross-repo', pass: false, reason: 'Instruction targets a different repository' });
      repoSafe = false;
      break;
    }
  }
  if (repoSafe) {
    gates.push({ gate: 'cross-repo', pass: true, reason: 'Instruction scoped to federation-control' });
  }

  return gates;
}

function generateAgentPrompt(inboxContent, template) {
  const timestamp = new Date().toISOString();
  const instructionBlock = inboxContent
    .replace(/^#\s+ChatGPT.*$/m, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/_No pending instruction\._/g, '')
    .trim();

  return `# Cursor Agent Execution Prompt
# Generated: ${timestamp}
# Source: .cursor/tasks/chatgpt-runtime-inbox.md

---

${template}

---

# Current Instruction

\`\`\`
${instructionBlock}
\`\`\`

---

# Execution Checklist

- [ ] git status confirmed
- [ ] Branch confirmed (main)
- [ ] Relevant files inspected
- [ ] Implementation complete
- [ ] Build passed
- [ ] Registry migration verification passed
- [ ] Topology verification passed
- [ ] Semantic verification passed
- [ ] git status (post-edit) reported
- [ ] Report generated
`;
}

import { execSync } from 'node:child_process';

function gitExec(cmd) {
  try {
    return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 10000 }).trim();
  } catch {
    return null;
  }
}

function getInboxPreview(content) {
  if (!content) return '(empty)';
  const stripped = content
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^#.*$/gm, '')
    .replace(/_No pending instruction\._/g, '')
    .trim();
  if (stripped.length === 0) return '(empty)';
  return stripped.slice(0, 120) + (stripped.length > 120 ? '...' : '');
}

function buildRecommendedPrompt(inboxContent) {
  const instruction = inboxContent
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^#\s+ChatGPT.*$/m, '')
    .replace(/_No pending instruction\._/g, '')
    .trim();

  return `Execute the following instruction in federation-control:

${instruction}

After implementation:
1. node scripts/build-runtime-workspace-v2.mjs
2. node scripts/verify-registry-migration.mjs
3. node scripts/verify-runtime-topology-links.mjs
4. node scripts/verify-federation-semantic.mjs
5. git status
6. Report: panels, version, PASS/FAIL per verification, files changed`;
}

function runStatusMode(inboxContent) {
  const branch = gitExec('git branch --show-current') ?? '(unknown)';
  const porcelain = gitExec('git status --porcelain') ?? '';
  const fileCount = porcelain ? porcelain.split('\n').filter(Boolean).length : 0;
  const gitSummary = fileCount === 0 ? 'clean' : `${fileCount} files modified`;
  const inboxEmpty = isInboxEmpty(inboxContent);
  const preview = getInboxPreview(inboxContent);

  const gates = checkSafetyGates(inboxContent);
  const allPass = gates.every((g) => g.pass);

  console.log(`[bridge] mode: status`);
  console.log(`[bridge] repo: ${REPO_ROOT}`);
  console.log(`[bridge] branch: ${branch}`);
  console.log(`[bridge] git status: ${gitSummary}`);
  console.log(`[bridge] inbox: ${inboxEmpty ? 'empty' : 'has instruction'}`);
  console.log(`[bridge] instruction preview: ${preview}`);

  console.log('\n[bridge] Safety Gates:');
  for (const g of gates) {
    console.log(`  ${g.pass ? 'PASS' : 'BLOCK'}: ${g.gate} — ${g.reason}`);
  }

  console.log(`\n[bridge] overall: ${allPass ? 'READY' : 'BLOCKED'}`);

  if (allPass && !inboxEmpty) {
    console.log('\n[bridge] Recommended Cursor Agent prompt:');
    console.log('─'.repeat(60));
    console.log(buildRecommendedPrompt(inboxContent));
    console.log('─'.repeat(60));
  }

  const result = {
    ok: allPass,
    mode: 'status',
    repo: REPO_NAME,
    branch,
    gitStatus: gitSummary,
    inboxEmpty,
    gates,
    timestamp: new Date().toISOString(),
  };
  console.log('\n' + JSON.stringify(result, null, 2));

  process.exit(allPass ? 0 : 1);
}

function runAgentPromptMode(inboxContent) {
  const template = readFile(TEMPLATE_PATH);

  if (!template) {
    console.error('[bridge] ERROR: Agent prompt template not found at', TEMPLATE_PATH);
    process.exit(1);
  }

  const gates = checkSafetyGates(inboxContent);
  const allPass = gates.every((g) => g.pass);

  console.log(`[bridge] mode: agent-prompt`);
  console.log(`[bridge] repo: ${REPO_ROOT}`);

  console.log('\n[bridge] Safety Gates:');
  for (const g of gates) {
    console.log(`  ${g.pass ? 'PASS' : 'BLOCK'}: ${g.gate} — ${g.reason}`);
  }

  if (!allPass) {
    console.error('\n[bridge] BLOCKED: Safety gates failed. Agent prompt NOT generated.');
    const blockers = gates.filter((g) => !g.pass);
    for (const b of blockers) {
      console.error(`  → ${b.reason}`);
    }
    process.exit(1);
  }

  const prompt = generateAgentPrompt(inboxContent, template);
  fs.writeFileSync(OUTPUT_PATH, prompt, 'utf8');

  console.log(`\n[bridge] Agent prompt generated: ${OUTPUT_PATH}`);
  console.log('[bridge] Ready for Cursor Agent execution.');

  const result = {
    ok: true,
    mode: 'agent-prompt',
    inboxPath: INBOX_PATH,
    outputPath: OUTPUT_PATH,
    gates,
    timestamp: new Date().toISOString(),
  };
  console.log('\n' + JSON.stringify(result, null, 2));
}

function main() {
  const args = process.argv.slice(2);
  const inboxContent = readFile(INBOX_PATH);

  if (args.includes('--agent-prompt')) {
    runAgentPromptMode(inboxContent);
  } else {
    runStatusMode(inboxContent);
  }
}

main();
