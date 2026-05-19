# Collapse Taxonomy

The development target is not feature count.
The development target is collapse reduction.

## Top rule

Collapse is not treated as a failure of the project.
Collapse visualization is the primary development method.

## Collapse categories

| Collapse Category | Description | Main Runtime |
|---|---|---|
| Demand Collapse | User demand cannot be converted into viable operation | Demand |
| Dispatch Collapse | Fleet dispatch cannot maintain operation | Fleet |
| ETA Integrity Collapse | ETA cannot remain reliable | Fleet / Demand |
| Urban Constraint Collapse | ODD or urban restriction breaks operation | Urban |
| Node Collapse | Acceptance / charging / H2 capacity becomes insufficient | Node |
| Energy Collapse | Energy balance cannot sustain operation | Energy |
| Revenue Collapse | Trips/utilization cannot sustain business | Business |
| Federation Collapse | Runtime layers are not synchronized | Federation |
| Responsibility Collapse | Decision boundaries are violated | Governance |

## Demand Collapse

### Propagation

Demand increase
→ Queue increase
→ ETA degradation
→ RideShare degradation
→ Revenue degradation

### Key events

- intent_created
- queue_overflow
- eta_degraded
- trip_lost

## Dispatch Collapse

### Propagation

Fleet reduction
→ Dispatch failure
→ Queue overflow
→ ETA degradation

### Key events

- dispatch_failed
- queue_overflow
- reallocation_started

## Urban Constraint Collapse

### Propagation

Weather deterioration
→ ODD reduction
→ Fleet availability reduction
→ Dispatch failure

### Key events

- odd_reduced
- weather_warning
- restriction_detected

## Node Collapse

### Propagation

H2 shortage / berth full
→ Node wait
→ Fleet stagnation
→ Dispatch degradation

### Key events

- h2_low
- berth_full
- acceptance_delayed
- charging_delayed

## Federation Collapse

### Definition

Ideal Runtime and Current Runtime are disconnected.

### Examples

- Seneschal intent is not connected to Fleet queue.
- Fleet ETA is not synchronized with user ETA.
- Urban ODD is not connected to dispatch feasibility.
- Node acceptance is not connected to dispatch routing.

## Responsibility Collapse

### Definition

Decision boundaries are violated.

### Examples

- Seneschal starts dispatch optimization.
- Fleet starts ODD ownership.
- Urban starts direct dispatch control.
- Node starts operational orchestration.

## Progress evaluation

Progress is evaluated by:

- Collapse reduction
- Federation coverage increase
- Runtime synchronization increase
- Responsibility integrity preservation

Progress is NOT evaluated by:

- Number of screens
- Number of features
- Animation quantity
- UI complexity
