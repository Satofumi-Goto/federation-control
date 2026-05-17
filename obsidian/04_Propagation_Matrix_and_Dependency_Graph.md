# Propagation Matrix and Dependency Graph

## 最上位定義

都市運行OSでは：

```txt
局所障害
≠
局所問題
```

である。

すべての状態は相互依存する。

---

# PART 1｜Dependency Graph

## Chapter 1｜Dependency Definition

Dependencyとは：

```txt
ある状態が別状態へ依存する構造
```

である。

---

## Chapter 2｜Federation Dependency

Demand
↓
Matching
↓
Dispatch
↓
Fleet
↓
Node
↓
Energy
↓
Trips

---

## Chapter 3｜Queue Dependency

Queue depends on:

- Dispatch timing
- Fleet arrival
- Node availability
- Relay timing
- Energy timing

---

## Chapter 4｜ETA Dependency

ETA depends on:

- Dispatch
- Queue
- Traffic
- Reroute
- ODD

---

## Chapter 5｜Throughput Dependency

Throughput depends on:

- Fleet utilization
- Queue stability
- Energy reserve
- Synchronization

---

# PART 2｜Propagation Matrix

## Chapter 6｜Queue Matrix

Queue overflow
↓
Dispatch delay
↓
ETA degradation
↓
Trips reduction
↓
Revenue deterioration

---

## Chapter 7｜Energy Matrix

Hydrogen shortage
↓
Refill delay
↓
Fleet restriction
↓
Throughput degradation
↓
IRR deterioration

---

## Chapter 8｜ODD Matrix

Weather restriction
↓
ODD shrink
↓
Reroute increase
↓
ETA deterioration
↓
Queue growth

---

## Chapter 9｜Synchronization Matrix

Timing mismatch
↓
Queue instability
↓
Dispatch instability
↓
Trips degradation

---

# PART 3｜Runtime State Dependency

## Chapter 10｜Queue Runtime

- queue_size
- waiting_time
- overflow_risk

Dependencies:
- berth_usage
- dispatch_timing
- arrival_rate

---

## Chapter 11｜Energy Runtime

- reserve
- refill_eta
- depletion_score

Dependencies:
- fleet_usage
- dispatch_load
- node_status

---

## Chapter 12｜Dispatch Runtime

- dispatch_latency
- reroute_count
- matching_rate

Dependencies:
- queue
- fleet_distribution
- ODD

---

# PART 4｜Grafana Mapping

## Chapter 13｜Dependency Visualization

Grafanaでは：

- queue severity
- dispatch delay
- throughput trend
- reserve trend

を表示する。

---

## Chapter 14｜Propagation Visualization

Grafanaでは：

Cause
↓
Propagation
↓
Impact

を表示する。

---

## Chapter 15｜Execution Link

Propagation severity
↓
Issue generation
↓
Execution task
↓
Implementation
