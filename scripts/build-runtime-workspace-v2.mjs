import fs from 'node:fs';
import path from 'node:path';
import { federationAddPanelHtml } from './lib/federation-add-panel.mjs';
import {
  federationGraphPanelHtml,
  loadRuntimeFederationMemory,
  obsidianKnowledgeGraphPanelHtml,
} from './lib/runtime-federation-brain-panels.mjs';
import {
  loadCanonicalRegistry,
  runtimeCardsRowHtml,
  runtimeCardsSectionHeaderHtml,
  runtimeCardCreatePanelHtml,
} from './lib/runtime-registry-cards.mjs';
import { resolveRuntimeCenterHref } from './lib/runtime-topology.mjs';
import { artifactCardHtml, defaultArtifactMeta } from './lib/runtime-workspace-artifacts.mjs';
import { cardBase, textPanelOptions } from './lib/runtime-workspace-theme.mjs';
import {
  operationalSystemCardHtml,
} from './lib/runtime-workspace-section-add.mjs';
import {
  sectionHeaderWithOverlayHtml,
  workspaceOverlaysBundleHtml,
} from './lib/runtime-workspace-overlay.mjs';

const routesPath = path.resolve('grafana/runtime-workspace-routes.json');
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));
const federationMemory = loadRuntimeFederationMemory();
const canonicalRegistry = loadCanonicalRegistry();

const TEXT_PLUGIN_VERSION = '11.5.2';

function makeTextPanel({ id, gridPos, title = '', content, transparent = true }) {
  return {
    id,
    type: 'text',
    title,
    transparent,
    pluginVersion: TEXT_PLUGIN_VERSION,
    gridPos,
    options: textPanelOptions(content),
  };
}

function row3Meta(routes, key) {
  return routes.row3ConsoleMeta?.[key] ?? { name: key, border: '#3b82f6' };
}

function row4Meta(routes, key) {
  return { ...defaultArtifactMeta(key), ...(routes.row4ArtifactMeta?.[key] ?? {}) };
}

const r = routes;
const runtimeCenterHref = resolveRuntimeCenterHref(r);
const row3 = r.row3;
const row4 = r.row4;
const discoveryLabel = r.row1.discoveryLabel ?? '入力統合';
const discoveryIcon = r.row1.discoveryIcon ?? '🤝';
const needsTranslationLabel = r.row1.needsTranslationLabel ?? '意図整理';
const alignmentLabel = r.row1.alignmentLabel ?? '責務解析';
const alignmentIcon = r.row1.alignmentIcon ?? '🧩';
const row3Title = row3.title ?? 'Operational Systems';
const row4Title = row4.title ?? 'System Artifacts';

const rtCardsHeaderY = 8;
const rtCardsRowY = 9;
const rtCardsRowH = 3;
const row3HeaderY = rtCardsRowY + rtCardsRowH;
const row3CardsY = row3HeaderY + 1;
const row3CardsH = 4;
const row4HeaderY = row3CardsY + row3CardsH;
const row4CardsStartY = row4HeaderY + 1;

const obsidianHref = r.row2.obsidianGraph;
const federationGraphHref = r.row2.runtimeFederationGraph ?? runtimeCenterHref;

const headerLinkStyle =
  'display:flex;flex-direction:column;align-items:center;padding:6px 10px;border-radius:10px;background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);min-width:64px;text-decoration:none;color:var(--text-primary,#111827);';

const headerHtml = `<div style="width:100%;height:100%;min-height:0;overflow:hidden;display:flex;align-items:center;justify-content:space-between;padding:10px 18px;${cardBase};box-shadow:0 1px 2px rgba(15,23,42,.04);">
  <a href="${runtimeCenterHref}" style="text-decoration:none;color:inherit;">
    <div style="font-size:26px;font-weight:700;line-height:1.1;color:var(--text-primary,#111827);">Runtime</div>
    <div style="margin-top:4px;font-size:11px;color:var(--text-secondary,#64748b);">Federation Brain · Federated Operational Governance Workspace</div>
  </a>
  <div style="display:flex;gap:12px;flex-shrink:0;">
    <a href="${r.row1.discovery}" style="${headerLinkStyle}">
      <div style="font-size:22px;line-height:1;">${discoveryIcon}</div>
      <div style="font-size:11px;margin-top:4px;font-weight:700;color:#0891b2;">${discoveryLabel}</div>
    </a>
    <a href="${r.row1.needsTranslation}" style="${headerLinkStyle}">
      <div style="font-size:22px;line-height:1;">🗣️</div>
      <div style="font-size:11px;margin-top:4px;font-weight:700;color:#d97706;">${needsTranslationLabel}</div>
    </a>
    <a href="${r.row1.alignment ?? r.row1.alliance}" style="${headerLinkStyle}">
      <div style="font-size:22px;line-height:1;">${alignmentIcon}</div>
      <div style="font-size:11px;margin-top:4px;font-weight:700;color:#7c3aed;">${alignmentLabel}</div>
    </a>
  </div>
</div>`;

