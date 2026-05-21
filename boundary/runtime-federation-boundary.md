# Runtime Federation Boundary

## Runtime Structure

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
├─ dispatch-engine.ts
├─ dispatch-priority.ts
├─ dispatch-assignment.ts
├─ dispatch-reroute.ts
├─ dispatch-fallback.ts
├─ dispatch-capacity.ts
├─ dispatch-state.ts
├─ dispatch-queue-sync.ts
├─ dispatch-node-sync.ts
├─ dispatch-odd-sync.ts
├─ dispatch-recovery.ts
├─ dispatch-overflow.ts
└─ dispatch-metrics.ts
```

responsibility:
- vehicle assignment
- reroute
- dispatch fallback

collapse trigger:
- dispatch timeout
- queue overflow

fallback:
- nearest fleet fallback
- dispatch reduction mode

## queue-runtime

```text
/queue-runtime
├─ queue-state.ts
├─ queue-capacity.ts
├─ queue-pressure.ts
├─ queue-overflow.ts
├─ overflow-trigger.ts
├─ overflow-detection.ts
├─ queue-sync.ts
├─ dispatch-sync.ts
├─ node-sync.ts
├─ queue-recovery.ts
├─ fallback-queue.ts
├─ recovery-condition.ts
├─ queue-latency.ts
├─ queue-utilization.ts
└─ queue-margin.ts
```

responsibility:
- queue state
- overflow detection
- wait estimation

collapse trigger:
- queue saturation
- acceptance delay

fallback:
- queue throttling
- overflow rerouting

## odd-runtime

```text
/odd-runtime
├─ odd-state.ts
├─ odd-reduction.ts
├─ odd-recovery.ts
├─ weather-sync.ts
├─ weather-restriction.ts
├─ regulation-restriction.ts
├─ restriction-zone.ts
├─ collapse-zone.ts
├─ restriction-sync.ts
├─ odd-sync.ts
├─ odd-metrics.ts
├─ fallback-runtime.ts
├─ recovery-condition.ts
└─ odd-capacity.ts
```

responsibility:
- ODD state
- weather restriction
- ODD recovery

collapse trigger:
- heavy rain
- low visibility

fallback:
- reduced ODD
- route restriction

## node-runtime

```text
/node-runtime
├─ acceptance-state.ts
├─ berth-allocation.ts
├─ charging-queue.ts
├─ hydrogen-queue.ts
├─ node-capacity.ts
├─ node-saturation.ts
├─ acceptance-sync.ts
├─ charging-sync.ts
├─ hydrogen-sync.ts
├─ node-recovery.ts
├─ fallback-acceptance.ts
├─ node-margin.ts
└─ node-metrics.ts
```

responsibility:
- acceptance
- charging queue
- hydrogen queue

collapse trigger:
- berth saturation
- hydrogen depletion

fallback:
- node rerouting
- charging reduction

## energy-runtime

```text
/energy-runtime
├─ soc-state.ts
├─ charging-margin.ts
├─ hydrogen-margin.ts
├─ renewable-margin.ts
├─ grid-margin.ts
├─ charging-sync.ts
├─ hydrogen-sync.ts
├─ energy-sync.ts
├─ energy-recovery.ts
├─ fallback-energy.ts
├─ energy-buffer.ts
├─ energy-utilization.ts
└─ energy-metrics.ts
```

responsibility:
- SOC state
- hydrogen margin
- renewable margin

collapse trigger:
- low SOC
- low hydrogen

fallback:
- charging limitation
- dispatch reduction

## federation-runtime

```text
/federation-runtime
├─ federation-state.ts
├─ runtime-sync.ts
├─ sync-latency.ts
├─ collapse-propagation.ts
├─ collapse-trigger.ts
├─ fallback-coordination.ts
├─ recovery-coordination.ts
├─ federation-capacity.ts
├─ federation-margin.ts
├─ federation-health.ts
├─ federation-metrics.ts
├─ runtime-registry.ts
├─ runtime-dependency.ts
├─ runtime-topology.ts
└─ runtime-center.ts
```

responsibility:
- runtime synchronization
- collapse propagation
- recovery coordination

collapse trigger:
- runtime desynchronization
- queue propagation
- energy shortage propagation

fallback:
- runtime isolation
- ODD downgrade
- queue throttling
