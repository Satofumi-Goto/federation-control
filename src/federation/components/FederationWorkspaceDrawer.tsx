import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFederationStore } from '../store/federationStore';

type DrawerKind = 'systems' | 'artifacts' | 'federation-add' | null;

const SCOPES = ['Runtime', 'Knowledge', 'KPI', 'Operational', 'Artifact'] as const;

export default function FederationWorkspaceDrawer() {
  const [params, setParams] = useSearchParams();
  const drawer = useFederationStore((s) => s.activeDrawer);
  const closeDrawer = useFederationStore((s) => s.closeDrawer);
  const registerSystem = useFederationStore((s) => s.registerOperationalSystem);
  const registerArtifact = useFederationStore((s) => s.registerArtifact);

  const [systemForm, setSystemForm] = useState({
    systemName: '',
    federationScope: 'Operational',
    viewerUrl: '',
    ownership: '',
    runtimeTags: '',
    consoleType: '',
  });
  const [artifactForm, setArtifactForm] = useState({
    artifactName: '',
    artifactType: '',
    linkedRuntime: '',
    linkedKpi: '',
    linkedFederationScope: 'Artifact',
  });
  const [addScopes, setAddScopes] = useState<string[]>(['Operational']);

  useEffect(() => {
    const d = params.get('drawer') as DrawerKind;
    if (d === 'systems' || d === 'artifacts' || d === 'federation-add') {
      useFederationStore.getState().openDrawer(d);
    }
  }, [params]);

  if (!drawer) return null;

  const onClose = () => {
    closeDrawer();
    params.delete('drawer');
    setParams(params, { replace: true });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-900">
            {drawer === 'systems' && 'Systems onboarding / add'}
            {drawer === 'artifacts' && 'Artifact add / create'}
            {drawer === 'federation-add' && 'Federation Add'}
          </h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800">
            ×
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 text-sm">
          {drawer === 'systems' && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                registerSystem(systemForm);
                onClose();
              }}
            >
              {(
                [
                  ['System Name', 'systemName'],
                  ['Federation Scope', 'federationScope'],
                  ['Viewer URL', 'viewerUrl'],
                  ['Ownership', 'ownership'],
                  ['Runtime Tags', 'runtimeTags'],
                  ['Console Type', 'consoleType'],
                ] as const
              ).map(([label, key]) => (
                <label key={key} className="block">
                  <span className="text-xs font-semibold text-slate-500">{label}</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={systemForm[key]}
                    onChange={(ev) => setSystemForm({ ...systemForm, [key]: ev.target.value })}
                    required={key === 'systemName' || key === 'viewerUrl'}
                  />
                </label>
              ))}
              <p className="text-xs text-slate-500">Viewer URL must include /viewer/ and runtime_embed=grafana</p>
              <button type="submit" className="w-full rounded-lg bg-blue-600 py-2 font-semibold text-white">
                Register system
              </button>
            </form>
          )}
          {drawer === 'artifacts' && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                registerArtifact(artifactForm);
                onClose();
              }}
            >
              {(
                [
                  ['Artifact Name', 'artifactName'],
                  ['Artifact Type', 'artifactType'],
                  ['Linked Runtime', 'linkedRuntime'],
                  ['Linked KPI', 'linkedKpi'],
                  ['Linked Federation Scope', 'linkedFederationScope'],
                ] as const
              ).map(([label, key]) => (
                <label key={key} className="block">
                  <span className="text-xs font-semibold text-slate-500">{label}</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={artifactForm[key]}
                    onChange={(ev) => setArtifactForm({ ...artifactForm, [key]: ev.target.value })}
                    required={key === 'artifactName'}
                  />
                </label>
              ))}
              <button type="submit" className="w-full rounded-lg bg-blue-600 py-2 font-semibold text-white">
                Create artifact
              </button>
            </form>
          )}
          {drawer === 'federation-add' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">Select federation scope ownership:</p>
              <div className="flex flex-wrap gap-2">
                {SCOPES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setAddScopes((prev) =>
                        prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
                      )
                    }
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      addScopes.includes(s) ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="text-xs text-amber-700">
                Persistence: localStorage PoC → federation-api (multi-session target)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
