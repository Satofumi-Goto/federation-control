/** Federation persistence — localStorage PoC; target federation-api / Supabase. */

export type FederationScope = 'Runtime' | 'Knowledge' | 'KPI' | 'Operational' | 'Artifact';

export type OperationalSystemDraft = {
  id: string;
  systemName: string;
  federationScope: string;
  viewerUrl: string;
  ownership: string;
  runtimeTags: string;
  consoleType: string;
};

export type SystemArtifactDraft = {
  id: string;
  artifactName: string;
  artifactType: string;
  linkedRuntime: string;
  linkedKpi: string;
  linkedFederationScope: string;
};

const KEYS = {
  systems: 'runtimeFederationConnectSystems',
  artifacts: 'runtimeSystemArtifacts',
};

export const persistenceMeta = {
  backend: 'localStorage-poc' as const,
  target: 'federation-api' as const,
};

function load<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[];
  } catch {
    return [];
  }
}

function save<T>(key: string, items: T[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

export const federationPersistence = {
  listSystems: () => load<OperationalSystemDraft>(KEYS.systems),
  addSystem: (draft: Omit<OperationalSystemDraft, 'id'>) => {
    const items = load<OperationalSystemDraft>(KEYS.systems);
    items.push({ ...draft, id: `sys-${Date.now()}` });
    save(KEYS.systems, items);
    return items;
  },
  listArtifacts: () => load<SystemArtifactDraft>(KEYS.artifacts),
  addArtifact: (draft: Omit<SystemArtifactDraft, 'id'>) => {
    const items = load<SystemArtifactDraft>(KEYS.artifacts);
    items.push({ ...draft, id: `art-${Date.now()}` });
    save(KEYS.artifacts, items);
    return items;
  },
};
