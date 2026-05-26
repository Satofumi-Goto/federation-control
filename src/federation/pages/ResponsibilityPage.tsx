import FederationPageFrame from '../components/workspace/FederationPageFrame';
import { useFederationStore } from '../store/federationStore';

export default function ResponsibilityPage() {
  const graph = useFederationStore((s) => s.responsibilityGraph);

  return (
    <FederationPageFrame stepId="responsibility">
      <div className="space-y-2">
        {graph.map((n) => (
          <div key={n.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-bold text-slate-900">{n.owner}</div>
            <div className="mt-1 text-sm text-slate-700">{n.scope}</div>
            <div className="mt-2 text-xs text-amber-800 bg-amber-50 rounded px-2 py-1 inline-block">
              {n.boundary}
            </div>
          </div>
        ))}
      </div>
    </FederationPageFrame>
  );
}
