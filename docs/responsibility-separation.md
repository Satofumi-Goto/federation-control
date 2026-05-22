# Responsibility Separation (Canonical)

## Top-Level Principle

```text
Knowledge
↓
Runtime
↓
Operation
↓
Business Feasibility
```

Urban OS Runtime Federation is the canonical control structure.

---

# Responsibility Ownership

| Domain | Primary Owner | Responsibility |
|---|---|---|
| AUTHORIZED / HOLD / STOP | Urban OS | City-wide feasibility judgment |
| Demand Federation | Urban OS | Demand synchronization and prioritization |
| Dispatch Execution | Fleet Operations | Vehicle execution and dispatch runtime |
| ETA Runtime | Fleet Operations | ETA generation and runtime update |
| Queue Runtime | Fleet + Node | Queue execution and berth coordination |
| Energy Constraint | Service Hub / Node | Energy limitation and acceptance control |
| ODD Constraint | Urban OS | Operational design domain federation |
| Throughput Federation | Urban OS | City-wide throughput optimization |
| Node Acceptance | Service Hub / Node | Berth / charging / fueling acceptance |
| Runtime Alignment | Federation Control | Cross-console synchronization |

---

# Responsibility Separation Rules

## Urban OS

- city-wide decision
- AUTHORIZED / HOLD / STOP
- federation synchronization
- feasibility judgment
- collapse prevention
- constraint federation
- throughput optimization
- runtime governance

Urban OS does NOT directly execute vehicle dispatch.
Urban OS does NOT directly operate energy hardware.

---

## Fleet Operations Console

- dispatch execution
- vehicle runtime
- ETA update
- queue execution
- operator execution
- route runtime
- execution monitoring

Fleet does NOT own city-wide feasibility.
Fleet does NOT own energy constraints.

---

## Service Hub / Node Console

- berth control
- charging/fueling acceptance
- queue acceptance
- hydrogen / energy state
- energy runtime
- maintenance runtime
- local constraint runtime

Node does NOT own city-wide dispatch.
Node does NOT own AUTHORIZED / HOLD / STOP.

---

## Federation Control

- runtime alignment
- synchronization monitoring
- mismatch detection
- collapse risk visualization
- ownership federation
- drift monitoring
- KPI synchronization

---

# Runtime Federation State

| Runtime Item | Urban OS | Fleet | Node |
|---|---|---|---|
| Demand | OWN | RECEIVE | RECEIVE |
| Dispatch | AUTHORIZE | EXECUTE | ACCEPT |
| Queue | OBSERVE | EXECUTE | ACCEPT |
| ETA | AGGREGATE | OWN | RECEIVE |
| Energy | RECEIVE | CONSUME | OWN |
| Constraint | OWN | RECEIVE | RECEIVE |
| ODD | OWN | RECEIVE | RECEIVE |
| Throughput | OWN | RECEIVE | RECEIVE |

---

# Canonical Rules

```text
GitHub = Canonical
Grafana = Runtime Visualization
Base44 = Preview / Push
Obsidian = Knowledge / Reasoning
```

---

# Grafana Runtime Federation

Grafana dashboards visualize:

- synchronization
- ownership
- runtime alignment
- collapse prevention
- KPI federation
- runtime drift
- constraint propagation
- throughput runtime

Grafana is NOT the canonical ownership definition.
GitHub markdown definitions are canonical.
