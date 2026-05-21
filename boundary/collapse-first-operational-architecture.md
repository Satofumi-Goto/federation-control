# Collapse First Operational Architecture

## 目的

都市OS Runtime Federation は runtime から始めない。

最初に見るべきものは：

```text
何が崩壊するか
どう伝播するか
どう封じ込めるか
どう復旧するか
```

つまり：

```text
collapse structure = operational architecture
```

---

# 最上位構造

```text
/collapse
├─ queue-collapse
├─ odd-collapse
├─ energy-collapse
├─ node-collapse
├─ dispatch-collapse
└─ federation-collapse
```

---

# queue-collapse

## 対象

- 配車待ち
- 乗車待ち
- 降車待ち
- 充填待ち
- 充電待ち
- 拠点受入待ち
- 再配置待ち

## repository structure

```text
/collapse/queue-collapse
├─ prediction
├─ detection
├─ propagation
├─ throttling
├─ reroute
├─ fallback
├─ recovery
└─ metrics
```

## prediction

```text
/collapse/queue-collapse/prediction
├─ queue-growth-prediction.ts
├─ queue-saturation-prediction.ts
├─ wait-time-prediction.ts
├─ node-delay-prediction.ts
└─ dispatch-delay-prediction.ts
```

## detection

```text
/collapse/queue-collapse/detection
├─ queue-saturation-detection.ts
├─ queue-overflow-detection.ts
├─ wait-time-threshold.ts
└─ queue-pressure-index.ts
```

## propagation

```text
/collapse/queue-collapse/propagation
├─ queue-to-dispatch-propagation.ts
├─ queue-to-eta-propagation.ts
├─ queue-to-node-propagation.ts
└─ queue-to-energy-propagation.ts
```

## control

```text
/collapse/queue-collapse/throttling
├─ queue-throttling.ts
├─ dispatch-limitation.ts
├─ low-priority-delay.ts
└─ acceptance-rate-control.ts
```

## recovery

```text
/collapse/queue-collapse/recovery
├─ queue-recovery.ts
├─ overflow-recovery.ts
├─ queue-normalization.ts
└─ recovery-condition.ts
```

---

# odd-collapse

## 対象

- ODD縮退
- 天候制約
- 視界制約
- 道路制約
- 走行可能領域縮小

## repository structure

```text
/collapse/odd-collapse
├─ prediction
├─ detection
├─ restriction-expansion
├─ route-isolation
├─ fallback
├─ recovery
└─ metrics
```

## prediction

```text
/collapse/odd-collapse/prediction
├─ weather-risk-prediction.ts
├─ visibility-risk-prediction.ts
├─ restriction-expansion-prediction.ts
└─ odd-availability-prediction.ts
```

## detection

```text
/collapse/odd-collapse/detection
├─ odd-reduction-detection.ts
├─ weather-threshold.ts
├─ visibility-threshold.ts
└─ restriction-zone-detection.ts
```

## propagation

```text
/collapse/odd-collapse/restriction-expansion
├─ odd-to-dispatch-propagation.ts
├─ odd-to-queue-propagation.ts
├─ odd-to-route-propagation.ts
└─ odd-to-fleet-capacity.ts
```

## fallback

```text
/collapse/odd-collapse/fallback
├─ reduced-odd-fallback.ts
├─ route-isolation.ts
├─ human-takeover-fallback.ts
└─ service-area-reduction.ts
```

## recovery

```text
/collapse/odd-collapse/recovery
├─ odd-recovery.ts
├─ restriction-recovery.ts
├─ route-recovery.ts
└─ recovery-condition.ts
```

---

# energy-collapse

## 対象

- SOC不足
- 水素供給不足
- 再エネ不足
- 系統受電制約
- 充電余力不足

## repository structure

```text
/collapse/energy-collapse
├─ prediction
├─ detection
├─ allocation
├─ limitation
├─ fallback
├─ recovery
└─ metrics
```

## prediction

```text
/collapse/energy-collapse/prediction
├─ soc-shortage-prediction.ts
├─ hydrogen-shortage-prediction.ts
├─ renewable-shortage-prediction.ts
├─ grid-margin-prediction.ts
└─ energy-buffer-prediction.ts
```

## detection

```text
/collapse/energy-collapse/detection
├─ low-soc-detection.ts
├─ low-hydrogen-detection.ts
├─ renewable-shortage-detection.ts
└─ charging-margin-threshold.ts
```

## propagation

```text
/collapse/energy-collapse/allocation
├─ energy-to-node-propagation.ts
├─ energy-to-fleet-propagation.ts
├─ energy-to-dispatch-propagation.ts
└─ energy-to-service-capacity.ts
```

## limitation

```text
/collapse/energy-collapse/limitation
├─ charging-limitation.ts
├─ hydrogen-limitation.ts
├─ dispatch-energy-limitation.ts
└─ service-capacity-limitation.ts
```

