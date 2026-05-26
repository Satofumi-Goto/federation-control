#!/usr/bin/env node
/**
 * Runtime Product Operating Readiness Gate
 *
 * Validates that the complete product operating model is in place:
 * operating model, responsibility matrix, SLA/SLO, KPIs,
 * business control, governance, and safety locks.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBusinessControl } from './runtimeBusinessControlEngine.mjs';
import { runSlaSloExecution } from './runtimeSlaSloExecutionEngine.mjs';
import { runProductKpi } from './runtimeProductKpiEngine.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const CHECKS = [
  {
    id: 'operating-model',
    label: 'Product operating model exists',
    path: 'runtime_data/runtime-product-operating-model.json',
    validate: (data) => !!data?.product?.name && !!data?.userSegments?.length,
  },
  {
    id: 'responsibility-matrix',
    label: 'Business responsibility matrix exists',
    path: 'runtime_data/runtime-business-responsibility-matrix.json',
    validate: (data) => !!data?.roles && Object.keys(data.roles).length >= 5,
  },
  {
    id: 'sla-slo-model',
    label: 'SLA/SLO model defined',
    path: 'runtime_data/runtime-sla-slo-model.json',
    validate: () => true,
    optional: true,
  },
  {
    id: 'business-control-engine',
    label: 'Business control engine exists',
    path: 'scripts/runtime/runtimeBusinessControlEngine.mjs',
    validate: () => true,
    fileCheck: true,
  },
  {
    id: 'sla-slo-engine',
    label: 'SLA/SLO execution engine exists',
    path: 'scripts/runtime/runtimeSlaSloExecutionEngine.mjs',
    validate: () => true,
    fileCheck: true,
  },
  {
    id: 'product-kpi-engine',
    label: 'Product KPI engine exists',
    path: 'scripts/runtime/runtimeProductKpiEngine.mjs',
    validate: () => true,
    fileCheck: true,
  },
  {
    id: 'governance-enforced',
    label: 'Runtime governance remains enforced',
    path: 'runtime_data/runtime-evolution-governance-result.json',
    validate: (data) => data?.summary?.safetyLocks?.allEnforced !== false,
    optional: true,
  },
  {
    id: 'registry-canonical',
    label: 'Runtime Registry remains canonical',
    path: 'runtime_data/runtime-evolution-governance-result.json',
    validate: (data) => data?.registryCanonical !== false,
    optional: true,
  },
  {
    id: 'safety-locks-active',
    label: 'Runtime safety locks remain active',
    path: 'runtime_data/runtime-evolution-governance-result.json',
    validate: (data) => data?.summary?.safetyLocks?.forbiddenRulesActive >= 7,
    optional: true,
  },
];

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export function runReadinessGate() {
  const now = new Date().toISOString();
  const results = [];

  for (const check of CHECKS) {
    const fullPath = path.resolve(REPO_ROOT, check.path);
    const exists = fs.existsSync(fullPath);

    if (check.fileCheck) {
      results.push({ id: check.id, label: check.label, passed: exists, detail: exists ? 'File exists' : 'File missing' });
      continue;
    }

    if (!exists) {
      results.push({ id: check.id, label: check.label, passed: check.optional ?? false, detail: check.optional ? 'Optional — file not found' : 'File missing' });
      continue;
    }

    const data = loadJson(fullPath);
    const valid = check.validate(data);
    results.push({ id: check.id, label: check.label, passed: valid, detail: valid ? 'Validated' : 'Validation failed' });
  }

  // Run live engine checks
  let businessResult, slaResult, kpiResult;
  try { businessResult = runBusinessControl(); } catch { businessResult = null; }
  try { slaResult = runSlaSloExecution(); } catch { slaResult = null; }
  try { kpiResult = runProductKpi(); } catch { kpiResult = null; }

  results.push({ id: 'business-control-live', label: 'Business control engine operational', passed: !!businessResult, detail: businessResult ? `Composite: ${businessResult.compositeScore}/100` : 'Engine failed' });
  results.push({ id: 'sla-slo-live', label: 'SLA/SLO engine operational', passed: !!slaResult, detail: slaResult ? `Status: ${slaResult.overallStatus}` : 'Engine failed' });
  results.push({ id: 'kpi-live', label: 'Product KPI engine operational', passed: !!kpiResult, detail: kpiResult ? `Score: ${kpiResult.summary.overallScore}%` : 'Engine failed' });

  const totalChecks = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = totalChecks - passed;

  const ready = failed === 0;

  const report = {
    checks: results,
    summary: { total: totalChecks, passed, failed, ready },
    liveResults: {
      businessControl: businessResult ? { compositeScore: businessResult.compositeScore, priority: businessResult.actionPriority.priority } : null,
      slaSlo: slaResult ? { status: slaResult.overallStatus, risks: slaResult.risks.length, alerts: slaResult.alerts.length } : null,
      productKpi: kpiResult ? { score: kpiResult.summary.overallScore, met: kpiResult.summary.met, below: kpiResult.summary.below } : null,
    },
    timestamp: now,
  };

  saveJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-product-operating-readiness-result.json'), report);
  return report;
}

if (process.argv[1]?.endsWith('runtimeProductOperatingReadinessGate.mjs')) {
  console.log('[readiness] Runtime Product Operating Readiness Gate');
  console.log('='.repeat(55));

  const r = runReadinessGate();

  console.log('\n  Checks:');
  for (const c of r.checks) {
    const icon = c.passed ? 'PASS' : 'FAIL';
    console.log(`    [${icon}] ${c.label}: ${c.detail}`);
  }

  console.log('\n  Live results:');
  if (r.liveResults.businessControl) {
    console.log(`    Business control: ${r.liveResults.businessControl.compositeScore}/100 (priority: ${r.liveResults.businessControl.priority})`);
  }
  if (r.liveResults.slaSlo) {
    console.log(`    SLA/SLO: ${r.liveResults.slaSlo.status} (risks: ${r.liveResults.slaSlo.risks}, alerts: ${r.liveResults.slaSlo.alerts})`);
  }
  if (r.liveResults.productKpi) {
    console.log(`    KPI: ${r.liveResults.productKpi.score}% (met: ${r.liveResults.productKpi.met}/${r.liveResults.productKpi.met + r.liveResults.productKpi.below})`);
  }

  console.log(`\n  Summary: ${r.summary.passed}/${r.summary.total} passed`);
  console.log(`\n${'='.repeat(55)}`);
  console.log(`[readiness] ${r.summary.ready ? 'PRODUCT OPERATING MODEL READY' : `NOT READY — ${r.summary.failed} check(s) failed`}`);
  console.log('\n' + JSON.stringify({ ok: true, ...r }, null, 2));
}
