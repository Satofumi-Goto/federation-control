# Federated Operational Governance Workspace

7工程の運行ガバナンス UI。既存3アイコン（連携探索・ニーズ翻訳・関係整理）を置換し、重複なく7工程へ移行する。

## 7工程

| # | 工程 | Route | 旧名称 |
|---|------|-------|--------|
| 1 | 入力統合 | `/federation/intake` | 連携探索 |
| 2 | 意図整理 | `/federation/intent` | ニーズ翻訳 |
| 3 | 責務解析 | `/federation/responsibility` | 関係整理 |
| 4 | 影響解析 | `/federation/impact` | — |
| 5 | 同期設計 | `/federation/sync-plan` | — |
| 6 | 同期改修 | `/federation/sync-apply` | — |
| 7 | 検証 | `/federation/validation` | — |

## Legacy redirects

- `/runtime_discovery` → `/federation/intake`
- `/need_impact` → `/federation/intent`
- `/d/external-federation-view/external-federation-view` → `/federation/responsibility`

## 開発

```bash
npm install
npm run dev
npm run build:federation-governance
npm run verify:federation-governance
```

ビルド出力: `dist/federation-governance/`

## Grafana 連携

- 正本: `grafana/federation-governance-routes.json`
- Runtime ヘッダ row1: `grafana/runtime-workspace-routes.json`（入力統合・意図整理・責務解析）
- ダッシュボード再生成: `npm run build:runtime-workspace`
