# Reverse-proxy Federation Viewer (fallback plan)

Use only if direct `nmcclain-iframe-panel` → `*.base44.app` cannot satisfy embed policy (strict parent `sandbox`, CSP, or storage blocks).

## Target shape

```
Grafana dashboard (satofumigoto.grafana.net)
  └── iframe panel src=/runtime-federation-proxy/fleet?runtime_embed=grafana
        └── Grafana-hosted reverse proxy → https://fleet-operations-console.base44.app?runtime_embed=grafana
```

Browser sees **same origin** as Grafana for the iframe URL; proxy forwards HTML/JS/assets to Base44.

## Requirements

- Proxy path on Grafana origin (Cloud: custom app or edge worker; OSS: nginx `sub_filter` + `proxy_pass`)
- Preserve query `runtime_embed=grafana`
- Forward `frame-ancestors` / do not strip Base44 CSP incorrectly
- WebSocket/HMR not required for production embed

## Trade-offs

| | Direct iframe | Reverse proxy |
|--|---------------|-----------------|
| Complexity | Low | High |
| Cookie/storage | Partitioned per top-level site | Closer to Grafana origin |
| Maintenance | Base44 + Grafana JSON | + proxy config |
| Security | Base44 CSP `frame-ancestors` Grafana | Proxy must enforce allowlist |

## Current canonical

Stay on **nmcclain-iframe-panel** + Base44 URL embed until proxy is required. Investigation: `GRAFANA_IFRAME_SANDBOX_INVESTIGATION.md`.
