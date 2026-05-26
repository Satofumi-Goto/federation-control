#!/usr/bin/env node
/**
 * Runtime Federation Conflict Engine
 *
 * Detects Runtime conflicts, conflicting repairs and deploys,
 * authority collisions, propagation loops, and generates
 * conflict resolution proposals.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveConflictByAuthority } from './runtimeFederationAuthorityEngine.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const DOMAIN_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-federation-domain-model.json');
const ORCH_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-orchestration-state.json');
const HEALTH_PATH = path.resolve(REPO_ROOT, 'runtime_data/runtime-federation-health-graph.json');

export const CONFLICT_TYPES = {
  REPAIR_CONFLICT: 'repair_conflict',
  DEPLOY_CONFLICT: 'deploy_conflict',
  AUTHORITY_COLLISION: 'authority_collision',
  PROPAGATION_LOOP: 'propagation_loop',
  DEPENDENCY_CONFLICT: 'dependency_conflict',
  GOVERNANCE_CONFLICT: 'governance_conflict',
};

export const RESOLUTION_STRATEGIES = {
  AUTHORITY_OVERRIDE: 'authority_override',
  PRIORITY_QUEUE: 'priority_queue',
  MANUAL_REVIEW: 'manual_review',
  BLOCK: 'block',
  DEFER: 'defer',
};

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

/**
 * Detect propagation loops in the domain topology.
 */
export function detectPropagationLoops() {
  const model = loadJson(DOMAIN_PATH);
  if (!model) return [];

  const loops = [];
  const edges = model.topology.edges;

  for (const domain of model.domains) {
    const visited = new Set();
    const stack = [domain.id];
    while (stack.length > 0) {
      const current = stack.pop();
      if (visited.has(current)) {
        if (current === domain.id) {
          loops.push({
            type: CONFLICT_TYPES.PROPAGATION_LOOP,
            origin: domain.id,
            severity: 'high',
            description: `Propagation loop detected from ${domain.id}`,
          });
        }
        continue;
      }
      visited.add(current);
      const outgoing = edges.filter(e => e.from === current).map(e => e.to);
      for (const next of outgoing) {
        if (next === domain.id && visited.size > 1) {
          loops.push({
            type: CONFLICT_TYPES.PROPAGATION_LOOP,
            origin: domain.id,
            path: [...visited, next],
            severity: 'high',
            description: `Loop: ${[...visited, next].join(' → ')}`,
          });
        } else if (!visited.has(next)) {
          stack.push(next);
        }
      }
    }
  }
  return loops;
}

/**
 * Detect authority collisions — domains at the same hierarchy level
 * with overlapping governance scopes.
 */
export function detectAuthorityCollisions() {
  const model = loadJson(DOMAIN_PATH);
  if (!model) return [];

  const collisions = [];
  const domains = model.domains;

  for (let i = 0; i < domains.length; i++) {
    for (let j = i + 1; j < domains.length; j++) {
      const a = domains[i];
      const b = domains[j];
      if (a.authorityLevel === b.authorityLevel) {
        const overlap = a.governanceScope.filter(s => b.governanceScope.includes(s));
        if (overlap.length > 0) {
          collisions.push({
            type: CONFLICT_TYPES.AUTHORITY_COLLISION,
            domainA: a.id,
            domainB: b.id,
            overlappingScopes: overlap,
            severity: 'medium',
            description: `Authority collision: ${a.id} and ${b.id} share scopes [${overlap.join(', ')}]`,
          });
        }
      }
    }
  }
  return collisions;
}

/**
 * Detect dependency conflicts — domains depending on degraded domains.
 */
export function detectDependencyConflicts() {
  const model = loadJson(DOMAIN_PATH);
  const health = loadJson(HEALTH_PATH);
  if (!model) return [];

  const degradedNodes = (health?.nodes ?? [])
    .filter(n => n.health === 'warning' || n.health === 'critical')
    .map(n => n.id);

  const conflicts = [];
  for (const domain of model.domains) {
    const degradedDeps = domain.dependencies.filter(dep =>
      degradedNodes.includes(dep.replace('-runtime', ''))
    );
    if (degradedDeps.length > 0) {
      conflicts.push({
        type: CONFLICT_TYPES.DEPENDENCY_CONFLICT,
        domain: domain.id,
        degradedDependencies: degradedDeps,
        severity: 'medium',
        description: `${domain.id} depends on degraded: [${degradedDeps.join(', ')}]`,
      });
    }
  }
  return conflicts;
}

/**
 * Generate conflict resolution proposals.
 */
export function generateResolutions(conflicts) {
  return conflicts.map(conflict => {
    let strategy = RESOLUTION_STRATEGIES.MANUAL_REVIEW;
    let action = 'Review required';

    switch (conflict.type) {
      case CONFLICT_TYPES.PROPAGATION_LOOP:
        strategy = RESOLUTION_STRATEGIES.BLOCK;
        action = 'Block propagation to break loop';
        break;
      case CONFLICT_TYPES.AUTHORITY_COLLISION: {
        const resolution = resolveConflictByAuthority(conflict.domainA, conflict.domainB);
        if (resolution.winner) {
          strategy = RESOLUTION_STRATEGIES.AUTHORITY_OVERRIDE;
          action = `${resolution.winner} takes authority (${resolution.reason})`;
        }
        break;
      }
      case CONFLICT_TYPES.DEPENDENCY_CONFLICT:
        strategy = RESOLUTION_STRATEGIES.DEFER;
        action = 'Defer operations until dependencies recover';
        break;
    }

    return { conflict, strategy, action, timestamp: new Date().toISOString() };
  });
}

/**
 * Full conflict detection scan.
 */
export function scanAllConflicts() {
  const loops = detectPropagationLoops();
  const collisions = detectAuthorityCollisions();
  const depConflicts = detectDependencyConflicts();
  const allConflicts = [...loops, ...collisions, ...depConflicts];
  const resolutions = generateResolutions(allConflicts);

  return {
    ok: true,
    conflicts: allConflicts,
    resolutions,
    counts: {
      loops: loops.length,
      collisions: collisions.length,
      dependencyConflicts: depConflicts.length,
      total: allConflicts.length,
    },
  };
}

function main() {
  console.log('[conflicts] Runtime Federation Conflict Engine');
  console.log('='.repeat(60));

  const result = scanAllConflicts();

  console.log(`\n  Propagation loops: ${result.counts.loops}`);
  console.log(`  Authority collisions: ${result.counts.collisions}`);
  console.log(`  Dependency conflicts: ${result.counts.dependencyConflicts}`);
  console.log(`  Total conflicts: ${result.counts.total}`);

  if (result.conflicts.length > 0) {
    console.log('\n  Detected Conflicts:');
    for (const c of result.conflicts) {
      console.log(`    [${c.type}] ${c.description} (${c.severity})`);
    }
    console.log('\n  Resolutions:');
    for (const r of result.resolutions) {
      console.log(`    [${r.strategy}] ${r.action}`);
    }
  } else {
    console.log('\n  No conflicts detected — federation topology is clean');
  }

  const report = {
    ok: result.counts.total === 0,
    conflicts: result.counts,
    resolutions: result.resolutions.length,
    clean: result.counts.total === 0,
    timestamp: new Date().toISOString(),
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[conflicts] Conflict scan ${report.clean ? 'CLEAN' : `${result.counts.total} CONFLICT(S)`}`);
  console.log('\n' + JSON.stringify(report, null, 2));
}

main();
