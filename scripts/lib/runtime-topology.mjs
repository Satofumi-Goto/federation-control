import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

export function loadRuntimeTopology() {
  const p = path.join(repoRoot, 'grafana/runtime-topology-routes.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function loadRuntimeWorkspaceRoutes() {
  const p = path.join(repoRoot, 'grafana/runtime-workspace-routes.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** Runtime center href used by cards/icons (Grafana path, not site root). */
export function resolveRuntimeCenterHref(routes, topology = loadRuntimeTopology()) {
  return (
    routes.runtimeTopPath ??
    topology.runtimeCenter?.grafana ??
    '/d/sa8ljn4/runtime'
  );
}

export function resolveOperationalArchitectureHref(routes, topology = loadRuntimeTopology()) {
  const target = topology.row2Panels?.operationalArchitecture?.target;
  if (target === 'runtimeCenter') {
    return resolveRuntimeCenterHref(routes, topology);
  }
  return routes.row2?.runtimePanel ?? resolveRuntimeCenterHref(routes, topology);
}

export function collectDashboardPathsFromRepo() {
  const grafanaDir = path.join(repoRoot, 'grafana');
  const paths = new Set();
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name.endsWith('.json')) {
        try {
          const j = JSON.parse(fs.readFileSync(full, 'utf8'));
          if (j.uid) {
            const slug =
              j.slug ||
              String(j.title || j.uid)
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            paths.add(`/d/${j.uid}/${slug}`);
          }
        } catch {
          /* skip */
        }
      }
    }
  };
  walk(grafanaDir);
  return paths;
}

export function extractHrefsFromHtml(html) {
  const hrefs = [];
  const re = /href=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) hrefs.push(m[1]);
  return hrefs;
}
