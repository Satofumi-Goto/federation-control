#!/usr/bin/env python3
"""
run_portal_inputs_repair.py

FastAPI HTTP endpoint that executes scripts/fix_inputs_documents.py
against a target federation-portal repository.

Start:
  pip install fastapi uvicorn
  python api/run_portal_inputs_repair.py

Or via uvicorn:
  uvicorn api.run_portal_inputs_repair:app --host 0.0.0.0 --port 8000

Endpoint:
  POST /api/run-portal-inputs-repair
"""

import subprocess
import sys
from pathlib import Path

try:
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    import uvicorn
except ImportError:
    print("Missing dependencies. Run: pip install fastapi uvicorn pydantic", file=sys.stderr)
    sys.exit(1)

SCRIPTS_DIR = Path(__file__).parent.parent / "scripts"
REPAIR_SCRIPT = SCRIPTS_DIR / "fix_inputs_documents.py"

CREATED_DOCUMENTS = [
    "docs/input-documents/autonomous-mobility-reference-data.md",
    "docs/input-documents/financial-assumptions-source.md",
    "docs/input-documents/blueprint-input-source.md",
]

UPDATED_FILES = [
    "src/components/federation/launcher/InputsSection.jsx",
]

app = FastAPI(title="Federation Control — Tool Runner", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


class RepairRequest(BaseModel):
    targetRepo: str
    build: bool = False
    commit: bool = False
    push: bool = False


@app.get("/")
def root():
    return {"status": "ok", "tools": ["POST /api/run-portal-inputs-repair"]}


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

    # Determine failure stage for diagnostics
    stage = "patch"
    if req.build:
        stage = "build"
    if req.commit:
        stage = "commit"
    if req.push:
        stage = "push"

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        return {
            "ok": False,
            "error": (result.stderr or result.stdout).strip(),
            "stage": stage,
        }

    # Resolve commit SHA if commit was requested
    commit_sha = None
    if req.commit:
        sha_result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=str(repo),
            capture_output=True,
            text=True,
        )
        if sha_result.returncode == 0:
            commit_sha = sha_result.stdout.strip()

    return {
        "ok": True,
        "targetRepo": str(repo),
        "createdDocuments": CREATED_DOCUMENTS,
        "updatedFiles": UPDATED_FILES,
        "build": "success" if req.build else "skipped",
        "commitSha": commit_sha,
        "push": "success" if req.push else "skipped",
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
