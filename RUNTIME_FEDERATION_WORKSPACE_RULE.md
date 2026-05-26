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

### Row2 — Brain panels

| Position | Panel | Link |
|----------|-------|------|
| Top-left | **Obsidian Knowledge Graph** | `row2.obsidianGraph` |
| Top-right | **Runtime Federation Graph** | `row2.runtimeFederationGraph` (Runtime center) |

The former **運行制御アーキテクチャ** static collapse panel is removed.

### Row3 — Operational Systems

Section header: **Operational Systems** with **+** on the title row (inline `details` — system add; does **not** navigate to federation governance routes). Cards use Base44 `/viewer/*?runtime_embed=grafana` (フリート運用, サービス拠点, 生活取引, 都市運行).

Row3 opens **Base44 Runtime Public Viewer** (`/viewer/*`) in the **same browser tab** (`runtime_embed=grafana`). Login-free. No root app URL (avoids Base44 auth/login).

### Row4 — System Artifacts

Section header: **System Artifacts** with **+** on the title row (inline `details` — artifact add). Artifact cards use English labels (Collapse Control, Functional Topology, …).

Browser **Back** returns to Runtime Top: `/d/sa8ljn4/runtime`.

Canonical URLs (`grafana/runtime-workspace-routes.json`):

* フリート運用 → `https://fleet-operations-console.base44.app/viewer/fleet?runtime_embed=grafana`
* サービス拠点 → `https://service-hub-console.base44.app/viewer/service-hub?runtime_embed=grafana`
* 生活取引 → `https://life-transaction-console.base44.app/viewer/life?runtime_embed=grafana`
* 都市運行 → `https://urban-operation-console.base44.app/viewer/urban?runtime_embed=grafana`

See `BASE44_RUNTIME_PUBLIC_VIEWER.md`.

Build: `node scripts/build-runtime-workspace-v2.mjs`

### Federation Connect

Middle row, right: **＋** opens Federation Connect (name, URL, optional repository). Supports Base44, Grafana, Excel Online, Google Sheets, Planner, HILS, Queue tool, ETA tool, Internal SaaS. Added systems persist in `localStorage` (`runtimeFederationConnectSystems`).

### Header (Federated Operational Governance — row1)

* **入力統合** (🤝) — replaces 連携探索 → `/federation/intake` (legacy `/runtime_discovery`)
* **意図整理** (🗣️) — replaces Needs翻訳 → `/federation/intent` (legacy `/need_impact`)
* **責務解析** (🧩) — replaces アライメント → `/federation/responsibility`

Full 7-step workspace: see `FEDERATION_GOVERNANCE.md` and `npm run dev` (SPA under `src/federation/`).

### Route topology (`grafana/runtime-topology-routes.json`)

| World | Path |
|-------|------|
| Runtime center | `/d/sa8ljn4/runtime` (logical `/`) |
| Calendar | `/calendar` |
| Map | `/map` |
| 運行制御アーキテクチャ card | Runtime center (same tab, no dead integrated-surface link) |

Verify: `npm run verify:runtime-topology` (also runs in deploy CI after build).

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
