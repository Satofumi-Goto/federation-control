#!/usr/bin/env node
/**
 * Runtime Federation Ecosystem Validator
 *
 * Validates cross-runtime topology consistency, authority consistency,
 * governance consistency, propagation safety, conflict safety,
 * ecosystem stability, Registry consistency, and Federation Memory consistency.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function fileExists(p) {
  return fs.existsSync(path.resolve(REPO_ROOT, p));
}

function run(cmd) {
  try {
    const output = execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 30000, stdio: 'pipe' });
    return { ok: true, output };
  } catch (e) {
    return { ok: false, output: e.stderr?.trim() ?? e.message };
  }
}

function extractJson(output) {
  try {
    const lines = output.split('\n');
    const jsonStart = lines.findIndex(l => l.trim() === '{');
    if (jsonStart >= 0) return JSON.parse(lines.slice(jsonStart).join('\n'));
  } catch { /* parse failed */ }
  return null;
}

function main() {
  console.log('[ecosystem-validate] Runtime Federation Ecosystem Validator');
  console.log('='.repeat(65));

  const checks = [];

  function check(id, label, fn) {
    const pass = fn();
    checks.push({ id, label, pass });
    console.log(`  ${pass ? 'PASS' : 'FAIL'}: ${label}`);
    return pass;
  }

  // 1. Cross-runtime topology consistency
  check('topology_consistency', 'Cross-runtime topology consistency', () => {
    const model = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-federation-domain-model.json'));
    if (!model || !model.domains || !model.topology) return false;
    const domainIds = model.domains.map(d => d.id);
    return model.topology.edges.every(e =>
      domainIds.includes(e.from) && domainIds.includes(e.to)
    );
  });

  // 2. Domain model completeness (9 domains)
  check('domain_completeness', 'All 9 Runtime domains exist', () => {
    const model = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-federation-domain-model.json'));
    return model?.domains?.length === 9;
  });

  // 3. Authority hierarchy consistency
  check('authority_consistency', 'Authority hierarchy consistency', () => {
    const model = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-federation-domain-model.json'));
    if (!model?.authorityHierarchy) return false;
    const allDomains = model.authorityHierarchy.flatMap(h => h.domains);
    return model.domains.every(d => allDomains.includes(d.id));
  });

  // 4. Authority engine operational
  check('authority_engine', 'Authority engine operational', () => {
    const result = run('node scripts/runtime/runtimeFederationAuthorityEngine.mjs');
    const json = extractJson(result.output);
    return result.ok && json?.ok === true;
  });

  // 5. Governance consistency
  check('governance_consistency', 'Governance scope defined for all domains', () => {
    const model = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-federation-domain-model.json'));
    if (!model?.domains) return false;
    return model.domains.every(d => d.governanceScope?.length > 0);
  });

  // 6. Propagation safety (no loops)
  check('propagation_safety', 'No propagation loops detected', () => {
    const result = run('node scripts/runtime/runtimeFederationConflictEngine.mjs');
    const json = extractJson(result.output);
    return result.ok && (json?.conflicts?.loops ?? 0) === 0;
  });

  // 7. Conflict safety
  check('conflict_safety', 'Conflict engine operational', () => {
    const result = run('node scripts/runtime/runtimeFederationConflictEngine.mjs');
    return result.ok;
  });

  // 8. Federation stability
  check('stability', 'Federation stability engine operational', () => {
    const result = run('node scripts/runtime/runtimeFederationStabilityEngine.mjs');
    const json = extractJson(result.output);
    return result.ok && json?.stability?.score != null;
  });

  // 9. Cross-federation engine operational
  check('cross_federation', 'Cross-federation engine operational', () => {
    const result = run('node scripts/runtime/runtimeCrossFederationEngine.mjs');
    const json = extractJson(result.output);
    return result.ok && json?.ok === true;
  });

  // 10. Runtime Registry consistency
  check('registry_consistency', 'Runtime Registry remains canonical', () => {
    return run('node scripts/verify-registry-migration.mjs').ok;
  });

  // 11. Runtime topology links
  check('topology_links', 'Runtime topology links valid', () => {
    return run('node scripts/verify-runtime-topology-links.mjs').ok;
  });

  // 12. Federation Memory consistency
  check('federation_memory', 'Federation Memory exists and has structure', () => {
    const memory = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-federation-memory.json'));
    return memory?.federationLive != null && memory?.knowledgeGraph != null;
  });

  // 13. SLA/SLO model exists
  check('sla_slo', 'SLA/SLO model exists', () => {
    const model = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-sla-slo-model.json'));
    return model?.sla != null && model?.slo != null;
  });

  // 14. Permission matrix exists
  check('permission_matrix', 'Permission matrix exists', () => {
    return fileExists('runtime_data/runtime-permission-matrix.json');
  });

  const passed = checks.filter(c => c.pass).length;
  const total = checks.length;
  const score = Math.round((passed / total) * 100);

  console.log(`\n${'='.repeat(65)}`);
  console.log(`[ecosystem-validate] ${passed}/${total} checks passed (${score}%)`);

  const report = {
    ok: score === 100,
    passed,
    total,
    score,
    checks,
    timestamp: new Date().toISOString(),
  };

  console.log('\n' + JSON.stringify(report, null, 2));
}

main();
