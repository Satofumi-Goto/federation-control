# Runtime Text panels — HTML mode (Grafana Cloud)

Grafana Cloud **sanitizes** Text panel HTML by default. Tags like `<style>`, `<script>`, and inline `<svg>` are stripped or shown as escaped text unless the instance enables `disable_sanitize_html`.

## What we do in GitHub (canonical)

Build output (`grafana/runtime-workspace-v2.json`) uses:

- `options.mode`: **`html`** (never markdown)
- `options.code.language`: **`html`**
- **No `<style>` blocks** — only inline `style=""` attributes
- **Knowledge graph**: SVG embedded via `<img src="data:image/svg+xml,...">`
- **崩壊制御 Runtime**: CSS `conic-gradient` donut + `<div>` bar/number cards (no `<svg>`)

Deploy script `scripts/deploy-runtime-workspace.mjs` re-normalizes all text panels to HTML mode before POST.

## Grafana UI (manual check)

For each affected panel (Header, 知識グラフ, 崩壊制御 Runtime, 自システム, Federation Connect):

1. Edit panel → **Text** options
2. **Mode** = **HTML**
3. If your Grafana edition shows **Disable sanitize HTML**, turn it **ON** (instance-level on Grafana Cloud may still restrict this; our build is sanitizer-safe without it)
4. Save dashboard → hard reload

## Federation Connect `＋`

The connect dialog uses `<script>` for `localStorage`. That requires **Disable sanitize HTML** on the instance. If `＋` does nothing after deploy, ask Grafana Cloud admin for `[panels] disable_sanitize_html = true` or use only the four built-in row3 consoles.
