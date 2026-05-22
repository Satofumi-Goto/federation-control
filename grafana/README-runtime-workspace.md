# Runtime Workspace 実装方針

## 現在確認できたこと

- `grafana/runtime-dashboard.json` は GitHub に保存済み。
- Grafana Dashboard JSON として読み取り可能。
- 既存Dashboardには以下が含まれている。
  - Runtime header
  - 制御思想構造
  - Gap / Conflict / Migration
  - 4コンソール
  - Dashboard links

## 次に追加するべき構成

### 1. Runtime同期マトリクス

目的：4コンソールが責務分離に対して、どこまで同期しているかを見える化する。

表示項目：

- フリート運用
- サービス拠点
- 都市運行
- 生活取引
- Demand
- Dispatch
- Queue
- ETA
- Node
- Energy
- ODD
- Constraint
- 同期率
- 状態：AUTHORIZED / HOLD / STOP

### 2. 修正指示Backlog

目的：同期していない箇所を、修正可能な作業単位に分解する。

表示項目：

- 問題箇所
- 影響先コンソール
- 責務分離上の原因
- 修正内容
- 事前検証項目
- 実行可否

### 3. 崩壊事前検証

目的：修正前に、既存4コンソールを壊す可能性を確認する。

QA Gate：

- FleetがNode設備を直接制御していないか
- Urban OSが実行オペレーションを持ちすぎていないか
- Node側の受入制約がFleetへ参照表示されているか
- Queue / ODD / Energy / Constraint の波及が見えるか
- 既存Map / Provider / Router を壊していないか

### 4. Dashboard Navigation統一

既存リンクは `/Runtime` など直URLが混ざるため、Grafanaの実Dashboard URLに寄せる。

優先：

- Runtime: `/d/sa8Ijn4/runtime`
- Runtime Discovery: 実URL確認後に置換
- Need Impact: 実URL確認後に置換

## 禁止事項

- Grafana本体JSONを確認なしで上書きしない。
- 既存 `runtime-dashboard.json` をバックアップなしで削除しない。
- Fleet Console に Node設備制御を持たせない。
- Service Hub Console を Fleet配下の制御盤として扱わない。
- 英語UIラベルを残さない。

## 次の作業順

1. 現行 `runtime-dashboard.json` を基準ファイルとして保持。
2. `runtime-workspace-v2.json` を別ファイルで作成。
3. GrafanaへImportして表示確認。
4. 問題なければ、既存Runtime Dashboardへ反映。
5. Runtime Discovery / Need Impact / 崩壊制御 / Federation Gap も同じ方式でGitHub保存。
