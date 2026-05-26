import { useFederationStore } from '../store/federationStore';

export default function FederationTopStatusBar() {
  const g = useFederationStore((s) => s.globalStatus);

  const chips = [
    { label: 'Federation Health', value: `${g.federationHealth}%` },
    { label: 'Collapse Risk', value: `${g.collapseRisk}%` },
    { label: 'Drift Count', value: String(g.driftCount) },
    { label: 'Queue Alert', value: g.queueAlert ? 'ON' : 'OFF' },
    { label: 'ETA Alert', value: g.etaAlert ? 'ON' : 'OFF' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
      {chips.map((c) => (
        <div
          key={c.label}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
        >
          <span className="text-slate-500">{c.label}: </span>
          <span className="font-semibold">{c.value}</span>
        </div>
      ))}
    </div>
  );
}
