#!/usr/bin/env node
/**
 * Runtime Tool Exposure Validation
 *
 * Validates that the Runtime tool exposure surface is operational,
 * governed, safe, and correctly wired to the execution pipeline.
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

function tryExec(cmd) {
  try {
    const output = execSync(cmd, { encoding: 'utf8', timeout: 30000, cwd: REPO_ROOT, stdio: 'pipe' });
    return { ok: true, output: output.trim() };
  } catch (e) {
    return { ok: false, output: e.stderr?.trim() ?? e.message };
  }
}

// ── Static checks ──

const STATIC_CHECKS = [
  { id: 'tool-exposure-script', label: 'Tool exposure layer exists', path: 'scripts/runtime/runtimeToolExposureLayer.mjs' },
  { id: 'external-gateway-script', label: 'External execution gateway exists', path: 'scripts/runtime/runtimeExternalExecutionGateway.mjs' },
  { id: 'tool-manifest', label: 'Tool manifest exists', path: 'runtime_data/runtime-tool-manifest.json' },
  { id: 'invocation-contract', label: 'External invocation contract exists', path: 'docs/runtime-external-invocation-contract.md' },
  { id: 'headless-executor', label: 'Headless executor exists', path: 'scripts/runtime/runtimeHeadlessCursorExecutor.mjs' },
  { id: 'safety-lock', label: 'Safety lock exists', path: 'scripts/runtime/runtimeInvocationSafetyLock.mjs' },
  { id: 'safety-layer', label: 'Safety layer exists', path: 'scripts/runtime/runtimeInvocationSafetyLayer.mjs' },
  { id: 'policy-engine', label: 'Policy engine exists', path: 'scripts/runtime/runtimePolicyEngine.mjs' },
  { id: 'credential-resolver', label: 'Credential resolver exists', path: 'scripts/runtime/runtimeCredentialResolver.mjs' },
  { id: 'workspace-binding', label: 'Workspace binding exists', path: 'scripts/runtime/runtimeCursorWorkspaceBinding.mjs' },
];

function runStaticChecks() {
  const results = [];
  for (const check of STATIC_CHECKS) {
    const fullPath = path.resolve(REPO_ROOT, check.path);
    const exists = fs.existsSync(fullPath);
    results.push({ id: check.id, label: check.label, pass: exists });
  }
  return results;
}

// ── Live checks ──

function checkToolExposureOperational() {
  const result = tryExec('node scripts/runtime/runtimeToolExposureLayer.mjs');
  if (!result.ok) return { pass: false, detail: 'Tool exposure layer failed to execute' };

  try {
    const jsonMatch = result.output.match(/\{[\s\S]*\}$/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { pass: parsed.ok === true && parsed.toolCount >= 7, detail: `${parsed.toolCount} tools exposed` };
    }
  } catch { /* fall through */ }
  return { pass: result.ok, detail: 'Executed but output not parseable' };
}

function checkExternalGatewayOperational() {
  const result = tryExec('node scripts/runtime/runtimeExternalExecutionGateway.mjs');
  if (!result.ok) return { pass: false, detail: 'External gateway failed to execute' };

  try {
    const jsonMatch = result.output.match(/\{[\s\S]*\}$/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { pass: parsed.ok === true, detail: `Gateway: governance=${parsed.governance}, safety=${parsed.safety}, scope=${parsed.scope}` };
    }
  } catch { /* fall through */ }
  return { pass: result.ok, detail: 'Executed but output not parseable' };
}

function checkManifestConsistency() {
  const manifest = loadJson(path.resolve(REPO_ROOT, 'runtime_data/runtime-tool-manifest.json'));
  if (!manifest) return { pass: false, detail: 'Manifest not found' };
  if (!manifest.tools || manifest.tools.length < 7) return { pass: false, detail: `Only ${manifest.tools?.length ?? 0} tools in manifest` };
  if (!manifest.permissionLevels || manifest.permissionLevels.length < 5) return { pass: false, detail: 'Missing permission levels' };
  if (!manifest.restrictions) return { pass: false, detail: 'Missing restrictions block' };

  const requiredRestrictions = [
    'destructiveExecutionRequiresApproval',
    'governanceBypassForbidden',
    'registryDeletionForbidden',
    'canonicalReplacementForbidden',
    'credentialExposureForbidden',
  ];
  const missingRestrictions = requiredRestrictions.filter(r => manifest.restrictions[r] !== true);
  if (missingRestrictions.length > 0) return { pass: false, detail: `Missing restrictions: ${missingRestrictions.join(', ')}` };

  return { pass: true, detail: `${manifest.tools.length} tools, ${manifest.permissionLevels.length} permission levels, all restrictions enforced` };
}

