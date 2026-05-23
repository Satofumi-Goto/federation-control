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

`/runtime` acts as:

* Runtime Federation Workspace
* Operational Console Router (same-tab navigation)

### Row3 — 自システム

Row3 opens **Base44 Operational Runtime** in the **same browser tab** (`runtime_embed=grafana`). No Federation Viewer dashboard, no iframe from the router, no `target="_blank"`, no `window.open()`.

Browser **Back** returns to Runtime Top: `/d/sa8ljn4/runtime`.

Canonical URLs (`grafana/runtime-workspace-routes.json`):

* フリート運用 → `https://fleet-operations-console.base44.app/?runtime_embed=grafana`
* サービス拠点 → `https://service-hub-console.base44.app/?runtime_embed=grafana`
* 生活取引 → `https://life-ledger-link.base44.app/?runtime_embed=grafana`
* 都市運行 → `https://urban-operation-console.base44.app/?runtime_embed=grafana`

Build: `node scripts/build-runtime-workspace-v2.mjs`

### Federation Connect

Middle row, right: **＋** opens Federation Connect (name, URL, optional repository). Supports Base44, Grafana, Excel Online, Google Sheets, Planner, HILS, Queue tool, ETA tool, Internal SaaS. Added systems persist in `localStorage` (`runtimeFederationConnectSystems`).

### Header

* **連携探索** (handshake 🤝) — was Discovery
* Needs翻訳
* アライメント

---

## Runtime Rule

| Layer | Role |
|-------|------|
| GitHub | Canonical |
| Runtime (Grafana) | Federated Runtime Control Platform |
| Base44 | Operational Runtime |

---

## Federation Viewer (legacy)

`grafana/runtime-federation-viewer.json` and viewer dashboards remain for reference/CI but are **not** row3 destinations. Do not run `build-federation-viewer-surfaces.mjs` to overwrite `runtime-workspace-routes.json` row3.

---

## Forbidden on /runtime router

* `target="_blank"` / `window.open()` for row3
* Federation Viewer as row3 link
* app launcher / “which app to open?” dialog
* iframe embed from router panels
