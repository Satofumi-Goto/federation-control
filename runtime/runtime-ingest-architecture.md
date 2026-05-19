# Runtime Event Ingest Architecture

Grafana is a Runtime Auditor.

Apps emit runtime events.
Grafana observes collapse, synchronization, and federation coverage.

## Federation Flow

Apps -> Event Gateway -> Event Store -> Grafana Runtime Observatory

## Seneschal

Role:
Demand and Intent Runtime.

Events:
- intent_created
- eta_requested
- rideshare_requested
- calendar_triggered

## Fleet Operations

Role:
Dispatch Runtime.

Events:
- dispatch_started
- dispatch_failed
- queue_overflow
- eta_degraded

## Urban Operations

Role:
Urban Constraint Runtime.

Events:
- odd_reduced
- weather_warning
- restriction_detected

## Node and Energy

Role:
Capacity Runtime.

Events:
- acceptance_delayed
- h2_low
- soc_low
- berth_full

## Event Gateway

Purpose:
Normalize app-specific events into Federation Runtime schema.

The gateway does not:
- modify app logic
- own dispatch
- own ODD
- own operational decisions

The gateway only:
- validates schema
- timestamps events
- attaches runtime layer
- forwards events to observability

## Grafana Panels

1. Runtime Health
2. Collapse Timeline
3. Federation Coverage
4. Responsibility Integrity

## Current Phase

Current phase is Ideal Runtime Definition.
Many Missing and Partial states are expected.

Progress is evaluated by:
- collapse reduction
- synchronization increase
- federation coverage increase
