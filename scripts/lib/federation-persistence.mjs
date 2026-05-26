/**
 * Federation persistence abstraction — localStorage is PoC only.
 * Production: Supabase | federation API | Redis | Edge KV | Grafana datasource.
 */

export const FEDERATION_STORAGE_KEYS = {
  systems: 'runtimeFederationConnectSystems',
  artifacts: 'runtimeSystemArtifacts',
  memory: 'runtimeFederationMemory',
};

export const FEDERATION_PERSISTENCE_BACKENDS = [
  'localStorage-poc',
  'supabase',
  'federation-api',
  'redis',
  'edge-kv',
  'grafana-datasource',
];

/** Canonical persistence contract (browser or API implements). */
export const federationPersistenceSpec = {
  backend: process.env.FEDERATION_PERSISTENCE_BACKEND ?? 'localStorage-poc',
  targetBackend: 'federation-api',
  multiSession: true,
  keys: FEDERATION_STORAGE_KEYS,
};

export function persistenceNoticeHtml() {
  return `<div style="margin-top:6px;padding:6px 8px;border-radius:8px;background:#fffbeb;border:1px solid #fde68a;font-size:8px;color:#92400e;line-height:1.4;">
    Persistence: <strong>${federationPersistenceSpec.backend}</strong> (PoC) → target <strong>${federationPersistenceSpec.targetBackend}</strong> for multi-session federation.
  </div>`;
}
