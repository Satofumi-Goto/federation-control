# Canonical Development Operation

## 最上位固定

Chat
↓
Assistant updates GitHub Canonical directly
↓
Cursor Agent executes local / large UI changes only when needed
↓
GitHub Push
↓
GitHub Actions
↓
Grafana Deploy

会話だけで決定しない。

決定事項は GitHub Canonical へ固定する。

Assistant は、可能な限り GitHub Canonical を直接更新する。

Cursor は、Assistant の GitHub 直接更新が安全制限・大規模UI再構成・ローカル実行権限で止まる場合だけ使う。

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
- Assistant が Canonical 更新を Cursor へ丸投げする運用崩壊

---

# Canonical Rule

GitHub = Canonical
Grafana = Runtime Workspace
Base44 = Operational Console

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

## Assistant

Assistant は Runtime Architect / Canonical Manager として、可能な限り GitHub Canonical を直接更新する。

Assistant は、単に Cursor へ貼り付けるだけの運用に戻してはいけない。

Assistant が直接更新できない場合だけ、理由を明示し、Cursor Agent へ渡す最小指示に分解する。

## Chat

Chat は短期メモリ。

## GitHub

GitHub を長期 Runtime Memory として扱う。

## Cursor Agent

Cursor は GitHub Canonical を読み、Assistant が直接できない大規模UI・ローカルファイル・workflow 実行・push を行う。

## Grafana

Grafana は Runtime Workspace 表示層。

---

# 禁止事項

- 会話だけで仕様を決定しない
- Assistant が Canonical 更新を省略しない
- Assistant が毎回 Cursor 貼り付け運用へ戻さない
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

Assistant は最初に GitHub Canonical 直接更新を試みる。
Cursor は例外処理・大規模実行・ローカル権限が必要な時だけ使う。
