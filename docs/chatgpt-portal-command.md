# ChatGPT Portal Command

Federation Control — tool that lets the Federation Portal Studio send a natural-language
modification request targeting the federation-portal repository.

---

## Architecture

```
Federation Portal (browser)
  └─ StudioSection.jsx  textarea + 実行 button
       └─ sendFederationPortalCommand(request)   [src/lib/federationChatGptCommandClient.js]
            └─ POST /api/chatgpt-command
                 └─ chatgpt_command_gateway.py   [federation-control API server]
                      └─ run_chatgpt_portal_command.py
                           ├─ OpenAI Responses API  → modification plan (JSON)
                           └─ executionMode:
                                draft          → return plan only
                                python-engine  → apply changes locally
                                github-workflow→ dispatch_portal_workflow.py → GitHub Actions
                                commit-push    → apply + npm build + git commit + push
```

## Allowed Target

`targetRepository` is locked to **`Satofumi-Goto/federation-portal`** only.
Requests targeting any other repository are rejected with HTTP 400.

---

## API

### POST /api/chatgpt-command

**Request:**
```json
{
  "targetRepository": "Satofumi-Goto/federation-portal",
  "targetArea": "federation-portal",
  "request": "Add a status badge to the Runtime tab header",
  "executionMode": "commit-push"
}
```

**Execution modes:**

| Mode | Description |
|------|-------------|
| `draft` | Returns OpenAI plan JSON without applying anything |
| `python-engine` | Applies file changes locally (no build / commit) |
| `github-workflow` | Dispatches GitHub Actions workflow via `dispatch_portal_workflow.py` |
| `commit-push` | Applies changes, `npm run build`, `git commit`, `git push` |

**Response (success):**
```json
{
  "ok": true,
  "targetRepository": "Satofumi-Goto/federation-portal",
  "summary": "Added status badge to Runtime tab header",
  "modifiedFiles": ["src/components/federation/launcher/InputsSection.jsx"],
  "commitSha": "a1b2c3d",
  "build": "success",
  "push": "success"
}
```

**Response (failure):**
```json
{
  "ok": false,
  "error": "npm run build failed: ...",
  "stage": "build | patch | openai | commit | push | github-workflow"
}
```

---

## Start API Server

```bash
pip install fastapi uvicorn pydantic openai requests
python api/chatgpt_command_gateway.py
# → http://0.0.0.0:8000
```

Both endpoints are served from the same process:
- `POST /api/chatgpt-command`
- `POST /api/run-portal-inputs-repair`

---

## Environment Variables (federation-control)

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | For openai modes | OpenAI API key |
| `GITHUB_TOKEN` | For github-workflow mode | PAT with `workflow` scope |

**API keys are never returned in API responses or printed in logs.**

---

## Environment Variables (federation-portal)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_FEDERATION_CONTROL_API_URL` | `http://localhost:8000` | Base URL of federation-control API |

---

## GitHub Actions Workflow

**File:** `.github/workflows/run-federation-portal-chatgpt-command.yml`

Triggered via `workflow_dispatch` with inputs:
- `request` — natural-language modification request (required)
- `execution_mode` — `draft` / `python-engine` / `commit-push` (default: `commit-push`)
- `portal_branch` — federation-portal branch (default: `main`)

**Required GitHub Secrets (in federation-control repo):**
- `OPENAI_API_KEY`
- `FEDERATION_PORTAL_TOKEN` — PAT with `contents:write` on federation-portal

**Commit message applied to federation-portal:**
```
feat: apply Federation Portal ChatGPT command
```

---

## Direct CLI

```bash
# Draft (plan only, no changes)
python scripts/run_chatgpt_portal_command.py \
  --request "Fix the status badge color in Inputs tab" \
  --execution-mode draft

# Apply locally and push
python scripts/run_chatgpt_portal_command.py \
  --request "Fix the status badge color in Inputs tab" \
  --execution-mode commit-push \
  --portal-path C:/GitHub/federation-portal

# Dispatch GitHub Actions
python scripts/dispatch_portal_workflow.py \
  --request "Fix the status badge color in Inputs tab" \
  --execution-mode commit-push \
  --portal-branch main
```

---

## Security

- `targetRepository` check: only `Satofumi-Goto/federation-portal` is allowed
- File path check in `run_chatgpt_portal_command.py`: only `src/`, `docs/`, `public/` may be written
- `OPENAI_API_KEY` and `GITHUB_TOKEN` are read from environment variables only — never from request body or logged
