# Cursor Direct Runtime Control Bridge — Specification

**Bridge name**: `chatgpt-runtime-bridge`
**Date**: 2026-05-26
**Repository**: federation-control

---

## Purpose

Safe local-only handoff layer between ChatGPT-directed instructions and Cursor Agent execution within the `federation-control` workspace. The bridge reads, validates, and surfaces instructions — it does **not** autonomously execute destructive operations.

---

## Local-Only Security Model

- The bridge runs entirely on the local machine
- No network services are exposed (no ports, no daemons)
- No credentials are transmitted or stored by the bridge
- All file operations are scoped to the `federation-control` workspace
- The bridge cannot commit, push, or deploy without explicit user instruction
- Safety gates block forbidden patterns before any prompt is generated

---

## Input Format

### Inbox file

```
.cursor/tasks/chatgpt-runtime-inbox.md
```

Contents: Markdown with a `# ChatGPT → Cursor Runtime Inbox` heading followed by the instruction body. HTML comments are stripped. An inbox containing only `_No pending instruction._` is treated as empty.

### Modes

| Flag | Mode | Behavior |
|------|------|----------|
| _(none)_ | `status` | Print inbox summary, git state, recommended prompt. Read-only. |
| `--agent-prompt` | `agent-prompt` | Validate safety gates, generate normalized execution prompt file. |

---

## Output Format

### Status mode output

```
[bridge] mode: status
[bridge] repo: <path>
[bridge] branch: main
[bridge] git status: <clean | N files modified>
[bridge] inbox: <empty | has instruction>
[bridge] instruction preview: <first 120 chars>
[bridge] safety gates: PASS / BLOCK
[bridge] recommended prompt: <cursor agent prompt text>
```

### Agent-prompt mode output

Generates `.cursor/tasks/chatgpt-runtime-agent-prompt.md` containing the full execution prompt with template, instruction, and checklist.

---

## Allowed Repositories

| Repository | Status |
|------------|--------|
| `federation-control` | **Allowed** — only permitted target |

All other repositories are blocked by the `repo-identity` safety gate.

---

## Forbidden Repositories

Any repository whose `package.json` `name` field is not `federation-control`.

---

## Allowed Commands

The bridge itself runs only read-only commands:

| Command | Purpose |
|---------|---------|
| `git branch --show-current` | Display current branch |
| `git status --porcelain` | Summarize working tree state |
| Read `.cursor/tasks/chatgpt-runtime-inbox.md` | Load instruction |
| Read `.cursor/tasks/chatgpt-runtime-agent-prompt-template.md` | Load template |
| Write `.cursor/tasks/chatgpt-runtime-agent-prompt.md` | Output generated prompt |

---

## Forbidden Commands (bridge will NOT execute)

| Command | Reason |
|---------|--------|
| `git commit` | Requires explicit user instruction |
| `git push` | Requires explicit user instruction |
| `git reset --hard` | Destructive |
| `rm -rf` / `del /s` | Destructive |
| `npm publish` | Deployment requires explicit approval |
| Any build/verify execution | Left to Cursor Agent, not the bridge |

---

## Forbidden Instruction Patterns

The bridge rejects instructions containing:

| Pattern | Reason |
|---------|--------|
| `window.location` | Violates Runtime routing rules |
| `window.open` | Violates Runtime routing rules |
| `viewPanel=401` | Obsolete routing mechanism |
| `remove registry` / `delete registry` | Destroys Runtime source of truth |
| `reintroduce placeholder` | Reverts cleanup progress |
| `obsolete panel` | References deprecated elements |
| Cross-repo modification | Out of scope |

---

## Logging Policy

- All bridge invocations print structured output to stdout
- Safety gate results are always logged (PASS/BLOCK per gate)
- No persistent log files are created (stdout only)
- No telemetry is sent externally
- Generated prompt files serve as an implicit audit trail

---

## Failure Handling

| Failure | Bridge behavior |
|---------|----------------|
| Inbox file missing | Print error, exit code 1 |
| Inbox empty | Report "no instruction", exit code 1 (for `--agent-prompt` mode) |
| Safety gate blocked | Print blocker reason, do NOT generate prompt, exit code 1 |
| Template file missing | Print error, exit code 1 |
| Wrong repository | Print "repo identity failed", exit code 1 |
| Git not available | Print warning, continue without git status |

---

## Manual Approval Points

The bridge is designed with deliberate manual checkpoints:

1. **Writing the inbox** — ChatGPT output must be manually pasted into the inbox file (or written by a trusted automation)
2. **Running the bridge** — User explicitly runs `npm run chatgpt:runtime-bridge`
3. **Reviewing the prompt** — Generated prompt can be inspected before Cursor Agent reads it
4. **Cursor Agent execution** — Agent session is started manually (until CLI invocation is implemented in Phase 3)
5. **Commit / push** — Always requires explicit instruction within the inbox content
