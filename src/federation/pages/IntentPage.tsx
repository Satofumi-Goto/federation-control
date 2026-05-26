import FederationPageFrame from '../components/workspace/FederationPageFrame';
import { useFederationStore } from '../store/federationStore';

export default function IntentPage() {
  const mappings = useFederationStore((s) => s.intentMappings);

  return (
    <FederationPageFrame stepId="intent">
      <div className="space-y-3">
        {mappings.map((m) => (
          <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <div className="text-slate-500">Raw</div>
            <div className="font-medium text-slate-900">{m.raw}</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div>
                <div className="text-xs text-slate-500">Operation meaning</div>
                <div>{m.operationMeaning}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">KPI</div>
                <div>{m.kpi}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Constraint</div>
                <div>{m.constraint}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </FederationPageFrame>
  );
}
