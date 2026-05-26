# Runtime Business / Enterprise Readiness

ChatGPT Business / Enterprise / Edu プランで
Federation Runtime MCP を利用する際の準備事項。

---

## Business / Enterprise で必要な設定

### Workspace Admin 確認事項

| # | 項目 | 状態 |
|---|------|------|
| 1 | ChatGPT workspace に admin 権限がある | 要確認 |
| 2 | Custom App / MCP Server 登録が許可されている | 要確認 |
| 3 | External API 呼び出しが許可されている | 要確認 |
| 4 | Bearer Token 認証が利用可能 | 対応済み |
| 5 | Write/Modify action が許可されている（execute-safe 用） | 要確認 |

### Organization-level 設定

| 設定 | 推奨値 |
|------|--------|
| Allow external MCP servers | Yes |
| Require approval for write actions | Yes（推奨） |
| Audit log retention | 90日以上 |
| IP allowlist | Cloudflare Tunnel IP を許可 |

---

## Remote MCP Registration 項目

Business / Enterprise の Custom App 登録画面で必要な情報:

| フィールド | 値 |
|-----------|-----|
| App Name | Federation Runtime Gateway |
| Description | Federation Runtime OS governed execution gateway |
| Endpoint URL | `https://<TUNNEL_URL>/mcp/tools` |
| Health Endpoint | `https://<TUNNEL_URL>/health` |
| Auth Type | Bearer Token |
| Token | `REMOTE_MCP_AUTH_TOKEN` の値 |
| Allowed Actions | Read, Write (governed) |
| Exposed Tools | runtime_status, runtime_dry_run, runtime_verify, runtime_execute_safe |

---

## Auth 方式

| 方式 | 対応 | 説明 |
|------|------|------|
| Bearer Token | 対応済み | `.env.runtime` の `REMOTE_MCP_AUTH_TOKEN` |
| OAuth 2.0 | 未対応 | Enterprise で OAuth が必要な場合は追加実装が必要 |
| API Key Header | 対応可能 | HTTP Bridge で追加ヘッダー対応可能 |
| mTLS | 未対応 | Cloudflare Tunnel 側で設定可能 |

---

## Write / Modify Action の安全条件

`runtime_execute_safe` は write action（副作用あり）であるため、
Business / Enterprise workspace では以下の安全条件を満たす:

### 事前ゲート

1. **Governance Policy 評価**: 全ポリシーPASS必須
2. **Safety Lock 評価**: locked 状態では実行不可
3. **Forbidden Pattern Filter**: 禁止パターン検出時は拒否
4. **Workspace Binding**: `federation-control` リポジトリのみ
5. **API Key 検証**: `@cursor/sdk` 認証済み

### 実行制約

- **execute-safe のみ**: execute-reviewed / execute-emergency は非公開
- **force push 不可**: git push --force は無条件拒否
- **credential 操作不可**: API key / token の読み取り・変更は不可
- **Registry 破壊不可**: Runtime Registry の削除・置換は不可
- **governance bypass 不可**: ガバナンスチェックのスキップは不可

### 実行後検証

- トポロジー検証自動実行
- セマンティック検証自動実行
- 実行結果の監査ログ記録

---

## Governance Policy

| ポリシー | 内容 |
|---------|------|
| 最大権限 | execute-safe |
| 破壊ツール公開 | 禁止 |
| credential 露出 | 禁止 |
| 監査ログ | 全リクエスト記録 |
| secret マスク | ログ出力時にマスク |
| 圧力閾値 | 80/100 超過で実行拒否 |
| ループ防止 | supervisor による制御 |

---

## Tool Exposure Policy

### 公開ツール

| ツール | 権限 | 副作用 | Business 推奨 |
|--------|------|--------|-------------|
| runtime_status | dry-run | なし | 全ユーザー |
| runtime_dry_run | dry-run | なし | 全ユーザー |
| runtime_verify | verify-only | なし | 全ユーザー |
| runtime_execute_safe | execute-safe | あり | Admin のみ推奨 |

### 非公開ツール（変更不可）

| ツール | 理由 |
|--------|------|
| runtime_deploy | 手動承認必要 |
| runtime_execute_reviewed | 手動承認必要 |
| runtime_execute_emergency | 危険操作 |

---

## User Approval Flow

Enterprise での承認フロー推奨:

```
ユーザー
  ↓ ChatGPT で runtime_execute_safe を呼び出し
Runtime Gateway
  ↓ Governance Policy 評価
  ↓ Safety Lock 評価
  ↓ Forbidden Pattern Filter
  ↓ [全PASS]
@cursor/sdk Agent.prompt()
  ↓ 実行
実行結果
  ↓ 自動検証（topology + semantic）
  ↓ 監査ログ記録
ChatGPT へ結果返却
```

### Enterprise 追加推奨

- `runtime_execute_safe` の呼び出しを Admin 権限に制限
- 実行前に Slack / Teams 通知を追加（webhook 連携）
- 監査ログを外部 SIEM に転送
- 月次で監査ログレビュー

---

## 移行チェックリスト

Business / Enterprise へ移行する際:

- [ ] Workspace admin が MCP Server 登録を許可
- [ ] Bearer Token を workspace secrets に格納
- [ ] tool exposure policy を admin に確認
- [ ] write action の承認フローを設定
- [ ] 監査ログの保存期間を設定
- [ ] IP allowlist を設定（必要な場合）
- [ ] テスト環境で全ツール動作確認
- [ ] 本番 workspace に登録
