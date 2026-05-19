# Federation Coverage

Federation Coverage measures how much of the Ideal Runtime is actually connected.

The current phase is expected to contain many Missing and Partial states.

## Coverage States

| State | Meaning |
|---|---|
| Missing | No runtime connection exists |
| Partial | Runtime connection exists but is incomplete |
| Connected | Runtime connection exists |
| Synchronized | Runtime connection and synchronization are validated |
| Governed | Runtime is observable and responsibility-safe |

## Federation Coverage Matrix

| Runtime Connection | Current State | Ideal State |
|---|---|---|
| Seneschal Intent → Fleet Dispatch | Missing | Synchronized |
| Fleet ETA → User ETA | Partial | Governed |
| Urban ODD → Dispatch Feasibility | Missing | Synchronized |
| Node Acceptance → Fleet Routing | Missing | Synchronized |
| Revenue → Runtime Health | Missing | Governed |
| Energy Constraint → Dispatch Runtime | Partial | Governed |

## Coverage Goal

The goal is NOT full integration.

The goal is:

- observable collapse,
- runtime synchronization,
- responsibility integrity,
- and collapse reduction.

## Current expected state

The current system intentionally remains fragmented because:

- apps are still PoC-level,
- runtime schema is evolving,
- and governance is being defined.

Therefore, many Missing and Partial states are considered normal.

## Long-term target

```text
Ideal Runtime
    ↓
Observed Collapse
    ↓
Event Federation
    ↓
Synchronization
    ↓
Governed Runtime Federation
```

## Company interpretation

### Toyota

Coverage target:
Integrated operation viability.

### Denso

Coverage target:
Translation from runtime collapse to control/runtime modules.

### Honda

Coverage target:
Energy and mobility synchronization.
