#!/usr/bin/env node
/**
 * Runtime Federation Authority Engine
 *
 * Determines Runtime authority hierarchy, ownership,
 * override permissions, emergency authority,
 * and cross-runtime conflict resolution.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const DOMAIN_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-federation-domain-model.json');
const ORCH_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-orchestration-state.json');
const PERMISSION_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-permission-matrix.json');

export const AUTHORITY_STATES = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  OBSERVER: 'observer',
  RESTRICTED: 'restricted',
  EMERGENCY: 'emergency',
};

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

/**
 * Derive the authority state for a domain based on orchestration mode.
 */
export function deriveAuthorityState(domain, orchState) {
  const mode = orchState?.activeMode ?? 'normal';

  if (mode === 'emergency') {
    if (domain.authorityLevel === 'primary') return AUTHORITY_STATES.EMERGENCY;
    return AUTHORITY_STATES.RESTRICTED;
  }
  if (mode === 'restricted' || mode === 'rollback') {
    if (domain.authorityLevel === 'primary') return AUTHORITY_STATES.PRIMARY;
    return AUTHORITY_STATES.RESTRICTED;
  }
  return domain.authorityLevel === 'primary'
    ? AUTHORITY_STATES.PRIMARY
    : AUTHORITY_STATES.SECONDARY;
}

/**
 * Build the full authority hierarchy.
 */
export function buildAuthorityHierarchy() {
  const model = loadJson(DOMAIN_PATH);
  const orch = loadJson(ORCH_PATH);
  if (!model) return { ok: false, error: 'Domain model not found' };

  const hierarchy = model.domains.map(domain => ({
    domainId: domain.id,
    label: domain.label,
    ownership: domain.ownership,
    baseAuthority: domain.authorityLevel,
    effectiveAuthority: deriveAuthorityState(domain, orch),
    canOverride: domain.authorityLevel === 'primary',
    canEmergencyOverride: domain.id === 'runtime-core' || domain.id === 'governance-runtime',
    dependents: domain.dependents,
    hierarchyLevel: model.authorityHierarchy.find(h => h.domains.includes(domain.id))?.level ?? 99,
  }));

  hierarchy.sort((a, b) => a.hierarchyLevel - b.hierarchyLevel);

  return {
    ok: true,
    hierarchy,
    primaryCount: hierarchy.filter(h => h.effectiveAuthority === AUTHORITY_STATES.PRIMARY || h.effectiveAuthority === AUTHORITY_STATES.EMERGENCY).length,
    secondaryCount: hierarchy.filter(h => h.effectiveAuthority === AUTHORITY_STATES.SECONDARY).length,
    restrictedCount: hierarchy.filter(h => h.effectiveAuthority === AUTHORITY_STATES.RESTRICTED).length,
    activeMode: orch?.activeMode ?? 'normal',
  };
}

/**
 * Check if domain A can override domain B.
 */
export function canOverride(domainIdA, domainIdB) {
  const model = loadJson(DOMAIN_PATH);
  if (!model) return { allowed: false, reason: 'Domain model not found' };

  const domainA = model.domains.find(d => d.id === domainIdA);
  const domainB = model.domains.find(d => d.id === domainIdB);
  if (!domainA || !domainB) return { allowed: false, reason: 'Domain not found' };

  const levelA = model.authorityHierarchy.find(h => h.domains.includes(domainIdA))?.level ?? 99;
  const levelB = model.authorityHierarchy.find(h => h.domains.includes(domainIdB))?.level ?? 99;

  if (levelA < levelB) return { allowed: true, reason: `${domainIdA} (level ${levelA}) outranks ${domainIdB} (level ${levelB})` };
  if (levelA === levelB && domainIdA === 'runtime-core') return { allowed: true, reason: 'runtime-core has universal override' };
  return { allowed: false, reason: `${domainIdA} (level ${levelA}) cannot override ${domainIdB} (level ${levelB})` };
}

/**
 * Resolve cross-runtime conflict by authority.
 */
export function resolveConflictByAuthority(domainIdA, domainIdB) {
  const overrideCheck = canOverride(domainIdA, domainIdB);
  if (overrideCheck.allowed) return { winner: domainIdA, reason: overrideCheck.reason };

  const reverseCheck = canOverride(domainIdB, domainIdA);
  if (reverseCheck.allowed) return { winner: domainIdB, reason: reverseCheck.reason };

  return { winner: null, reason: 'Equal authority — requires manual resolution' };
}

function main() {
  console.log('[authority] Runtime Federation Authority Engine');
  console.log('='.repeat(60));

  const result = buildAuthorityHierarchy();
  if (!result.ok) {
    console.log(`  ERROR: ${result.error}`);
    return;
  }

  console.log(`\n  Mode: ${result.activeMode}`);
  console.log(`  Primary: ${result.primaryCount} | Secondary: ${result.secondaryCount} | Restricted: ${result.restrictedCount}`);

  console.log('\n  Authority Hierarchy:');
  for (const h of result.hierarchy) {
    const flags = [];
    if (h.canOverride) flags.push('override');
    if (h.canEmergencyOverride) flags.push('emergency-override');
    console.log(`    L${h.hierarchyLevel} ${h.label} (${h.effectiveAuthority}) [${flags.join(', ')}]`);
    console.log(`       owner: ${h.ownership} | dependents: ${h.dependents.length}`);
  }

  // Conflict resolution demo
  console.log('\n  Conflict Resolution Tests:');
  const tests = [
    ['runtime-core', 'fleet-runtime'],
    ['governance-runtime', 'execution-runtime'],
    ['fleet-runtime', 'urban-runtime'],
  ];
  for (const [a, b] of tests) {
    const res = resolveConflictByAuthority(a, b);
    console.log(`    ${a} vs ${b} → winner: ${res.winner ?? 'none'} (${res.reason})`);
  }

  const report = {
    ok: true,
    hierarchy: result.hierarchy.map(h => ({
      domain: h.domainId,
      level: h.hierarchyLevel,
      authority: h.effectiveAuthority,
      ownership: h.ownership,
    })),
    primaryCount: result.primaryCount,
    secondaryCount: result.secondaryCount,
    restrictedCount: result.restrictedCount,
    activeMode: result.activeMode,
    timestamp: new Date().toISOString(),
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log('[authority] Authority engine operational');
  console.log('\n' + JSON.stringify(report, null, 2));
}

main();
