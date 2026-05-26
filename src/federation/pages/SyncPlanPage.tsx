import FederationPageFrame from '../components/workspace/FederationPageFrame';
import { useFederationStore } from '../store/federationStore';

export default function SyncPlanPage() {
  const plans = useFederationStore((s) => s.syncPlans);

  return (
    <FederationPageFrame stepId="sync-plan">
      {plans.map((p) => (
        <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-900">Safe Sequence</div>
          <ol className="mt-2 list-decimal pl-5 text-sm text-slate-700">
            {p.sequence.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <div className="mt-3 text-xs text-emerald-700">
            Rollback: {p.rollbackReady ? 'planned' : 'not ready'}
          </div>
        </div>
      ))}
    </FederationPageFrame>
  );
}
