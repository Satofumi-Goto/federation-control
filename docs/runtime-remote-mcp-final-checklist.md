# Runtime Remote MCP — Final Connection Checklist

Use this checklist to confirm every layer is operational before
registering the Federation Runtime as a ChatGPT custom MCP app.

---

## Infrastructure

| # | Check | Command | Expected |
|---|-------|---------|----------|
| 1 | Local MCP gateway | `npm run runtime:mcp-test` | 9/9 PASS |
| 2 | Tool exposure layer | `npm run runtime:tool-validation` | 17/17 PASS |
| 3 | Headless executor | `npm run runtime:headless-check` | 0 blockers |
| 4 | HTTP bridge | `npm run runtime:remote-mcp-readiness` | 11/11 PASS |
| 5 | Remote policy | `npm run runtime:remote-mcp-policy` | 20/20 PASS |
| 6 | Endpoint manifest | `npm run runtime:remote-mcp-endpoint-validate` | ALL PASS |

## Authentication

| # | Check | How to verify |
|---|-------|---------------|
| 7 | `CURSOR_API_KEY` set | Present in `.env.runtime` |
| 8 | `REMOTE_MCP_AUTH_TOKEN` set | Present in `.env.runtime` (>= 16 chars) |
| 9 | `.env.runtime` gitignored | `git check-ignore .env.runtime` returns the path |

## Tunnel

| # | Check | How to verify |
|---|-------|---------------|
| 10 | Tunnel tool installed | `cloudflared --version` or `tailscale version` |
| 11 | HTTP bridge running | `npm run runtime:mcp-http` shows "Listening on 127.0.0.1:3100" |
| 12 | Tunnel running | `cloudflared tunnel --url http://localhost:3100` shows HTTPS URL |
| 13 | Health endpoint reachable | `curl https://<TUNNEL_URL>/health` returns `{"ok": true}` |
| 14 | Endpoint is HTTPS | URL starts with `https://` |

## ChatGPT Registration

| # | Check | How to verify |
|---|-------|---------------|
| 15 | ChatGPT custom app created | App appears in ChatGPT Apps list |
| 16 | `runtime_status` works | Ask ChatGPT to check runtime status |
| 17 | `runtime_dry_run` works | Ask ChatGPT to dry-run a verification |
| 18 | `runtime_verify` works | Ask ChatGPT to verify topology and semantics |
| 19 | `runtime_execute_safe` works | Ask ChatGPT to execute a safe instruction |

## Safety

| # | Check | How to verify |
|---|-------|---------------|
| 20 | Destructive tools not exposed | `runtime_deploy` etc. return TOOL_NOT_ALLOWED |
| 21 | Unauthenticated requests rejected | Request without token returns 401 |
| 22 | Credential exposure blocked | Instruction with "CURSOR_API_KEY" returns FORBIDDEN_PATTERN |
| 23 | Force push blocked | Instruction with "git push --force" returns FORBIDDEN_PATTERN |
| 24 | Governance bypass blocked | Instruction with "bypass governance" returns FORBIDDEN_PATTERN |
| 25 | Audit log recording | `runtime_data/runtime-remote-mcp-audit-log.json` has entries |

---

## Completion Status

When all 25 checks pass, the Federation Runtime is fully connected
to ChatGPT as a governed remote MCP app.

```
ChatGPT → Remote MCP → Secure Tunnel → HTTP Bridge → Governance → Safety → Agent.prompt() → Federation Runtime OS
```
