# Collapse Propagation and Runtime State

## 最上位定義

都市運行OSでは、崩壊は単独障害ではない。

崩壊とは：

```txt
局所障害
↓
同期喪失
↓
状態伝播
↓
Trips degradation
↓
Business collapse
```

である。

---

# PART 1｜Collapse Propagation

## Chapter 1｜Propagation Definition

Propagationとは：

```txt
ある状態変化が
別レイヤへ影響を伝播する事
```

である。

重要：

都市運行OSでは、

- Fleet
- Dispatch
- Queue
- Node
- Energy
- ETA
- Reservation

が相互依存している。

そのため、局所最適は成立しない。

---

## Chapter 2｜Queue Propagation

### 基本構造

```txt
Queue increase
↓
Vehicle waiting
↓
Dispatch delay
↓
ETA deterioration
↓
Trips decrease
```

### Runtime State

- current_queue
- queue_growth_rate
- waiting_vehicle_count
- estimated_clear_time
- queue_severity

### Grafana表示

- Queue severity
- Waiting vehicles
- Time-to-clear
- HOLD/DEGRADED state

---

## Chapter 3｜Dispatch Propagation

### 基本構造

```txt
Dispatch latency
↓
Matching failure
↓
Vehicle imbalance
↓
Throughput degradation
```

### Runtime State

- dispatch_latency_ms
- matching_success_rate
- reroute_count
- unassigned_requests

### Grafana表示

- Dispatch delay
- Matching health
- Throughput trend

---

## Chapter 4｜Energy Propagation

### 基本構造

```txt
Hydrogen shortage
↓
Refill delay
↓
Fleet availability decrease
↓
Trips reduction
```

### Runtime State

- hydrogen_reserve
- reserve_threshold
- refill_eta
- energy_feasibility

### Grafana表示

- Energy reserve
- Reserve depletion risk
- Refill forecast

---

## Chapter 5｜ODD Propagation

### 基本構造

```txt
Weather restriction
↓
ODD shrink
↓
Dispatch reroute
↓
ETA degradation
↓
Queue increase
```

### Runtime State

- odd_status
- restricted_area_count
- reroute_load
- weather_risk_score

### Grafana表示

- ODD map
- Restricted zones
- Dispatch reroute state

---

# PART 2｜Runtime State

## Chapter 6｜Runtime State Role

runtime_stateは：

❌ 単なるJSON

ではない。

👉 都市運行OSの現在状態。

---

## Chapter 7｜State Layer

### Demand State

- reservation_count
- cancellation_rate
- demand_heat

### Dispatch State

- dispatch_latency
- matching_rate
- reroute_state

### Fleet State

- utilization
- occupancy
- idle_distribution

### Node State

- queue
- berth_usage
- turnaround

### Energy State

- reserve
- refill
- energy_risk

---

## Chapter 8｜State Transition

都市運行OSでは状態遷移を持つ。

```txt
AUTHORIZED
↓
HOLD
↓
DEGRADED
↓
STOP
```

### AUTHORIZED

通常運行。

### HOLD

制約接近。

### DEGRADED

性能低下。

### STOP

運行停止。

---

## Chapter 9｜Synchronization State

### 同期対象

- ETA
- Queue
- Dispatch timing
- Relay timing
- Energy timing

### 同期崩壊

```txt
Timing mismatch
↓
Queue growth
↓
Dispatch instability
```

---

# PART 3｜Grafana Mapping

## Chapter 10｜Why Grafana

Grafanaは：

👉 状態伝播を可視化する。

Obsidianは：

👉 原因・因果・設計思想を保持する。

---

## Chapter 11｜Mapping Structure

### Obsidian

- Collapse theory
- Constraint logic
- Arbitration
- Synchronization design

### runtime_state

- queue
- eta
- reserve
- throughput
- collapse_score

### Grafana

- HOLD state
- Queue severity
- ETA degradation
- Energy warning

---

## Chapter 12｜Execution Linkage

重要：

Grafanaは監視だけで終わらない。

```txt
Collapse detection
↓
Issue generation
↓
Execution task
↓
Backlog
↓
Implementation
```

まで接続する。
