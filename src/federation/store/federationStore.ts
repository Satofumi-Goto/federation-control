import { create } from 'zustand';
import type {
  ApplyStatus,
  FederationGlobalStatus,
  ImpactAnalysis,
  IntakeItem,
  IntentMapping,
  ResponsibilityNode,
  SyncPlan,
  ValidationStatus,
} from '../types/federation';
import {
  federationPersistence,
  type OperationalSystemDraft,
  type SystemArtifactDraft,
} from '../utils/federationPersistence';

const seedIntakes: IntakeItem[] = [
  { id: 'i1', source: 'Need', title: '拠点間Queue遅延', priority: 'high', kind: 'Need' },
  { id: 'i2', source: 'KPI', title: 'Throughput drift +4%', priority: 'medium', kind: 'KPI' },
  { id: 'i3', source: 'Federation Drift', title: 'Fleet↔Hub責務ずれ', priority: 'high', kind: 'Federation Drift' },
  { id: 'i4', source: 'Runtime Alert', title: 'ETA degradation urban', priority: 'medium', kind: 'Runtime Alert' },
];

type DrawerKind = 'systems' | 'artifacts' | 'federation-add' | null;

type FederationState = {
  globalStatus: FederationGlobalStatus;
  intakes: IntakeItem[];
  intentMappings: IntentMapping[];
  responsibilityGraph: ResponsibilityNode[];
  impactAnalysis: ImpactAnalysis;
  syncPlans: SyncPlan[];
  applyStatus: ApplyStatus;
  validationStatus: ValidationStatus;
  operationalSystems: OperationalSystemDraft[];
  systemArtifacts: SystemArtifactDraft[];
  activeDrawer: DrawerKind;
  addIntake: (item: Omit<IntakeItem, 'id'>) => void;
  openDrawer: (kind: Exclude<DrawerKind, null>) => void;
  closeDrawer: () => void;
  registerOperationalSystem: (draft: Omit<OperationalSystemDraft, 'id'>) => void;
  registerArtifact: (draft: Omit<SystemArtifactDraft, 'id'>) => void;
};

export const useFederationStore = create<FederationState>((set) => ({
  globalStatus: {
    federationHealth: 74,
    collapseRisk: 32,
    driftCount: 3,
    queueAlert: true,
    etaAlert: false,
  },
  intakes: seedIntakes,
  intentMappings: [
    {
      id: 'm1',
      raw: '拠点間の待ちを減らしつつ同期を保つ',
      operationMeaning: 'Queue圧力をHub受入制約内で再配分',
      kpi: 'Throughput / ETA',
      constraint: 'Node capacity / Dispatch window',
    },
  ],
  responsibilityGraph: [
    { id: 'r1', owner: 'Fleet', scope: 'Dispatch実行', boundary: 'Node設備を直接制御しない' },
    { id: 'r2', owner: 'Service Hub', scope: '受入・Node', boundary: 'Fleet配下の制御盤ではない' },
    { id: 'r3', owner: 'Urban', scope: 'ODD・制約', boundary: '実行オペ過多を持たない' },
  ],
  impactAnalysis: {
    collapseRisk: 58,
    impactRadius: 'Queue → ETA → Dispatch → Fleet',
    feasibilityScore: 71,
    contradictions: ['Hub受入とFleet増便の同時要求'],
  },
  syncPlans: [
    {
      id: 'p1',
      sequence: ['schema-translation', 'hub-console', 'fleet-console', 'validation'],
      rollbackReady: true,
    },
  ],
  applyStatus: {
    phase: 'idle',
    repos: ['fleet-operations-console', 'service-hub-console'],
    failures: [],
  },
  validationStatus: {
    healthScore: 74,
    alignmentRate: 82,
    driftCount: 3,
    stable: false,
  },
  operationalSystems: federationPersistence.listSystems(),
  systemArtifacts: federationPersistence.listArtifacts(),
  activeDrawer: null,
  addIntake: (item) =>
    set((s) => ({
      intakes: [...s.intakes, { ...item, id: `i-${Date.now()}` }],
    })),
  openDrawer: (kind) => set({ activeDrawer: kind }),
  closeDrawer: () => set({ activeDrawer: null }),
  registerOperationalSystem: (draft) =>
    set({ operationalSystems: federationPersistence.addSystem(draft) }),
  registerArtifact: (draft) => set({ systemArtifacts: federationPersistence.addArtifact(draft) }),
}));