const row3Cards = [
  ['fleetOperation', row3.fleetOperation],
  ['serviceHub', row3.serviceHub],
  ['lifeTransaction', row3.lifeTransaction],
  ['urbanOperation', row3.urbanOperation],
];

const navItemKeys = [
  'collapseArchitecture',
  'functionalArchitecture',
  'sequenceDiagram',
  'plSimulation',
  'costRecoveryPlan',
  'wbs',
  'serviceOperation',
  'pl',
  'irr',
];

const navPanels = navItemKeys.map((key, index) => {
  const meta = row4Meta(r, key);
  const href = row4[key];
  const col = index % 3;
  const row = Math.floor(index / 3);
  return makeTextPanel({
    id: 401 + index,
    gridPos: { h: 2, w: 8, x: col * 8, y: row4CardsStartY + row * 2 },
    content: artifactCardHtml(href, meta),
  });
});

const dashboard = {
  uid: 'sa8ljn4',
  editable: true,
  schemaVersion: 39,
  title: 'Runtime',
  version: 37,
  refresh: '30s',
  timezone: 'browser',
  description: 'Federated Operational Governance Workspace — Federation Brain',
  tags: ['federation-governance', 'urban-os-runtime', 'workspace-router'],
  links: [
    { title: 'Runtime', url: r.runtimeTopPath ?? '/d/sa8ljn4/runtime' },
    { title: discoveryLabel, url: r.row1.discovery },
    { title: needsTranslationLabel, url: r.row1.needsTranslation },
    { title: alignmentLabel, url: r.row1.alignment ?? r.row1.alliance },
  ],
  panels: [
    makeTextPanel({ id: 100, gridPos: { h: 3, w: 24, x: 0, y: 0 }, content: headerHtml }),
    makeTextPanel({
      id: 201,
      gridPos: { h: 5, w: 11, x: 0, y: 3 },
      content: obsidianKnowledgeGraphPanelHtml(obsidianHref),
    }),
    makeTextPanel({
      id: 202,
      gridPos: { h: 5, w: 11, x: 11, y: 3 },
      content: federationGraphPanelHtml(federationGraphHref, federationMemory),
    }),
    makeTextPanel({
      id: 203,
      title: 'Federation Add',
      gridPos: { h: 5, w: 2, x: 22, y: 3 },
      content: federationAddPanelHtml(r),
    }),

    makeTextPanel({
      id: 250,
      gridPos: { h: 1, w: 24, x: 0, y: rtCardsHeaderY },
      content: runtimeCardsSectionHeaderHtml(),
    }),
    makeTextPanel({
      id: 251,
      gridPos: { h: rtCardsRowH, w: 22, x: 0, y: rtCardsRowY },
      content: runtimeCardsRowHtml(canonicalRegistry),
    }),
    makeTextPanel({
      id: 252,
      gridPos: { h: rtCardsRowH, w: 2, x: 22, y: rtCardsRowY },
      content: runtimeCardCreatePanelHtml(),
    }),

    makeTextPanel({
      id: 300,
      gridPos: { h: 1, w: 24, x: 0, y: row3HeaderY },
      content: sectionHeaderWithOverlayHtml(
        row3Title,
        'fed-overlay-systems',
        'Systems onboarding / add',
      ),
    }),
    makeTextPanel({
      id: r.row4Layout?.headerPanelId ?? 350,
      gridPos: { h: 1, w: 24, x: 0, y: row4HeaderY },
      content: sectionHeaderWithOverlayHtml(
        row4Title,
        'fed-overlay-artifacts',
        'Artifact add / create',
      ),
    }),
    ...row3Cards.map(([key, href], index) => {
      const meta = row3Meta(r, key);
      return makeTextPanel({
        id: 311 + index,
        gridPos: { h: row3CardsH, w: 6, x: index * 6, y: row3CardsY },
        content: operationalSystemCardHtml(href, meta.name, meta.border),
      });
    }),
    ...navPanels,
    makeTextPanel({
      id: 399,
      gridPos: { h: 1, w: 24, x: 0, y: row4CardsStartY + Math.ceil(navItemKeys.length / 3) * 2 },
      content: workspaceOverlaysBundleHtml(),
    }),
  ],
};

const outPath = path.resolve('grafana/runtime-workspace-v2.json');
fs.writeFileSync(outPath, `${JSON.stringify(dashboard, null, 2)}\n`);
console.log(`Wrote ${outPath} (${dashboard.panels.length} panels, version ${dashboard.version})`);
