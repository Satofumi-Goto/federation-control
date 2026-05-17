# Constraint Arbitration and Trips Feasibility

## 最上位定義

Trips Feasibilityとは：

```txt
運行が成立するか
```

である。

重要：

Tripsは固定値ではない。

Tripsは：

Demand × Dispatch × Fleet × Node × Energy × Synchronization

の成立結果。

---

# PART 1｜Constraint

## Chapter 1｜Constraintとは

Constraintとは：

```txt
運行成立を制限する条件
```

である。

### 代表制約

- Safety
- Energy
- Queue
- Dispatch latency
- Vehicle limit
- ODD
- Throughput

---

## Chapter 2｜Safety Constraint

最優先。

```txt
Safety > all
```

### 状態

- ODD valid
- sensor valid
- path valid
- emergency clear

---

## Chapter 3｜Energy Constraint

エネルギーは上限制約。

### 制約対象

- reserve
- refill timing
- queue
- hydrogen availability

### 崩壊

reserve depletion → dispatch restriction → trips decrease

---

## Chapter 4｜Queue Constraint

Queueは局所問題ではない。

Queue increase → synchronization loss → throughput collapse

### Runtime State

- queue_size
- waiting_time
- berth_usage
- overflow_risk

---

## Chapter 5｜Vehicle Constraint

### 制約

- payload
- range
- thermal
- durability
- weight

### 崩壊

payload reduction → revenue deterioration

---

# PART 2｜Arbitration

## Chapter 6｜Arbitrationとは

Arbitrationとは：

```txt
制約競合時の優先順位制御
```

である。

---

## Chapter 7｜Priority Structure

```txt
Safety
>
Energy
>
Synchronization
>
Dispatch
>
Revenue
```

---

## Chapter 8｜Synchronization Arbitration

同期維持を優先する。

理由：

同期崩壊は全体崩壊へ伝播するため。

---

## Chapter 9｜Revenue Arbitration

Revenue最大化は最優先ではない。

理由：

短期Revenue最適化はQueue overflowを起こす。

---

# PART 3｜Trips Feasibility

## Chapter 10｜Feasibility Definition

Trips Feasibilityとは：

```txt
運行成立可能性
```

である。

---

## Chapter 11｜Feasibility State

### AUTHORIZED

運行成立。

### HOLD

制約接近。

### DEGRADED

性能低下。

### STOP

成立不能。

---

## Chapter 12｜Feasibility Formula

概念式：

```txt
Trips Feasibility
=
Demand
× Dispatch
× Fleet
× Node
× Energy
× Synchronization
```

---

## Chapter 13｜Feasibility Collapse

### Queue Collapse

queue overflow → HOLD

### Energy Collapse

reserve depletion → DEGRADED

### Synchronization Collapse

state mismatch → STOP

---

# PART 4｜Grafana Mapping

## Chapter 14｜Grafana Role

Grafanaでは：

- HOLD
- DEGRADED
- STOP
- Queue severity
- Energy reserve
- Dispatch health

を表示する。

---

## Chapter 15｜Obsidianとの差異

Obsidian：
- why
- causality
- theory
- arbitration logic

Grafana：
- state
- health
- severity
- alert

---

## Chapter 16｜Execution Link

Trips Feasibility低下は：

```txt
Issue
↓
Execution task
↓
Backlog
```

へ接続する。
