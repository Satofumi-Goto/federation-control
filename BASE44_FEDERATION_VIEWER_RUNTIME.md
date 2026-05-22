# Base44 Federation Viewer Runtime

## Architecture

| Layer | Role |
|-------|------|
| Grafana | Federation OS · overlay KPI · collapse · constraint |
| Base44 | Operational Runtime Console · real UX in iframe |

Row3 opens **Federation Viewer** dashboards (`grafana/runtime-federation-viewer.json`).

## URL parameter

```
?runtime_embed=grafana
```

Activates on Base44:

- embedded runtime mode
- federation viewer mode (read-only)
- federation session (no login redirect)

## Auth guard order (critical)

Correct order:

1. URL `runtime_embed=grafana` (sync: `index.html` + `federationViewerBootstrap.js`)
2. `sessionStorage.federationViewerSession=true` + `base44_federation_viewer_session`
3. `AuthContext` / `ProtectedRoute` auth bypass — **before** `redirectToLogin`
4. Operational Runtime render (Queue, ETA, Constraint, Dispatch, Node)

Forbidden when `runtime_embed=grafana`:

- `redirectToLogin` / popup auth / top-level auth redirect
- auth guard running before embed detection

Patch: `node scripts/patch-base44-auth-guard-order.mjs <console-repo>`

## Viewer behavior

- read-only federation viewer
- modal submit disabled (capture phase)
- dispatch execute disabled
- displays: Queue, ETA, Runtime state, Constraint, Dispatch state, Node state

## CSP

`public/_headers`:

```
Content-Security-Policy: frame-ancestors https://satofumigoto.grafana.net 'self'
```

Do not enable Base44 Dashboard **Prevent Embedding**.

## Base44 repos

Apply:

```bash
node scripts/apply-base44-federation-viewer.mjs <path-to-console-repo>
```

Repos:

- Satofumi-Goto/fleet-operations-console
- Satofumi-Goto/service-hub-console
- Satofumi-Goto/life-transaction-console
- Satofumi-Goto/urban-operation-console

## Grafana build

```bash
node scripts/build-federation-viewer-surfaces.mjs
node scripts/build-runtime-workspace-v2.mjs
```

Federation Viewer uses **`nmcclain-iframe-panel`** (not Text panel HTML iframe). Install: `GRAFANA_IFRAME_PANEL.md`.

## Visual verification

```bash
GRAFANA_URL=... GRAFANA_USER=... GRAFANA_PASSWORD=... npm run visual-check
```

Checks: Base44 iframe rendered (`iframe[src*=base44.app]`), `#root` height > 0, viewer banner, `runtime_embed=grafana`, no blank iframe, no login redirect, artifacts under `artifacts/runtime-visual-check/`.

## Iframe sizing

Embed mode applies full viewport sizing to `html`, `body`, `#root`, and `FederationViewerShell` (`flex` column, `min-height: 100vh`). Patch: `node scripts/patch-base44-iframe-sizing.mjs <console-repo>`.
