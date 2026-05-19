# Runtime Synchronization Boundary Matrix

Grafana visualizes bidirectional runtime synchronization, but each runtime keeps independent ownership.

## Ownership Matrix

| Runtime | Owns | Does Not Own |
|---|---|---|
| Seneschal | Intent, Calendar, ETA request, Wallet UI, Shared request, Life sync entry | Dispatch, ODD, Node routing, Capacity control |
| Fleet | Dispatch, Queue, ETA generation, Vehicle allocation, Provider comparison | Wallet state, Settlement, ODD ownership, Node capacity ownership |
| Life Transaction | Wallet state, Settlement, Subscription, P2P, Shared transaction, Credit state | Dispatch, ODD, Vehicle allocation, Node capacity |
| Urban | ODD, Weather, Traffic, Urban queue, Urban load, Constraint | Dispatch execution, Wallet, Settlement, Node capacity |
| Node | PPA, VPP, H2, SOC, Charging, Swap, Capacity, Berth, Acceptance | Intent, Calendar, Wallet, Dispatch ownership |

## Allowed Synchronization

| From | To | Allowed Sync |
|---|---|---|
| Seneschal | Fleet | intent_created, eta_requested, shared_request |
| Fleet | Seneschal | dispatch_state, eta_generated, queue_delay |
| Seneschal | Life Transaction | wallet_view_request, shared_payment_request, subscription_view |
| Life Transaction | Seneschal | wallet_state, settlement_state, subscription_state |
| Urban | Fleet | odd_state, weather_warning, road_constraint |
| Fleet | Urban | fleet_load, dispatch_pressure, route_pressure |
| Node | Fleet | acceptance_state, h2_state, soc_state, berth_state |
| Fleet | Node | arrival_plan, charging_request, swap_request |
| Life Transaction | Fleet | payment_validity, subscription_validity |
| Fleet | Life Transaction | trip_result, usage_record, fare_request |
| Node | Life Transaction | charging_fee, energy_usage, node_usage_record |
| Life Transaction | Node | settlement_state, subscription_state |

## Forbidden Synchronization

| Runtime | Forbidden |
|---|---|
| Seneschal | Dispatch override, ODD override, Node routing override, capacity control |
| Fleet | Wallet rewrite, settlement decision, ODD ownership, node capacity rewrite |
| Life Transaction | Dispatch control, ETA generation, ODD control, fleet allocation |
| Urban | Dispatch ownership, wallet rewrite, settlement decision, node operation ownership |
| Node | Calendar rewrite, intent rewrite, dispatch ownership, wallet decision |

## Conflict Priority

| Conflict | Winner |
|---|---|
| Intent vs ODD | Urban ODD |
| Intent vs Node capacity | Node capacity |
| Dispatch vs Node acceptance | Node acceptance |
| Dispatch vs ODD | Urban ODD |
| Wallet validity vs Dispatch request | Life Transaction validity |
| Subscription failure vs RideShare request | Life Transaction validity |
| Fleet utilization vs Energy shortage | Node / Energy constraint |

## Grafana Rule

Grafana observes boundary violations.
Grafana does not correct them.

Boundary violation is treated as Responsibility Collapse.