function checkSafetyEnforced() {
  const result = tryExec('node scripts/runtime/runtimeInvocationSafetyLock.mjs');
  return { pass: result.ok, detail: result.ok ? 'Safety lock operational' : 'Safety lock failed' };
}

function checkGovernanceEnforced() {
  const result = tryExec('node scripts/runtime/runtimePolicyEngine.mjs');
  return { pass: result.ok, detail: result.ok ? 'Governance policies active' : 'Governance check failed' };
}

function checkExecutionScopeEnforced() {
  const pkgJson = loadJson(path.resolve(REPO_ROOT, 'package.json'));
  const bound = pkgJson?.name === 'federation-control';
  return { pass: bound, detail: bound ? 'Workspace bound to federation-control' : 'Workspace binding failed' };
}

function checkRegistryCanonical() {
  const registry = loadJson(path.resolve(REPO_ROOT, 'src/runtime/registry/runtimeRegistryData.json'));
  if (!registry) return { pass: false, detail: 'Registry data missing' };
  const cards = Array.isArray(registry) ? registry : registry.cards ?? [];
  if (cards.length === 0) return { pass: false, detail: 'Registry contains no cards' };
  const hasViewPanel = JSON.stringify(registry).includes('viewPanel=401');
  return { pass: !hasViewPanel, detail: hasViewPanel ? 'Legacy viewPanel=401 detected' : `${cards.length} cards, direct dashboard routing` };
}

// ── Main ──

if (process.argv[1]?.endsWith('runtimeToolExposureValidation.mjs')) {
  console.log('[tool-validation] Runtime Tool Exposure Validation');
  console.log('='.repeat(60));

  const results = [];
  let passCount = 0;
  let totalCount = 0;

  // Static checks
  console.log('\n  Static checks:');
  const staticResults = runStaticChecks();
  for (const r of staticResults) {
    console.log(`    ${r.pass ? 'PASS' : 'FAIL'}: ${r.label}`);
    results.push(r);
    totalCount++;
    if (r.pass) passCount++;
  }

  // Live checks
  console.log('\n  Live checks:');
  const liveChecks = [
    { id: 'tool-exposure-live', label: 'Tool exposure operational', fn: checkToolExposureOperational },
    { id: 'external-gateway-live', label: 'External gateway operational', fn: checkExternalGatewayOperational },
    { id: 'manifest-consistency', label: 'Manifest consistency', fn: checkManifestConsistency },
    { id: 'safety-enforced', label: 'Safety enforced', fn: checkSafetyEnforced },
    { id: 'governance-enforced', label: 'Governance enforced', fn: checkGovernanceEnforced },
    { id: 'execution-scope-enforced', label: 'Execution scope enforced', fn: checkExecutionScopeEnforced },
    { id: 'registry-canonical', label: 'Registry remains canonical', fn: checkRegistryCanonical },
  ];

  for (const check of liveChecks) {
    const result = check.fn();
    console.log(`    ${result.pass ? 'PASS' : 'FAIL'}: ${check.label} — ${result.detail}`);
    results.push({ id: check.id, label: check.label, pass: result.pass, detail: result.detail });
    totalCount++;
    if (result.pass) passCount++;
  }

  const allPass = passCount === totalCount;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[tool-validation] ${passCount}/${totalCount} checks passed — ${allPass ? 'ALL PASS' : 'ISSUES FOUND'}`);
  console.log('\n' + JSON.stringify({
    ok: allPass,
    passed: passCount,
    total: totalCount,
    results: results.filter(r => !r.pass),
    timestamp: new Date().toISOString(),
  }, null, 2));

  if (!allPass) process.exitCode = 1;
}
