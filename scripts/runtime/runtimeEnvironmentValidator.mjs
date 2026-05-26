#!/usr/bin/env node
/**
 * Runtime Environment Validator
 *
 * Validates presence of required environment variables
 * for the deploy pipeline. Never prints raw token values.
 */

import { getCredentialSummary } from './runtimeCredentialResolver.mjs';

const REQUIRED_VARS = [
  { key: 'GRAFANA_TOKEN', label: 'Grafana API token' },
  { key: 'GRAFANA_URL', label: 'Grafana instance URL' },
  { key: 'GITHUB_TOKEN', label: 'GitHub token', altKeys: ['GH_TOKEN'] },
];

function mask(val) {
  if (!val) return '(not set)';
  if (val.length <= 8) return '***';
  return val.slice(0, 4) + '***' + val.slice(-4);
}

function main() {
  console.log('[env-check] Runtime Environment Validator');
  console.log('='.repeat(50));

  const results = [];

  for (const v of REQUIRED_VARS) {
    let value = process.env[v.key] ?? null;
    let resolvedFrom = v.key;

    if (!value && v.altKeys) {
      for (const alt of v.altKeys) {
        if (process.env[alt]) {
          value = process.env[alt];
          resolvedFrom = alt;
          break;
        }
      }
    }

    const present = !!value;
    const masked = mask(value);

    results.push({ key: v.key, label: v.label, present, masked, resolvedFrom: present ? resolvedFrom : null });
    console.log(`  ${present ? 'OK' : 'MISSING'}: ${v.key} — ${v.label} [${masked}]`);
  }

  const allPresent = results.every(r => r.present);

  console.log('\n[env-check] Credential summary (from resolver):');
  const summary = getCredentialSummary();
  console.log(JSON.stringify(summary, null, 2));

  const readiness = allPresent ? 'ready' : 'not-ready';
  console.log(`\n[env-check] Machine readiness: ${readiness}`);

  if (!allPresent) {
    const missing = results.filter(r => !r.present);
    console.log('[env-check] Missing variables:');
    for (const m of missing) {
      console.log(`  - ${m.key}: ${m.label}`);
    }
    console.log('\n[env-check] To fix: copy .env.runtime.example to .env.runtime and fill in values.');
  }

  const report = {
    readiness,
    allPresent,
    variables: results.map(r => ({ key: r.key, present: r.present, masked: r.masked })),
    timestamp: new Date().toISOString(),
  };
  console.log('\n' + JSON.stringify(report, null, 2));

  process.exit(allPresent ? 0 : 1);
}

main();
