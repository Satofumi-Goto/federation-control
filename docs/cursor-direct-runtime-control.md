# Cursor Direct Runtime Control — Design Document

**Date**: 2026-05-26
**Repository**: federation-control
**Purpose**: Enable direct ChatGPT → Cursor Agent invocation without manual copy/paste

---

## 1. Candidate Architectures

### A. Cursor CLI — Headless Non-Interactive Mode

**Mechanism**: The `agent` CLI binary (also aliased as `cursor-agent`) supports `--print` mode for non-interactive, scriptable execution with full workspace tool access.

**Command example**:
```bash
agent -p --force --workspace /path/to/federation-control \
  "$(cat .cursor/tasks/chatgpt-runtime-inbox.md)"
```

**Capabilities**:
- Full file read/write (with `--force` / `--yolo`)
- Shell command execution
- Git operations
- MCP server access
- Structured output (`--output-format json`)
- Resume previous sessions (`--resume <id>`)
- Worktree isolation (`--worktree`)
- Mode selection (`--mode agent|plan|ask`)

**Maturity**: Production (GA since 2025, CLI v1.x stable)
**Platform**: macOS, Linux, WSL. Windows native support via `agent.exe`.

---

### B. Cursor SDK — `@cursor/sdk` (TypeScript)

**Mechanism**: NPM package that embeds the Cursor agent runtime directly in a Node.js process. Agents run locally against `cwd` or remotely on Cursor Cloud VMs.

**API**:
```typescript
import { Agent } from "@cursor/sdk";

const result = await Agent.prompt(
  "Implement the instruction from .cursor/tasks/chatgpt-runtime-inbox.md",
  {
    apiKey: process.env.CURSOR_API_KEY!,
    model: { id: "composer-2.5" },
    local: { cwd: "/path/to/federation-control" },
  }
);
```

**Capabilities**:
- Full workspace file access (local runtime)
- Shell command execution
- Git operations
- MCP servers (inline or from project config)
- Streaming events (`run.stream()`)
- Multi-turn conversations (`agent.send()`)
- Session resume (`Agent.resume()`)
- Model selection (`Cursor.models.list()`)

**Maturity**: Public beta (released April 29, 2026, v1.0.13 as of May 2026)
**Known limitation**: Project skills (`.cursor/skills/`) may not load in SDK local runtime (known bug report). Project rules (`.cursor/rules/`) load via `settingSources: ["project"]`.

---

### C. Cursor SDK — `cursor-sdk` (Python)

**Mechanism**: Python equivalent of the TypeScript SDK, same agent model.

**API**:
```python
from cursor_sdk import Agent, AgentOptions, LocalAgentOptions

result = Agent.prompt(
    "Execute instruction from inbox",
    AgentOptions(
        api_key=os.environ["CURSOR_API_KEY"],
        model="composer-2.5",
        local=LocalAgentOptions(cwd="/path/to/federation-control"),
    ),
)
```

**Maturity**: Public beta (same timeline as TypeScript SDK)
**Note**: This repo is TypeScript/Node.js; Python adds unnecessary dependency.

---

### D. ACP (Agent Client Protocol) — JSON-RPC over stdio

**Mechanism**: `agent acp` starts the CLI as a JSON-RPC server communicating over stdin/stdout. Custom clients send `session/new`, `session/prompt`, and handle `session/update` notifications.

**Use case**: Building custom editors, IDE integrations, or persistent daemons that multiplex agent sessions.

**Capabilities**: Same as CLI (full tool access) but with programmatic control flow.

**Maturity**: Advanced/hidden command. Stable protocol but intended for editor integrations.

---

### E. Cloud Agents REST API

**Mechanism**: HTTP API at `https://api.cursor.com/v1/agents/*` for spawning agents on Cursor-hosted VMs against cloned GitHub repos.

**Capabilities**:
- Auto-clone repository
- Full agent execution
- Auto-create PRs (`autoCreatePR: true`)
- No local machine required

**Limitations**: Operates on a fresh clone, not the local working tree. Cannot access local state (localStorage concepts, local build artifacts).

---

### F. File-Watcher Hook + Cursor IDE

**Mechanism**: A file-system watcher detects changes to `chatgpt-runtime-agent-prompt.md` and triggers Cursor IDE to open/read the file.

