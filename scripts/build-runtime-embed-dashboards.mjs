import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('grafana/dashboards');

const GRAFANA_EMBED_QUERY = '?runtime_embed=grafana';

const embeds = [
  {
    uid: 'runtime-fleet-embed',
    slugTitle: 'Runtime Fleet Embed',
    label: 'フリート運用',
    sub: 'Operational Console · 埋め込み',
    url: 'https://fleet-operations-console.base44.app',
    accent: '#3b82f6',
  },
  {
    uid: 'runtime-service-hub-embed',
    slugTitle: 'Runtime Service Hub Embed',
    label: 'サービス拠点',
    sub: 'Operational Console · 埋め込み',
    url: 'https://service-hub-console.base44.app',
    accent: '#8b5cf6',
  },
  {
    uid: 'runtime-life-embed',
    slugTitle: 'Runtime Life Embed',
    label: '生活取引',
    sub: 'Operational Console · 埋め込み',
    url: 'https://life-ledger-link.base44.app',
    accent: '#f97316',
  },
  {
    uid: 'runtime-urban-embed',
    slugTitle: 'Runtime Urban Embed',
    label: '都市運行',
    sub: 'Operational Console · 埋め込み',
    url: 'https://urban-operation-console.base44.app',
    accent: '#22c55e',
  },
];

function iframePanel(url, label) {
  const src = url.includes('?') ? `${url}&runtime_embed=grafana` : `${url}${GRAFANA_EMBED_QUERY}`;
  return `<div style="width:100%;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;background:#02060c;border:1px solid rgba(148,163,184,.2);border-radius:10px;"><iframe src="${src}" title="${label}" style="display:block;width:100%;height:100%;min-height:520px;border:0;border-radius:10px;background:#02060c;" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
}

function headerPanel(label, sub, accent) {
  return `<div style="width:100%;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:linear-gradient(180deg,#0b1220,#02060c);border:1px solid ${accent};border-radius:10px;color:#fff;"><div><div style="font-size:11px;color:#94a3b8;">Runtime Federation Workspace</div><div style="font-size:20px;font-weight:900;">${label}</div><div style="font-size:11px;color:#cbd5e1;margin-top:2px;">${sub}</div></div><a href="/d/sa8ljn4/runtime" style="text-decoration:none;font-size:11px;font-weight:700;color:#67e8f9;padding:6px 10px;border:1px solid rgba(56,189,248,.35);border-radius:8px;">← Runtime</a></div>`;
}

for (const e of embeds) {
  const dashboard = {
    uid: e.uid,
    editable: true,
    schemaVersion: 39,
    style: 'dark',
    title: e.slugTitle,
    version: 1,
    refresh: '30s',
    timezone: 'browser',
    description: `${e.label} — Base44 Operational Console embedded in Grafana Runtime Workspace.`,
    tags: ['runtime', 'operational-console-embed', 'base44', 'workspace-embed'],
    links: [{ title: 'Runtime', url: '/d/sa8ljn4/runtime' }],
    panels: [
      {
        id: 1,
        type: 'text',
        title: '',
        transparent: true,
        gridPos: { h: 3, w: 24, x: 0, y: 0 },
        options: { mode: 'html', content: headerPanel(e.label, e.sub, e.accent) },
      },
      {
        id: 2,
        type: 'text',
        title: '',
        transparent: true,
        gridPos: { h: 17, w: 24, x: 0, y: 3 },
        options: { mode: 'html', content: iframePanel(e.url, e.label) },
      },
    ],
  };

  const file = path.join(outDir, `${e.uid}.json`);
  fs.writeFileSync(file, `${JSON.stringify(dashboard, null, 2)}\n`);
  console.log(`Wrote ${file}`);
}
