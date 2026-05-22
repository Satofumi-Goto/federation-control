# Runtime Federation Workspace Rule

## Runtime Workspace

Grafana acts as Runtime Federation Workspace.

Runtime Workspace is:

* Federation
* KPI
* Runtime synchronization
* Queue propagation
* ODD constraint
* Node synchronization
* Collapse propagation
* AUTHORIZED / HOLD / STOP visualization

Runtime Workspace is not the Operational Console itself.

---

## Operational Console

Base44 acts as Operational Console.

Operational Console handles:

* dispatch
* queue handling
* runtime workflow
* modal interaction
* operational UX
* runtime operation

---

## Runtime Router

/runtime acts as:

* Runtime Federation Workspace
* Operational Console Router

/runtime must not expose Base44 preview URLs.

`/runtime` row3 must not link directly to Base44 production URLs.

---

## Base44 Integration Rule

Base44 Operational Consoles are embedded inside Grafana Runtime Workspace via iframe embed dashboards.

Router flow:

`/runtime` → `/d/runtime-*-embed/*` → iframe(Base44 production app)

Embed dashboards (canonical):

* `runtime-fleet-embed`
* `runtime-service-hub-embed`
* `runtime-life-embed`
* `runtime-urban-embed`

Do not expose:

* direct Base44 URL navigation from Router panels
* external preview feeling
* Base44 login redirect as the primary entry
* app launcher dialog
* external app routing feeling

---

## Federation Naming

Needs翻訳:

* rename toward Runtime Federation / Needs Federation

アライメント:

* rename toward Federation alignment
* Router icon: puzzle (🧩)

Reason:
The workspace handles runtime synchronization rather than alliance management.

---

## Canonical Rule

GitHub = Canonical
Grafana = Runtime Workspace
Base44 = Operational Console

---

## Long-term Rule

This structure is treated as a permanent Runtime Federation operation rule.
