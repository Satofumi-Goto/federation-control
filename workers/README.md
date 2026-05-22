# Runtime Reverse Proxy

This Worker exposes Runtime URL federation routes.

Routes:

- `/runtime/fleet` -> Fleet Operations Console
- `/runtime/service-hub` -> Service Hub Console
- `/runtime/life` -> Life Transaction Console
- `/runtime/urban` -> Urban Operation Console

Source:

- `workers/runtime-reverse-proxy.js`

Required deployment secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ZONE_ID`
- `RUNTIME_PROXY_HOST`

Runtime rule:

- Grafana remains Federation OS / analysis.
- Base44 remains Operational Runtime Console.
- Reverse proxy federation keeps Runtime URL space without iframe plugin dependency.
