import FederationPageFrame from '../components/workspace/FederationPageFrame';
import { useFederationStore } from '../store/federationStore';

export default function SyncApplyPage() {
  const apply = useFederationStore((s) => s.applyStatus);

  return (
    <FederationPageFrame stepId="sync-apply">
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <div className="text-xs text-slate-500">Apply phase</div>
        <div className="text-lg font-bold capitalize text-slate-900">{apply.phase}</div>
        <div className="mt-4 text-xs font-semibold text-slate-500">Target repos</div>
        <ul className="mt-1 list-disc pl-5 text-slate-700">
          {apply.repos.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
    </FederationPageFrame>
  );
}
