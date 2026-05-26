# federation-control

**Federated Operational Governance Workspace** — Grafana Federation Brain + 7-step SPA.

## Commands

```bash
npm install
npm run dev                          # SPA: /federation/intake …
npm run build:runtime-workspace      # grafana/runtime-workspace-v2.json
npm run build:federation-governance
npm run verify:runtime-topology
npm run verify:federation-governance
npm run verify:federation-semantic
```

## Docs

- [FEDERATION_GOVERNANCE.md](./FEDERATION_GOVERNANCE.md) — 7-step routes (`/federation/intake`, not `/runtime_discovery`)
- [FEDERATION_PERSISTENCE.md](./FEDERATION_PERSISTENCE.md) — localStorage PoC → federation-api
- [grafana/federation-semantic-map.json](./grafana/federation-semantic-map.json) — route / card / artifact alignment

## Workspace semantics

| Area | Role |
|------|------|
| Obsidian Knowledge Graph | ADR · Runtime Note · Collapse Note · Federation Link · Knowledge Cluster |
| Federation Graph | Live state (Health, drifts, alignment, collapse risk) |
| Operational Systems | Viewer badges · `/viewer/*?runtime_embed=grafana` |
| System Artifacts | Federation cross-links (↔ KPI / graph) |
| Federation Add | Scoped onboarding (Runtime · Knowledge · KPI · Operational · Artifact) |
