#!/usr/bin/env python3
"""
chatgpt_command_gateway.py

Federation Control — ChatGPT Command Gateway
Receives natural-language modification requests from Federation Portal and
dispatches them to OpenAI → federation-portal repo (build / commit / push).

Start:
  pip install fastapi uvicorn pydantic openai requests
  python api/chatgpt_command_gateway.py

Endpoint:
  POST /api/chatgpt-command
  POST /api/run-portal-inputs-repair  (included for single-server convenience)

Allowed targets:
  Satofumi-Goto/federation-portal only
"""

import subprocess
import sys
from pathlib import Path
from typing import Optional

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    import uvicorn
except ImportError:
    print("Missing dependencies. Run: pip install fastapi uvicorn pydantic", file=sys.stderr)
    sys.exit(1)

SCRIPTS_DIR = Path(__file__).parent.parent / "scripts"
PORTAL_COMMAND_SCRIPT = SCRIPTS_DIR / "run_chatgpt_portal_command.py"
REPAIR_SCRIPT = SCRIPTS_DIR / "fix_inputs_documents.py"

ALLOWED_REPOSITORY = "Satofumi-Goto/federation-portal"

CREATED_DOCUMENTS = [
    "docs/input-documents/autonomous-mobility-reference-data.md",
    "docs/input-documents/financial-assumptions-source.md",
    "docs/input-documents/blueprint-input-source.md",
]
UPDATED_FILES = ["src/components/federation/launcher/InputsSection.jsx"]

app = FastAPI(
    title="Federation Control — Command Gateway",
    version="2.0.0",
    description="URL-executable tool gateway for federation-portal modifications",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)


class ChatGptCommandRequest(BaseModel):
    targetRepository: str
    targetArea: Optional[str] = "federation-portal"
    request: str
    executionMode: str = "commit-push"


class RepairRequest(BaseModel):
    targetRepo: str
    build: bool = False
    commit: bool = False
    push: bool = False


@app.get("/")
def root():
    return {
        "status": "ok",
        "tools": [
            "POST /api/chatgpt-command",
            "POST /api/run-portal-inputs-repair",
        ],
    }


@app.post("/api/chatgpt-command")
def chatgpt_command(req: ChatGptCommandRequest):
    if req.targetRepository != ALLOWED_REPOSITORY:
        raise HTTPException(
            status_code=400,
            detail=(
                f"targetRepository '{req.targetRepository}' is not allowed. "
                f"Only '{ALLOWED_REPOSITORY}' is permitted."
            ),
        )

    if not PORTAL_COMMAND_SCRIPT.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Command script not found: {PORTAL_COMMAND_SCRIPT}",
        )

    cmd = [
        sys.executable,
        str(PORTAL_COMMAND_SCRIPT),
        "--request", req.request,
        "--execution-mode", req.executionMode,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

    if result.returncode != 0:
        stage = _infer_stage(req.executionMode, result.stderr or result.stdout)
        return {
            "ok": False,
            "error": (result.stderr or result.stdout).strip()[:1000],
            "stage": stage,
        }

    import json as _json
    try:
        payload = _json.loads(result.stdout)
    except Exception:
        payload = {"raw": result.stdout.strip()[:2000]}

    return {"ok": True, "targetRepository": req.targetRepository, **payload}


@app.post("/api/run-portal-inputs-repair")
def run_portal_inputs_repair(req: RepairRequest):
    repo = Path(req.targetRepo).resolve()
    if not repo.is_dir():
        return {"ok": False, "error": f"targetRepo not found: {repo}", "stage": "patch"}

    if not REPAIR_SCRIPT.exists():
        return {"ok": False, "error": f"repair script not found: {REPAIR_SCRIPT}", "stage": "patch"}

    cmd = [sys.executable, str(REPAIR_SCRIPT), "--repo", str(repo)]
    if req.build:
        cmd.append("--build")
    if req.commit:
        cmd.append("--commit")
    if req.push:
        cmd.append("--push")

    stage = "patch"
    if req.build:
        stage = "build"
    if req.commit:
        stage = "commit"
    if req.push:
        stage = "push"

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    if result.returncode != 0:
        return {
            "ok": False,
            "error": (result.stderr or result.stdout).strip(),
            "stage": stage,
        }

    commit_sha = None
    if req.commit:
        sha = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=str(repo),
            capture_output=True,
            text=True,
        )
        if sha.returncode == 0:
            commit_sha = sha.stdout.strip()

    return {
        "ok": True,
        "targetRepo": str(repo),
        "createdDocuments": CREATED_DOCUMENTS,
        "updatedFiles": UPDATED_FILES,
        "build": "success" if req.build else "skipped",
        "commitSha": commit_sha,
        "push": "success" if req.push else "skipped",
    }


def _infer_stage(execution_mode: str, output: str) -> str:
    out = (output or "").lower()
    if "openai" in out or "plan" in out:
        return "openai"
    if "build" in out or "npm" in out:
        return "build"
    if "commit" in out:
        return "commit"
    if "push" in out:
        return "push"
    if "workflow" in out or "dispatch" in out:
        return "github-workflow"
    return execution_mode


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
