# Cursor Invocation Capabilities — Investigation

**Date**: 2026-05-26
**Repository**: federation-control
**Purpose**: Enumerate all possible ChatGPT → Cursor invocation methods and select the recommended bridge architecture.

---

## 1. Cursor CLI (`agent` binary)

**Status**: Feasible — **Recommended Primary**

| Property | Detail |
|----------|--------|
| Binary | `agent` / `agent.exe` (Windows) |
| Headless mode | `agent -p --force --workspace <path> "<prompt>"` |
| Output | Structured JSON via `--output-format json` |
| Tool access | Full: files, shell, git, MCP |
| Session resume | `--resume <thread-id>` |
| Worktree isolation | `--worktree` |
| Platform | macOS, Linux, Windows (native) |
| Maturity | GA — production stable |

**Invocation example**:
```bash
agent -p --force --workspace /path/to/federation-control \
  "$(cat .cursor/tasks/runtime-bridge-payload.json)"
```

---

## 2. cursor-agent CLI

Alias for `agent`. Same binary, same capabilities. No separate installation.

---

## 3. MCP Invocation

**Status**: Feasible (indirect)

MCP servers are accessible from within an active Cursor Agent session. They cannot be invoked externally to start a session. MCP is a tool layer inside the agent, not an entry point.

**Use**: After the agent session starts (via CLI or SDK), MCP tools are available.

---

## 4. VSCode Extension Host APIs

**Status**: Not feasible for external invocation

Cursor is a VS Code fork. The extension host allows `vscode.commands.executeCommand()`, but Cursor's agent is not exposed through the standard extension command API. No `cursor.startAgent` or `cursor.runPrompt` command exists.

---

## 5. Local WebSocket Bridge

**Status**: Not available

No official Cursor WebSocket API or local daemon port. The Cursor IDE does not expose a WebSocket endpoint for external connections.

---

## 6. stdin/stdout Execution Model (ACP)

**Status**: Feasible — Advanced

**Mechanism**: `agent acp` starts the CLI as a JSON-RPC server over stdin/stdout.

| Method | Direction |
|--------|-----------|
| `session/new` | Client → Agent |
| `session/prompt` | Client → Agent |
| `session/update` | Agent → Client (notification) |

**Use case**: Building persistent daemons or multiplexed agent sessions.

**Note**: More complex than CLI headless mode. Best for editor integrations, not one-shot bridge invocations.

---

## 7. External Process Invocation

**Status**: Feasible

Node.js `child_process.execSync()` or `spawn()` can invoke `agent -p --force` directly. This is the basis of the bridge service.

```javascript
import { execSync } from 'node:child_process';
const result = execSync('agent -p --force --workspace . "instruction"', {
  encoding: 'utf8',
  timeout: 120000,
});
```

---

## 8. Local Daemon Capability

**Status**: Not available (native)

Cursor does not provide a background daemon API. However, a custom Node.js watcher process can serve as a bridge daemon:

1. Watch `.cursor/tasks/chatgpt-runtime-inbox.md` for changes
2. On change: validate → generate payload → invoke CLI
3. Capture output → write report

This is the architecture implemented in `runtimeCursorBridgeService.mjs`.

---

## 9. File-Triggered Execution

**Status**: Partially feasible

Cursor IDE does not auto-execute agent sessions on file changes. However:

- A file watcher (`fs.watch`) can detect inbox changes
- The watcher invokes `agent -p` via CLI
- Result: file-triggered execution through custom middleware

This is the architecture implemented in `runtimeBridgeWatcher.mjs`.

---

## 10. Cursor SDK (`@cursor/sdk`)

**Status**: Feasible — Secondary

| Property | Detail |
|----------|--------|
| Package | `@cursor/sdk` (TypeScript), `cursor-sdk` (Python) |
| API | `Agent.prompt()`, `Agent.create()`, `agent.send()` |
| Runtime | Local (cwd) or Cloud (VM clone) |
| Streaming | `run.stream()` for progress events |
| Multi-turn | `agent.send()` for follow-up messages |
| Maturity | Public beta (v1.0.13+, April 2026) |

---

## Summary Matrix

| Method | Feasible | Maturity | Recommended |
|--------|:--------:|:--------:|:-----------:|
| Cursor CLI (`agent -p`) | Yes | GA | **Primary** |
| Cursor SDK (`@cursor/sdk`) | Yes | Beta | Secondary |
| ACP (JSON-RPC stdio) | Yes | Advanced | Future |
| MCP (tool layer) | Indirect | Stable | N/A (not entry point) |
| External process | Yes | N/A | Via CLI |
| File-triggered | Partial | Custom | Via watcher |
| VSCode Extension Host | No | N/A | — |
| WebSocket / Daemon | No | N/A | — |
| Local Daemon | Custom only | N/A | Via watcher |

---

## Security Implications

| Concern | Mitigation |
|---------|------------|
| `--force` enables unreviewed writes | Safety gates in bridge pre-validate instruction |
| API key exposure | `CURSOR_API_KEY` in env only, never committed |
| Arbitrary shell execution | Forbidden pattern checks block dangerous instructions |
| Cross-repo access | Bridge validates repo identity before execution |
| Token leakage | Credential resolver masks all tokens in output |
| Unattended deploy | No auto-push/deploy without explicit instruction |

## Required Local Services

| Service | Required |
|---------|----------|
| Cursor CLI (`agent` binary) | Yes — install via cursor.com |
| `CURSOR_API_KEY` env var | Yes — generate at cursor.com dashboard |
| Node.js >= 18 | Yes (already present) |
| Git | Yes (already present) |

## Required Permissions

| Permission | Scope |
|------------|-------|
| File read/write | federation-control workspace only |
| Shell execution | Build, verify, git commands |
| Network | Outbound HTTPS to api2.cursor.sh |
| Git push | Only when explicitly instructed |
