# ChatGPT Remote MCP セットアップガイド

Federation Runtime OS を ChatGPT Custom App として接続する手順。

---

## 前提条件

| # | 確認項目 | コマンド |
|---|---------|---------|
| 1 | HTTP Bridge readiness | `npm run runtime:remote-mcp-readiness` → ALL PASS |
| 2 | REMOTE_MCP_AUTH_TOKEN 設定済み | `.env.runtime` に記載 |
| 3 | CURSOR_API_KEY 設定済み | `.env.runtime` に記載 |
| 4 | Tunnel ツール導入済み | `cloudflared --version` |

---

## Step 1: HTTP Bridge 起動

```powershell
npm run runtime:mcp-http
```

確認: `[mcp-http] Listening on http://127.0.0.1:3100` が表示される。

このターミナルは閉じない。

---

## Step 2: Secure Tunnel 起動

**新しいターミナル**で実行:

```powershell
cloudflared tunnel --url http://localhost:3100
```

出力されるHTTPS URLを控える（例: `https://xxxx.trycloudflare.com`）。

---

## Step 3: Remote Endpoint 検証

```powershell
# ヘルスチェック
curl https://<TUNNEL_URL>/health

# 期待レスポンス
# {"ok": true, "service": "federation-runtime-mcp"}

# 認証なしリクエスト → 401
curl -X POST https://<TUNNEL_URL>/mcp/tools/call -H "Content-Type: application/json" -d '{"name":"runtime_status","arguments":{}}'
# → 401 Unauthorized

# 認証ありリクエスト → 200
curl -X POST https://<TUNNEL_URL>/mcp/tools/call -H "Content-Type: application/json" -H "Authorization: Bearer <TOKEN>" -d '{"name":"runtime_status","arguments":{}}'
# → 200 OK
```

---

## Step 4: ChatGPT Developer Mode 有効化

1. [chat.openai.com](https://chat.openai.com) を開く
2. **Settings** → **Developer** (または **Beta Features**)
3. **Developer Mode** または **Plugins / Apps / MCP** を有効化

> ChatGPT Pro/Business/Enterprise のプランにより UI が異なる場合がある。
> 2026年5月時点で Custom MCP UI が未提供の場合は「Fallback運用ガイド」を参照。

---

## Step 5: Custom App 登録

1. **Apps** (または **GPTs** → **Create**) を開く
2. **Add MCP Server** または **Custom Tool / Action** を選択
3. 以下を入力:

| フィールド | 値 |
|-----------|-----|
| 名前 | Federation Runtime Gateway |
| Endpoint URL | `https://<TUNNEL_URL>/mcp/tools` |
| Auth Type | Bearer Token |
| Token | `.env.runtime` の `REMOTE_MCP_AUTH_TOKEN` の値 |

4. 保存

---

## Step 6: ツール動作確認

### runtime_status

ChatGPTで以下を質問:

> 「Federation Runtime Gateway を使って、現在のRuntime状態を確認して」

期待: `runtime_status` が呼ばれ、オーケストレーション状態が返る。

### runtime_dry_run

> 「Federation Runtime Gateway で、Runtime Registry の検証をdry-runして」

### runtime_verify

> 「Federation Runtime Gateway で、トポロジーとセマンティックをverifyして」

### runtime_execute_safe

> 「Federation Runtime Gateway で、ダッシュボードルートの整合性を検証して実行して。force pushは禁止」

---

## Tunnel URL 更新手順

trycloudflare URL は一時的。cloudflared を再起動すると変更される。

1. `cloudflared tunnel --url http://localhost:3100` を再実行
2. 新しいHTTPS URLを控える
3. `runtime_data/chatgpt-remote-mcp-registration.json` の `remoteMcpEndpoint.url` を更新
4. ChatGPT Custom App 設定の Endpoint URL を更新
5. `npm run runtime:remote-mcp-readiness` で接続確認

---

## Request/Response フォーマット

### リクエスト

```json
POST /mcp/tools/call
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "name": "runtime_status",
  "arguments": {}
}
```

### レスポンス（成功）

```json
{
  "ok": true,
  "result": { ... }
}
```

### レスポンス（エラー）

| Status | 意味 |
|--------|------|
| 401 | 認証トークンなし/不正 |
| 403 | 禁止ツール/禁止パターン |
| 400 | リクエスト形式不正 |
| 500 | 内部エラー |

---

## トラブルシューティング

| 問題 | 対処 |
|------|------|
| 401 Unauthorized | auth token が `.env.runtime` と一致しているか確認 |
| 403 Forbidden | 禁止ツール呼び出しか禁止パターン検出 |
| Connection refused | Tunnel または Bridge が停止している |
| TOOL_NOT_ALLOWED | `runtime_deploy` 等の禁止ツールを呼んでいる |
| GOVERNANCE_BLOCKED | ガバナンスポリシー評価失敗 |
| SAFETY_BLOCKED | 安全ロック状態がblocked |
| FORBIDDEN_PATTERN | 命令に禁止パターン（force push等）が含まれている |

---

## シャットダウン

1. Tunnel 停止 (Ctrl+C)
2. HTTP Bridge 停止 (Ctrl+C)
3. Remote endpoint は即座にアクセス不可になる
