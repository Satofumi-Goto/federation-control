import type { FederationStepId } from '../types/federation';
import { useFederationStore } from '../store/federationStore';

type Props = { stepId: FederationStepId };

export default function FederationSummaryPanel({ stepId }: Props) {
  const store = useFederationStore();

  let title = 'Summary';
  let rows: { label: string; value: string }[] = [];

  switch (stepId) {
    case 'intake':
      title = '入力統合';
      rows = [
        { label: 'Intake items', value: String(store.intakes.length) },
        { label: 'High priority', value: String(store.intakes.filter((i) => i.priority === 'high').length) },
        { label: 'Drift signals', value: String(store.globalStatus.driftCount) },
      ];
      break;
    case 'intent':
      title = '意図整理';
      rows = [
        { label: 'Mappings', value: String(store.intentMappings.length) },
        { label: 'Constraints', value: store.intentMappings[0]?.constraint ?? '—' },
        { label: 'KPI focus', value: store.intentMappings[0]?.kpi ?? '—' },
      ];
      break;
    case 'responsibility':
      title = '責務解析';
      rows = [
        { label: 'Owners', value: String(store.responsibilityGraph.length) },
        { label: 'Sync scope', value: 'Multi-console' },
        { label: 'Boundary gaps', value: '1 detected' },
      ];
      break;
    case 'impact':
      title = '影響解析';
      rows = [
        { label: 'Collapse Risk', value: `${store.impactAnalysis.collapseRisk}%` },
        { label: 'Impact Radius', value: store.impactAnalysis.impactRadius },
        { label: 'Feasibility', value: `${store.impactAnalysis.feasibilityScore}%` },
      ];
      break;
    case 'sync-plan':
      title = '同期設計';
      rows = [
        { label: 'Plan steps', value: String(store.syncPlans[0]?.sequence.length ?? 0) },
        { label: 'Rollback', value: store.syncPlans[0]?.rollbackReady ? 'Ready' : '—' },
        { label: 'Targets', value: '4 consoles' },
      ];
      break;
    case 'sync-apply':
      title = '同期改修';
      rows = [
        { label: 'Phase', value: store.applyStatus.phase },
        { label: 'Repos', value: String(store.applyStatus.repos.length) },
        { label: 'Failures', value: String(store.applyStatus.failures.length) },
      ];
      break;
    case 'validation':
      title = '検証';
      rows = [
        { label: 'Federation Health', value: `${store.validationStatus.healthScore}%` },
        { label: 'Alignment Rate', value: `${store.validationStatus.alignmentRate}%` },
        { label: 'Drift Count', value: String(store.validationStatus.driftCount) },
      ];
      break;
  }

  return (
    <aside className="w-64 shrink-0 border-l border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="rounded-lg border border-slate-200 bg-white p-2.5">
            <div className="text-[10px] text-slate-500">{r.label}</div>
            <div className="text-sm font-semibold text-slate-900">{r.value}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}
