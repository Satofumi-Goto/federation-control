# Base44 Operational Console — Grafana iframe embed

## Scope

| Base44 app | Production URL | GitHub repo |
|------------|----------------|-------------|
| Fleet Operations Console | `https://fleet-operations-console.base44.app` | `Satofumi-Goto/fleet-operations-console` |
| Service Hub Console | `https://service-hub-console.base44.app` | `Satofumi-Goto/service-hub-console` |
| Life Ledger Link | `https://life-ledger-link.base44.app` | `Satofumi-Goto/life-transaction-console` |
| Urban Operation Console | `https://urban-operation-console.base44.app` | `Satofumi-Goto/urban-operation-console` |

## Grafana parent

```
https://satofumigoto.grafana.net
```

Embed path: `/runtime` → `/d/runtime-*-embed/*` → iframe(Base44 URL `?runtime_embed=grafana`).

## Required on each Base44 app

### 1. HTTP response (iframe allow)

Prefer **Content-Security-Policy** `frame-ancestors`:

```
Content-Security-Policy: frame-ancestors https://satofumigoto.grafana.net 'self'
```

In repo: `public/_headers` (copied to `dist/` on build).

Do **not** send blocking `X-Frame-Options: DENY` or `SAMEORIGIN`.

### 2. Base44 Dashboard (manual if headers still blocked)

Dashboard → Security → Settings → Security Headers:

- **Prevent Embedding**: OFF

Platform toggle overrides CDN when enabled.

### 3. App code

- `src/lib/runtimeFederationEmbed.js` — Grafana embed detection
- `src/lib/grafanaRuntimeEmbedHeaders.js` — dev/preview CSP
- `vite.config.js` — registers embed header plugin
- `base44/config.jsonc` — `runtimeFederation` canonical block
- `AuthContext` — login/logout return URL preserves `runtime_embed=grafana`

Apply from federation-control:

```bash
node scripts/apply-base44-grafana-embed.mjs <path-to-base44-repo>
```

## Runtime rule

| Layer | Role |
|-------|------|
| Grafana | Federation OS |
| Base44 | Operational Console |

Forbidden UX: external app picker, iframe refusal, login that breaks out of Grafana shell as primary flow.
