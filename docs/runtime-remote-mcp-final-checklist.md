# Runtime Remote MCP — 最終接続チェックリスト

Federation Runtime を ChatGPT Custom MCP App として登録する前に、
全レイヤーの動作確認を行う。

---

## インフラストラクチャ

| # | 確認項目 | コマンド | 期待結果 |
|---|---------|---------|---------|
| 1 | Local MCP gateway | `npm run runtime:mcp-test` | 9/9 PASS |
| 2 | Tool exposure layer | `npm run runtime:tool-validation` | 17/17 PASS |
| 3 | Headless executor | `npm run runtime:headless-check` | 0 blockers, FULLY HEADLESS READY |
| 4 | HTTP bridge | `npm run runtime:remote-mcp-readiness` | 11/11 PASS |
| 5 | Remote policy | `npm run runtime:remote-mcp-policy` | 20/20 PASS |
| 6 | Endpoint manifest | `npm run runtime:remote-mcp-endpoint-validate` | ALL PASS |
| 7 | Topology verify | `npm run verify:runtime-topology` | ok: true |
| 8 | Semantic verify | `npm run verify:federation-semantic` | ok: true |
| 9 | State Engine | `npm run runtime:state-verify` | 23/23 PASS |
| 10 | Repair Engine | `npm run runtime:repair-verify` | 55/55 PASS |

## 認証

| # | 確認項目 | 検証方法 |
|---|---------|---------|
| 11 | `CURSOR_API_KEY` 設定済み | `.env.runtime` に存在 |
| 12 | `REMOTE_MCP_AUTH_TOKEN` 設定済み | `.env.runtime` に存在 (16文字以上) |
| 13 | `.env.runtime` gitignored | `git check-ignore .env.runtime` がパスを返す |

## トンネル

| # | 確認項目 | 検証方法 |
|---|---------|---------|
| 14 | Tunnel ツール導入済み | `cloudflared --version` |
| 15 | HTTP Bridge 起動 | `npm run runtime:mcp-http` → "Listening on 127.0.0.1:3100" |
| 16 | Tunnel 起動 | `cloudflared tunnel --url http://localhost:3100` → HTTPS URL |
| 17 | `/health` 到達可能 | `curl https://<URL>/health` → `{"ok": true}` |
| 18 | HTTPS確認 | URLが `https://` で始まる |

## Remote Endpoint 検証

| # | 確認項目 | 検証方法 |
|---|---------|---------|
| 19 | 認証なし → 401 | token無しPOST → 401 Unauthorized |
| 20 | 認証あり → 200 | token付きPOST → 200 OK |
| 21 | tools/list 取得可能 | GET /mcp/tools/list → ツール一覧 |
| 22 | runtime_status 呼び出し可能 | POST runtime_status → 結果返却 |
| 23 | runtime_dry_run 呼び出し可能 | POST runtime_dry_run → シミュレーション結果 |
| 24 | runtime_verify 呼び出し可能 | POST runtime_verify → 検証結果 |
| 25 | runtime_execute_safe 公開確認 | tools/list に含まれる |
| 26 | execute-emergency 非公開確認 | POST → 403 TOOL_NOT_ALLOWED |

## 安全性

| # | 確認項目 | 検証方法 |
|---|---------|---------|
| 27 | 破壊ツール非公開 | `runtime_deploy` 等 → TOOL_NOT_ALLOWED |
| 28 | 認証なし拒否 | token無しリクエスト → 401 |
| 29 | credential露出ブロック | "CURSOR_API_KEY" 含む命令 → FORBIDDEN_PATTERN |
| 30 | force push ブロック | "git push --force" 含む命令 → FORBIDDEN_PATTERN |
| 31 | governance bypass ブロック | "bypass governance" 含む命令 → FORBIDDEN_PATTERN |
| 32 | 監査ログ記録 | `runtime_data/runtime-remote-mcp-audit-log.json` にエントリ |

## ChatGPT 登録

| # | 確認項目 | 検証方法 |
|---|---------|---------|
| 33 | ChatGPT Custom App 作成 | ChatGPT Apps一覧に表示 |
| 34 | `runtime_status` 動作 | ChatGPTでRuntime状態確認を質問 |
| 35 | `runtime_dry_run` 動作 | ChatGPTでdry-run検証を質問 |
| 36 | `runtime_verify` 動作 | ChatGPTでトポロジー/セマンティック検証を質問 |
| 37 | `runtime_execute_safe` 動作 | ChatGPTで安全実行を質問 |

---

## 完成判定

全37チェックがPASSした場合、Federation Runtime は
ChatGPT governed remote MCP app として完全接続完了。

```
ChatGPT
  ↓ Custom App / MCP
Remote MCP Endpoint (HTTPS)
  ↓ Bearer Token Auth
Cloudflare Tunnel
  ↓
HTTP Bridge (localhost:3100)
  ↓ Policy + Audit
Runtime Gateway
  ↓ Governance + Safety Gate
Headless Cursor Executor
  ↓ @cursor/sdk Agent.prompt()
Federation Runtime OS
```
