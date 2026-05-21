# Collapse Lifecycle Runtime

## 最上位構造

```text
/runtime
├─ dispatch-runtime
├─ queue-runtime
├─ odd-runtime
├─ node-runtime
├─ energy-runtime
└─ federation-runtime
```

## dispatch-runtime

```text
/dispatch-runtime
├─ prediction
├─ planning
├─ control
├─ coordination
├─ fallback
├─ recovery
└─ metrics
```

### prediction

```text
/dispatch-runtime/prediction
├─ dispatch-demand-prediction.ts
├─ dispatch-overflow-prediction.ts
├─ reroute-prediction.ts
├─ dispatch-delay-prediction.ts
└─ dispatch-capacity-prediction.ts
```

### planning

```text
/dispatch-runtime/planning
├─ dispatch-priority-planning.ts
├─ reroute-planning.ts
├─ dispatch-reduction-planning.ts
└─ fleet-redistribution-planning.ts
```

### control

```text
/dispatch-runtime/control
├─ dispatch-control.ts
├─ reroute-control.ts
├─ dispatch-throttling.ts
└─ fleet-assignment-control.ts
```

### coordination

```text
/dispatch-runtime/coordination
├─ queue-coordination.ts
├─ odd-coordination.ts
├─ node-coordination.ts
└─ energy-coordination.ts
```

### fallback

```text
/dispatch-runtime/fallback
├─ nearest-fleet-fallback.ts
├─ dispatch-reduction-fallback.ts
├─ reroute-fallback.ts
└─ low-priority-cancel.ts
```

### recovery

```text
/dispatch-runtime/recovery
├─ dispatch-recovery.ts
├─ reroute-recovery.ts
├─ fleet-recovery.ts
└─ recovery-condition.ts
```

## queue-runtime

```text
/queue-runtime
├─ prediction
├─ planning
├─ control
├─ coordination
├─ fallback
├─ recovery
└─ metrics
```

### prediction

```text
/queue-runtime/prediction
├─ queue-growth-prediction.ts
├─ overflow-prediction.ts
├─ wait-time-prediction.ts
└─ saturation-prediction.ts
```

### control

```text
/queue-runtime/control
├─ queue-throttling.ts
├─ queue-redistribution.ts
├─ dispatch-limitation.ts
└─ overflow-control.ts
```

### fallback

```text
/queue-runtime/fallback
├─ queue-fallback.ts
├─ overflow-reroute.ts
├─ low-priority-drop.ts
└─ queue-isolation.ts
```

### recovery

```text
/queue-runtime/recovery
├─ queue-recovery.ts
├─ overflow-recovery.ts
├─ queue-normalization.ts
└─ recovery-condition.ts
```

## odd-runtime

```text
/odd-runtime
├─ prediction
├─ planning
├─ control
├─ coordination
├─ fallback
├─ recovery
└─ metrics
```

### prediction

```text
/odd-runtime/prediction
├─ weather-prediction.ts
├─ visibility-prediction.ts
├─ restriction-prediction.ts
└─ odd-collapse-prediction.ts
```

### control

```text
/odd-runtime/control
├─ odd-reduction-control.ts
├─ restriction-control.ts
├─ route-restriction-control.ts
└─ odd-capacity-control.ts
```

### fallback

```text
/odd-runtime/fallback
├─ reduced-odd-fallback.ts
├─ human-takeover-fallback.ts
├─ route-isolation.ts
└─ restriction-fallback.ts
```

### recovery

```text
/odd-runtime/recovery
├─ odd-recovery.ts
├─ restriction-recovery.ts
├─ route-recovery.ts
└─ recovery-condition.ts
```

## federation-runtime

```text
/federation-runtime
├─ prediction
├─ planning
├─ control
├─ coordination
├─ fallback
├─ recovery
└─ metrics
```

### control

```text
/federation-runtime/control
├─ runtime-sync-control.ts
├─ collapse-propagation-control.ts
├─ federation-capacity-control.ts
└─ runtime-isolation-control.ts
```

### fallback

```text
/federation-runtime/fallback
├─ runtime-isolation-fallback.ts
├─ queue-throttling-fallback.ts
├─ odd-downgrade-fallback.ts
└─ node-bypass-fallback.ts
```

### recovery

```text
/federation-runtime/recovery
├─ federation-recovery.ts
├─ synchronization-recovery.ts
├─ runtime-rejoin.ts
└─ recovery-condition.ts
```

## 最重要

collapse lifecycle = repository structure

prediction
planning
control
coordination
fallback
recovery

が都市OS Runtime Federation の中核。
