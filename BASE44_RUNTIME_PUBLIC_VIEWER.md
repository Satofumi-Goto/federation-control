# Base44 Runtime Public Viewer Layer

Grafana Runtime row3 opens **viewer URLs** (not root app URLs) for login-free read-only operational UI.

## Viewer URLs

| Console | URL |
|---------|-----|
| Fleet | `https://fleet-operations-console.base44.app/viewer/fleet?runtime_embed=grafana` |
| Service Hub | `https://service-hub-console.base44.app/viewer/service-hub?runtime_embed=grafana` |
| Life | `https://life-ledger-link.base44.app/viewer/life?runtime_embed=grafana` |
| Urban | `https://urban-operation-console.base44.app/viewer/urban?runtime_embed=grafana` |

## App changes (each Base44 repo)

- Routes: `/viewer/*` → `RuntimePublicViewerShell` + mirrored operational routes
- `window.__RUNTIME_PUBLIC_VIEW__ = true` (index.html + `establishRuntimePublicViewSession`)
- Auth bypass on viewer path (no redirect to Base44 login)
- Read-only: block save / delete / submit; hide Federation Connect & Runtime Draft Create
- `runtime_embed=grafana` preserved

## Apply

```bash
node scripts/patch-base44-auth-guard-order.mjs <repo-path>
node scripts/apply-base44-runtime-public-viewer.mjs <repo-path> fleet|serviceHub|life|urban
```

All four:

```bash
npm run apply:base44-runtime-viewers
```

Then commit & push each Base44 repo and redeploy on Base44 platform.

## Grafana

Canonical: `grafana/runtime-workspace-routes.json` → `node scripts/build-runtime-workspace-v2.mjs` → deploy.
