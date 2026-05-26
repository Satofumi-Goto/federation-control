import FederationPageFrame from '../components/workspace/FederationPageFrame';
import { useFederationStore } from '../store/federationStore';

export default function ValidationPage() {
  const v = useFederationStore((s) => s.validationStatus);

  return (
    <FederationPageFrame stepId="validation">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-xs text-emerald-800">Health Score</div>
          <div className="text-2xl font-bold text-emerald-900">{v.healthScore}%</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-xs text-blue-800">Alignment Rate</div>
          <div className="text-2xl font-bold text-blue-900">{v.alignmentRate}%</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Drift Count</div>
          <div className="text-2xl font-bold text-slate-900">{v.driftCount}</div>
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-600">
        成立性: {v.stable ? '安定' : '要フォローアップ'}
      </p>
    </FederationPageFrame>
  );
}
