# Federation Control — Tool Registry

Tools registered for URL-executable execution via `POST /api/*`.

---

## Portal Inputs Repair

| Field | Value |
|-------|-------|
| **Tool Name** | Portal Inputs Repair |
| **Endpoint** | `POST /api/run-portal-inputs-repair` |
| **Script** | `scripts/fix_inputs_documents.py` |
| **Target** | federation-portal |
| **API Server** | `python api/run_portal_inputs_repair.py` |

### Purpose

Repairs Federation Portal `Inputs` section:

- Creates `docs/input-documents/autonomous-mobility-reference-data.md`
- Creates `docs/input-documents/financial-assumptions-source.md`
- Creates `docs/input-documents/blueprint-input-source.md`
- Rewrites `src/components/federation/launcher/InputsSection.jsx`
  - Removes `LEDGER_ENTRIES` flat list
  - Adds `INPUT_DOCUMENTS` with clickable document cards
  - Adds `DOCUMENT PREVIEW` panel (switches on card click)
  - Adds `CONNECTED_SOURCES` panel (Repository Index / Knowledge Vault / Federation Control)

### Start API Server

```bash
pip install fastapi uvicorn pydantic
python api/run_portal_inputs_repair.py
# → listening on http://0.0.0.0:8000
```

### Request

```http
POST http://localhost:8000/api/run-portal-inputs-repair
Content-Type: application/json

{
  "targetRepo": "C:\\GitHub\\federation-portal",
  "build": true,
  "commit": true,
  "push": true
}
```

### Response (success)

```json
{
  "ok": true,
  "targetRepo": "C:\\GitHub\\federation-portal",
  "createdDocuments": [
    "docs/input-documents/autonomous-mobility-reference-data.md",
    "docs/input-documents/financial-assumptions-source.md",
    "docs/input-documents/blueprint-input-source.md"
  ],
  "updatedFiles": [
    "src/components/federation/launcher/InputsSection.jsx"
  ],
  "build": "success",
  "commitSha": "...",
  "push": "success"
}
```

### Response (failure)

```json
{
  "ok": false,
  "error": "...",
  "stage": "build | patch | commit | push"
}
```

### CLI (direct)

```bash
python scripts/fix_inputs_documents.py \
  --repo C:/GitHub/federation-portal \
  --build --commit --push
```

---

## ChatGPT Portal Command

| Field | Value |
|-------|-------|
| **Tool Name** | ChatGPT Portal Command |
| **Endpoint** | `POST /api/chatgpt-command` |
| **Script** | `scripts/run_chatgpt_portal_command.py` |
| **Dispatch** | `scripts/dispatch_portal_workflow.py` |
| **Target** | federation-portal (fixed — `Satofumi-Goto/federation-portal` only) |
| **API Server** | `python api/chatgpt_command_gateway.py` |
| **Workflow** | `.github/workflows/run-federation-portal-chatgpt-command.yml` |

### Purpose

Receives natural-language modification requests from Federation Portal Studio,
calls OpenAI to generate a file-level patch, and applies it to federation-portal
(build / commit / push). See `docs/chatgpt-portal-command.md` for full details.

### Request

```json
{
  "targetRepository": "Satofumi-Goto/federation-portal",
  "targetArea": "federation-portal",
  "request": "...",
  "executionMode": "draft | python-engine | github-workflow | commit-push"
}
```

### Response (success)

```json
{
  "ok": true,
  "summary": "...",
  "modifiedFiles": ["..."],
  "commitSha": "...",
  "build": "success",
  "push": "success"
}
```

### Security constraints

- `targetRepository` locked to `Satofumi-Goto/federation-portal`
- File writes restricted to `src/`, `docs/`, `public/`
- `OPENAI_API_KEY` and `GITHUB_TOKEN` from env only — never logged

---

## Adding New Tools

To register a new URL-executable tool:

1. Add the implementation script to `scripts/`
2. Add an endpoint handler to `api/run_portal_inputs_repair.py` (or a new file)
3. Register it in this document with the same table format
