# Runtime visual-check — Grafana GitHub OAuth

Grafana Cloud (`satofumigoto.grafana.net`) uses **GitHub OAuth**, not email/password login.

## GitHub Actions secrets

| Secret | Required |
|--------|----------|
| `GRAFANA_URL` | Yes |
| `GRAFANA_GITHUB_USER` | Yes (GitHub account for OAuth) |
| `GRAFANA_GITHUB_PASSWORD` | Yes (PAT or password; prefer machine user) |

Aliases also accepted by scripts:

- `GITHUB_OAUTH_USER` / `GITHUB_OAUTH_PASSWORD`

Legacy (only if your stack still has password login):

- `GRAFANA_USER` / `GRAFANA_PASSWORD`

## Local run

```bash
export GRAFANA_URL=https://satofumigoto.grafana.net
export GRAFANA_GITHUB_USER=your-github-user
export GRAFANA_GITHUB_PASSWORD=your-github-password-or-pat
npm run visual-check
```

## Playwright flow

1. Open `${GRAFANA_URL}/login`
2. Click **GitHub** OAuth entry
3. Complete GitHub sign-in (popup or redirect)
4. Authorize Grafana if prompted
5. Verify session → screenshot `/runtime` and federation viewers

## manifest.json fields

| Field | Meaning |
|-------|---------|
| `oauthLoginSuccess` | Grafana session established |
| `loginMethod` | `github-oauth`, `existing-session`, etc. |
| `iframePresent` | Any viewer has Base44 iframe in DOM |
| `federationViewerBanner` | `.federation-viewer-banner` visible in iframe |
| `runtimeEmbedDetected` | iframe `src` contains `runtime_embed=grafana` |

## 2FA

If the GitHub account has 2FA, use a **machine user** without 2FA or a PAT-based automation account for CI only.
