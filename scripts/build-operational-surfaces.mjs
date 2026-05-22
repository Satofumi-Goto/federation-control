import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve('.');
const specPath = path.join(repoRoot, 'grafana/runtime-operational-surfaces.json');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const outDir = path.join(repoRoot, 'grafana/dashboards');

function loadDashboard(relPath) {
  const file = path.join(repoRoot, relPath);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function gateColor(gate) {
  if (gate === 'AUTHORIZED') return '#22c55e';
  if (gate === 'HOLD') return '#f59e0b';
  if (gate === 'STOP') return '#ef4444';
  return '#94a3b8';
}

function metricPanel(item, accent, panelId, gridPos) {
  const gate = item.gate ?? 'AUTHORIZED';
  const gc = gateColor(gate);
  return {
    id: panelId,
    type: 'text',
    title: item.labelJa,
    transparent: true,
    gridPos,
    options: {
      mode: 'html',
      content: `<div style="width:100%;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;padding:12px;background:#0f172a;border:1px solid ${accent};border-left:4px solid ${accent};border-radius:12px;color:#fff;"><div style="font-size:11px;color:#94a3b8;">${item.labelEn}</div><div style="font-size:11px;font-weight:800;color:${accent};margin-top:2px;">${item.labelJa}</div><div style="font-size:22px;font-weight:900;margin-top:6px;">${item.value}</div><div style="font-size:11px;color:#94a3b8;margin-top:4px;">${item.detail}</div><div style="margin-top:8px;font-size:11px;font-weight:700;color:${gc};">${gate}</div></div>`,
    },
  };
}

function headerPanel(surface, subtitle) {
  return {
    id: 100,
    type: 'text',
    title: '',
    transparent: true,
    gridPos: { h: 3, w: 24, x: 0, y: 0 },
    options: {
      mode: 'html',
      content: `<div style="width:100%;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:linear-gradient(180deg,#0b1220,#02060c);border:1px solid ${surface.accent};border-radius:12px;color:#fff;"><div><div style="font-size:11px;color:#94a3b8;">Operational App Surface · ${surface.role}</div><div style="font-size:24px;font-weight:900;">${surface.labelJa}</div><div style="margin-top:4px;font-size:11px;color:#cbd5e1;">${subtitle}</div></div><a href="/d/${spec.runtimeRouterUid}/runtime" style="text-decoration:none;font-size:11px;font-weight:700;color:#67e8f9;padding:6px 12px;border:1px solid rgba(56,189,248,.4);border-radius:8px;">← Runtime</a></div>`,
    },
  };
}

function overlayStrip(items, accent, startY = 3) {
  return items.map((item, i) =>
    metricPanel(item, accent, 110 + i, { h: 4, w: 4, x: i * 4, y: startY })
  );
}

function shiftPanels(panels, dy, skipIds = new Set([100, 110, 111, 112, 113, 114])) {
  return panels.map((p) => {
    if (skipIds.has(p.id)) return p;
    const g = p.gridPos || { x: 0, y: 0, w: 12, h: 8 };
    return { ...p, gridPos: { ...g, y: (g.y ?? 0) + dy } };
  });
}

function maxId(panels) {
  return panels.reduce((m, p) => Math.max(m, p.id ?? 0), 0);
}

function renumberSecondary(panels, startId) {
  let id = startId;
  return panels.map((p) => ({ ...p, id: id++ }));
}

function buildFromBase(surface) {
  const base = loadDashboard(surface.baseDashboard);
  const dy = surface.overlayOffsetY ?? 7;
  const subtitle =
    surface.key === 'fleet'
      ? 'v1 伝播連携ボード + Federation OS 運用レイヤ'
      : surface.key === 'life'
        ? 'v1 Ledger·Demand モデル + 生活取引 Surface'
        : surface.key === 'urban'
          ? 'v1 運行計画 + 制御分析 Surface'
          : 'v1 高密度 Operational Surface';

  let panels = [
    headerPanel(surface, subtitle),
    ...overlayStrip(surface.operationalOverlay, surface.accent),
    ...shiftPanels(base.panels ?? [], dy),
  ];

  if (surface.secondaryDashboard) {
    const secondary = loadDashboard(surface.secondaryDashboard);
    const baseMax = maxId(panels);
    const shifted = (secondary.panels ?? []).map((p) => {
      const g = p.gridPos || { h: 8, w: 12, x: 0, y: 0 };
      return { ...p, gridPos: { ...g, y: (g.y ?? 0) + dy + 12 } };
    });
    panels = [...panels, ...renumberSecondary(shifted, baseMax + 1)];
  }

  const dashboard = {
    ...base,
    uid: surface.uid,
    title: surface.title ?? base.title,
    description: `${surface.labelJa} — Operational App Surface（Base44禁止・v1ベース統合）`,
    tags: [...new Set([...(base.tags ?? []), 'runtime', 'operational-surface', 'urban-os-runtime', surface.key])],
    links: [
      { title: 'Runtime', url: `/d/${spec.runtimeRouterUid}/runtime` },
      { title: surface.labelJa, url: `/d/${surface.uid}/${surface.slug}` },
    ],
    panels,
  };

  return dashboard;
}

function buildServiceHub(surface) {
  const base = loadDashboard(surface.baseDashboard);
  const accent = surface.accent;
  const byTitle = Object.fromEntries((base.panels ?? []).map((p) => [p.title, p]));

  const pick = (title, fallbackItem, x) => {
    const existing = byTitle[title];
    if (existing) {
      return {
        ...existing,
        id: 110 + x,
        gridPos: { h: 5, w: 4, x: x * 4, y: 3 },
        transparent: true,
      };
    }
    return metricPanel(fallbackItem, accent, 110 + x, { h: 5, w: 4, x: x * 4, y: 3 });
  };

  const items = surface.operationalOverlay;
  const row = [
    pick('受入', items[0], 0),
    pick('ノード', items[1], 1),
    pick('エネルギー', items[2], 2),
    pick('同期', items[3], 3),
    pick('制約', items[4], 4),
  ];

  const detailPanels = (base.panels ?? [])
    .filter((p) => p.id !== 1 && !['受入', 'ノード', 'エネルギー', '同期', '制約', 'キュー'].includes(p.title))
    .map((p, i) => ({
      ...p,
      id: 200 + i,
      gridPos: { h: 4, w: 6, x: (i % 4) * 6, y: 8 + Math.floor(i / 4) * 4 },
    }));

  const queuePanel = byTitle['キュー'];
  const extra = queuePanel
    ? [{ ...queuePanel, id: 220, gridPos: { h: 4, w: 12, x: 0, y: 12 } }]
    : [];

  return {
    ...base,
    uid: surface.uid,
    title: surface.title,
    description: `${surface.labelJa} — Service Hub Operational Surface（高密度・Base44禁止）`,
    tags: [...new Set([...(base.tags ?? []), 'operational-surface'])],
    links: [
      { title: 'Runtime', url: `/d/${spec.runtimeRouterUid}/runtime` },
      { title: surface.labelJa, url: `/d/${surface.uid}/${surface.slug}` },
    ],
    panels: [
      {
        id: 100,
        type: 'text',
        title: '',
        transparent: true,
        gridPos: { h: 3, w: 24, x: 0, y: 0 },
        options: {
          mode: 'html',
          content: `<div style="width:100%;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:linear-gradient(180deg,#0b1220,#02060c);border:1px solid ${accent};border-radius:12px;color:#fff;"><div><div style="font-size:11px;color:#94a3b8;">Operational App Surface · ${surface.role}</div><div style="font-size:24px;font-weight:900;">${surface.labelJa}</div><div style="margin-top:4px;font-size:11px;color:#c4b5fd;">v1 Service Hub Console · 高密度 panel</div></div><a href="/d/${spec.runtimeRouterUid}/runtime" style="text-decoration:none;font-size:11px;font-weight:700;color:#67e8f9;padding:6px 12px;border:1px solid rgba(56,189,248,.4);border-radius:8px;">← Runtime</a></div>`,
        },
      },
      ...row,
      ...extra,
      ...detailPanels,
    ],
  };
}

const index = {
  description: 'Runtime Federation dashboard index — v1-base Operational App Surfaces.',
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
  const dashboard =
    surface.mode === 'enhance-in-place' ? buildServiceHub(surface) : buildFromBase(surface);

  const outFile = path.join(outDir, surface.outputFile);
  fs.writeFileSync(outFile, `${JSON.stringify(dashboard, null, 2)}\n`);
  console.log(`Wrote ${outFile} (${dashboard.panels.length} panels, uid=${dashboard.uid})`);

  index.operationalSurfaces.push({
    key: surface.key,
    uid: surface.uid,
    slug: surface.slug,
    title: dashboard.title,
    labelJa: surface.labelJa,
    path: `/d/${surface.uid}/${surface.slug}`,
    role: surface.role,
    baseDashboard: surface.baseDashboard,
    secondaryDashboard: surface.secondaryDashboard ?? null,
    dashboardFile: `grafana/dashboards/${surface.outputFile}`,
    displayItems: surface.operationalOverlay.map((d) => d.id),
    verified: true,
  });
}

const indexPath = path.join(repoRoot, 'grafana/runtime-dashboard-index.json');
fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
console.log(`Wrote ${indexPath}`);

// Sync root canonical index
fs.writeFileSync(
  path.join(repoRoot, 'runtime-dashboard-index.json'),
  `${JSON.stringify(
    {
      description: index.description,
      runtimeRoot: index.runtimeRouter.path,
      rule: index.policy.forbidden.join(', '),
      dashboards: Object.fromEntries(
        index.operationalSurfaces.map((s) => [
          `${s.key}Surface`,
          { title: s.labelJa, path: s.path, role: s.role, verified: true },
        ])
      ),
    },
    null,
    2
  )}\n`
);
console.log('Wrote runtime-dashboard-index.json');
