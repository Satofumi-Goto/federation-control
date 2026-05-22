import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('grafana');
const specPath = path.join(root, 'runtime-operational-surfaces.json');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const outDir = path.join(root, 'dashboards');

function gateColor(gate) {
  if (gate === 'AUTHORIZED') return '#22c55e';
  if (gate === 'HOLD') return '#f59e0b';
  if (gate === 'STOP') return '#ef4444';
  return '#94a3b8';
}

function metricPanel(item, accent, panelId, gridPos) {
  const gate = item.gate ?? 'AUTHORIZED';
  const gateColorValue = gateColor(gate);
  return {
    id: panelId,
    type: 'text',
    title: item.labelJa,
    transparent: true,
    gridPos,
    options: {
      mode: 'html',
      content: `<div style="width:100%;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;padding:12px;background:#0f172a;border:1px solid ${accent};border-left:4px solid ${accent};border-radius:12px;color:#fff;"><div style="font-size:11px;color:#94a3b8;">${item.labelEn}</div><div style="font-size:11px;font-weight:800;color:${accent};margin-top:2px;">${item.labelJa}</div><div style="font-size:22px;font-weight:900;margin-top:6px;">${item.value}</div><div style="font-size:11px;color:#94a3b8;margin-top:4px;">${item.detail}</div><div style="margin-top:8px;font-size:11px;font-weight:700;color:${gateColorValue};">${gate}</div></div>`,
    },
  };
}

function headerPanel(surface) {
  const pathHref = `/d/${surface.uid}/${surface.slug}`;
  return {
    id: 1,
    type: 'text',
    title: '',
    transparent: true,
    gridPos: { h: 3, w: 24, x: 0, y: 0 },
    options: {
      mode: 'html',
      content: `<div style="width:100%;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:linear-gradient(180deg,#0b1220,#02060c);border:1px solid ${surface.accent};border-radius:12px;color:#fff;"><div><div style="font-size:11px;color:#94a3b8;">Operational App Surface · ${surface.role}</div><div style="font-size:24px;font-weight:900;">${surface.labelJa}</div><div style="margin-top:4px;font-size:11px;color:#cbd5e1;">Grafana Federation OS · Base44はOperational UX（Surface非置換）</div></div><a href="/d/${spec.runtimeRouterUid}/runtime" style="text-decoration:none;font-size:11px;font-weight:700;color:#67e8f9;padding:6px 12px;border:1px solid rgba(56,189,248,.4);border-radius:8px;">← Runtime</a></div>`,
    },
  };
}

function buildDashboard(surface) {
  const items = surface.displayItems;
  const metricPanels = items.map((item, index) => {
    const col = index % 5;
    return metricPanel(item, surface.accent, 10 + index, { h: 5, w: 4, x: col * 4, y: 3 });
  });

  return {
    uid: surface.uid,
    editable: true,
    schemaVersion: 39,
    style: 'dark',
    title: surface.title,
    version: 1,
    refresh: '30s',
    timezone: 'browser',
    description: `${surface.labelJa} — Grafana Operational App Surface（Base44 iframe/直リンク禁止）`,
    tags: ['runtime', 'operational-surface', 'urban-os-runtime', surface.key],
    links: [
      { title: 'Runtime', url: `/d/${spec.runtimeRouterUid}/runtime` },
      { title: surface.labelJa, url: `/d/${surface.uid}/${surface.slug}` },
    ],
    panels: [headerPanel(surface), ...metricPanels],
  };
}

const index = {
  description: 'Runtime Federation dashboard index — Operational App Surfaces and Router verification state.',
  layoutVersion: spec.layoutVersion,
  generatedFrom: 'grafana/runtime-operational-surfaces.json',
  runtimeRouter: {
    uid: spec.runtimeRouterUid,
    path: `/d/${spec.runtimeRouterUid}/runtime`,
    verified: true,
  },
  policy: spec.policy,
  operationalSurfaces: [],
};

for (const surface of spec.surfaces) {
  const dashboard = buildDashboard(surface);
  const outFile = path.join(outDir, surface.outputFile);
  fs.writeFileSync(outFile, `${JSON.stringify(dashboard, null, 2)}\n`);
  console.log(`Wrote ${outFile}`);

  index.operationalSurfaces.push({
    key: surface.key,
    uid: surface.uid,
    title: surface.title,
    slug: surface.slug,
    labelJa: surface.labelJa,
    path: `/d/${surface.uid}/${surface.slug}`,
    role: surface.role,
    dashboardFile: `grafana/dashboards/${surface.outputFile}`,
    displayItems: surface.displayItems.map((d) => d.id),
    verified: true,
  });
}

const indexPath = path.join(root, 'runtime-dashboard-index.json');
fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
console.log(`Wrote ${indexPath}`);
