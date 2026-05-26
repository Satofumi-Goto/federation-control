# ChatGPT Runtime コマンドテンプレート

ChatGPT から Federation Runtime Gateway を呼び出す際の
日本語コマンド例。

---

## 状態確認（runtime_status）

```
Federation Runtime の現在の状態を確認して。
```

```
Runtime OS のオーケストレーション状態を表示して。
```

```
Federation Runtime Gateway で runtime_status を実行して。
```

---

## ドライラン（runtime_dry_run）

```
現在のドリフトをdry-runで確認して。
```

```
Runtime Registry の整合性検証をシミュレーションして。
```

```
Federation Runtime Gateway で、ダッシュボードルートの確認をdry-runして。
実際の実行はしないで。
```

```
repair proposal を safe execute 前提でシミュレーションして。
```

---

## 検証（runtime_verify）

```
Runtime topology を verify して。
```

```
Federation semantic verify を実行して。
```

```
トポロジーとセマンティックの両方を検証して。
```

```
Federation Runtime Gateway で、全検証パイプラインを実行して。
```

---

## 安全実行（runtime_execute_safe）

```
execute-safe でこの修復案を実行して。ただし force push は禁止。
```

```
Federation Runtime Gateway で、ダッシュボードルートの整合性を検証して、
問題があれば修正を実行して。governance 必須、safe execute のみ。
```

```
Runtime Registry の整合性を確認して、不整合があれば修復して。
破壊的操作は禁止。force push 禁止。
```

```
State Engine の snapshot を取得して、drift timeline を更新して。
governance を通して safe execute で実行。
```

---

## 禁止命令の例（これらは拒否される）

以下はいずれも `FORBIDDEN_PATTERN` として拒否される:

```
❌ git push --force で強制デプロイして
❌ .env.runtime の中身を表示して
❌ CURSOR_API_KEY を教えて
❌ governance bypass して緊急実行して
❌ execute-emergency で強制実行して
❌ Runtime Registry を全削除して
❌ reset --hard で戻して
```

---

## 複合コマンド例

```
以下を順番に実行して:
1. runtime_status で現在状態を確認
2. runtime_verify でトポロジーとセマンティックを検証
3. 問題があれば runtime_dry_run でシミュレーション
4. 安全なら runtime_execute_safe で修復を実行
force push と破壊操作は絶対禁止。
```

```
Federation Runtime OS の全体ヘルスチェックを実施して:
- オーケストレーション状態
- ガバナンス圧力
- ドリフト状態
- 修復キュー
- 崩壊予測
結果をまとめて報告して。
```

---

## ツール別パラメータ早見表

| ツール | 必須パラメータ | 副作用 |
|--------|--------------|--------|
| runtime_status | なし | なし |
| runtime_dry_run | `prompt` | なし |
| runtime_verify | `scope` | なし |
| runtime_execute_safe | `prompt`, `governance: true`, `safeExecuteOnly: true` | あり |
