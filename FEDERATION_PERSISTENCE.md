# Federation persistence

## Current (PoC)

- Browser `localStorage` via `federationPersistence` (`src/federation/utils/federationPersistence.ts`)
- Keys: `runtimeFederationConnectSystems`, `runtimeSystemArtifacts`
- Grafana workspace shows migration notice; **not** production multi-session

## Target

| Backend | Use case |
|---------|----------|
| `federation-api` | Canonical REST for systems / artifacts / live state |
| Supabase | Auth + row-level federation scope |
| Redis / Edge KV | Live federation metrics fan-out |
| Grafana datasource | Read-only federation health in dashboards |

Set `FEDERATION_PERSISTENCE_BACKEND=federation-api` when API is available.

## Semantic alignment

See `grafana/federation-semantic-map.json` and `npm run verify:federation-semantic`.
