# Grafana IFrame panel (Federation Viewer)

Federation Viewer dashboards embed Base44 Operational Runtime using the **IFrame panel plugin**, not HTML inside a Text panel.

## Why

Grafana sanitizes HTML in Text panels. Inline `<iframe>` in Text panels renders blank and breaks Federation Viewer.

## Panel plugin

| Field | Value |
|-------|--------|
| Plugin ID | `nmcclain-iframe-panel` |
| Version | `1.0.1` |
| Dashboard panel `type` | `nmcclain-iframe-panel` |
| Option `src` | Base44 URL with `runtime_embed=grafana` |

Canonical: `grafana/runtime-federation-viewer.json` → `scripts/build-federation-viewer-surfaces.mjs`.

## Install

### CI (attempt)

```bash
GRAFANA_URL=... GRAFANA_TOKEN=... node scripts/ensure-grafana-iframe-plugin.mjs
```

Grafana Cloud may reject unsigned ZIP installs. If install fails, install manually once per stack.

### Manual (Grafana Cloud / OSS)

1. Download release: [nmcclain-iframe-panel v1.0.1](https://github.com/nmcclain/nmcclain-iframe-panel/releases/tag/v1.0.1)
2. Admin → Plugins → install or upload ZIP (stack policy permitting)
3. Restart Grafana if required

## Forbidden

- Text panel HTML iframe embed
- `disable_sanitize_html` for federation runtime
- Row3 links to raw Base44 URLs from the Runtime router

## Layout

| Row | Content |
|-----|---------|
| Top | Grafana Federation overlay (Queue, KPI, Constraint, Collapse, Runtime state) |
| Bottom | `nmcclain-iframe-panel` — full width, tall grid, Base44 console |

## Alternative (not default)

Same-origin reverse proxy in front of Base44 (e.g. `/runtime-proxy/fleet` on the Grafana origin). Use only if the iframe plugin cannot be installed.
