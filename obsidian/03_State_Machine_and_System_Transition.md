# State Machine and System Transition

## 最上位定義

都市運行OSは静的システムではない。

状態遷移システムである。

重要：

Grafanaは状態を表示する。

Obsidianは状態遷移の意味・因果・崩壊条件を定義する。

---

# PART 1｜State Machine

## Chapter 1｜State Machine Definition

State Machineとは：

```txt
状態
↓
条件
↓
次状態
```

を定義する構造である。

都市運行OSでは：

- Queue
- Dispatch
- Fleet
- Energy
- ODD
- Node
- Trips Feasibility

が状態遷移を持つ。

---

## Chapter 2｜Trips Feasibility State

### AUTHORIZED

正常運行。

条件：
- queue stable
- dispatch stable
- reserve stable
- ODD valid

### HOLD

制約接近。

条件：
- queue growth
- reserve decrease
- ETA deterioration

### DEGRADED

性能低下。

条件：
- reroute increase
- throughput reduction
- synchronization instability

### STOP

運行停止。

条件：
- energy depletion
- ODD invalid
- synchronization collapse

---

## Chapter 3｜Queue State

### NORMAL

通常。

### WARNING

Queue増加。

### HOLD

受入遅延。

### OVERFLOW

Queue崩壊。

### RECOVERY

Queue回復。

---

## Chapter 4｜Dispatch State

### MATCHING

車両探索。

### ASSIGNED

割当済。

### ENROUTE

移動中。

### DELAYED

遅延発生。

### REROUTE

経路変更。

### FAILED

配車失敗。

---

## Chapter 5｜Energy State

### NORMAL

通常。

### RESERVE_LOW

残量低下。

### REFILL_WAIT

補給待ち。

### ENERGY_HOLD

Dispatch制限。

### ENERGY_STOP

供給不能。

---

# PART 2｜Transition Condition

## Chapter 6｜Queue Transition

NORMAL → WARNING

条件：
- queue_growth_rate > threshold

WARNING → HOLD

条件：
- waiting_time increase

HOLD → OVERFLOW

条件：
- berth unavailable

---

## Chapter 7｜Dispatch Transition

MATCHING → ASSIGNED

条件：
- vehicle found

ASSIGNED → ENROUTE

条件：
- dispatch commit

ENROUTE → DELAYED

条件：
- ETA deviation

---

## Chapter 8｜Energy Transition

NORMAL → RESERVE_LOW

条件：
- reserve below threshold

RESERVE_LOW → REFILL_WAIT

条件：
- refill unavailable

REFILL_WAIT → ENERGY_HOLD

条件：
- dispatch restriction

---

# PART 3｜Runtime State Mapping

## Chapter 9｜Queue Runtime State

- queue_size
- waiting_time
- overflow_risk
- berth_usage

## Chapter 10｜Dispatch Runtime State

- dispatch_latency
- matching_rate
- reroute_count
- failed_dispatch

## Chapter 11｜Energy Runtime State

- reserve
- refill_eta
- energy_risk
- depletion_score

---

# PART 4｜Propagation

## Chapter 12｜Queue Propagation

queue overflow
↓
dispatch delay
↓
ETA deterioration
↓
trips decrease

## Chapter 13｜Energy Propagation

reserve depletion
↓
fleet restriction
↓
throughput decrease
↓
revenue deterioration

## Chapter 14｜Synchronization Propagation

timing mismatch
↓
queue increase
↓
dispatch instability
↓
collapse propagation

---

# PART 5｜Grafana Mapping

## Chapter 15｜Grafana State Display

Grafana表示：

- HOLD
- DEGRADED
- OVERFLOW
- ENERGY_HOLD
- FAILED

## Chapter 16｜Alert Structure

Queue severity > threshold
↓
Grafana alert
↓
Execution task generation

## Chapter 17｜Execution Link

Collapse detection
↓
Issue
↓
Task
↓
Backlog
↓
Implementation
