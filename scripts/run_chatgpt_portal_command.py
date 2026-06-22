#!/usr/bin/env python3
"""
run_chatgpt_portal_command.py

Executes a natural-language modification request against federation-portal.

Steps:
  1. Call OpenAI Responses API to generate a JSON modification plan
  2. Validate target repo is federation-portal
  3. Apply plan based on executionMode:
     - draft            → print plan JSON and exit
     - python-engine    → apply changes locally (no build/commit)
     - github-workflow  → dispatch GitHub Actions workflow
     - commit-push      → apply changes, npm build, git commit, git push

Usage (local):
  python scripts/run_chatgpt_portal_command.py \
    --request "Add a loading spinner to the Inputs tab" \
    --execution-mode commit-push \
    --portal-path C:/GitHub/federation-portal

Usage (CI — called by GitHub Actions):
  python scripts/run_chatgpt_portal_command.py \
    --request "$REQUEST" \
    --execution-mode commit-push \
    --portal-path /workspace/federation-portal

Environment variables:
  OPENAI_API_KEY   (required for openai modes)
  GITHUB_TOKEN     (required for github-workflow mode)
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


PORTAL_REPO = "Satofumi-Goto/federation-portal"
COMMIT_MESSAGE = "feat: apply Federation Portal ChatGPT command"

SYSTEM_PROMPT = """\
You are a precise code-modification assistant for a React + Vite application called Federation Portal.
Given a natural-language modification request, produce a JSON response describing exactly which files
to create, update, or delete.

Rules:
- Only modify files under src/, public/, or docs/ — never package.json, vite.config.*, or CI files.
- Keep changes minimal and targeted. Do not reformat unrelated code.
- Preserve all existing UI components, menu items, and layouts unless explicitly told to change them.
- Never add new top-level menu items to FederationPortal.jsx unless explicitly asked.
- Output ONLY valid JSON — no markdown, no commentary.

Response format:
{
  "summary": "<one-line description of changes>",
  "files": [
    {
      "path": "src/...",
      "action": "create" | "update" | "delete",
      "content": "<full file content as a string, or null for delete>"
    }
  ]
}
"""


def call_openai(request: str) -> dict:
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY environment variable is not set")

    try:
        import openai
        client = openai.OpenAI(api_key=api_key)

        # Prefer Responses API; fall back to Chat Completions
        if hasattr(client, "responses"):
            resp = client.responses.create(
                model="gpt-4o",
                instructions=SYSTEM_PROMPT,
                input=request,
            )
            raw = resp.output_text if hasattr(resp, "output_text") else resp.output[0].content[0].text
        else:
            resp = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": request},
                ],
                response_format={"type": "json_object"},
            )
            raw = resp.choices[0].message.content

        return json.loads(raw)

    except ImportError:
        raise RuntimeError("openai package not installed. Run: pip install openai")


def apply_plan(plan: dict, portal_path: Path) -> list[str]:
    modified = []
    for file_entry in plan.get("files", []):
        rel_path = file_entry.get("path", "")
        action = file_entry.get("action", "update")
        content = file_entry.get("content")

        # Security: only allow src/, docs/, public/
        if not (
            rel_path.startswith("src/")
            or rel_path.startswith("docs/")
            or rel_path.startswith("public/")
        ):
            print(f"[skip] blocked path: {rel_path}", file=sys.stderr)
            continue

        target = portal_path / rel_path

        if action == "delete":
            if target.exists():
                target.unlink()
                modified.append(rel_path)
        else:
            if content is None:
                print(f"[skip] no content for {rel_path}", file=sys.stderr)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
            modified.append(rel_path)

    return modified


def run_npm_build(portal_path: Path):
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=str(portal_path),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"npm run build failed:\n{result.stderr or result.stdout}")


def git_commit_push(portal_path: Path) -> str:
    def git(args):
        r = subprocess.run(
            ["git"] + args,
            cwd=str(portal_path),
            capture_output=True,
            text=True,
        )
        if r.returncode != 0:
            raise RuntimeError(f"git {' '.join(args)} failed: {r.stderr or r.stdout}")
        return r.stdout.strip()

    git(["add", "-A"])

    status = subprocess.run(
        ["git", "diff", "--cached", "--quiet"],
        cwd=str(portal_path),
    )
    if status.returncode == 0:
        return git(["rev-parse", "HEAD"])

    git(["commit", "-m", COMMIT_MESSAGE])
    git(["push"])
    return git(["rev-parse", "HEAD"])


def dispatch_workflow(request: str, execution_mode: str, portal_branch: str):
    dispatch_script = Path(__file__).parent / "dispatch_portal_workflow.py"
    result = subprocess.run(
        [
            sys.executable,
            str(dispatch_script),
            "--request", request,
            "--execution-mode", execution_mode,
            "--portal-branch", portal_branch,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr or result.stdout)
    return json.loads(result.stdout)


def main():
    parser = argparse.ArgumentParser(description="Run ChatGPT portal command")
    parser.add_argument("--request", required=True, help="Natural-language modification request")
    parser.add_argument(
        "--execution-mode",
        default="commit-push",
        choices=["draft", "python-engine", "github-workflow", "commit-push"],
        help="Execution mode",
    )
    parser.add_argument(
        "--portal-path",
        default=os.environ.get("FEDERATION_PORTAL_PATH", "C:/GitHub/federation-portal"),
        help="Local path to federation-portal repo",
    )
    parser.add_argument("--portal-branch", default="main")
    args = parser.parse_args()

    portal_path = Path(args.portal_path).resolve()

    # 1. Generate plan via OpenAI
    print("[openai] Generating modification plan…", file=sys.stderr)
    try:
        plan = call_openai(args.request)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e), "stage": "openai"}))
        sys.exit(1)

    if args.execution_mode == "draft":
        print(json.dumps({"ok": True, "plan": plan}, ensure_ascii=False))
        return

    if args.execution_mode == "github-workflow":
        try:
            result = dispatch_workflow(args.request, args.execution_mode, args.portal_branch)
            print(json.dumps({"ok": True, **result}, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({"ok": False, "error": str(e), "stage": "github-workflow"}))
            sys.exit(1)
        return

    # python-engine or commit-push: apply locally
    if not portal_path.is_dir():
        print(json.dumps({"ok": False, "error": f"portal path not found: {portal_path}", "stage": "patch"}))
        sys.exit(1)

    print("[patch] Applying plan…", file=sys.stderr)
    try:
        modified = apply_plan(plan, portal_path)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e), "stage": "patch"}))
        sys.exit(1)

    if args.execution_mode == "python-engine":
        print(json.dumps({
            "ok": True,
            "summary": plan.get("summary", ""),
            "modifiedFiles": modified,
        }, ensure_ascii=False))
        return

    # commit-push: build → commit → push
    print("[build] Running npm run build…", file=sys.stderr)
    try:
        run_npm_build(portal_path)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e), "stage": "build"}))
        sys.exit(1)

    print("[commit] Committing and pushing…", file=sys.stderr)
    try:
        commit_sha = git_commit_push(portal_path)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e), "stage": "commit"}))
        sys.exit(1)

    print(json.dumps({
        "ok": True,
        "summary": plan.get("summary", ""),
        "modifiedFiles": modified,
        "commitSha": commit_sha,
        "build": "success",
        "push": "success",
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
