export type FederationStepId =
  | 'intake'
  | 'intent'
  | 'responsibility'
  | 'impact'
  | 'sync-plan'
  | 'sync-apply'
  | 'validation';

export type FederationStep = {
  id: FederationStepId;
  path: string;
  label: string;
  legacyLabels?: string[];
  icon: string;
  features: string[];
  summaryKeys: string[];
};

export type IntakeItem = {
  id: string;
  source: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  kind: string;
};

export type IntentMapping = {
  id: string;
  raw: string;
  operationMeaning: string;
  kpi: string;
  constraint: string;
};

export type ResponsibilityNode = {
  id: string;
  owner: string;
  scope: string;
  boundary: string;
};

export type ImpactAnalysis = {
  collapseRisk: number;
  impactRadius: string;
  feasibilityScore: number;
  contradictions: string[];
};

export type SyncPlan = {
  id: string;
  sequence: string[];
  rollbackReady: boolean;
};

export type ApplyStatus = {
  phase: 'idle' | 'running' | 'partial' | 'done' | 'failed';
  repos: string[];
  failures: string[];
};

export type ValidationStatus = {
  healthScore: number;
  alignmentRate: number;
  driftCount: number;
  stable: boolean;
};

export type FederationGlobalStatus = {
  federationHealth: number;
  collapseRisk: number;
  driftCount: number;
  queueAlert: boolean;
  etaAlert: boolean;
};
