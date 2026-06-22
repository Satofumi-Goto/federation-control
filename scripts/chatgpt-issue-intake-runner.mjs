#!/usr/bin/env node
/**
 * ChatGPT Issue Intake Runner
 *
 * Safe external handoff target for GitHub issue based requests.
 * The issue body is not executed here. This runner only records that
 * an issue was received and tells the operator which existing bridge
 * command should be run next.
 */

const result = {
  ok: true,
  route: 'github-issue-intake',
  label: 'chatgpt-intake',
  nextCommands: [
    'npm run chatgpt:runtime-bridge',
    'npm run chatgpt:runtime-agent-prompt'
  ],
  note: 'Use the GitHub issue body as the instruction source for the runtime inbox.'
};

console.log(JSON.stringify(result, null, 2));
