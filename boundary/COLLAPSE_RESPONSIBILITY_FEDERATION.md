# Collapse Responsibility Federation

Top subject: Collapse.

Propagation:
Need -> Dispatch -> Queue -> ODD -> Constraint -> Energy -> Node.

Reverse propagation:
Node -> Energy -> Constraint -> ODD -> Queue -> Dispatch -> Need.

Owners:
- Need: Life Transaction
- Dispatch: Fleet
- Queue: Federated
- ODD: Vehicle / Urban OS
- Constraint: Urban OS
- Energy: Service Hub / Energy Provider
- Node: Service Hub

Boundary rules:
- Fleet must not directly control Node energy equipment.
- Urban OS decides and synchronizes, but does not become daily fleet operations.
- Service Hub owns acceptance and energy constraints. Fleet references them.
- Life Transaction creates demand and customer confirmation. It does not execute dispatch.
- ODD and safety override demand, ETA, and utilization.

Collapse events:
- Queue overflow: shared dispatch, reallocation, HOLD order change.
- Energy shortage: trips cap, refuel slot limitation, Node rebalance.
- ODD exit: reroute, fallback, STOP.
- ETA collapse: customer notice, dispatch recalculation, SLA protection.

Runtime states:
AUTHORIZED / HOLD / STOP.

KPI basis:
- alignmentScore = responsibility matched layers / required layers
- collapseRisk = active collapse events / monitored collapse events
- syncLatency = last runtime sync latency
- recoveryProgress = completed recovery actions / required recovery actions

Fixed operation:
GitHub is Canonical.
Grafana is Runtime Workspace.
Base44 is Preview / Push.
