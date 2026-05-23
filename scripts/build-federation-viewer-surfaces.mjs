import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve('.');
const specPath = path.join(repoRoot, 'grafana/runtime-federation-viewer.json');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const outDir = path.join(repoRoot, 'grafana/dashboards');
const iframeSpec = spec.iframePanel;

function gateColor(gate) {
  if (gate === 'AUTHORIZED') return '#22c55e';
  if (gate === 'HOLD') return '#f59e0b';
  if (gate === 'STOP') return '#ef4444';
  return '#94a3b8';
}

function overlayPanel(item, accent, id, x) {
  const gc = gateColor(item.gate);
  return {
    id,
    type: 'text',
    title: item.labelJa,
    transparent: true,
    gridPos: { h: 3, w: 4, x: x * 4, y: 3 },
    options: {
      mode: 'html',
      content: `<div style="width:100%;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;padding:8px 10px;background:#0f172a;border:1px solid ${accent};border-left:3px solid ${accent};border-radius:8px;color:#fff;"><div style="font-size:10px;color:#94a3b8;">${item.labelEn}</div><div style="font-size:13px;font-weight:900;margin-top:2px;">${item.labelJa}</div><div style="font-size:18px;font-weight:900;margin-top:2px;">${item.value}</div><div style="font-size:10px;color:${gc};font-weight:700;margin-top:4px;">${item.gate}</div></div>`,
    },
  };
}

function iframeSrc(url) {
  const q = spec.embedQuery;
  return url.includes('?') ? `${url}&${q}` : `${url}?${q}`;
}

function base44RuntimePanel(src, labelJa) {
  const { type, pluginVersion, title, gridPos } = iframeSpec;
  return {
    id: 20,
    type,
    pluginVersion,
    title: title || 'Base44 Operational Runtime',
    transparent: false,
    gridPos: { ...gridPos },
    options: {
      src,
      scaleFactor: 1,
      disableInteractivity: false,
    },
    fieldConfig: { defaults: {}, overrides: [] },
    description: `${labelJa} — iframe plugin panel (not text/HTML embed)`,
  };
}

for (const v of spec.viewers) {
  const src = iframeSrc(v.base44Url);
  const dashboard = {
    uid: v.uid,
    editable: true,
    schemaVersion: 39,
    style: 'dark',
    title: `Runtime ${v.labelJa} Federation Viewer`,
    version: 1,
    refresh: '30s',
    timezone: 'browser',
    description: `${v.labelJa} — Grafana Federation overlay + Base44 Operational Runtime (iframe plugin · viewer read-only)`,
    tags: ['runtime', 'federation-viewer', 'grafana-overlay', 'base44-runtime', 'iframe-plugin', v.key],
    links: [{ title: 'Runtime', url: `/d/${spec.runtimeRouterUid}/runtime` }],
    panels: [
      {
        id: 1,
        type: 'text',
        title: '',
        transparent: true,
        gridPos: { h: 3, w: 24, x: 0, y: 0 },
        options: {
          mode: 'html',
          content: `<div style="width:100%;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:linear-gradient(180deg,#0b1220,#02060c);border:1px solid ${v.accent};border-radius:10px;color:#fff;"><div><div style="font-size:10px;color:#67e8f9;">Runtime Federation OS · Overlay</div><div style="font-size:20px;font-weight:900;">${v.labelJa}</div><div style="font-size:10px;color:#cbd5e1;margin-top:2px;">Base44 Operational Runtime · Federation Viewer（read-only）</div></div><a href="/d/${spec.runtimeRouterUid}/runtime" style="text-decoration:none;font-size:10px;font-weight:700;color:#67e8f9;padding:5px 10px;border:1px solid rgba(56,189,248,.35);border-radius:6px;">← Runtime</a></div>`,
        },
      },
      ...v.grafanaOverlay.map((item, i) => overlayPanel(item, v.accent, 10 + i, i)),
      {
        id: 2,
        type: 'text',
        title: '',
        transparent: true,
        gridPos: { h: 2, w: 24, x: 0, y: 6 },
        options: {
          mode: 'html',
          content: `<div style="width:100%;height:100%;padding:6px 10px;background:#111827;border:1px solid rgba(148,163,184,.25);border-radius:8px;color:#94a3b8;font-size:10px;">Grafana: Queue · KPI · Constraint · Collapse · Runtime state &nbsp;|&nbsp; Base44: Operational Runtime（${iframeSpec.type} · ${spec.embedQuery}）</div>`,
        },
      },
      base44RuntimePanel(src, v.labelJa),
    ],
  };

  const outFile = path.join(outDir, v.outputFile);
  fs.writeFileSync(outFile, `${JSON.stringify(dashboard, null, 2)}\n`);
  console.log(`Wrote ${outFile}`);
}

// Row3 routes are canonical in grafana/runtime-workspace-routes.json (same-tab Base44 navigation).
