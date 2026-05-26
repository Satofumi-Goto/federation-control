import FederationPageFrame from '../components/workspace/FederationPageFrame';
import { useFederationStore } from '../store/federationStore';

export default function IntakePage() {
  const intakes = useFederationStore((s) => s.intakes);

  return (
    <FederationPageFrame stepId="intake">
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-2 text-xs font-semibold text-slate-500">
          Unified Intake Feed
        </div>
        <ul className="divide-y divide-slate-100">
          {intakes.map((item) => (
            <li key={item.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <span className="font-medium text-slate-900">{item.title}</span>
                <span className="ml-2 text-xs text-slate-500">{item.kind}</span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  item.priority === 'high'
                    ? 'bg-red-50 text-red-700'
                    : item.priority === 'medium'
                      ? 'bg-amber-50 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {item.priority}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </FederationPageFrame>
  );
}
