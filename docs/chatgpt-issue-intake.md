# ChatGPT Issue Intake

External ChatGPT threads use GitHub issues labeled `chatgpt-intake` as the handoff channel.

Current entrypoints:

- `scripts/chatgpt-issue-intake.mjs`
- `.cursor/tasks/chatgpt-runtime-inbox.md`
- `npm run chatgpt:runtime-bridge`
- `npm run chatgpt:runtime-agent-prompt`

Required flow:

1. Create an issue using the Federation intake template.
2. Apply the `chatgpt-intake` label.
3. The intake handler records the issue.
4. The runtime bridge converts the request into a Cursor Agent execution prompt.
5. The agent performs implementation, commit, and push.
6. The result is reported back to the issue.
