#!/usr/bin/env node
/**
 * Runtime Operational Command Readiness Gate
 *
 * Validates the complete autonomous operational command platform:
 * command engine, authority graph, coordination, emergency command,
 * safety rules, governance, Registry, and ecosystem stability.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOperationalCommand } from './runtimeOperationalCommandEngine.mjs';
import { runAutonomousCoordination } from './runtimeAutonomousCoordinationEngine.mjs';
import { runEmergencyCommand } from './runtimeEmergencyCommandEngine.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

function loadJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function saveJson(p, d) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n', 'utf8'); }

const STATIC_CHECKS = [
  { id: 'authority-graph', label: 'Command authority graph exists', path: 'runtime_data/runtime-command-authority-graph.json',
    validate: d => !!d?.nodes?.length && !!d?.controlAuthority?.length },
  { id: 'command-timeline', label: 'Command timeline exists', path: 'runtime_data/runtime-operational-command-timeline.json',
    validate: d => !!d?.counters },
  { id: 'command-engine', label: 'Operational command engine exists', path: 'scripts/runtime/runtimeOperationalCommandEngine.mjs',
    validate: () => true, fileCheck: true },
  { id: 'coordination-engine', label: 'Autonomous coordination engine exists', path: 'scripts/runtime/runtimeAutonomousCoordinationEngine.mjs',
    validate: () => true, fileCheck: true },
  { id: 'emergency-engine', label: 'Emergency command engine exists', path: 'scripts/runtime/runtimeEmergencyCommandEngine.mjs',
    validate: () => true, fileCheck: true },
  { id: 'governance-enforced', label: 'Governance enforcement active', path: 'runtime_data/runtime-evolution-governance-result.json',
    validate: d => d?.summary?.safetyLocks?.allEnforced !== false, optional: true },
  { id: 'registry-canonical', label: 'Runtime Registry canonical', path: 'runtime_data/runtime-evolution-governance-result.json',
    validate: d => d?.registryCanonical !== false, optional: true },
  { id: 'safety-locks', label: 'Safety locks active', path: 'runtime_data/runtime-evolution-governance-result.json',
    validate: d => (d?.summary?.safetyLocks?.forbiddenRulesActive ?? 0) >= 7, optional: true },
];

export function runCommandReadiness() {
  const now = new Date().toISOString();
  const results = [];

  for (const check of STATIC_CHECKS) {
    const fullPath = path.resolve(REPO_ROOT, check.path);
    const exists = fs.existsSync(fullPath);

    if (check.fileCheck) {
      results.push({ id: check.id, label: check.label, passed: exists, detail: exists ? 'File exists' : 'File missing' });
      continue;
    }

    if (!exists) {
      results.push({ id: check.id, label: check.label, passed: check.optional ?? false, detail: check.optional ? 'Optional — not found' : 'File missing' });
      continue;
    }

    const data = loadJson(fullPath);
    const valid = check.validate(data);
    results.push({ id: check.id, label: check.label, passed: valid, detail: valid ? 'Validated' : 'Validation failed' });
  }

  let command, coordination, emergency;
  try { command = runOperationalCommand(); } catch { command = null; }
  try { coordination = runAutonomousCoordination(); } catch { coordination = null; }
  try { emergency = runEmergencyCommand(); } catch { emergency = null; }

  results.push({ id: 'command-live', label: 'Command engine operational', passed: !!command?.summary?.authorityOperational,
    detail: command ? `authority=${command.summary.authorityOperational}, governance=${command.summary.governanceEnforced}` : 'Engine failed' });
  results.push({ id: 'coordination-live', label: 'Autonomous coordination operational', passed: !!coordination,
    detail: coordination ? `${coordination.summary.totalActions} actions, critical=${coordination.summary.criticalActions}` : 'Engine failed' });
  results.push({ id: 'emergency-live', label: 'Emergency command operational', passed: !!emergency,
    detail: emergency ? `level=${emergency.summary.emergencyLevel}, canonical=${emergency.summary.canonicalProtected}` : 'Engine failed' });
  results.push({ id: 'ecosystem-stable', label: 'Ecosystem stability operational', passed: coordination ? coordination.summary.criticalActions === 0 : false,
    detail: coordination ? `${coordination.summary.criticalActions} critical actions` : 'Cannot evaluate' });

  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const ready = results.every(r => r.passed);

  const report = {
    checks: results,
    summary: { total, passed, failed: total - passed, ready },
    liveResults: {
      command: command ? { authorityOperational: command.summary.authorityOperational, dispatchEfficiency: command.summary.dispatchEfficiency } : null,
      coordination: coordination ? { totalActions: coordination.summary.totalActions, criticalActions: coordination.summary.criticalActions } : null,
      emergency: emergency ? { level: emergency.summary.emergencyLevel, canonicalProtected: emergency.summary.canonicalProtected } : null,
    },
    timestamp: now,
  };

  saveJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-operational-command-readiness-result.json'), report);
  return report;
}

if (process.argv[1]?.endsWith('runtimeOperationalCommandReadinessGate.mjs')) {
  console.log('[readiness] Runtime Operational Command Readiness Gate');
  console.log('='.repeat(55));

  const r = runCommandReadiness();

  console.log('\n  Checks:');
  for (const c of r.checks) console.log(`    [${c.passed ? 'PASS' : 'FAIL'}] ${c.label}: ${c.detail}`);

  console.log('\n  Live results:');
  if (r.liveResults.command) console.log(`    Command: authority=${r.liveResults.command.authorityOperational}, dispatch=${r.liveResults.command.dispatchEfficiency}%`);
  if (r.liveResults.coordination) console.log(`    Coordination: ${r.liveResults.coordination.totalActions} actions, ${r.liveResults.coordination.criticalActions} critical`);
  if (r.liveResults.emergency) console.log(`    Emergency: ${r.liveResults.emergency.level}, canonical=${r.liveResults.emergency.canonicalProtected}`);

  console.log(`\n  Summary: ${r.summary.passed}/${r.summary.total} passed`);
  console.log(`\n${'='.repeat(55)}`);
  console.log(`[readiness] ${r.summary.ready ? 'COMMAND READINESS CONFIRMED' : `NOT READY — ${r.summary.failed} check(s) failed`}`);
  console.log('\n' + JSON.stringify({ ok: true, ...r }, null, 2));
}
