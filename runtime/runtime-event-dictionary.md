# Runtime Event Dictionary

Grafana is the runtime auditor. Apps emit events. Grafana audits collapse, synchronization, responsibility, and coverage.

## Rule

Grafana must not instruct apps directly.
Grafana only observes runtime events and visualizes collapse reduction.

## Event envelope

```json
{
  "event": "event_name",
  "source_app": "seneschal | fleet | urban | node | integration",
  "runtime_layer": "demand | fleet | urban | node | energy | business",
  "severity": "info | degraded | collapse",
  "timestamp": "ISO-8601",
  "region": "string",
  "correlation_id": "string",
  "payload": {}
}
```

## Seneschal events

| Event | Layer | Meaning | Collapse Link |
|---|---|---|---|
| intent_created | demand | User intent was generated | Demand to Dispatch |
| eta_requested | demand | User requested ETA | ETA Integrity |
| rideshare_requested | demand | RideShare request was generated | Demand Matching |
| calendar_triggered | demand | Calendar created operation demand | Demand Generation |
| request_cancelled | demand | User cancelled request | Demand Quality |

## Fleet events

| Event | Layer | Meaning | Collapse Link |
|---|---|---|---|
| dispatch_started | fleet | Dispatch process started | Dispatch Runtime |
| dispatch_success | fleet | Dispatch succeeded | Dispatch Runtime |
| dispatch_failed | fleet | Dispatch failed | Dispatch Collapse |
| queue_overflow | fleet | Dispatch queue exceeded threshold | Queue Collapse |
| eta_degraded | fleet | ETA reliability worsened | ETA Integrity |
| reallocation_started | fleet | Re-dispatch started | Recovery Runtime |

## Urban events

| Event | Layer | Meaning | Collapse Link |
|---|---|---|---|
| odd_reduced | urban | ODD was reduced | Urban Constraint Collapse |
| weather_warning | urban | Weather risk detected | ODD / Fleet Availability |
| restriction_detected | urban | Road or area restriction detected | Urban Constraint |
| urban_queue_detected | urban | City-level queue detected | Urban Queue |

## Node / Energy events

| Event | Layer | Meaning | Collapse Link |
|---|---|---|---|
| acceptance_available | node | Node can accept vehicles | Node Capacity |
| acceptance_delayed | node | Acceptance is delayed | Node Collapse |
| berth_full | node | Berth is full | Node Wait |
| h2_low | energy | Hydrogen is low | Energy Constraint |
| soc_low | energy | Battery SOC is low | Energy Constraint |
| charging_delayed | node | Charging is delayed | Node / Energy Collapse |
| swap_queue_overflow | node | Swap queue exceeded threshold | Node Collapse |

## Business / integration events

| Event | Layer | Meaning | Collapse Link |
|---|---|---|---|
| trip_completed | business | Trip completed | Revenue Runtime |
| trip_lost | business | Trip was lost | Revenue Collapse |
| revenue_degraded | business | Revenue worsened | Business Collapse |
| utilization_degraded | business | Utilization worsened | Business Collapse |

## Minimum first connection

1. Seneschal: intent_created
2. Fleet: dispatch_failed / queue_overflow
3. Urban: odd_reduced
4. Node: acceptance_delayed / h2_low
5. Integration: trip_lost / revenue_degraded
