/** System Artifacts cards with federation cross-links. */

import { navLink } from './runtime-workspace-theme.mjs';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function artifactCardHtml(href, meta) {
  const { label, accent, linkRuntime, linkKpi, linkGraph } = meta;
  const federationLine = [linkRuntime, linkKpi, linkGraph].filter(Boolean).join(' · ');
  return `<a href="${href}" style="${navLink};border-left:3px solid ${accent};">
    <div style="font-size:12px;font-weight:700;color:var(--text-primary,#111827);">${esc(label)}</div>
    ${
      federationLine
        ? `<div style="margin-top:4px;font-size:9px;color:#0891b2;font-weight:600;">↔ ${esc(federationLine)}</div>`
        : ''
    }
  </a>`;
}

export function defaultArtifactMeta(key) {
  const map = {
    collapseArchitecture: {
      label: 'Collapse Control',
      accent: '#ef4444',
      linkRuntime: 'Federation Graph',
      linkKpi: 'Collapse Risk',
    },
    functionalArchitecture: {
      label: 'Functional Topology',
      accent: '#0ea5e9',
      linkRuntime: 'Operational Systems',
      linkKpi: 'Alignment',
    },
    sequenceDiagram: {
      label: 'Federation Sequence',
      accent: '#f59e0b',
      linkRuntime: 'Federation Graph',
      linkKpi: 'Queue Drift',
    },
    plSimulation: {
      label: 'Business Simulation',
      accent: '#22c55e',
      linkRuntime: 'Throughput',
      linkKpi: 'Throughput Drift',
    },
    costRecoveryPlan: {
      label: 'Cost Recovery',
      accent: '#14b8a6',
      linkRuntime: 'Investment',
      linkKpi: 'Federation Health',
    },
    wbs: { label: 'Execution Planning', accent: '#94a3b8', linkRuntime: 'Operational Systems' },
    serviceOperation: {
      label: 'Service Operations',
      accent: '#3b82f6',
      linkRuntime: 'Hub console',
      linkKpi: 'Alignment',
    },
    pl: {
      label: 'Profit & Loss',
      accent: '#a855f7',
      linkRuntime: 'Throughput',
      linkKpi: 'Throughput Drift',
      linkGraph: 'Federation Graph',
    },
    irr: {
      label: 'Investment Return',
      accent: '#eab308',
      linkRuntime: 'Queue',
      linkKpi: 'Queue Drift',
      linkGraph: 'Federation Graph',
    },
  };
  return map[key] ?? { label: key, accent: '#64748b' };
}
