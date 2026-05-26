#!/usr/bin/env node
/**
 * Runtime Auto-Verification Pipeline
 *
 * Runs all verification scripts and reports pass/fail for each.
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

const CHECKS = [
  { name: 'registry-migration', cmd: 'node scripts/verify-registry-migration.mjs' },
  { name: 'runtime-topology', cmd: 'node scripts/verify-runtime-topology-links.mjs' },
  { name: 'federation-semantic', cmd: 'node scripts/verify-federation-semantic.mjs' },
  { name: 'federation-governance', cmd: 'node scripts/verify-federation-governance.mjs' },
  { name: 'runtime-build', cmd: 'node scripts/build-runtime-workspace-v2.mjs' },
];

function runCheck(check) {
  try {
    const output = execSync(check.cmd, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 30000 }).trim();
    return { name: check.name, ok: true, output: output.split('\n').slice(-3).join('\n') };
  } catch (e) {
    return { name: check.name, ok: false, output: (e.stderr ?? e.message).trim().split('\n').slice(-3).join('\n') };
  }
}

function main() {
  console.log('[auto-verify] Runtime Auto-Verification Pipeline');
  console.log('='.repeat(50));

  const results = CHECKS.map(runCheck);
  let allPass = true;

  for (const r of results) {
    const status = r.ok ? 'PASS' : 'FAIL';
    console.log(`\n  [${status}] ${r.name}`);
    if (!r.ok) {
      console.log(`         ${r.output}`);
      allPass = false;
    }
  }

  const passed = results.filter(r => r.ok).length;
  console.log(`\n${'='.repeat(50)}`);
  console.log(`[auto-verify] ${passed}/${results.length} checks passed`);
  console.log(`[auto-verify] Overall: ${allPass ? 'ALL PASS' : 'SOME FAILED'}`);

  if (!allPass) process.exitCode = 1;
  return { allPass, results };
}

main();
