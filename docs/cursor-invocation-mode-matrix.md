# Cursor Invocation Mode Matrix

Last updated: 2026-05-26

## Local System Profile

| Property | Value |
|----------|-------|
| Cursor Version | 3.4.20 |
| OS | Windows 10 |
| Cursor.exe | `%LOCALAPPDATA%\Programs\cursor\Cursor.exe` |
| cursor-tunnel.exe | `%LOCALAPPDATA%\Programs\cursor\resources\app\bin\cursor-tunnel.exe` |
| cursor.cmd | `%LOCALAPPDATA%\Programs\cursor\resources\app\bin\cursor.cmd` |
| @cursor/sdk | v1.0.13 (npm registry) |

## Mode Comparison

| Mode | Feasible | Stable | Secure | Local-Only | Autonomous | Recommended |
|------|----------|--------|--------|------------|------------|-------------|
| **Cursor SDK (`@cursor/sdk`)** | Yes | Yes | Yes (API key) | Yes (local runtime) | **Yes** | **Recommended** |
| **CLI Agent (`cursor.cmd agent`)** | Yes | Partial | Yes | Yes | Partial | Conditional |
| **cursor-tunnel.exe** | Yes | Yes | Yes | Yes | No (no agent) | Not recommended |
| **File-trigger (inbox/payload)** | Yes | Yes | Yes | Yes | Partial | Fallback |
| **MCP Bridge** | Yes | Yes | Yes | Yes | Partial | Secondary |
| **IPC/Socket** | No | N/A | N/A | N/A | N/A | Not available |
| **VSCode Extension Host** | No | N/A | N/A | N/A | N/A | Not feasible |

## Detailed Mode Analysis

### 1. Cursor SDK (`@cursor/sdk`) — RECOMMENDED

**Invocation**: `Agent.prompt()` or `Agent.create()` + `agent.send()`

| Property | Detail |
|----------|--------|
| Fully headless | Yes — no UI, no Electron, no display |
| Programmatic | Yes — TypeScript/Node.js native |
| stdin prompt | Yes — prompt passed as string argument |
| Workspace targeting | Yes — `local: { cwd }` |
| Streaming | Yes — `run.stream()` |
| Multi-turn | Yes — `agent.send()` follow-ups |
| Model selection | Yes — `model: { id: "composer-2.5" }` |
| Auth | `CURSOR_API_KEY` environment variable |
| Install | `npm install @cursor/sdk` |

**Execution pattern**:

```javascript
import { Agent } from "@cursor/sdk";

const result = await Agent.prompt(prompt, {
  apiKey: process.env.CURSOR_API_KEY,
  model: { id: "composer-2.5" },
  local: { cwd: "/path/to/federation-control" },
});
```

### 2. CLI Agent (`cursor.cmd agent`)

**Invocation**: `ELECTRON_RUN_AS_NODE=1 Cursor.exe cli.js agent`

| Property | Detail |
|----------|--------|
| Fully headless | No — launches terminal-based agent within Electron |
| Programmatic | Partial — CLI invocation via child_process |
| stdin prompt | Not documented |
| Workspace targeting | Yes — opens workspace |
| Requires display | Yes — Electron process |

**Limitation**: The `agent` subcommand description says "Start the Cursor agent in your terminal", but it operates within the Electron process context, meaning it requires a display environment. Not suitable for fully headless server/CI execution.

### 3. cursor-tunnel.exe (Standalone CLI)

**Invocation**: Direct binary execution

| Property | Detail |
|----------|--------|
| Fully headless | Yes |
| Agent support | No — supports tunnel/ext/status/version only |
| Use case | Remote tunnel access, not agent execution |

### 4. File-trigger Execution

**Invocation**: Write payload to `.cursor/tasks/runtime-bridge-payload.json`

| Property | Detail |
|----------|--------|
| Fully headless | No — requires running Cursor IDE instance |
| Async | Yes — payload written, picked up by running Cursor |
| Workspace targeting | Yes — payload scoped to repository |
| Governance | Yes — safety layer validates payload |

### 5. MCP Bridge

**Invocation**: MCP tool calls from within running Cursor agent

| Property | Detail |
|----------|--------|
| Fully headless | No — requires active Cursor agent session |
| Programmatic | Partial — structured tool calls |
| Use case | Extension of existing agent capabilities |

## Resolution Path

```txt
Blocker: @cursor/sdk not installed locally + CURSOR_API_KEY not set
         ↓
Step 1:  npm install @cursor/sdk
Step 2:  Set CURSOR_API_KEY in .env.runtime
Step 3:  Run: npm run runtime:headless-dry-run
         ↓
Result:  Fully headless ChatGPT → Cursor execution operational
```

## Architecture

```txt
ChatGPT
  ↓ instruction
Runtime Bridge Service
  ↓ structured payload
Headless Cursor Executor
  ↓ Agent.prompt() via @cursor/sdk
Cursor Agent (local runtime)
  ↓ file edits
federation-control repository
  ↓ build + verify
Runtime Verification Pipeline
```
