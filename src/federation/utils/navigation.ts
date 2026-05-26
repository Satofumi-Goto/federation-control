import type { FederationStep, FederationStepId } from '../types/federation';

export const FEDERATION_STEPS: FederationStep[] = [
  {
    id: 'intake',
    path: '/federation/intake',
    label: '入力統合',
    legacyLabels: ['連携探索', 'Discovery', 'Runtime Discovery'],
    icon: 'Inbox',
    features: [
      'Unified Intake Feed',
      'Source Classification',
      'Priority Engine',
      'Conflict Detection',
      'Federation Drift Intake',
      'KPI Drift Intake',
    ],
    summaryKeys: ['intakeCount', 'conflictCount', 'priorityHigh'],
  },
  {
    id: 'intent',
    path: '/federation/intent',
    label: '意図整理',
    legacyLabels: ['ニーズ翻訳', 'Needs翻訳', 'Need Impact'],
    icon: 'Brain',
    features: [
      'Intent Normalization',
      'KPI Mapping',
      'Constraint Extraction',
      'Hidden Dependency Detection',
      'Operation Meaning Expansion',
      'Multi-Console Impact Preview',
    ],
    summaryKeys: ['intentCount', 'constraintCount', 'dependencyHints'],
  },
  {
    id: 'responsibility',
    path: '/federation/responsibility',
    label: '責務解析',
    legacyLabels: ['関係整理', 'アライメント', 'Alignment'],
    icon: 'Network',
    features: [
      'Responsibility Mapping',
      'Ownership Validation',
      'Boundary Analysis',
      'Dependency Graph',
      'Collapse Chain',
      'Sync Scope Analysis',
      'Federation Route Visualization',
      'Authority Validation',
      'Cross-Console Link Analysis',
    ],
    summaryKeys: ['ownerCount', 'boundaryGaps', 'syncScope'],
  },
  {
    id: 'impact',
    path: '/federation/impact',
    label: '影響解析',
    icon: 'AlertTriangle',
    features: [
      'Impact Radius',
      'Collapse Prediction',
      'KPI Drift Analysis',
      'Queue Impact Estimation',
      'ETA Degradation Analysis',
      'Throughput Loss Estimation',
      'Constraint Explosion Detection',
      'Federation Misalignment Analysis',
      'Contradiction Detection',
      'Operational Feasibility Score',
    ],
    summaryKeys: ['collapseRisk', 'impactRadius', 'feasibilityScore'],
  },
  {
    id: 'sync-plan',
    path: '/federation/sync-plan',
    label: '同期設計',
    icon: 'Workflow',
    features: [
      'Sync Plan Generator',
      'Safe Sequence Planning',
      'Repo Dependency Resolution',
      'Schema Translation',
      'Migration Planning',
      'Verification Planning',
      'Rollback Planning',
      'Multi-Console Apply Planning',
      'Staging Planning',
      'Federation Sequence Visualization',
    ],
    summaryKeys: ['planSteps', 'rollbackReady', 'stagingTargets'],
  },
  {
    id: 'sync-apply',
    path: '/federation/sync-apply',
    label: '同期改修',
    icon: 'RefreshCw',
    features: [
      'Diff Apply',
      'Multi-Repo Sync',
      'Staging Apply',
      'Apply Validation',
      'Rollback Execute',
      'Sync Status Tracking',
      'Failure Isolation',
      'Partial Apply Recovery',
      'Federation State Tracking',
    ],
    summaryKeys: ['applyPhase', 'repoCount', 'failureCount'],
  },
  {
    id: 'validation',
    path: '/federation/validation',
    label: '検証',
    icon: 'ShieldCheck',
    features: [
      'Health Score',
      'Drift Detection',
      'Queue Stability Check',
      'ETA Validation',
      'Throughput Validation',
      'Constraint Stability',
      'Federation Alignment Check',
      'Collapse Detection',
      'Cross-Console Validation',
      'KPI Consistency Validation',
    ],
    summaryKeys: ['healthScore', 'alignmentRate', 'driftCount'],
  },
];

export function stepById(id: FederationStepId): FederationStep {
  const step = FEDERATION_STEPS.find((s) => s.id === id);
  if (!step) throw new Error(`Unknown step: ${id}`);
  return step;
}

export function stepByPath(pathname: string): FederationStep | undefined {
  return FEDERATION_STEPS.find((s) => pathname === s.path || pathname.startsWith(`${s.path}/`));
}
