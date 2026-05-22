# Grafana iframe sandbox investigation (nmcclain-iframe-panel)

## Plugin source audit (v1.0.1)

Upstream: [nmcclain/nmcclain-iframe-panel](https://github.com/nmcclain/nmcclain-iframe-panel) `src/components/IframePanel.tsx`

```tsx
<iframe
  title="IFrame"
  src={srcUrl}
  className={...}
/>
```

| Attribute | Present in plugin? |
|-----------|-------------------|
| `sandbox` | **No** |
| `allow` | Only in CSS typo (`allow:` in emotion css), not HTML `allow` |
| `allow-same-origin` | N/A (no sandbox) |
| `allow-scripts` | N/A (no sandbox) |
| `allow-storage-access-by-user-activation` | N/A |

**Conclusion:** Blank Base44 UI is **not** caused by an explicit restrictive `sandbox` on the plugin iframe. Without `sandbox`, the embedded document runs with normal first-party capabilities on `*.base44.app`.

## Likely causes when iframe is empty but present

1. **Storage partitioning** — `sessionStorage` in cross-site iframe may throw or partition; mitigated by `runtime_embed=grafana` URL + `window.__FEDERATION_VIEWER_RUNTIME__` fallback (Base44 patch).
2. **Layout** — `#root` height 0; mitigated by `patch-base44-iframe-sizing.mjs`.
3. **Base44 deploy lag** — Git push ≠ immediate `*.base44.app` deploy.

## Diagnostics

### In browser (Base44 console, `?runtime_embed=grafana`)

Filter: `[federation-viewer]`

Expected sequence:

1. `index.html bootstrap ok`
2. `federationViewerBootstrap.js executed`
3. `establishFederationViewerSession` with `storageOk: true|false`
4. `FederationViewerShell mount`

### Playwright (federation-control)

```bash
GRAFANA_URL=... GRAFANA_USER=... GRAFANA_PASSWORD=... \\
  node scripts/diagnose-federation-iframe-sandbox.mjs
```

Artifact: `artifacts/federation-iframe-sandbox/report.json` — records iframe `sandbox`/`allow` DOM and in-frame `sessionStorage` / banner.

## Cannot add sandbox allowances via dashboard JSON

`nmcclain-iframe-panel` options are only: `src`, `scaleFactor`, `disableInteractivity`. No `sandbox` option to extend.

To force sandbox allowances you would need a **forked panel plugin** that sets e.g.:

```html
sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-storage-access-by-user-activation"
```

That is only needed if some parent wrapper adds `sandbox` without tokens (not observed in plugin source).

## Alternative: reverse-proxy federation viewer

If Grafana or enterprise policy ever wraps embeds with a strict sandbox, use same-origin proxy:

| Approach | Origin seen by browser | sessionStorage |
|----------|------------------------|----------------|
| Direct iframe (`nmcclain`) | `fleet-*.base44.app` | First-party in frame |
| Reverse proxy | `satofumigoto.grafana.net/runtime-proxy/...` | Same-origin with Grafana |

See `REVERSE_PROXY_FEDERATION_VIEWER.md` (plan only; not default).

## Runtime rule (unchanged)

- Grafana: Federation OS overlay
- Base44: Operational Runtime in iframe (`runtime_embed=grafana`)
