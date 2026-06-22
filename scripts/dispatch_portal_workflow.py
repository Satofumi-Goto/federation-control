#!/usr/bin/env python3
"""
dispatch_portal_workflow.py

Dispatches the GitHub Actions workflow_dispatch event for the
federation-portal ChatGPT command workflow in federation-control.

Usage:
  python scripts/dispatch_portal_workflow.py \
    --request "Add loading spinner to Inputs tab" \
    --execution-mode commit-push \
    --portal-branch main

Environment variables:
  GITHUB_TOKEN   Personal Access Token with workflow scope (required)

Output (stdout, JSON):
  { "workflowRunId": null, "workflowUrl": "...", "dispatchedAt": "..." }
  Workflow run ID is not available immediately after dispatch; poll via
  GitHub API /repos/{owner}/{repo}/actions/runs if needed.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    print("Missing requests package. Run: pip install requests", file=sys.stderr)
    sys.exit(1)

CONTROL_OWNER = "Satofumi-Goto"
CONTROL_REPO = "federation-control"
WORKFLOW_FILE = "run-federation-portal-chatgpt-command.yml"
GITHUB_API = "https://api.github.com"


def dispatch(request: str, execution_mode: str, portal_branch: str, ref: str = "main") -> dict:
    token = os.environ.get("GITHUB_TOKEN", "")
    if not token:
        raise RuntimeError("GITHUB_TOKEN environment variable is not set")

    url = (
        f"{GITHUB_API}/repos/{CONTROL_OWNER}/{CONTROL_REPO}"
        f"/actions/workflows/{WORKFLOW_FILE}/dispatches"
    )
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    payload = {
        "ref": ref,
        "inputs": {
            "request": request,
            "execution_mode": execution_mode,
            "portal_branch": portal_branch,
        },
    }

    resp = requests.post(url, json=payload, headers=headers, timeout=30)
    if resp.status_code not in (200, 204):
        raise RuntimeError(
            f"GitHub API returned {resp.status_code}: {resp.text[:500]}"
        )

    dispatched_at = datetime.now(timezone.utc).isoformat()
    workflow_url = (
        f"https://github.com/{CONTROL_OWNER}/{CONTROL_REPO}"
        f"/actions/workflows/{WORKFLOW_FILE}"
    )
    return {
        "workflowRunId": None,
        "workflowUrl": workflow_url,
        "dispatchedAt": dispatched_at,
        "ref": ref,
    }


def main():
    parser = argparse.ArgumentParser(description="Dispatch federation-portal ChatGPT workflow")
    parser.add_argument("--request", required=True)
    parser.add_argument("--execution-mode", default="commit-push")
    parser.add_argument("--portal-branch", default="main")
    parser.add_argument("--ref", default="main", help="federation-control branch to run on")
    args = parser.parse_args()

    try:
        result = dispatch(args.request, args.execution_mode, args.portal_branch, args.ref)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e), "stage": "github-workflow"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
