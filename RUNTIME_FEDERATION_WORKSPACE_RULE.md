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

`/runtime` row3 opens **Federation Viewer** dashboards only (not raw Base44 URLs).

Row3 = Grafana Federation overlay + Base44 Operational Runtime in **`nmcclain-iframe-panel`** (`runtime_embed=grafana`). No Text panel HTML iframe. See `grafana/runtime-federation-viewer.json`, `GRAFANA_IFRAME_PANEL.md`, and `BASE44_FEDERATION_VIEWER_RUNTIME.md`.

Current row3 targets (canonical):

* フリート運用 → `/d/runtime-fleet-federation-viewer/fleet-federation-viewer`
* サービス拠点 → `/d/runtime-service-hub-federation-viewer/service-hub-federation-viewer`
* 生活取引 → `/d/runtime-life-federation-viewer/life-federation-viewer`
* 都市運行 → `/d/runtime-urban-federation-viewer/urban-federation-viewer`

Build: `node scripts/build-federation-viewer-surfaces.mjs` then `node scripts/build-runtime-workspace-v2.mjs`.

Grafana = Federation OS overlay. Base44 = Operational Runtime (viewer read-only in iframe). Not native console replacement.

Do not expose:

* Base44 login redirect / popup auth inside federation viewer iframe
* direct Base44 production URL from Router panels
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
