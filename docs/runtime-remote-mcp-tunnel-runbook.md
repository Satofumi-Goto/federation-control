# Runtime Remote MCP Tunnel Runbook

Operational runbook for exposing the Federation Runtime MCP Gateway
to remote callers through a secure tunnel.

---

## Selected Tunnel Method

**Primary: Cloudflare Tunnel** (`cloudflared`)

Rationale: automatic HTTPS, Cloudflare Access for identity-based allowlisting,
ephemeral or named tunnel URLs, no inbound firewall rules, free tier.

**Fallback: Tailscale Funnel** (if both endpoints are on the same Tailnet).

---

## Architecture

```
Remote caller (ChatGPT / MCP client)
  ↓ HTTPS
Cloudflare edge (TLS termination)
  ↓ encrypted tunnel
cloudflared (local process)
  ↓ HTTP localhost:3100
runtimeMcpHttpBridge.mjs
  ↓ Bearer token auth
  ↓ Remote MCP policy filter
  ↓ Forbidden pattern filter
  ↓ Audit log
runtimeExternalExecutionGateway.mjs / runtimeHeadlessCursorExecutor.mjs
  ↓
@cursor/sdk Agent.prompt()
  ↓
Federation Runtime OS
```

---

## Prerequisites

| Requirement | How to install |
|-------------|---------------|
| Node.js >= 18 | Already installed |
| `@cursor/sdk` | `npm install` (already installed) |
| `@modelcontextprotocol/sdk` | `npm install` (already installed) |
| `cloudflared` | `winget install cloudflare.cloudflared` |
| `CURSOR_API_KEY` | Set in `.env.runtime` |
| `REMOTE_MCP_AUTH_TOKEN` | Set in `.env.runtime` |

---

## Setup Steps

### 1. Set auth token

Generate a secure random token:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env.runtime`:

```
REMOTE_MCP_AUTH_TOKEN=<generated token>
```

### 2. Install cloudflared

```powershell
winget install cloudflare.cloudflared
```

### 3. Start the HTTP bridge

```powershell
npm run runtime:mcp-http
```

This starts the HTTP bridge on `localhost:3100` with:
- Bearer token authentication
- Remote MCP policy enforcement
- Audit logging
- Only 4 allowed tools exposed

### 4. Start the tunnel

**Quick tunnel (ephemeral URL, no Cloudflare account required):**

```powershell
cloudflared tunnel --url http://localhost:3100
```

This prints a temporary `https://xxxx.trycloudflare.com` URL.

**Named tunnel (persistent, requires Cloudflare account):**

```powershell
cloudflared tunnel create federation-runtime
cloudflared tunnel route dns federation-runtime runtime-mcp.yourdomain.com
cloudflared tunnel run federation-runtime
```

### 5. Register the remote endpoint

In the MCP client (ChatGPT, etc.), configure:

```json
{
  "url": "https://<tunnel-url>/mcp",
  "headers": {
    "Authorization": "Bearer <REMOTE_MCP_AUTH_TOKEN>"
  }
}
```

---

## Stop / Shutdown

### Stop tunnel

```
Ctrl+C in the cloudflared terminal
```

Or:

```powershell
cloudflared tunnel cleanup
```

### Stop HTTP bridge

```
Ctrl+C in the npm run runtime:mcp-http terminal
```

### Emergency kill (both)

```powershell
Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*runtimeMcpHttpBridge*" } | Stop-Process -Force
```

---

## Local MCP Port

| Setting | Value |
|---------|-------|
| Protocol | HTTP (localhost only) |
| Host | `127.0.0.1` |
| Port | `3100` |
| Path | `/mcp/tools/list`, `/mcp/tools/call` |

HTTPS is provided by the tunnel, not by the local bridge.

---

## Remote Endpoint Format

| Component | Value |
|-----------|-------|
| Base URL | `https://<tunnel-url>` |
| List tools | `GET /mcp/tools/list` |
| Call tool | `POST /mcp/tools/call` |
| Auth header | `Authorization: Bearer <token>` |

---

## Authentication

- **Method**: Bearer token in `Authorization` header
- **Token source**: `REMOTE_MCP_AUTH_TOKEN` in `.env.runtime`
- **Missing auth**: `401 Unauthorized`
- **Invalid auth**: `403 Forbidden`
- **Token never logged**: Masked in all audit entries

---

## Rollback / Shutdown Procedure

1. Stop `cloudflared` (Ctrl+C or kill process)
2. Stop `runtimeMcpHttpBridge.mjs` (Ctrl+C)
3. Verify no tunnel is running: `cloudflared tunnel list`
4. Verify port is free: `netstat -an | findstr 3100`
5. Review audit log: `npm run runtime:remote-mcp-tunnel -- --audit`

---

## Security Checklist

- [ ] `REMOTE_MCP_AUTH_TOKEN` is set and not committed to git
- [ ] `.env.runtime` is in `.gitignore`
- [ ] Only 4 tools are exposed (status, dry-run, verify, execute-safe)
- [ ] Destructive tools are not exposed
- [ ] Bearer token auth is enforced on every request
- [ ] Unauthenticated requests return 401
- [ ] Forbidden patterns (credentials, force push, etc.) are rejected
- [ ] Secrets are masked in all responses and audit logs
- [ ] Governance checks pass before execution
- [ ] Safety lock is enforced
- [ ] Audit log records every remote call
- [ ] Tunnel uses HTTPS (never plain HTTP to the internet)
- [ ] Local bridge listens on 127.0.0.1 only (not 0.0.0.0)