**Limitations**: Cursor IDE does not support external trigger of agent execution via file events. No hook mechanism exists to automatically start an agent session from a file change.

**Verdict**: Not feasible without additional middleware.

---

### G. WebSocket / Local Daemon

**Mechanism**: No official Cursor WebSocket or daemon API exists for external connections.

**Verdict**: Not available.

---

### H. VSCode Extension Host API

**Mechanism**: Cursor is a VS Code fork. Extensions can use `vscode.commands.executeCommand()` but Cursor's agent is not exposed through the standard extension API.

**Verdict**: Not viable for external invocation.

---

## 2. Recommended Architecture

### Primary: Cursor CLI Headless Mode (`agent -p --force`)

**Why**:
- Most mature and stable mechanism
- Full tool access (files, shell, git)
- Direct workspace operation against local working tree
- Structured JSON output for programmatic parsing
- No beta API surface — production CLI
- Works on all platforms
- Simple integration: one shell command

### Secondary (future): Cursor SDK (`@cursor/sdk`)

**Why SDK as secondary**:
- More granular control (streaming, multi-turn, MCP inline)
- Embeds in Node.js process (no external binary dependency)
- Better error handling (`CursorAgentError` vs exit codes)
- But: public beta, skills loading bug, heavier dependency

### Recommended Flow

```
ChatGPT produces instruction
↓
Write to .cursor/tasks/chatgpt-runtime-inbox.md
↓
npm run chatgpt:runtime-agent-prompt
  (safety gates validate)
↓
npm run chatgpt:cursor-exec
  (invokes: agent -p --force --workspace . <prompt>)
↓
Cursor Agent executes against federation-control
↓
Build + verify + report
```

---

## 3. Security Implications

| Concern | Mitigation |
|---------|------------|
| API key exposure | Store `CURSOR_API_KEY` in environment variable only, never in committed files |
| Arbitrary code execution | `--force` enables file writes; safety gates in bridge script pre-validate instruction content |
| Forbidden patterns | Bridge rejects `window.location`, `window.open`, `viewPanel=401`, Registry removal |
| Cross-repo access | Bridge validates repo identity before prompt generation |
| Credential leaks | `.gitignore` must exclude `.env`, `credentials.json`; bridge does not commit secrets |
| Unattended execution | All changes are local until explicit `git push`; no auto-deploy without user instruction |

---

## 4. Required Local Services

| Service | Status | Required Action |
|---------|--------|----------------|
| Cursor CLI (`agent` binary) | **NOT INSTALLED** | Install via `curl https://cursor.com/install -fsS \| bash` or Windows installer |
| Node.js (>= 18) | Installed | None |
| Git | Installed | None |
| Cursor API Key | **NOT SET** | Generate at cursor.com/dashboard/integrations, set `CURSOR_API_KEY` env var |
| Cursor subscription | Required | Active Cursor Pro/Business subscription needed |

---

## 5. Required Ports / Processes

| Component | Port/Process | Notes |
|-----------|-------------|-------|
| Cursor CLI | No port — runs as CLI process | Spawned per invocation, exits when done |
| Cursor SDK (if used) | Spawns local executor subprocess | Auto-managed, cleaned up on dispose |
| ACP mode (if used) | stdio pipes | No network port |
| API calls | HTTPS to `api2.cursor.sh` | Outbound only, no inbound listener needed |

---

## 6. Required Auth / Session Handling

1. **One-time authentication**: Run `agent login` to authenticate with Cursor account
2. **API Key for scripts**: Set `CURSOR_API_KEY` environment variable
3. **Session persistence**: CLI supports `--resume <thread-id>` and `agent ls` to list past sessions
4. **No OAuth flow required**: API key is sufficient for headless execution

---

## 7. Required Cursor Settings

No special Cursor IDE settings needed for CLI invocation. The CLI operates independently of the IDE.

For SDK local runtime with project rules:
```typescript
local: {
  cwd: "/path/to/federation-control",
  settingSources: ["project"],  // loads .cursor/rules/
}
```

---

## 8. Required MCP Configuration

The bridge script and Cursor Agent already share the workspace. No additional MCP configuration is required for the CLI approach.

