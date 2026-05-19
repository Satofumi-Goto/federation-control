# Runtime Health Model

Runtime health is not a simple KPI value.

Runtime health measures synchronization viability.

## Runtime Health States

| State | Meaning |
|---|---|
| Healthy | Runtime synchronization maintained |
| Degraded | Synchronization weakening |
| Collapse | Runtime no longer sustainable |
| Missing | Runtime connection does not exist |

## Runtime Targets

### Demand Runtime

Observe:
- intent_created
- eta_requested
- rideshare_requested

### Fleet Runtime

Observe:
- dispatch_started
- dispatch_failed
- queue_overflow

### Urban Runtime

Observe:
- odd_reduced
- restriction_detected
- weather_warning

### Node Runtime

Observe:
- acceptance_delayed
- h2_low
- berth_full

### Business Runtime

Observe:
- trip_lost
- revenue_degraded
- utilization_degraded

## Runtime Federation Principle

The objective is not perfect synchronization.

The objective is:
- observable collapse,
- visible propagation,
- and responsibility-safe federation.
