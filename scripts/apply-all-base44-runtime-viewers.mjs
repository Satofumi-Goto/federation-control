/**
 * Apply Runtime Public Viewer to all four Base44 consoles.
 * Clones into .base44-repos/ if missing, runs auth-guard patch then public viewer patch.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const spec = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'base44-runtime-viewer-spec.json'), 'utf8'),
);
const baseDir = path.join(repoRoot, '.base44-repos');

const keyToFolder = {
  fleet: 'fleet-operations-console',
  serviceHub: 'service-hub-console',
  life: 'life-transaction-console',
  urban: 'urban-operation-console',
};

for (const [key, cfg] of Object.entries(spec.consoles)) {
  const folder = keyToFolder[key] || cfg.github.split('/').pop();
  const dest = path.join(baseDir, folder);
  console.log(`\n=== ${key} → ${dest} ===`);

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(baseDir, { recursive: true });
    execSync(`git clone https://github.com/${cfg.github}.git "${dest}"`, {
      stdio: 'inherit',
      cwd: repoRoot,
    });
  }

  execSync(`node scripts/patch-base44-auth-guard-order.mjs "${dest}"`, {
    stdio: 'inherit',
    cwd: repoRoot,
  });
  execSync(`node scripts/apply-base44-runtime-public-viewer.mjs "${dest}" ${key}`, {
    stdio: 'inherit',
    cwd: repoRoot,
  });
}

console.log('\nAll consoles patched locally under .base44-repos/');
