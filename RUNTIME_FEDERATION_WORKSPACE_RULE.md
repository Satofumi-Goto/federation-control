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

`/runtime` row3 must not link to Base44 (iframe, direct URL, or login redirect).

Row3 uses **Grafana Operational App Surface** dashboards (see `grafana/runtime-operational-surfaces.json`).

Current row3 targets (canonical):

* フリート運用 → `/d/runtime-fleet-surface/fleet-operational-surface`
* サービス拠点 → `/d/runtime-service-hub-surface/service-hub-operational-surface`
* 生活取引 → `/d/runtime-life-surface/life-transaction-operational-surface`
* 都市運行 → `/d/runtime-urban-surface/urban-operation-operational-surface`

Grafana = Federation OS / Operational Surface. Base44 = Operational UX (not replaced by Surface).

Do not expose:

* Base44 iframe embed from Router
* direct Base44 URL navigation from Router panels
* Base44 login redirect as the primary entry
* 準備中カード as row3 destination
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
