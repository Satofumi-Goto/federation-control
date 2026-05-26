# ChatGPT Remote MCP Setup Guide

Step-by-step guide for connecting ChatGPT to the Federation Runtime
MCP Gateway as a remote MCP custom app.

---

## Prerequisites

Before starting, ensure:

- [ ] HTTP bridge passes readiness: `npm run runtime:remote-mcp-readiness` → ALL PASS
- [ ] `REMOTE_MCP_AUTH_TOKEN` is set in `.env.runtime`
- [ ] `CURSOR_API_KEY` is set in `.env.runtime`
- [ ] Tunnel tool is installed (`cloudflared`, `tailscale`, or `ngrok`)

---

## Step 1: Start the local HTTP bridge

```powershell
npm run runtime:mcp-http
```

Verify output shows:

```
[mcp-http] Listening on http://127.0.0.1:3100
```

Leave this terminal running.

---

## Step 2: Start the secure tunnel

Open a **new terminal** and run:

**Cloudflare Tunnel (recommended):**

```powershell
cloudflared tunnel --url http://localhost:3100
```

**Tailscale Funnel:**

```powershell
tailscale funnel 3100
```

Note the HTTPS URL printed by the tunnel (e.g. `https://xxxx.trycloudflare.com`).

---

## Step 3: Verify the remote endpoint

In a browser or with curl, test:

```bash
curl https://<TUNNEL_URL>/health
```

Expected response:

```json
{"ok": true, "service": "federation-runtime-mcp"}
```

---

## Step 4: Enable Developer Mode in ChatGPT

1. Open [chat.openai.com](https://chat.openai.com)
2. Go to **Settings** → **Developer** (or **Beta Features**)
3. Enable **Developer Mode** or **Plugins / Apps / MCP**

> The exact UI path may vary. Look for "Custom Apps", "MCP", or
> "Developer Tools" in ChatGPT settings.

---

## Step 5: Create Custom App / MCP App

1. Go to **Apps** (or **GPTs** → **Create**)
2. Select **Add MCP Server** or **Custom Tool / Action**
3. Enter the following:

| Field | Value |
|-------|-------|
| Name | Federation Runtime Gateway |
| Endpoint URL | `https://<TUNNEL_URL>/mcp/tools` |
| Auth Type | Bearer Token |
| Token | `<REMOTE_MCP_AUTH_TOKEN from .env.runtime>` |

4. Save the app configuration

---

## Step 6: Test runtime_status

In ChatGPT, ask:

> "Use the Federation Runtime Gateway to check the current runtime status."

Expected: ChatGPT calls `runtime_status` and returns orchestration state,
last session info, and tool count.

**If this fails**: check tunnel is running, auth token matches, endpoint URL is correct.

---

## Step 7: Test runtime_dry_run

Ask:

> "Use the Federation Runtime Gateway to dry-run a verification of the Runtime Registry."

Expected: ChatGPT calls `runtime_dry_run` and returns a simulation result
showing pre-flight gates and execution plan.

---

## Step 8: Test runtime_verify

Ask:

> "Use the Federation Runtime Gateway to verify Runtime topology and semantic consistency."

Expected: ChatGPT calls `runtime_verify` and returns topology and semantic
check results (both should be `ok: true`).

---

## Step 9: Test runtime_execute_safe (with caution)

Only after steps 6-8 pass. Ask:

> "Use the Federation Runtime Gateway to execute: Verify Runtime Registry
> consistency and confirm all dashboard routes are correct."

Expected: ChatGPT calls `runtime_execute_safe`, which:
1. Validates governance (must pass)
2. Checks safety lock (must be cleared)
3. Filters forbidden patterns (must pass)
4. Invokes `Agent.prompt()` via `@cursor/sdk`
5. Returns execution result

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| 401 Unauthorized | Check auth token matches `.env.runtime` |
| 403 Forbidden | Token is wrong, or request contains forbidden pattern |
| Connection refused | Tunnel is not running, or bridge is not started |
| TOOL_NOT_ALLOWED | You're trying to call a forbidden tool |
| GOVERNANCE_BLOCKED | Governance policy check failed |
| SAFETY_BLOCKED | Safety lock is in blocked state |
| FORBIDDEN_PATTERN | Instruction contains a blocked pattern |

---

## Shutdown

1. Stop the tunnel (Ctrl+C in tunnel terminal)
2. Stop the HTTP bridge (Ctrl+C in bridge terminal)
3. The remote endpoint becomes immediately unreachable
