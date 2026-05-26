/**
 * State Transition Evaluator
 *
 * Classifies the Runtime into one of 8 operational states and
 * records transitions over time. States are not OK/NG binary
 * but represent a graduated operational condition.
 *
 * States:
 *   HEALTHY         → 正常        — All systems nominal
 *   DEGRADED        → 劣化        — Partial degradation detected
 *   DRIFTING        → 乖離進行    — Active drift detected
 *   CONSTRAINED     → 制約中      — Governance pressure elevated
 *   REPAIR_READY    → 改修準備可  — Repair feasible, awaiting trigger
 *   EXECUTION_LOCKED → 実行ロック — Execution blocked by safety/governance
 *   COLLAPSE_RISK   → 崩壊リスク  — Multiple degradation indicators
 *   RECOVERING      → 復旧中      — Active recovery in progress
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLatestSnapshot } from './runtimeSnapshotEngine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const STATE_DIR = path.resolve(REPO_ROOT, 'runtime_data/state');
const TRANSITIONS_PATH = path.resolve(STATE_DIR, 'runtime-state-transitions.json');
const MAX_TRANSITIONS = 100;

export const STATES = {
  HEALTHY: { id: 'HEALTHY', label: '正常', severity: 0 },
  DEGRADED: { id: 'DEGRADED', label: '劣化', severity: 30 },
  DRIFTING: { id: 'DRIFTING', label: '乖離進行', severity: 40 },
  CONSTRAINED: { id: 'CONSTRAINED', label: '制約中', severity: 50 },
  REPAIR_READY: { id: 'REPAIR_READY', label: '改修準備可', severity: 35 },
  EXECUTION_LOCKED: { id: 'EXECUTION_LOCKED', label: '実行ロック', severity: 60 },
  COLLAPSE_RISK: { id: 'COLLAPSE_RISK', label: '崩壊リスク', severity: 80 },
  RECOVERING: { id: 'RECOVERING', label: '復旧中', severity: 45 },
  // Phase 28: Autonomous Runtime Repair states
  ANALYZING: { id: 'ANALYZING', label: '解析中', severity: 25 },
  PREDICTING: { id: 'PREDICTING', label: '予測中', severity: 28 },
  VERIFYING: { id: 'VERIFYING', label: '検証中', severity: 30 },
  GOVERNANCE_REVIEW: { id: 'GOVERNANCE_REVIEW', label: 'ガバナンス確認中', severity: 55 },
  SAFE_EXECUTE_READY: { id: 'SAFE_EXECUTE_READY', label: '安全実行可能', severity: 38 },
  EXECUTING_SAFE: { id: 'EXECUTING_SAFE', label: '安全実行中', severity: 42 },
  RECOVERY_VALIDATION: { id: 'RECOVERY_VALIDATION', label: '復旧確認中', severity: 35 },
  PARTIAL_RECOVERY: { id: 'PARTIAL_RECOVERY', label: '部分復旧', severity: 48 },
  BLOCKED_BY_GOVERNANCE: { id: 'BLOCKED_BY_GOVERNANCE', label: 'ガバナンス停止', severity: 65 },
};

export function evaluateState(snapshot) {
  if (!snapshot) return STATES.HEALTHY;

  const gov = snapshot.governance ?? {};
  const exec = snapshot.execution ?? {};
  const health = snapshot.health ?? {};
  const drift = snapshot.drift ?? {};
  const repair = snapshot.repair ?? {};
  const verify = snapshot.verification ?? {};
  const repairPipeline = snapshot.repairPipeline ?? {};

  // Phase 28 repair pipeline states take priority when active
  if (repairPipeline.stage === 'blocked-by-governance') return STATES.BLOCKED_BY_GOVERNANCE;
  if (repairPipeline.stage === 'executing-safe') return STATES.EXECUTING_SAFE;
  if (repairPipeline.stage === 'recovery-validation') return STATES.RECOVERY_VALIDATION;
  if (repairPipeline.stage === 'partial-recovery') return STATES.PARTIAL_RECOVERY;
  if (repairPipeline.stage === 'governance-review') return STATES.GOVERNANCE_REVIEW;
  if (repairPipeline.stage === 'safe-execute-ready') return STATES.SAFE_EXECUTE_READY;
  if (repairPipeline.stage === 'verifying') return STATES.VERIFYING;
  if (repairPipeline.stage === 'predicting') return STATES.PREDICTING;
  if (repairPipeline.stage === 'analyzing') return STATES.ANALYZING;

  if (gov.lockDecision === 'blocked' || exec.deployState === 'blocked') {
    return STATES.EXECUTION_LOCKED;
  }

  const degradedCount = drift.degradedDomains?.length ?? 0;
  const pressure = gov.pressureScore ?? 0;
  const propagation = health.propagationSeverity ?? 0;

  if (degradedCount >= 3 || pressure > 60 || propagation > 50) {
    return STATES.COLLAPSE_RISK;
  }

  if (repair.activeRepairState === 'repairing' || repair.activeRepairState === 'recovering') {
    return STATES.RECOVERING;
  }

  if (pressure > 30 || gov.violations > 0) {
    return STATES.CONSTRAINED;
  }

  if (drift.state !== 'healthy' || degradedCount > 0 || drift.congestionLevel !== 'none') {
    return STATES.DRIFTING;
  }

  if (repair.adaptiveActions > 0 || repair.lastDecision === 'apply') {
    return STATES.REPAIR_READY;
  }

  if (!verify.topology?.ok || !verify.semantic?.ok || health.overallLevel === 'warning') {
    return STATES.DEGRADED;
  }

  return STATES.HEALTHY;
}

function loadTransitions() {
  try {
    const data = JSON.parse(fs.readFileSync(TRANSITIONS_PATH, 'utf8'));
    if (!Array.isArray(data.transitions)) throw new Error('invalid');
    return data;
  } catch {
    return { transitions: [], currentState: null, version: 1 };
  }
}

function saveTransitions(data) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  if (data.transitions.length > MAX_TRANSITIONS) {
    data.transitions = data.transitions.slice(-MAX_TRANSITIONS);
  }
  fs.writeFileSync(TRANSITIONS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export function recordTransition(snapshot) {
  const newState = evaluateState(snapshot);
  const data = loadTransitions();
  const prevState = data.currentState;

  if (prevState !== newState.id) {
    data.transitions.push({
      timestamp: snapshot?.timestamp ?? new Date().toISOString(),
      snapshotId: snapshot?.id ?? null,
      from: prevState,
      to: newState.id,
      toLabel: newState.label,
      severity: newState.severity,
    });
    data.currentState = newState.id;
    saveTransitions(data);
    return { changed: true, from: prevState, to: newState.id, label: newState.label };
  }

  return { changed: false, current: newState.id, label: newState.label };
}

export function getCurrentState() {
  const data = loadTransitions();
  const stateId = data.currentState ?? 'HEALTHY';
  return STATES[stateId] ?? STATES.HEALTHY;
}

export function getTransitionHistory() {
  const data = loadTransitions();
  return {
    currentState: data.currentState ?? 'HEALTHY',
    currentLabel: (STATES[data.currentState] ?? STATES.HEALTHY).label,
    totalTransitions: data.transitions.length,
    recent: data.transitions.slice(-10),
    stateDistribution: (() => {
      const dist = {};
      for (const t of data.transitions) {
        dist[t.to] = (dist[t.to] || 0) + 1;
      }
      return dist;
    })(),
  };
}

// ── CLI ──
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const snapshot = loadLatestSnapshot();
  if (!snapshot) {
    console.log('[state-transition] No snapshot available.');
    process.exit(1);
  }
  const result = recordTransition(snapshot);
  if (result.changed) {
    console.log(`[state-transition] TRANSITION: ${result.from ?? 'INIT'} → ${result.to} (${result.label})`);
  } else {
    console.log(`[state-transition] No change: ${result.current} (${result.label})`);
  }
  const history = getTransitionHistory();
  console.log(`[state-transition] Total transitions: ${history.totalTransitions}`);
  console.log(`[state-transition] Current: ${history.currentState} (${history.currentLabel})`);
}
