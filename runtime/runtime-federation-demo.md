# Runtime Federation Demo Flow

This demo intentionally connects apps without real-world infrastructure.

The purpose is to demonstrate:

- collapse propagation,
- federation runtime,
- runtime synchronization,
- and responsibility boundaries.

## Demo federation

Seneschal
→ intent_created

Fleet
→ dispatch_started
→ queue_overflow

Urban
→ odd_reduced

Node
→ acceptance_delayed
→ h2_low

Grafana
→ observes collapse propagation and federation coverage.

## Demo collapse flow

intent_created
→ dispatch_started
→ queue_overflow
→ odd_reduced
→ acceptance_delayed
→ revenue degradation

## Important rule

Grafana does not control apps.

Grafana only:
- observes,
- audits,
- and visualizes runtime collapse.
