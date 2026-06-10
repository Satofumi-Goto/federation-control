const RUNTIME_SYNC_ROWS = [
  {
    application: 'Seneschal',
    repository: 'Satofumi-Goto/seneschal',
    githubHead: 'main',
    base44Head: 'pending',
    publishedRuntime: 'pending',
    controller: 'ChatGPT + GitHub',
  },
  {
    application: 'Fleet Operations',
    repository: 'Satofumi-Goto/fleet-operations-console',
    githubHead: 'main',
    base44Head: 'pending',
    publishedRuntime: 'pending',
    controller: 'ChatGPT + GitHub',
  },
  {
    application: 'Service Hub',
    repository: 'Satofumi-Goto/service-hub-console',
    githubHead: 'main',
    base44Head: 'pending',
    publishedRuntime: 'pending',
    controller: 'ChatGPT + GitHub',
  },
  {
    application: 'Urban Operation',
    repository: 'Satofumi-Goto/urban-operation-console',
    githubHead: 'main',
    base44Head: 'pending',
    publishedRuntime: 'pending',
    controller: 'ChatGPT + GitHub',
  },
];

function resolveStatus(row: (typeof RUNTIME_SYNC_ROWS)[number]) {
  const visible = [row.githubHead, row.base44Head, row.publishedRuntime].filter((v) => v !== 'pending');
  if (visible.length < 3) return 'OBSERVE';
  return new Set(visible).size === 1 ? 'SYNCED' : 'OUT_OF_SYNC';
}

function statusClass(status: string) {
  if (status === 'SYNCED') return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300';
  if (status === 'OUT_OF_SYNC') return 'border-red-400/40 bg-red-500/10 text-red-300';
  return 'border-amber-400/40 bg-amber-500/10 text-amber-300';
}

export default function FederationRuntimeSyncMonitor() {
  const rows = RUNTIME_SYNC_ROWS.map((row) => ({ ...row, status: resolveStatus(row) }));
  const outOfSync = rows.filter((row) => row.status === 'OUT_OF_SYNC').length;
  const observing = rows.filter((row) => row.status === 'OBSERVE').length;

  return (
    <section className="border-b border-slate-800 bg-slate-950 px-6 py-4 text-slate-100">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300">Federation Control / Runtime Sync</div>
          <div className="mt-1 text-sm text-slate-300">GitHub HEAD / Base44 HEAD / Published Runtime SHA drift monitor</div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="rounded border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-cyan-200">Controller: ChatGPT redundant check</span>
          <span className={`rounded border px-2 py-1 ${outOfSync ? 'border-red-400/40 bg-red-500/10 text-red-300' : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'}`}>{outOfSync ? 'DRIFT' : 'NO DRIFT'}</span>
          {observing > 0 ? <span className="rounded border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-amber-300">{observing} OBSERVE</span> : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70">
        <div className="grid grid-cols-[1.1fr_1.4fr_0.8fr_0.8fr_0.9fr_0.8fr] border-b border-slate-800 bg-slate-900 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          <div>Application</div>
          <div>Repository</div>
          <div>GitHub HEAD</div>
          <div>Base44 HEAD</div>
          <div>Published Runtime</div>
          <div>Status</div>
        </div>
        {rows.map((row) => (
          <div key={row.application} className="grid grid-cols-[1.1fr_1.4fr_0.8fr_0.8fr_0.9fr_0.8fr] items-center border-b border-slate-800/70 px-3 py-2 font-mono text-[11px] last:border-b-0">
            <div className="font-semibold text-slate-100">{row.application}</div>
            <div className="truncate text-cyan-200">{row.repository}</div>
            <div>{row.githubHead}</div>
            <div>{row.base44Head}</div>
            <div>{row.publishedRuntime}</div>
            <div><span className={`rounded border px-2 py-1 ${statusClass(row.status)}`}>{row.status}</span></div>
          </div>
        ))}
      </div>
    </section>
  );
}
