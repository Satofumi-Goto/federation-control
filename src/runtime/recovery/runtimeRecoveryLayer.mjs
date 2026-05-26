/**
 * Runtime Recovery Layer
 *
 * Safe recovery orchestration — NOT auto-recovery.
 *
 * Provides:
 *   - snapshot fallback evaluation
 *   - corrupted state isolation
 *   - degraded runtime continuation assessment
 *   - safe restart readiness
 *   - recovery recommendation
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DATA_ROOT = path.resolve(REPO_ROOT, 'runtime_data');
const STABILITY_DIR = path.resolve(DATA_ROOT, 'stability');

function tryLoadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function evaluateSnapshotFallback() {
  const lineage = tryLoadJson(path.resolve(DATA_ROOT, 'state/runtime-rollback-lineage.json'));
  const safepoints = lineage?.safepoints ?? [];
  return {
    available: safepoints.length > 0,
    safepointCount: safepoints.length,
    latestSafepoint: safepoints[safepoints.length - 1]?.timestamp ?? null,
    recommendation: safepoints.length > 0 ? 'ロールバック安全点あり' : 'ロールバック安全点なし — 新規snapshot取得推奨',
  };
}

function evaluateCorruptedStateIsolation() {
  const integrity = tryLoadJson(path.resolve(STABILITY_DIR, 'runtime-integrity-result.json'));
  const corrupted = integrity?.corrupted ?? [];
  return {
    corruptedDomains: corrupted,
    isolationNeeded: corrupted.length > 0,
    isolationAction: corrupted.length > 0
      ? `${corrupted.join(', ')} を隔離し、正常ドメインで継続運用`
      : '隔離不要',
  };
}

function evaluateDegradedContinuation() {
  const integrity = tryLoadJson(path.resolve(STABILITY_DIR, 'runtime-integrity-result.json'));
  const score = integrity?.integrityScore ?? 100;
  const canContinue = score >= 50;
  return {
    integrityScore: score,
    canContinueDegraded: canContinue,
    recommendation: canContinue
      ? `整合性 ${score}% — 劣化運用継続可能`
      : `整合性 ${score}% — 復旧優先推奨`,
  };
}

function evaluateRestartReadiness() {
  const checks = [];
  const criticalPaths = [
    { label: 'Registry', path: path.resolve(REPO_ROOT, 'src/runtime/registry/runtimeRegistryData.json') },
    { label: 'Orchestration State', path: path.resolve(DATA_ROOT, 'runtime-orchestration-state.json') },
    { label: 'Invocation Lock', path: path.resolve(DATA_ROOT, 'runtime-invocation-lock-state.json') },
  ];
  for (const c of criticalPaths) {
    const exists = fs.existsSync(c.path);
    let parseable = false;
    try { JSON.parse(fs.readFileSync(c.path, 'utf8')); parseable = true; } catch {}
    checks.push({ file: c.label, exists, parseable, ok: exists && parseable });
  }
  const allOk = checks.every(c => c.ok);
  return {
    ready: allOk,
    checks,
    recommendation: allOk ? '安全再起動可能' : '破損ファイル修復後に再起動',
  };
}

export function evaluateRecovery() {
  const snapshotFallback = evaluateSnapshotFallback();
  const corruptionIsolation = evaluateCorruptedStateIsolation();
  const degradedContinuation = evaluateDegradedContinuation();
  const restartReadiness = evaluateRestartReadiness();

  const overallReady = restartReadiness.ready && degradedContinuation.canContinueDegraded;
  const overallRecommendation = !overallReady
    ? '復旧操作が必要 — 破損状態の修復を実施してください'
    : corruptionIsolation.isolationNeeded
    ? '部分破損あり — 隔離後に継続運用可能'
    : '正常 — 長期運用継続可能';

  const result = {
    timestamp: new Date().toISOString(),
    overallReady,
    overallRecommendation,
    snapshotFallback,
    corruptionIsolation,
    degradedContinuation,
    restartReadiness,
  };

  fs.mkdirSync(STABILITY_DIR, { recursive: true });
  fs.writeFileSync(
    path.resolve(STABILITY_DIR, 'runtime-recovery-result.json'),
    JSON.stringify(result, null, 2) + '\n',
  );
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  console.log('[recovery] Evaluating recovery readiness...');
  const r = evaluateRecovery();
  console.log(`[recovery] Ready: ${r.overallReady}`);
  console.log(`[recovery] ${r.overallRecommendation}`);
}
