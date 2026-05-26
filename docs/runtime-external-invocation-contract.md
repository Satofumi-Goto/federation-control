# Runtime External Invocation Contract

Defines the contract for external callers (ChatGPT, MCP servers, CI pipelines) to invoke
the Federation Runtime execution pipeline through the governed tool surface.

---

## Invocation Schema

```json
{
  "toolId": "runtime-execute | runtime-dry-run | runtime-verify | runtime-deploy | runtime-governance | runtime-status | runtime-result",
  "permission": "dry-run | verify-only | execute-safe | execute-reviewed | execute-emergency",
  "payload": {
    "instruction": "string — the normalized Runtime instruction",
    "instructionId": "string — unique instruction identifier",
    "source": "chatgpt-runtime-bridge | mcp | ci | manual",
    "timestamp": "ISO 8601"
  },
  "options": {
    "dryRun": false,
    "skipPostExecution": false
  }
}
```

---

## Allowed Commands

| Tool ID | Permission Required | Description |
|---------|-------------------|-------------|
| `runtime-execute` | `execute-safe` | Execute governed prompt via `Agent.prompt()` |
| `runtime-dry-run` | `dry-run` | Simulate execution without `Agent.prompt()` |
| `runtime-verify` | `verify-only` | Run verification pipeline (topology, semantic, build) |
| `runtime-deploy` | `execute-reviewed` | Deploy Grafana dashboards (requires approval) |
| `runtime-governance` | `verify-only` | Evaluate governance policies |
| `runtime-status` | `dry-run` | Read orchestration state |
| `runtime-result` | `dry-run` | Read latest execution result |

---

## Forbidden Commands

The following operations are **unconditionally blocked** by the Runtime safety layer:

- `rm -rf` / destructive filesystem operations
- `git push --force` / force push to protected branches
- Credential exposure (`CURSOR_API_KEY`, `.env.runtime` contents)
- Runtime Registry deletion or replacement
- Canonical document replacement without governance approval
- Governance bypass or safety lock override
- Direct database operations
- Arbitrary shell execution outside governed entrypoints

---

## Governance Requirements

### Execute-level tools (`runtime-execute`, `runtime-deploy`)

1. **Pre-flight gates** must all pass:
   - Workspace binding to `federation-control`
   - Safety lock evaluation
   - `@cursor/sdk` installed and API key configured
   - Governance policy evaluation
   - Payload validation

2. **Governance pressure** must be below critical threshold (< 80/100).

3. **Instruction safety** validation — no forbidden patterns detected.

### Verify-level tools (`runtime-verify`, `runtime-governance`)

- No governance gate required
- Read-only operations

### Dry-run / status tools

- No governance gate required
- No side effects

---

## Safety Requirements

| Requirement | Enforced By |
|-------------|-------------|
| Workspace binding | `runtimeCursorWorkspaceBinding.mjs` |
| Payload validation | `runtimeInvocationSafetyLayer.mjs` |
| Instruction safety | `runtimeInvocationSafetyLayer.mjs` |
| Safety lock | `runtimeInvocationSafetyLock.mjs` |
| Loop prevention | `runtimeTriggerLoopSupervisor.mjs` |
| Governance policy | `runtimePolicyEngine.mjs` |
| Credential isolation | `runtimeCredentialResolver.mjs` |

---

## Verification Requirements

After any `runtime-execute` invocation:

1. Build verification: `node scripts/build-runtime-workspace-v2.mjs`
2. Auto-verification: `node scripts/runtime/runtimeAutoVerificationPipeline.mjs`
3. Topology verification: `node scripts/verify-runtime-topology-links.mjs`
4. Semantic verification: `node scripts/verify-federation-semantic.mjs`

---

## Approval Requirements

| Action | Approval Required |
|--------|-------------------|
| Dry-run | No |
| Verify | No |
| Execute (safe) | No — governed by safety lock |
| Execute (reviewed) | Yes — manual approval |
| Deploy | Yes — manual approval |
| Emergency execute | Bypasses normal approval, logged for audit |

---

## Response Schema

```json
{
  "ok": true,
  "toolId": "runtime-execute",
  "permission": "execute-safe",
  "result": {
    "status": "completed | blocked | failed | dry-run",
    "agentResult": { "status": "finished", "id": "run-..." },
    "postExecution": { "buildOk": true, "verifyOk": true },
    "governanceResult": { "passed": true },
    "safetyResult": { "decision": "proceed" }
  },
  "timestamp": "ISO 8601"
}
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| `PERMISSION_DENIED` | Caller permission insufficient for tool |
| `GOVERNANCE_BLOCKED` | Governance policy evaluation failed |
| `SAFETY_BLOCKED` | Safety lock blocked execution |
| `APPROVAL_REQUIRED` | Tool requires manual approval |
| `PAYLOAD_INVALID` | Invocation payload failed validation |
| `SDK_UNAVAILABLE` | `@cursor/sdk` not installed or API key missing |
| `EXECUTION_FAILED` | `Agent.prompt()` returned error |
| `GATEWAY_ERROR` | External execution gateway internal error |
