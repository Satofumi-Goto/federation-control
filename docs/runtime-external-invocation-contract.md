# Runtime External Invocation Contract

外部呼び出し元（ChatGPT, MCP, CI）が Federation Runtime 実行パイプラインを
governed tool surface 経由で呼び出す際の契約。

---

## MCP Tool Call フォーマット

### runtime_status

```json
{
  "name": "runtime_status",
  "arguments": {}
}
```

| 項目 | 値 |
|------|-----|
| 権限 | dry-run |
| 副作用 | なし |
| 用途 | オーケストレーション状態・最終セッション・ツール数を読み取る |

### runtime_dry_run

```json
{
  "name": "runtime_dry_run",
  "arguments": {
    "prompt": "Verify Runtime Registry consistency"
  }
}
```

| 項目 | 値 |
|------|-----|
| 権限 | dry-run |
| 副作用 | なし |
| 用途 | Agent.prompt() なしで実行パイプラインをシミュレーション |

### runtime_verify

```json
{
  "name": "runtime_verify",
  "arguments": {
    "scope": "topology-semantic-tool"
  }
}
```

| 項目 | 値 |
|------|-----|
| 権限 | verify-only |
| 副作用 | なし |
| 用途 | トポロジー・セマンティック・ツール検証を実行 |
| scope 選択肢 | `topology`, `semantic`, `tool`, `topology-semantic-tool` |

### runtime_execute_safe

```json
{
  "name": "runtime_execute_safe",
  "arguments": {
    "prompt": "Verify all dashboard routes are correct",
    "governance": true,
    "safeExecuteOnly": true
  }
}
```

| 項目 | 値 |
|------|-----|
| 権限 | execute-safe |
| 副作用 | あり（@cursor/sdk Agent.prompt() 実行） |
| 用途 | ガバナンス審査済みプロンプトを安全実行 |
| governance | 必須: true |
| safeExecuteOnly | 必須: true |

---

## 許可コマンド一覧

| Tool | 権限 | 副作用 | 説明 |
|------|------|--------|------|
| `runtime_status` | dry-run | なし | Runtime OS 状態読み取り |
| `runtime_dry_run` | dry-run | なし | 実行シミュレーション |
| `runtime_verify` | verify-only | なし | 検証パイプライン実行 |
| `runtime_execute_safe` | execute-safe | あり | governed safe execution |

## 禁止コマンド

以下は **無条件ブロック**:

| Tool | 理由 |
|------|------|
| `runtime_deploy` | 手動承認必要 |
| `runtime_execute_reviewed` | 手動承認必要 |
| `runtime_execute_emergency` | 危険操作 — 公開禁止 |

---

## 禁止パターン（命令内容フィルタ）

以下のパターンを含む命令は `FORBIDDEN_PATTERN` として拒否:

- `rm -rf` / 破壊的ファイル操作
- `git push --force` / force push
- `CURSOR_API_KEY` / credential 露出
- `REMOTE_MCP_AUTH_TOKEN` / token 露出
- `.env.runtime` / 環境ファイル操作
- `reset --hard` / 破壊的git操作
- `--no-verify` / 検証スキップ
- `registry replace` / Registry 破壊
- `governance bypass` / ガバナンスバイパス
- `auto-delete` / 自動削除
- `execute-emergency` / 緊急実行

---

## ガバナンス要件

### execute-safe レベル

1. **事前ゲート** 全通過必須:
   - workspace binding: `federation-control`
   - safety lock evaluation
   - `@cursor/sdk` installed + API key configured
   - governance policy evaluation
   - payload validation
   - forbidden pattern filter

2. **ガバナンス圧力** < 80/100

3. **命令安全性検証** — 禁止パターン非検出

### verify / dry-run / status レベル

- ガバナンスゲート不要
- 読み取り専用

---

## レスポンス形式

### 成功

```json
{
  "ok": true,
  "toolId": "runtime_status",
  "result": {
    "status": "completed",
    "data": { ... }
  },
  "timestamp": "2026-05-26T19:30:00.000Z"
}
```

### エラー

```json
{
  "ok": false,
  "error": "GOVERNANCE_BLOCKED",
  "detail": "ガバナンスポリシー評価失敗",
  "timestamp": "2026-05-26T19:30:00.000Z"
}
```

---

## エラーコード一覧

| コード | 意味 |
|--------|------|
| `TOOL_NOT_ALLOWED` | 禁止ツール呼び出し |
| `GOVERNANCE_BLOCKED` | ガバナンスポリシー評価失敗 |
| `SAFETY_BLOCKED` | 安全ロックによる実行拒否 |
| `FORBIDDEN_PATTERN` | 禁止パターン検出 |
| `PAYLOAD_INVALID` | リクエスト形式不正 |
| `SDK_UNAVAILABLE` | @cursor/sdk 未導入またはAPI key未設定 |
| `EXECUTION_FAILED` | Agent.prompt() 実行エラー |
| `GATEWAY_ERROR` | ゲートウェイ内部エラー |

---

## 安全性レイヤー

| レイヤー | 担当 |
|---------|------|
| workspace binding | `runtimeCursorWorkspaceBinding.mjs` |
| payload validation | `runtimeInvocationSafetyLayer.mjs` |
| forbidden pattern filter | `runtimeInvocationSafetyLayer.mjs` |
| safety lock | `runtimeInvocationSafetyLock.mjs` |
| loop prevention | `runtimeTriggerLoopSupervisor.mjs` |
| governance policy | `runtimePolicyEngine.mjs` |
| credential isolation | `runtimeCredentialResolver.mjs` |
| remote MCP policy | `runtime-remote-mcp-policy.json` |
| remote auth | `runtimeRemoteMcpAuth.mjs` |
| audit log | `runtime-remote-mcp-audit-log.json` |

---

## 実行後検証

`runtime_execute_safe` 実行後:

1. Build verification: `node scripts/build-runtime-workspace-v2.mjs`
2. Auto-verification: `node scripts/runtime/runtimeAutoVerificationPipeline.mjs`
3. Topology verification: `npm run verify:runtime-topology`
4. Semantic verification: `npm run verify:federation-semantic`
