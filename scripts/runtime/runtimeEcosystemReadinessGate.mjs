#!/usr/bin/env node
/**
 * Runtime Ecosystem Readiness Gate
 *
 * Validates the complete business ecosystem platform:
 * ecosystem model, multi-operator coordination, service federation,
 * economic model, ecosystem KPIs, governance enforcement,
 * and Registry consistency.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMultiOperatorCoordination } from './runtimeMultiOperatorCoordinationEngine.mjs';
import { runServiceFederation } from './runtimeServiceFederationEngine.mjs';
import { runEconomicModel } from './runtimeEconomicModelEngine.mjs';
import { runEcosystemKpi } from './runtimeEcosystemKpiEngine.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

const STATIC_CHECKS = [
  {
    id: 'ecosystem-model',
    label: 'Ecosystem business model exists',
    path: 'runtime_data/runtime-business-ecosystem-model.json',
    validate: (data) => !!data?.ecosystem?.name && !!data?.participants?.length && !!data?.serviceDomains?.length,
  },
  {
    id: 'operating-model',
    label: 'Product operating model exists',
    path: 'runtime_data/runtime-product-operating-model.json',
    validate: (data) => !!data?.product?.name,
  },
  {
    id: 'responsibility-matrix',
    label: 'Responsibility matrix exists',
    path: 'runtime_data/runtime-business-responsibility-matrix.json',
    validate: (data) => !!data?.roles && Object.keys(data.roles).length >= 5,
  },
  {
    id: 'governance-enforced',
    label: 'Governance enforcement active',
    path: 'runtime_data/runtime-evolution-governance-result.json',
    validate: (data) => data?.summary?.safetyLocks?.allEnforced !== false,
    optional: true,
  },
  {
    id: 'registry-canonical',
    label: 'Runtime Registry canonical',
    path: 'runtime_data/runtime-evolution-governance-result.json',
    validate: (data) => data?.registryCanonical !== false,
    optional: true,
  },
  {
    id: 'safety-locks',
    label: 'Safety locks enforced',
    path: 'runtime_data/runtime-evolution-governance-result.json',
    validate: (data) => (data?.summary?.safetyLocks?.forbiddenRulesActive ?? 0) >= 7,
    optional: true,
  },
  {
    id: 'authority-boundaries',
    label: 'Authority boundaries defined',
    path: 'runtime_data/runtime-business-ecosystem-model.json',
    validate: (data) => !!data?.authorityFlows?.length && !!data?.governanceHierarchy?.length,
  },
  {
    id: 'ecosystem-ownership',
    label: 'Ecosystem ownership defined',
    path: 'runtime_data/runtime-business-ecosystem-model.json',
    validate: (data) => data?.serviceDomains?.every(d => !!d.owner),
  },
];

export function runEcosystemReadiness() {
  const now = new Date().toISOString();
  const results = [];

  for (const check of STATIC_CHECKS) {
    const fullPath = path.resolve(REPO_ROOT, check.path);
    const exists = fs.existsSync(fullPath);

    if (!exists) {
      results.push({ id: check.id, label: check.label, passed: check.optional ?? false, detail: check.optional ? 'Optional — file not found' : 'File missing' });
      continue;
    }

    const data = loadJson(fullPath);
    const valid = check.validate(data);
    results.push({ id: check.id, label: check.label, passed: valid, detail: valid ? 'Validated' : 'Validation failed' });
  }

  // Live engine checks
  let coordination, federation, economic, kpi;
  try { coordination = runMultiOperatorCoordination(); } catch { coordination = null; }
  try { federation = runServiceFederation(); } catch { federation = null; }
  try { economic = runEconomicModel(); } catch { economic = null; }
  try { kpi = runEcosystemKpi(); } catch { kpi = null; }

  results.push({
    id: 'coordination-live',
    label: 'Multi-operator coordination operational',
    passed: !!coordination?.summary?.coordinationActive,
    detail: coordination ? `${coordination.summary.totalOperators} operators, ${coordination.summary.conflictCount} conflicts` : 'Engine failed',
  });
  results.push({
    id: 'federation-live',
    label: 'Service federation operational',
    passed: !!federation && federation.summary.healthScore >= 70,
    detail: federation ? `Health: ${federation.summary.healthScore}/100, ${federation.summary.federatedServices} services` : 'Engine failed',
  });
  results.push({
    id: 'economic-live',
    label: 'Economic model operational',
    passed: !!economic,
    detail: economic ? `Efficiency: ${economic.summary.efficiency}%, V/C ratio: ${economic.summary.valueToCostratio}` : 'Engine failed',
  });
  results.push({
    id: 'kpi-live',
    label: 'Ecosystem KPI engine operational',
    passed: !!kpi,
    detail: kpi ? `Score: ${kpi.summary.overallScore}%, ${kpi.summary.met}/${kpi.summary.total} met` : 'Engine failed',
  });

  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;
  const ready = failed === 0;

  const report = {
    checks: results,
    summary: { total, passed, failed, ready },
    liveResults: {
      coordination: coordination ? { operators: coordination.summary.totalOperators, conflicts: coordination.summary.conflictCount, active: coordination.summary.coordinationActive } : null,
      federation: federation ? { healthScore: federation.summary.healthScore, services: federation.summary.federatedServices } : null,
      economic: economic ? { efficiency: economic.summary.efficiency, valueToCostratio: economic.summary.valueToCostratio } : null,
      kpi: kpi ? { overallScore: kpi.summary.overallScore, met: kpi.summary.met, total: kpi.summary.total } : null,
    },
    timestamp: now,
  };

  saveJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-ecosystem-readiness-result.json'), report);
  return report;
}

if (process.argv[1]?.endsWith('runtimeEcosystemReadinessGate.mjs')) {
  console.log('[readiness] Runtime Ecosystem Readiness Gate');
  console.log('='.repeat(55));

  const r = runEcosystemReadiness();

  console.log('\n  Checks:');
  for (const c of r.checks) {
    const icon = c.passed ? 'PASS' : 'FAIL';
    console.log(`    [${icon}] ${c.label}: ${c.detail}`);
  }

  console.log('\n  Live results:');
  if (r.liveResults.coordination) console.log(`    Coordination: ${r.liveResults.coordination.operators} operators, ${r.liveResults.coordination.conflicts} conflicts`);
  if (r.liveResults.federation) console.log(`    Federation: health ${r.liveResults.federation.healthScore}/100, ${r.liveResults.federation.services} services`);
  if (r.liveResults.economic) console.log(`    Economic: efficiency ${r.liveResults.economic.efficiency}%, V/C ${r.liveResults.economic.valueToCostratio}`);
  if (r.liveResults.kpi) console.log(`    KPI: ${r.liveResults.kpi.overallScore}% (${r.liveResults.kpi.met}/${r.liveResults.kpi.total} met)`);

  console.log(`\n  Summary: ${r.summary.passed}/${r.summary.total} passed`);
  console.log(`\n${'='.repeat(55)}`);
  console.log(`[readiness] ${r.summary.ready ? 'ECOSYSTEM READY' : `NOT READY — ${r.summary.failed} check(s) failed`}`);
  console.log('\n' + JSON.stringify({ ok: true, ...r }, null, 2));
}