## recovery

```text
/collapse/energy-collapse/recovery
├─ charging-recovery.ts
├─ hydrogen-recovery.ts
├─ renewable-recovery.ts
└─ energy-buffer-recovery.ts
```

---

# node-collapse

## 対象

- 拠点受入飽和
- バース不足
- 充電待ち
- 充填待ち
- 搬入滞留

## repository structure

```text
/collapse/node-collapse
├─ prediction
├─ detection
├─ acceptance-control
├─ bypass
├─ fallback
├─ recovery
└─ metrics
```

## prediction

```text
/collapse/node-collapse/prediction
├─ berth-saturation-prediction.ts
├─ acceptance-delay-prediction.ts
├─ charging-queue-prediction.ts
└─ hydrogen-queue-prediction.ts
```

## detection

```text
/collapse/node-collapse/detection
├─ node-saturation-detection.ts
├─ berth-overflow-detection.ts
├─ acceptance-threshold.ts
└─ node-pressure-index.ts
```

## control

```text
/collapse/node-collapse/acceptance-control
├─ acceptance-rate-control.ts
├─ berth-allocation-control.ts
├─ charging-slot-control.ts
└─ hydrogen-slot-control.ts
```

## bypass

```text
/collapse/node-collapse/bypass
├─ node-bypass-routing.ts
├─ alternate-node-selection.ts
├─ bypass-condition.ts
└─ node-overflow-routing.ts
```

## recovery

```text
/collapse/node-collapse/recovery
├─ node-recovery.ts
├─ acceptance-recovery.ts
├─ berth-recovery.ts
└─ recovery-condition.ts
```

---

# dispatch-collapse

## 対象

- 配車不能
- 再配車失敗
- vehicle assignment失敗
- reroute過負荷

## repository structure

```text
/collapse/dispatch-collapse
├─ prediction
├─ detection
├─ assignment-control
├─ reroute-control
├─ fallback
├─ recovery
└─ metrics
```

## prediction

```text
/collapse/dispatch-collapse/prediction
├─ assignment-failure-prediction.ts
├─ reroute-overflow-prediction.ts
├─ fleet-shortage-prediction.ts
└─ dispatch-latency-prediction.ts
```

## detection

```text
/collapse/dispatch-collapse/detection
├─ assignment-timeout-detection.ts
├─ reroute-failure-detection.ts
├─ fleet-shortage-detection.ts
└─ dispatch-overflow-index.ts
```

## control

```text
/collapse/dispatch-collapse/assignment-control
├─ assignment-priority-control.ts
├─ dispatch-reduction-control.ts
├─ vehicle-capacity-control.ts
└─ low-priority-cancel-control.ts
```

## recovery

```text
/collapse/dispatch-collapse/recovery
├─ dispatch-recovery.ts
├─ assignment-recovery.ts
├─ reroute-recovery.ts
└─ recovery-condition.ts
```

---

# federation-collapse

## 対象

- runtime同期崩壊
- 状態不整合
- 制約伝播不能
- recovery不整合

## repository structure

```text
/collapse/federation-collapse
├─ prediction
├─ detection
├─ isolation
├─ synchronization-control
├─ fallback
├─ recovery
└─ metrics
```

## prediction

```text
/collapse/federation-collapse/prediction
├─ sync-latency-prediction.ts
├─ runtime-desync-prediction.ts
├─ propagation-risk-prediction.ts
└─ federation-margin-prediction.ts
```

## detection

```text
/collapse/federation-collapse/detection
├─ sync-latency-detection.ts
├─ runtime-desync-detection.ts
├─ federation-health-check.ts
└─ propagation-break-detection.ts
```

## isolation

```text
/collapse/federation-collapse/isolation
├─ runtime-isolation.ts
├─ isolation-condition.ts
├─ degraded-mode.ts
└─ safe-mode.ts
```

## recovery

```text
/collapse/federation-collapse/recovery
├─ federation-recovery.ts
├─ runtime-rejoin.ts
├─ synchronization-recovery.ts
└─ recovery-condition.ts
```

---

# collapse lifecycle

```text
prediction
↓
detection
↓
propagation
↓
control
↓
fallback
↓
recovery
```

---

# runtime mapping

```text
queue-collapse      → queue-runtime / dispatch-runtime / node-runtime
odd-collapse        → odd-runtime / dispatch-runtime / federation-runtime
energy-collapse     → energy-runtime / node-runtime / dispatch-runtime
node-collapse       → node-runtime / queue-runtime / energy-runtime
dispatch-collapse   → dispatch-runtime / queue-runtime / federation-runtime
federation-collapse → federation-runtime / all-runtime
```

---

# 最重要

この構造では runtime が主役ではない。

主役は collapse unit。

runtime は collapse を検知・封じ込め・復旧するための実装責務である。
