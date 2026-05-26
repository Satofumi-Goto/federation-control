# Runtime Remote MCP Exposure Options

Comparison of tunnel options for exposing the Federation Runtime MCP Gateway
to remote callers (ChatGPT, external MCP clients).

---

## Requirements

| Requirement | Priority |
|-------------|----------|
| Authenticated access | Required |
| HTTPS encryption | Required |
| Allowlisted callers | Recommended |
| No raw local port exposure | Required |
| Easy shutdown / kill switch | Required |
| No persistent public URL | Recommended |
| Audit trail integration | Required |

---

## Option Comparison

### 1. Cloudflare Tunnel (RECOMMENDED)

| Aspect | Detail |
|--------|--------|
| Install | `winget install cloudflare.cloudflared` |
| Run | `cloudflared tunnel --url http://localhost:3100` |
| Auth | Cloudflare Access (SSO, email OTP, allowlist) |
| HTTPS | Automatic via Cloudflare edge |
| Allowlist | Yes, via Cloudflare Access policies |
| Shutdown | Ctrl+C or `cloudflared tunnel cleanup` |
| Cost | Free tier available |
| Stability | Production-grade |

**Why recommended**: Cloudflare Tunnel provides the strongest combination of
authentication, encryption, and access control. Quick tunnels generate
ephemeral URLs; named tunnels integrate with Cloudflare Access for identity-based
allowlisting. No inbound firewall rules needed.

### 2. Tailscale Funnel (RECOMMENDED for private networks)

| Aspect | Detail |
|--------|--------|
| Install | `winget install tailscale.tailscale` |
| Run | `tailscale funnel 3100` |
| Auth | Tailscale identity (WireGuard mesh) |
| HTTPS | Automatic via Tailscale |
| Allowlist | Tailnet membership = access control |
| Shutdown | `tailscale funnel --reset` |
| Cost | Free for personal (up to 3 users) |
| Stability | Production-grade |

**Why recommended**: Ideal if the caller is also on the same Tailnet. Built-in
identity and encryption via WireGuard. No public URL exposure unless Funnel
is explicitly enabled for external callers.

### 3. ngrok

| Aspect | Detail |
|--------|--------|
| Install | `winget install ngrok.ngrok` |
| Run | `ngrok http 3100` |
| Auth | ngrok auth token; IP/OAuth allowlist on paid plans |
| HTTPS | Automatic |
| Allowlist | Paid plans only |
| Shutdown | Ctrl+C |
| Cost | Free tier (limited); paid for auth features |
| Stability | Good |

**Caution**: Free-tier ngrok provides an unauthenticated public URL. This
violates the remote MCP policy (`forbidOpenPublicExposure: true`). Only use
ngrok with paid-tier IP allowlisting or OAuth gateway enabled.

### 4. localhost.run

| Aspect | Detail |
|--------|--------|
| Install | None (uses SSH) |
| Run | `ssh -R 80:localhost:3100 nokey@localhost.run` |
| Auth | None (public URL) |
| HTTPS | Yes |
| Allowlist | No |
| Shutdown | Close SSH session |
| Cost | Free |
| Stability | Best-effort |

**Not recommended**: No authentication. Public URL is exposed. Acceptable
only for temporary one-off testing behind additional application-layer auth.

### 5. Custom HTTPS Reverse Proxy

| Aspect | Detail |
|--------|--------|
| Setup | nginx/caddy + Let's Encrypt + firewall rules |
| Auth | Custom (Basic Auth, mTLS, API key header) |
| HTTPS | Via reverse proxy |
| Allowlist | Firewall rules / nginx allow directives |
| Shutdown | Stop proxy service |
| Cost | Hosting cost |
| Stability | Depends on setup |

**For advanced users**: Full control over auth and access. Recommended only
when running the Runtime on a persistent server.

---

## Recommendation

**Primary: Cloudflare Tunnel** — best balance of security, ease of use, and
zero-trust access control via Cloudflare Access.

**Secondary: Tailscale Funnel** — best for private/internal use where both
the Runtime host and the caller are on the same Tailnet.

**Avoid**: localhost.run and free-tier ngrok for anything beyond ephemeral testing.

---

## MCP Transport Note

The current MCP gateway uses **stdio transport** (JSON-RPC over stdin/stdout).
This is the standard model for local MCP clients (Cursor, Claude Desktop) where
the client spawns the server as a subprocess.

For **remote** access, the MCP protocol supports **Streamable HTTP** transport.
To expose the Runtime gateway remotely:

1. Wrap `mcp/runtime-gateway-server.mjs` with an HTTP adapter
   (Express + `@modelcontextprotocol/sdk` Streamable HTTP transport)
2. Listen on `localhost:3100`
3. Tunnel that port via Cloudflare Tunnel / Tailscale Funnel

The local stdio interface remains available for direct Cursor MCP connections.
