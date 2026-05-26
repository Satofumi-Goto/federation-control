/**
 * Runtime Snapshot Engine
 *
 * Captures the current Federation Runtime state into a single
 * unified snapshot object. Sources:
 *   - topology verify
 *   - semantic verify
 *   - MCP tool manifest
 *   - governance state (orchestration, lock)
 *   - execution availability (headless session, trigger supervisor)
 *   - drift indicators (health graph, digital twin)
 *   - repair readiness (repair audit, adaptive topology)
 *   - SLA/SLO execution
 *   - operational snapshot (deploy state)
 *
 * NEVER stores secrets, tokens, or API keys.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DATA_ROOT = path.resolve(REPO_ROOT, 'runtime_data');
const STATE_DIR = path.resolve(DATA_ROOT, 'state');
const LATEST_PATH = path.resolve(STATE_DIR, 'runtime-snapshot-latest.json');

function loadJson(relPath) {
  try { return JSON.parse(fs.readFileSync(path.resolve(DATA_ROOT, relPath), 'utf8')); }
  catch { return null; }
}

function tryVerify(script) {
  try {
    execSync(`node ${script}`, { cwd: REPO_ROOT, timeout: 15000, stdio: 'pipe' });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message?.slice(0, 200) };
  }
}

function getCommitSha() {
  try { return execSync('git rev-parse HEAD', { cwd: REPO_ROOT, stdio: 'pipe' }).toString().trim(); }
  catch { return null; }
}

export function captureSnapshot() {
  const timestamp = new Date().toISOString();
  const commitSha = getCommitSha();

  const topologyResult = tryVerify('scripts/verify-runtime-topology-links.mjs');
  const semanticResult = tryVerify('scripts/verify-federation-semantic.mjs');

  const toolManifest = loadJson('runtime-tool-manifest.json');
  const orchestration = loadJson('runtime-orchestration-state.json');
  const lockState = loadJson('runtime-invocation-lock-state.json');
  const healthGraph = loadJson('runtime-federation-health-graph.json');
  const digitalTwin = loadJson('runtime-operational-digital-twin-graph.json');
  const repairAudit = loadJson('runtime-repair-audit-log.json');
  const adaptiveTopo = loadJson('runtime-adaptive-topology-result.json');
  const slaExec = loadJson('runtime-sla-slo-execution-result.json');
  const opSnapshot = loadJson('runtime-operational-snapshot.json');
  const headlessSession = loadJson('runtime-headless-session.json');
  const triggerSupervisor = loadJson('runtime-trigger-supervisor-state.json');
  const envState = loadJson('runtime-environment-state.json');

  const twinNodes = digitalTwin?.nodes ?? [];
  const healthNodes = healthGraph?.nodes ?? [];
  const repairEntries = Array.isArray(repairAudit) ? repairAudit : [];

  const snapshot = {
    id: crypto.randomUUID(),
    timestamp,
    commitSha,

    verification: {
      topology: topologyResult,
      semantic: semanticResult,
    },

    governance: {
      mode: orchestration?.governanceState ?? lockState?.governance?.mode ?? 'unknown',
      deployPolicy: lockState?.governance?.deployPolicy ?? 'unknown',
      repairPolicy: lockState?.governance?.repairPolicy ?? 'unknown',
      lockDecision: lockState?.decision ?? 'unknown',
      lockChecks: (lockState?.checks ?? []).map(c => ({ check: c.check, pass: c.pass })),
      pressureScore: orchestration?.pressureScore ?? healthGraph?.governancePressure ?? 0,
      violations: orchestration?.violations ?? 0,
      stormDetected: orchestration?.stormDetected ?? false,
    },

    execution: {
      mode: orchestration?.activeMode ?? 'unknown',
      queueDepth: (orchestration?.activeQueue ?? []).length,
      deployState: orchestration?.activeDeployState ?? 'unknown',
      headlessStatus: headlessSession?.status ?? 'unknown',
      triggerPaused: triggerSupervisor?.paused ?? false,
      triggerBlockRate: (() => {
        const t = triggerSupervisor;
        if (!t) return 0;
        const total = (t.totalExecutions ?? 0) + (t.totalBlocked ?? 0);
        return total > 0 ? Math.round(((t.totalBlocked ?? 0) / total) * 100) : 0;
      })(),
      loopCount: orchestration?.loopCount ?? 0,
    },

    health: {
      overallLevel: healthGraph?.governanceLevel ?? 'unknown',
      dependencyHealth: healthGraph?.dependencyHealth ?? 'unknown',
      governancePressure: healthGraph?.governancePressure ?? 0,
      executionPressure: healthGraph?.executionPressure ?? 0,
      repairPressure: healthGraph?.repairPressure ?? 0,
      deployPressure: healthGraph?.deployPressure ?? 0,
      propagationSeverity: healthGraph?.propagationSeverity ?? 0,
      nodes: healthNodes.map(n => ({ id: n.id, health: n.health, pressure: n.pressure })),
    },

    drift: {
      state: orchestration?.driftState ?? 'unknown',
      activeCount: twinNodes.filter(n => n.state !== 'active').length,
      degradedDomains: twinNodes.filter(n => n.health !== 'healthy').map(n => n.id),
      congestionLevel: digitalTwin?.congestion?.level ?? 'none',
      hotspots: digitalTwin?.congestion?.hotspots ?? [],
    },

    repair: {
      activeRepairState: orchestration?.activeRepairState ?? 'unknown',
      totalCycles: repairEntries.length,
      lastDecision: repairEntries[repairEntries.length - 1]?.decision ?? null,
      verificationPassRate: repairEntries.length > 0
        ? Math.round((repairEntries.filter(e => e.verificationPass).length / repairEntries.length) * 100) : 100,
      adaptiveActions: adaptiveTopo?.totalActions ?? 0,
      safetyLocksEnforced: adaptiveTopo?.safetyLocksEnforced ?? true,
    },

    sla: {
      overallStatus: slaExec?.overallStatus ?? 'unknown',
      metrics: Object.fromEntries(
        Object.entries(slaExec?.metrics ?? {}).map(([k, v]) => [k, { current: v.current, target: v.target, unit: v.unit }])
      ),
      riskCount: (slaExec?.risks ?? []).length,
    },

    deploy: {
      version: opSnapshot?.version ?? 0,
      panelCount: opSnapshot?.panelCount ?? 0,
      registryCount: opSnapshot?.registryCount ?? 0,
      verificationPass: opSnapshot?.verificationPass ?? false,
    },

    environment: {
      healthScore: envState?.healthScore ?? 0,
      activeModules: (envState?.activeModules ?? []).length,
    },

    tools: {
      exposedCount: toolManifest?.tools?.length ?? 0,
    },
  };

  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(LATEST_PATH, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  return snapshot;
}

export function loadLatestSnapshot() {
  try { return JSON.parse(fs.readFileSync(LATEST_PATH, 'utf8')); }
  catch { return null; }
}

// ── CLI ──
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  console.log('[snapshot] Capturing Federation Runtime snapshot...');
  const snap = captureSnapshot();
  console.log(`[snapshot] ID: ${snap.id}`);
  console.log(`[snapshot] Commit: ${snap.commitSha}`);
  console.log(`[snapshot] Governance: ${snap.governance.mode} (pressure: ${snap.governance.pressureScore})`);
  console.log(`[snapshot] Execution: ${snap.execution.mode} (queue: ${snap.execution.queueDepth})`);
  console.log(`[snapshot] Health: ${snap.health.overallLevel} (dep: ${snap.health.dependencyHealth})`);
  console.log(`[snapshot] Drift: ${snap.drift.state} (degraded: ${snap.drift.degradedDomains.length})`);
  console.log(`[snapshot] SLA: ${snap.sla.overallStatus} (risks: ${snap.sla.riskCount})`);
  console.log(`[snapshot] Saved to ${LATEST_PATH}`);
}
