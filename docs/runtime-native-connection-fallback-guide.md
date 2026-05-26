# Runtime Native Connection — Fallback 運用ガイド

OpenAI 側の Custom App / MCP UI が未提供の場合の運用方法。

---

## 現状

2026年5月時点で、ChatGPT の Custom MCP App UI は
Pro / Plus プランでは完全提供されていない可能性がある。

- **Business / Enterprise / Edu** プランでは workspace admin 経由で
  MCP Server を登録できる場合がある
- **Pro / Plus** では Developer Mode やPlugins経由でのMCP接続が
  段階的にロールアウト中

---

## Fallback 運用フロー

OpenAI UI が利用できない期間は、以下のフローで運用する。

```
ChatGPT (指示書生成)
  ↓ テキスト出力
ユーザー (手動コピー)
  ↓ Cursor Agent へ投入
Cursor Agent (実行)
  ↓ @cursor/sdk or Cursor IDE
Federation Runtime OS (結果出力)
  ↓ テキスト or JSON
ユーザー (ChatGPTへフィードバック)
```

### 具体的手順

1. **ChatGPT** で Federation Runtime への指示を生成
2. 出力されたテキストを **Cursor Agent** の入力へコピー
3. Cursor Agent が `federation-control` リポジトリ内で実行
4. 結果を ChatGPT へフィードバック（必要な場合）

---

## Remote MCP Endpoint の維持

OpenAI UI が利用できない場合でも、Remote MCP Endpoint は
**接続待機状態**として維持する。

### 維持理由

- OpenAI UI ロールアウト時に即接続可能
- ローカルテスト・検証に使用可能
- CI/CD パイプラインからの呼び出しに使用可能
- 他の MCP クライアントからの接続に使用可能

### 維持方法

- `npm run runtime:mcp-http` は必要時のみ起動
- `cloudflared tunnel` は必要時のみ起動
- 起動しない場合でもコード・設定は最新を維持
- 定期的に `npm run runtime:remote-mcp-readiness` で動作確認

---

## Tunnel URL 変更時の更新

trycloudflare URL は一時的。再起動時に変更される。

1. `cloudflared tunnel --url http://localhost:3100` で新URL取得
2. `runtime_data/chatgpt-remote-mcp-registration.json` の URL を更新
3. ChatGPT Custom App（存在する場合）の URL を更新
4. `npm run runtime:remote-mcp-readiness` で検証

---

## OpenAI UI 提供時の移行手順

OpenAI が Custom MCP UI を提供した時点で:

1. ChatGPT Settings → Developer → MCP を有効化
2. `docs/chatgpt-remote-mcp-setup-guide.md` の Step 4-5 に従う
3. `runtime_data/chatgpt-remote-mcp-registration.json` の情報で登録
4. `docs/chatgpt-runtime-command-templates.md` のコマンドでテスト
5. `runtime_data/runtime-native-connection-state.json` の
   `nativeChatGPTConnection` を `"connected"` に更新

---

## 利用可能な代替 MCP クライアント

OpenAI UI が未提供でも、以下の MCP クライアントから接続可能:

| クライアント | 接続方法 |
|-------------|---------|
| Cursor IDE | `.mcp/runtime-gateway.json` 設定済み |
| Claude Desktop | `claude_desktop_config.json` に追加 |
| その他 MCP 対応クライアント | stdio or HTTP endpoint |

---

## 状態管理

`runtime_data/runtime-native-connection-state.json` で現在の接続状態を管理。

| フィールド | 説明 |
|-----------|------|
| `nativeChatGPTConnection` | OpenAI接続状態 (`pending-ui-rollout`, `connected`, `disconnected`) |
| `remoteMcpEndpoint` | Endpoint準備状態 (`ready`, `not-started`) |
| `fallbackMode` | 現在のfallback運用モード |
