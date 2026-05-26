import FederationPageFrame from '../components/workspace/FederationPageFrame';
import { useFederationStore } from '../store/federationStore';

export default function ImpactPage() {
  const impact = useFederationStore((s) => s.impactAnalysis);

  return (
    <FederationPageFrame stepId="impact">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="text-xs text-red-700">Collapse Risk</div>
          <div className="text-2xl font-bold text-red-900">{impact.collapseRisk}%</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Operational Feasibility</div>
          <div className="text-2xl font-bold text-slate-900">{impact.feasibilityScore}%</div>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <div className="font-semibold text-slate-900">Impact Radius</div>
        <p className="mt-1 text-slate-700">{impact.impactRadius}</p>
        <div className="mt-3 font-semibold text-slate-900">Contradictions</div>
        <ul className="mt-1 list-disc pl-5 text-slate-700">
          {impact.contradictions.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
    </FederationPageFrame>
  );
}