For SDK with inline MCP servers:
```typescript
mcpServers: [{
  name: "user-filesystem",
  transport: { type: "stdio", command: "...", args: [...] },
}]
```

---

## 9. Required CLI Tooling

| Tool | Install Command | Purpose |
|------|----------------|---------|
| `agent` (Cursor CLI) | `curl https://cursor.com/install -fsS \| bash` | Headless agent execution |
| `@cursor/sdk` (optional) | `npm install @cursor/sdk` | Programmatic SDK integration |

---

## 10. Implementation Steps

### Phase 1 — CLI Setup (this document) ✅
- [x] Investigate available mechanisms
- [x] Select recommended architecture
- [x] Document security, auth, ports, settings
- [x] Create design document

### Phase 2 — Cursor CLI Installation & Auth
- [ ] Install Cursor CLI (`agent` binary) on local machine
- [ ] Run `agent login` to authenticate
- [ ] Set `CURSOR_API_KEY` in environment
- [ ] Verify with `agent status` / `agent about`
- [ ] Test: `agent -p --mode=ask "What repo is this?" --workspace .`

### Phase 3 — Bridge Script Extension
- [ ] Add `chatgpt:cursor-exec` npm script
- [ ] Bridge generates prompt, then spawns `agent -p --force`
- [ ] Capture structured JSON output
- [ ] Parse result: build status, verification status, file changes
- [ ] Write execution report to `.cursor/tasks/chatgpt-runtime-exec-report.md`

### Phase 4 — End-to-End Validation
- [ ] Write test instruction to inbox
- [ ] Run `npm run chatgpt:cursor-exec`
- [ ] Verify agent executes: build, verify, report
- [ ] Verify safety gates block forbidden instructions
- [ ] Verify no unintended file modifications

### Phase 5 — SDK Integration (optional, future)
- [ ] Install `@cursor/sdk`
- [ ] Create `scripts/chatgpt-cursor-sdk-bridge.mjs`
- [ ] Implement `Agent.prompt()` with local runtime
- [ ] Compare reliability vs CLI approach
- [ ] Decide on primary mechanism

---

## 11. Blockers

| Blocker | Severity | Resolution |
|---------|----------|------------|
| Cursor CLI not installed on this machine | **Critical** | User must install CLI |
| `CURSOR_API_KEY` not set | **Critical** | User must generate and set API key |
| Windows path handling for CLI | Medium | CLI supports Windows; verify with test |
| CLI `--force` enables unreviewed writes | Low | Safety gates in bridge pre-validate; CLI operates on local only |

---

## 12. Estimated Remaining Steps After Phase 1

| Step | Description | Effort |
|------|-------------|--------|
| 1 | Install Cursor CLI | 5 min |
| 2 | Authenticate (`agent login`) | 2 min |
| 3 | Set `CURSOR_API_KEY` | 2 min |
| 4 | Test CLI connectivity | 5 min |
| 5 | Extend bridge with `--cursor-exec` mode | 30 min |
| 6 | End-to-end test | 15 min |
| **Total** | | **~60 min** |

---

## 13. Capability Confirmation

Can Cursor expose these through an external callable interface?

| Capability | CLI (`agent -p`) | SDK (`@cursor/sdk`) | Cloud API |
|------------|:---:|:---:|:---:|
| Local workspace write | ✅ | ✅ | ❌ (clone only) |
| Build execution (`node scripts/...`) | ✅ | ✅ | ✅ |
| Verification execution | ✅ | ✅ | ✅ |
| Git commit/push | ✅ | ✅ | ✅ (auto-PR) |
| Deploy execution | ✅ | ✅ | ✅ |

---

## 14. Summary

| Question | Answer |
|----------|--------|
| Feasible? | **Yes** — both CLI and SDK support direct programmatic invocation |
| Recommended architecture | **Cursor CLI headless mode** (`agent -p --force`) |
| Exact remaining steps | **6 steps** (~60 minutes of work) |
| Next implementation phase | Phase 2: Install CLI, authenticate, test connectivity |
| Can ChatGPT eventually control Cursor directly? | **Yes** — via CLI spawning or SDK `Agent.prompt()`, ChatGPT can write instruction → bridge validates → Cursor Agent executes against federation-control workspace with full file/shell/git access |
