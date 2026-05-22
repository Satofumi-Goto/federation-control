# Canonical Development Operation

## 最上位固定

Chat
↓
GitHub Canonical
↓
Cursor Agent
↓
GitHub Push
↓
GitHub Actions
↓
Grafana Deploy

会話だけで決定しない。

決定事項は GitHub Canonical へ固定する。

---

# 開発運用目的

目的は Runtime Federation の継続運用。

以下を防止する。

- スレッド変更による記憶消失
- Runtime Federation 方針の揺れ
- audience rule の揺れ
- Collapse propagation の揺れ
- Queue / ODD / Constraint 運用崩壊
- Runtime URL 構造崩壊
- GitHub / Grafana canonical mismatch

---

# Canonical Rule

GitHub = Canonical
Grafana = Runtime Workspace
Base44 = Preview / Push

---

# Runtime Root

/runtime

は Toyota / Denso 向け Runtime 本体。

Honda Runtime は作らない。

---

# Collapse Federation

最上位主語は Runtime ではなく Collapse。

Need
→ Dispatch
→ Queue
→ ODD
→ Constraint
→ Energy
→ Node

を propagation chain として固定。

---

# Runtime States

AUTHORIZED
HOLD
STOP

---

# 開発運用ルール

## Chat

Chat は短期メモリ。

## GitHub

GitHub を長期 Runtime Memory として扱う。

## Cursor Agent

Cursor は GitHub Canonical を読み、実装・修正・workflow 更新・push を行う。

## Grafana

Grafana は Runtime Workspace 表示層。

---

# 禁止事項

- 会話だけで仕様を決定しない
- Runtime Top を説明資料化しない
- Runtime Top を全部入りにしない
- Queue / ODD / Constraint propagation を削除しない
- Collapse 主語を Runtime 紹介へ戻さない
- GitHub Canonical と Grafana 表示を乖離させない

---

# 運用固定

今後、Runtime Federation の決定事項は:

- GitHub Canonical
- Runtime Workspace
- Collapse Federation
- Audience Rule
- Workflow
- Runtime URL

へ固定し、会話のみで保持しない。
