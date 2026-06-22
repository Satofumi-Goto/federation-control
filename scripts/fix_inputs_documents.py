#!/usr/bin/env python3
"""
fix_inputs_documents.py

Repairs Federation Portal Inputs section:
  - Creates docs/input-documents/ markdown reference documents
  - Removes stub/test files
  - Rewrites InputsSection.jsx with INPUT_DOCUMENTS, DOCUMENT PREVIEW, CONNECTED_SOURCES
  - Optionally runs npm run build, commits, and pushes

Usage:
  python scripts/fix_inputs_documents.py --repo C:/GitHub/federation-portal
  python scripts/fix_inputs_documents.py --repo C:/GitHub/federation-portal --build --commit --push
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path


AUTONOMOUS_MOBILITY_MD = """\
# Autonomous Mobility Reference Data

**Status:** REGISTERED / SEEDED
**Owner:** Business Planning
**Imported:** 2025-01-15
**Used by:** Parameter Registry · Financial Assumptions · Blueprint Validation

---

## Fleet Deployment Parameters

| Parameter | Value | Unit | Scenario |
|-----------|-------|------|----------|
| Initial Fleet Size | 50 | vehicles | Base |
| Expansion Fleet Size | 200 | vehicles | Growth |
| Vehicle Unit Cost | 8,500,000 | JPY | Base |
| Operational Hours/Day | 18 | hours | Base |
| Utilization Rate | 0.72 | ratio | Base |
| Average Trip Distance | 8.5 | km | Urban |

## Route Coverage

| Area | Coverage | Status |
|------|----------|--------|
| Urban Core | 45 km² | Active |
| Suburban Ring | 120 km² | Planned |
| Airport Corridor | 22 km | Active |

## Reliability Targets

- MTBF: 2,000 hours
- System Availability: 99.2%
- Intervention Rate: < 0.5 per 100 km

## Safety & Regulatory

- Level: SAE Level 4
- Regulatory Framework: MLIT Guidelines 2024
- Certification Target: Q3 2026
- Safety Case: Functional Safety / ISO 26262

## Scenario Assumptions

| Scenario | Fleet | Coverage | Launch |
|----------|-------|----------|--------|
| Base | 50 | Urban Core | Q1 2025 |
| Growth | 200 | Urban + Suburban | Q3 2026 |
| Optimistic | 500 | City-wide | Q1 2028 |

---

*Source: Business Planning / Autonomous Mobility Division*
*Last updated: 2025-01-15*
"""

FINANCIAL_ASSUMPTIONS_MD = """\
# Financial Assumptions Source

**Status:** REGISTERED / SEEDED
**Owner:** Finance
**Imported:** 2025-01-15
**Used by:** PL Model · IRR Analysis · CAPEX / OPEX Planning

---

## Revenue Assumptions

| Item | Value | Unit | Notes |
|------|-------|------|-------|
| Fare per km | 150 | JPY | Base scenario |
| Monthly Active Users | 12,000 | users | Year 1 |
| Average Trip Distance | 8.5 | km | Urban trips |
| Annual Revenue (Y1) | 550,000,000 | JPY | Conservative |

## CAPEX Breakdown

| Category | Amount (JPY M) | Timing |
|----------|---------------|--------|
| Vehicle Acquisition | 425 | Q1 2025 |
| Infrastructure | 85 | Q1–Q2 2025 |
| Software Platform | 45 | Q1 2025 |
| Total CAPEX | 555 | — |

## OPEX Assumptions

| Category | Annual (JPY M) | Notes |
|----------|---------------|-------|
| Operations | 180 | Staff + dispatch |
| Maintenance | 95 | Per-vehicle avg |
| Platform / SaaS | 24 | Licensing |
| Insurance | 42 | Fleet coverage |
| Total OPEX | 341 | Year 1 |

## Return Metrics

- Payback Period: 6.5 years
- IRR: 12.3% (base) / 18.7% (growth)
- NPV (10yr): ¥1.2B
- Break-even: Month 38

## Assumption Categories

- CAPEX
- OPEX
- Development Cost
- Equipment Cost
- Training Cost
- Annual Benefit
- ROI / IRR / Payback

---

*Source: Finance Division / Business Architecture*
*Last updated: 2025-01-15*
"""

BLUEPRINT_INPUT_MD = """\
# Blueprint Input Source

**Status:** REGISTERED / SEEDED
**Owner:** Engineering
**Imported:** 2025-01-15
**Used by:** Blueprint Card Generation · Capability Mapping · Technical Requirements

---

## System Capabilities

| Capability | Description | Status |
|------------|-------------|--------|
| Autonomous Navigation | SAE L4 urban driving | Confirmed |
| Remote Monitoring | Real-time fleet telemetry | Confirmed |
| Dynamic Routing | AI-based route optimization | In Development |
| Passenger Interface | Multi-modal booking app | Confirmed |
| Safety Override | Human intervention protocol | Confirmed |
| V2X Communication | Vehicle-to-everything data exchange | Planned |

## Technical Requirements

### Compute & Connectivity

- Onboard GPU: NVIDIA Orin SoC (254 TOPS)
- Connectivity: 5G + LTE fallback
- Edge Processing: < 50 ms latency target
- V2X Communication: DSRC + C-V2X

### Sensor Suite

- LiDAR: 360° coverage, 128-beam
- Camera: 8× surround, 4K
- Radar: Long-range + short-range
- HD Map: Centimeter-level accuracy

## Integration Points

| System | Interface | Protocol |
|--------|-----------|----------|
| Fleet Management | REST API | JSON / HTTPS |
| Passenger App | GraphQL | WebSocket |
| Traffic Management | UTMS | VICS / ITS |
| Regulatory Reporting | File Export | CSV / PDF |

## Blueprint Card Mapping

- **Business Case Card** → Business case definition + market size
- **Capability Card** → System capabilities table
- **Financial Card** → Revenue and CAPEX figures
- **Release Card** → Phased deployment schedule

---

*Source: Engineering / Systems Architecture*
*Last updated: 2025-01-15*
"""

INPUTS_SECTION_JSX = r"""import React, { useMemo, useState } from 'react';
import SectionHeader from '../SectionHeader';
import { BUSINESS_CASES, INPUT_SOURCE_TYPES, INPUT_SOURCES_SEED } from '../../../data/inputSourceRegistry';
import { PARAMETER_CATEGORIES, PARAMETER_LAYERS, PARAMETERS_SEED } from '../../../data/parameterRegistry';
import { FINANCIAL_ASSUMPTION_TYPES, FINANCIAL_ASSUMPTIONS_SEED } from '../../../data/financialAssumptionRegistry';
import { BLUEPRINT_INPUT_CARD_TYPES, BLUEPRINT_INPUT_CARDS_SEED } from '../../../data/blueprintInputCardRegistry';
import { REFERENCE_DOCUMENTS, REFERENCE_INPUTS, DERIVED_INPUTS } from '../../../data/referenceInputRegistry';

const C = {
  cyan: '#1D4ED8',
  green: '#047857',
  amber: '#B45309',
  red: '#B91C1C',
  blue: '#2563EB',
  muted: '#334155',
};

function TextTab({ active, children, onClick }) {
  return (
    <button type="button" onClick={onClick} className="px-0 pb-1 font-mono text-[12px] font-semibold transition-colors" style={{ color: active ? C.cyan : C.muted, borderBottom: active ? `2px solid ${C.cyan}` : '2px solid transparent' }}>
      {children}
    </button>
  );
}

function MiniBadge({ children, color = C.muted }) {
  return <span className="font-mono text-[7px] px-1.5 py-0.5 rounded" style={{ color, background: `${color}15`, border: `1px solid ${color}33` }}>{children}</span>;
}

const INPUT_DOCUMENTS = [
  {
    id: 'app-doc',
    label: 'Application Document',
    file: 'Application.docx',
    status: 'INPUTTED / SEEDED',
    statusColor: C.green,
    type: 'Uploaded Word document',
    owner: 'Business Architecture',
    usedFor: 'Business case definition / Autonomous Mobility scenario / Capability extraction / Blueprint inputs / Reference narrative',
    preview: `# Application Document

File: Application.docx
Status: INPUTTED / SEEDED
Owner: Business Architecture

## Contents

Uploaded Word document containing the full business case for
Toyota Autonomous Mobility. Parsed into source registries and
blueprint input cards.

## Extracted Sections

- Business Context & Market Opportunity
- Capability Requirements
- Financial Overview
- Implementation Roadmap
- Risk & Mitigation`,
  },
  {
    id: 'ref-data',
    label: 'Autonomous Mobility Reference Data',
    file: 'docs/input-documents/autonomous-mobility-reference-data.md',
    status: 'REGISTERED / SEEDED',
    statusColor: C.green,
    type: 'Markdown reference document',
    owner: 'Business Planning',
    usedFor: 'Source assumptions / Parameter registry / Financial assumptions / Blueprint validation',
    preview: `# Autonomous Mobility Reference Data

Status: REGISTERED / SEEDED
Owner: Business Planning

## Fleet Deployment Parameters

| Parameter           | Value     | Unit     |
|---------------------|-----------|----------|
| Initial Fleet Size  | 50        | vehicles |
| Vehicle Unit Cost   | 8,500,000 | JPY      |
| Utilization Rate    | 0.72      | ratio    |
| Operational Hours   | 18        | hrs/day  |

## Reliability Targets

- MTBF: 2,000 hours
- System Availability: 99.2%
- Intervention Rate: < 0.5 per 100 km

## Safety Level

SAE Level 4 — MLIT Guidelines 2024`,
  },
  {
    id: 'financial-assumptions',
    label: 'Financial Assumptions Source',
    file: 'docs/input-documents/financial-assumptions-source.md',
    status: 'REGISTERED / SEEDED',
    statusColor: C.green,
    type: 'Markdown reference document',
    owner: 'Finance',
    usedFor: 'PL / IRR / payback / CAPEX / OPEX / revenue and cost assumptions',
    preview: `# Financial Assumptions Source

Status: REGISTERED / SEEDED
Owner: Finance

## Revenue Assumptions

| Item                  | Value       | Unit  |
|-----------------------|-------------|-------|
| Fare per km           | 150         | JPY   |
| Monthly Active Users  | 12,000      | users |
| Annual Revenue (Y1)   | 550,000,000 | JPY   |

## CAPEX Breakdown

| Category            | Amount (JPY M) |
|---------------------|---------------|
| Vehicle Acquisition | 425           |
| Infrastructure      | 85            |
| Software Platform   | 45            |
| Total CAPEX         | 555           |

## Return Metrics

- Payback Period: 6.5 years
- IRR: 12.3% (base) / 18.7% (growth)
- NPV (10yr): ¥1.2B
- Break-even: Month 38`,
  },
  {
    id: 'blueprint-input',
    label: 'Blueprint Input Source',
    file: 'docs/input-documents/blueprint-input-source.md',
    status: 'REGISTERED / SEEDED',
    statusColor: C.green,
    type: 'Markdown reference document',
    owner: 'Engineering',
    usedFor: 'Blueprint card generation / Capability mapping / Technical requirements',
    preview: `# Blueprint Input Source

Status: REGISTERED / SEEDED
Owner: Engineering

## System Capabilities

| Capability               | Status         |
|--------------------------|----------------|
| Autonomous Navigation    | Confirmed      |
| Remote Monitoring        | Confirmed      |
| Dynamic Routing          | In Development |
| Passenger Interface      | Confirmed      |
| Safety Override          | Confirmed      |

## Technical

- Onboard GPU: NVIDIA Orin SoC (254 TOPS)
- Connectivity: 5G + LTE fallback
- LiDAR: 360° / 128-beam

## Blueprint Card Mapping

- Business Case Card → Business case + market size
- Capability Card → System capabilities
- Financial Card → Revenue and CAPEX
- Release Card → Deployment schedule`,
  },
];

const CONNECTED_SOURCES = [
  {
    id: 'repo-index',
    label: 'Repository Index',
    file: 'docs/repository-index.json',
    status: 'LINKED',
    statusColor: C.blue,
    type: 'Repository index file',
    owner: 'Platform',
  },
  {
    id: 'knowledge-vault',
    label: 'Knowledge Vault',
    file: 'Obsidian / external vault',
    status: 'LINKED',
    statusColor: C.blue,
    type: 'External knowledge vault',
    owner: 'Knowledge',
  },
  {
    id: 'federation-control',
    label: 'Federation Control',
    file: 'Grafana / Runtime dashboard',
    status: 'CONNECTED / CONFIGURED',
    statusColor: C.cyan,
    type: 'Runtime dashboard',
    owner: 'Runtime',
  },
];

function SourceIntakePanel({ activeCaseId }) {
  const [draftType, setDraftType] = useState('Document');
  const [selectedDocId, setSelectedDocId] = useState(INPUT_DOCUMENTS[0].id);
  const selectedDoc = INPUT_DOCUMENTS.find((d) => d.id === selectedDocId);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-3">
      <section className="rounded border border-border/60 bg-background/40 p-3 space-y-3">
        <div>
          <div className="font-mono text-[10px] font-bold text-primary uppercase tracking-widest">Source Intake</div>
          <div className="font-mono text-[8px] text-muted-foreground mt-1">Add a new document, URL, repository, dashboard, runtime source, or manual reference data.<br />登録済みの入力は右側の台帳に表示されます。</div>
        </div>
        <div className="space-y-2">
          <select value={draftType} onChange={(e) => setDraftType(e.target.value)} className="w-full rounded border border-border/60 bg-background px-2 py-1.5 font-mono text-[10px] text-foreground">
            {INPUT_SOURCE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <input className="w-full rounded border border-border/60 bg-background px-2 py-1.5 font-mono text-[10px] text-foreground" placeholder="Source name / URL / file path / repository" />
          <textarea className="w-full rounded border border-border/60 bg-background px-2 py-1.5 font-mono text-[10px] text-foreground resize-none" rows={4} placeholder="Paste raw notes, public URL, supplier quote summary, or manual assumption..." />
          <div className="flex gap-1 flex-wrap">
            <button type="button" className="font-mono text-[8px] px-2 py-1 rounded border border-green-700 text-green-700 dark:border-green-400 dark:text-green-400">parse source</button>
            <button type="button" className="font-mono text-[8px] px-2 py-1 rounded border border-blue-700 text-blue-700 dark:border-blue-400 dark:text-blue-400">register as evidence</button>
          </div>
        </div>
      </section>

      <div className="space-y-3">
        <section className="rounded border border-border/60 bg-background/40 p-3 space-y-2">
          <div>
            <div className="font-mono text-[10px] font-bold text-primary uppercase tracking-widest">Inputted Documents</div>
            <div className="font-mono text-[8px] text-muted-foreground mt-0.5">入力済みドキュメント — クリックしてプレビュー</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {INPUT_DOCUMENTS.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSelectedDocId(doc.id)}
                className={`text-left rounded border p-2 space-y-1 transition-colors w-full ${selectedDocId === doc.id ? 'border-blue-500/60 bg-blue-500/10' : 'border-border/50 bg-card/40 hover:border-border/80'}`}
              >
                <div className="font-mono text-[9px] font-semibold text-foreground">{doc.label}</div>
                <div className="font-mono text-[7px] space-y-0.5">
                  <div><span className="text-muted-foreground/60">Status:</span> <span style={{ color: doc.statusColor }}>{doc.status}</span></div>
                  <div><span className="text-muted-foreground/60">Type:</span> <span className="text-muted-foreground">{doc.type}</span></div>
                  <div><span className="text-muted-foreground/60">Owner:</span> <span className="text-primary">{doc.owner}</span></div>
                  <div className="truncate" title={doc.file}><span className="text-muted-foreground/60">File:</span> <span className="text-muted-foreground">{doc.file}</span></div>
                  <div className="leading-relaxed"><span className="text-muted-foreground/60">Used for:</span> <span className="text-muted-foreground">{doc.usedFor}</span></div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded border border-border/60 bg-background/40 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-mono text-[10px] font-bold text-violet-700 dark:text-violet-400 uppercase tracking-widest">Document Preview</div>
              <div className="font-mono text-[8px] text-muted-foreground mt-0.5 truncate max-w-[260px]" title={selectedDoc?.file}>{selectedDoc?.file}</div>
            </div>
            <MiniBadge color={C.green}>{selectedDoc?.status}</MiniBadge>
          </div>
          <pre className="font-mono text-[8px] text-muted-foreground leading-relaxed whitespace-pre-wrap bg-background/60 rounded border border-border/40 p-3 max-h-52 overflow-y-auto">{selectedDoc?.preview}</pre>
        </section>

        <section className="rounded border border-border/60 bg-background/40 p-3 space-y-2">
          <div>
            <div className="font-mono text-[10px] font-bold text-primary uppercase tracking-widest">Connected Sources</div>
            <div className="font-mono text-[8px] text-muted-foreground mt-0.5">接続済み外部ソース</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {CONNECTED_SOURCES.map((src) => (
              <div key={src.id} className="rounded border border-border/50 bg-card/40 p-2 space-y-1">
                <div className="font-mono text-[9px] font-semibold text-foreground">{src.label}</div>
                <div className="font-mono text-[7px] space-y-0.5">
                  <div><span className="text-muted-foreground/60">Status:</span> <span style={{ color: src.statusColor }}>{src.status}</span></div>
                  <div><span className="text-muted-foreground/60">Type:</span> <span className="text-muted-foreground">{src.type}</span></div>
                  <div><span className="text-muted-foreground/60">Owner:</span> <span className="text-primary">{src.owner}</span></div>
                  <div className="truncate" title={src.file}><span className="text-muted-foreground/60">File:</span> <span className="text-muted-foreground">{src.file}</span></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ParameterRegistryPanel({ activeCaseId }) {
  const [layer, setLayer] = useState('All');
  const [category, setCategory] = useState('All');
  const params = PARAMETERS_SEED.filter((p) => p.caseId === activeCaseId)
    .filter((p) => layer === 'All' || p.layer === layer)
    .filter((p) => category === 'All' || p.category === category);
  return (
    <section className="rounded border border-border/60 bg-background/40 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] font-bold text-primary uppercase tracking-widest">Parameter Registry</div>
          <div className="font-mono text-[8px] text-muted-foreground mt-1">Numerical values become reusable parameters before Blueprint, Engineering, Adoption, or Telemetry consumes them.</div>
        </div>
        <div className="flex gap-2">
          <select value={layer} onChange={(e) => setLayer(e.target.value)} className="rounded border border-border/60 bg-background px-2 py-1 font-mono text-[9px] text-foreground">
            {['All', ...PARAMETER_LAYERS].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded border border-border/60 bg-background px-2 py-1 font-mono text-[9px] text-foreground">
            {['All', ...PARAMETER_CATEGORIES].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] font-mono text-[8px]">
          <thead className="text-muted-foreground border-b border-border/50">
            <tr><th className="text-left py-1">Layer</th><th className="text-left">Category</th><th className="text-left">Parameter</th><th className="text-left">Value</th><th className="text-left">Formula</th><th className="text-left">Scenario</th><th className="text-left">Source</th></tr>
          </thead>
          <tbody>
            {params.map((p) => (
              <tr key={p.id} className="border-b border-border/20">
                <td className="py-1 text-primary">{p.layer}</td><td>{p.category}</td><td className="text-foreground">{p.label}</td><td className="text-green-700 dark:text-green-400">{p.value} {p.unit}</td><td className="text-muted-foreground">{p.formula}</td><td>{p.year} / {p.scenario}</td><td className="text-muted-foreground">{p.sourceId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FinancialAssumptionPanel({ activeCaseId }) {
  const [type, setType] = useState('All');
  const rows = FINANCIAL_ASSUMPTIONS_SEED.filter((a) => a.caseId === activeCaseId).filter((a) => type === 'All' || a.type === type);
  return (
    <section className="rounded border border-border/60 bg-background/40 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest">Financial Assumptions</div>
          <div className="font-mono text-[8px] text-muted-foreground mt-1">PL, IRR, payback, CAPEX, OPEX, revenue and cost assumptions are captured here before financial models use them.</div>
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded border border-border/60 bg-background px-2 py-1 font-mono text-[9px] text-foreground">
          {['All', ...FINANCIAL_ASSUMPTION_TYPES].map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {rows.map((a) => (
          <div key={a.id} className="rounded border border-amber-700/40 dark:border-amber-400/40 bg-amber-500/10 p-2 space-y-1">
            <div className="flex items-center justify-between gap-2"><div className="font-mono text-[9px] font-semibold text-foreground truncate">{a.item}</div><MiniBadge color={C.amber}>{a.type}</MiniBadge></div>
            <div className="font-mono text-[12px] font-bold text-green-700 dark:text-green-400">{a.value} {a.unit}</div>
            <div className="font-mono text-[7px] text-muted-foreground truncate" title={a.formula}>{a.formula}</div>
            <div className="font-mono text-[7px] text-muted-foreground/70">{a.year} · {a.scenario} · {a.sourceId}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReferenceDocsPanel({ activeCaseId }) {
  const refs = REFERENCE_INPUTS.filter((r) => r.caseId === activeCaseId);
  const derived = DERIVED_INPUTS.filter((r) => r.caseId === activeCaseId);
  return (
    <div className="space-y-3">
      <section className="rounded border border-border/60 bg-background/40 p-3 space-y-2">
        <div className="font-mono text-[10px] font-bold text-violet-700 dark:text-violet-400 uppercase tracking-widest">Reference Data Documents</div>
        <div className="font-mono text-[8px] text-muted-foreground mt-1">Inputs taken from external documents and used by Blueprint. Not primary inputs — values need independent review.</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {REFERENCE_DOCUMENTS.map((doc) => (
            <div key={doc.id} className="rounded border border-violet-700/40 dark:border-violet-400/40 bg-violet-500/10 p-2 space-y-1">
              <div className="font-mono text-[9px] font-semibold text-foreground leading-snug">{doc.title}</div>
              <div className="font-mono text-[7px] text-muted-foreground">{doc.id}</div>
              <div className="font-mono text-[7px] text-muted-foreground">source: {doc.sourceType} · imported: {doc.importedAt}</div>
              <div className="font-mono text-[7px] text-muted-foreground truncate">used by: {doc.usedBy.join(', ')}</div>
              <div className="flex items-center justify-between gap-1 pt-1">
                <span className="font-mono text-[7px] text-violet-700 dark:text-violet-400">{doc.numericFieldsCount} numeric fields</span>
                <MiniBadge color={doc.confidence === 'source-backed' ? C.green : C.amber}>{doc.status}</MiniBadge>
              </div>
            </div>
          ))}
          <div className="rounded border border-green-700/40 dark:border-green-400/40 bg-green-500/10 p-2 space-y-1">
            <div className="font-mono text-[9px] font-semibold text-foreground leading-snug">MBSE Design Reference Pack</div>
            <div className="font-mono text-[7px] text-muted-foreground">design-mbse-reference-pack</div>
            <div className="font-mono text-[7px] text-muted-foreground">source: manual reference dataset · imported: seeded</div>
            <div className="font-mono text-[7px] text-muted-foreground truncate">used by: Design / Logical Architecture / Physical Allocation / Digital Twin / Traceability</div>
            <div className="flex items-center justify-between gap-1 pt-1">
              <span className="font-mono text-[7px] text-green-700 dark:text-green-400">4 reference tables</span>
              <MiniBadge color={C.green}>REFERENCE IMPORTED</MiniBadge>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded border border-border/60 bg-background/40 p-3 space-y-2">
        <div className="font-mono text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest">Reference Inputs</div>
        <div className="font-mono text-[8px] text-muted-foreground mt-1">Values attributed to source documents but not yet in primary parameter registry. Used by Blueprint Financial and Release cards.</div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {refs.map((r) => (
            <div key={r.id} className="rounded border border-amber-700/40 dark:border-amber-400/40 bg-amber-500/10 p-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-[9px] font-semibold text-foreground truncate">{r.label}</div>
                <MiniBadge color={C.amber}>{r.category}</MiniBadge>
              </div>
              <div className="font-mono text-[12px] font-bold text-green-700 dark:text-green-400">{r.value}{r.unit ? ` ${r.unit}` : ''}</div>
              <div className="font-mono text-[7px] text-muted-foreground truncate" title={r.formula}>{r.formula}</div>
              <div className="font-mono text-[7px] text-muted-foreground/70">{r.sourceDocId} · {r.confidence}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded border border-border/60 bg-background/40 p-3 space-y-2">
        <div className="font-mono text-[10px] font-bold text-green-700 dark:text-green-400 uppercase tracking-widest">Derived Inputs</div>
        <div className="font-mono text-[8px] text-muted-foreground mt-1">Values calculated from primary inputs using explicit formulas. Formula-backed — traceable to source parameters.</div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {derived.map((r) => (
            <div key={r.id} className="rounded border border-green-700/40 dark:border-green-400/40 bg-green-500/10 p-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-[9px] font-semibold text-foreground truncate">{r.label}</div>
                <MiniBadge color={C.green}>derived</MiniBadge>
              </div>
              <div className="font-mono text-[12px] font-bold text-green-700 dark:text-green-400">{r.value}{r.unit ? ` ${r.unit}` : ''}</div>
              <div className="font-mono text-[7px] text-muted-foreground truncate" title={r.formula}>{r.formula}</div>
              <div className="font-mono text-[7px] text-muted-foreground/70">inputs: {r.inputIds?.join(', ')}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function BlueprintInputCardsPanel({ activeCaseId }) {
  const [type, setType] = useState('All');
  const cards = BLUEPRINT_INPUT_CARDS_SEED
    .filter((card) => card.caseId === activeCaseId)
    .filter((card) => type === 'All' || card.type === type);

  return (
    <section className="rounded border border-border/60 bg-background/40 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] font-bold text-primary uppercase tracking-widest">Blueprint Inputs</div>
          <div className="font-mono text-[8px] text-muted-foreground mt-1">Parsed Application results prepared as source cards for Blueprint. Blueprint should render from these cards, not duplicate Application values.</div>
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded border border-border/60 bg-background px-2 py-1 font-mono text-[9px] text-foreground">
          {['All', ...BLUEPRINT_INPUT_CARD_TYPES].map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {cards.map((card) => (
          <article key={card.id} className="rounded border border-blue-700/40 dark:border-blue-400/40 bg-blue-500/10 p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-[11px] font-bold text-foreground truncate">{card.title}</div>
                <div className="font-mono text-[7px] text-muted-foreground mt-0.5 truncate">{card.sourceSection}</div>
              </div>
              <MiniBadge color={card.type === 'Financial' || card.type === 'Cost' ? C.amber : C.blue}>{card.type}</MiniBadge>
            </div>

            <div className="font-mono text-[8px] text-muted-foreground leading-snug">{card.summary}</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {card.keyValues.map((kv) => (
                <div key={`${card.id}-${kv.label}`} className="rounded border border-border/30 bg-background/30 p-1.5 min-w-0">
                  <div className="font-mono text-[6px] uppercase tracking-widest text-muted-foreground/50 truncate">{kv.label}</div>
                  <div className="font-mono text-[10px] font-bold text-green-700 dark:text-green-400 truncate">{kv.value}{kv.unit ? ` ${kv.unit}` : ''}</div>
                  <div className="font-mono text-[6px] text-muted-foreground/65 truncate" title={kv.formula}>{kv.formula}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-border/20">
              <MiniBadge color={C.cyan}>{card.blueprintCardId}</MiniBadge>
              <MiniBadge color={C.green}>{card.sourceId}</MiniBadge>
              <span className="font-mono text-[7px] text-muted-foreground truncate">{card.outputUse}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function InputsSection() {
  const [activeCaseId, setActiveCaseId] = useState(BUSINESS_CASES[0]?.id || '');
  const [activeTab, setActiveTab] = useState('sources');
  const activeCase = useMemo(() => BUSINESS_CASES.find((c) => c.id === activeCaseId), [activeCaseId]);

  const blueprintCount = BLUEPRINT_INPUT_CARDS_SEED.filter((card) => card.caseId === activeCaseId).length;

  return (
    <div className="space-y-6">
      <SectionHeader title="Inputs" subtitle="読み込み・数値・原価・出典の正本" />

      <section className="rounded-lg border border-blue-700/40 dark:border-blue-400/40 bg-secondary/10 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[12px] font-bold text-primary">Generic input layer for any business case</div>
            <div className="font-mono text-[9px] text-muted-foreground mt-1">Federation stays generic. Toyota Autonomous Mobility is only the current case study.</div>
          </div>
          <select value={activeCaseId} onChange={(e) => setActiveCaseId(e.target.value)} className="rounded border border-border/60 bg-background px-2 py-1 font-mono text-[10px] text-foreground">
            {BUSINESS_CASES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 font-mono text-[8px]">
          <div className="rounded border border-border/40 p-2"><div className="text-muted-foreground">CASE</div><div className="text-foreground truncate">{activeCase?.id}</div></div>
          <div className="rounded border border-border/40 p-2"><div className="text-muted-foreground">SOURCES</div><div className="text-green-700 dark:text-green-400">{INPUT_SOURCES_SEED.filter((s) => s.caseId === activeCaseId).length}</div></div>
          <div className="rounded border border-border/40 p-2"><div className="text-muted-foreground">PARAMETERS</div><div className="text-primary">{PARAMETERS_SEED.filter((p) => p.caseId === activeCaseId).length}</div></div>
          <div className="rounded border border-border/40 p-2"><div className="text-muted-foreground">FINANCIAL</div><div className="text-amber-700 dark:text-amber-400">{FINANCIAL_ASSUMPTIONS_SEED.filter((f) => f.caseId === activeCaseId).length}</div></div>
          <div className="rounded border border-border/40 p-2"><div className="text-muted-foreground">BLUEPRINT</div><div className="text-primary">{blueprintCount}</div></div>
          <div className="rounded border border-border/40 p-2"><div className="text-muted-foreground">REFERENCE</div><div className="text-violet-700 dark:text-violet-400">{REFERENCE_INPUTS.filter((r) => r.caseId === activeCaseId).length + DERIVED_INPUTS.filter((r) => r.caseId === activeCaseId).length + 1}</div></div>
        </div>
      </section>

      <div className="flex items-center gap-6 border-b border-border/60">
        <TextTab active={activeTab === 'sources'} onClick={() => setActiveTab('sources')}>Source Intake</TextTab>
        <TextTab active={activeTab === 'parameters'} onClick={() => setActiveTab('parameters')}>Parameter Registry</TextTab>
        <TextTab active={activeTab === 'financial'} onClick={() => setActiveTab('financial')}>Financial Assumptions</TextTab>
        <TextTab active={activeTab === 'blueprint'} onClick={() => setActiveTab('blueprint')}>Blueprint Inputs</TextTab>
        <TextTab active={activeTab === 'refdocs'} onClick={() => setActiveTab('refdocs')}>Reference Docs</TextTab>
      </div>

      {activeTab === 'sources' ? <SourceIntakePanel activeCaseId={activeCaseId} /> : null}
      {activeTab === 'parameters' ? <ParameterRegistryPanel activeCaseId={activeCaseId} /> : null}
      {activeTab === 'financial' ? <FinancialAssumptionPanel activeCaseId={activeCaseId} /> : null}
      {activeTab === 'blueprint' ? <BlueprintInputCardsPanel activeCaseId={activeCaseId} /> : null}
      {activeTab === 'refdocs' ? <ReferenceDocsPanel activeCaseId={activeCaseId} /> : null}
    </div>
  );
}
"""


STUB_FILES_TO_DELETE = [
    "docs/test-create.txt",
    "docs/input-documents/reference-data.md",
    "docs/input-documents/source-blue.md",
]

CREATED_DOCUMENTS = [
    "docs/input-documents/autonomous-mobility-reference-data.md",
    "docs/input-documents/financial-assumptions-source.md",
    "docs/input-documents/blueprint-input-source.md",
]

UPDATED_FILES = [
    "src/components/federation/launcher/InputsSection.jsx",
]


def run(cmd, cwd, check=True):
    result = subprocess.run(
        cmd, cwd=cwd, capture_output=True, text=True, shell=isinstance(cmd, str)
    )
    if check and result.returncode != 0:
        raise RuntimeError(result.stderr or result.stdout)
    return result


def patch(repo: Path):
    # Create input-documents directory
    doc_dir = repo / "docs" / "input-documents"
    doc_dir.mkdir(parents=True, exist_ok=True)

    # Write markdown documents
    (doc_dir / "autonomous-mobility-reference-data.md").write_text(
        AUTONOMOUS_MOBILITY_MD, encoding="utf-8"
    )
    (doc_dir / "financial-assumptions-source.md").write_text(
        FINANCIAL_ASSUMPTIONS_MD, encoding="utf-8"
    )
    (doc_dir / "blueprint-input-source.md").write_text(
        BLUEPRINT_INPUT_MD, encoding="utf-8"
    )

    # Delete stub / test files
    for rel in STUB_FILES_TO_DELETE:
        target = repo / rel
        if target.exists():
            target.unlink()

    # Rewrite InputsSection.jsx
    jsx_path = repo / "src" / "components" / "federation" / "launcher" / "InputsSection.jsx"
    jsx_path.write_text(INPUTS_SECTION_JSX, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Repair federation-portal Inputs section")
    parser.add_argument("--repo", required=True, help="Path to federation-portal repo")
    parser.add_argument("--build", action="store_true", help="Run npm run build")
    parser.add_argument("--commit", action="store_true", help="Git commit changes")
    parser.add_argument("--push", action="store_true", help="Git push after commit")
    args = parser.parse_args()

    repo = Path(args.repo).resolve()
    if not repo.is_dir():
        print(f"ERROR: repo not found: {repo}", file=sys.stderr)
        sys.exit(1)

    print(f"[patch] Applying to {repo}")
    patch(repo)
    print("[patch] Done")

    if args.build:
        print("[build] Running npm run build...")
        run(["npm", "run", "build"], cwd=repo)
        print("[build] Success")

    if args.commit:
        run(["git", "add", "-A"], cwd=repo)
        run(
            ["git", "commit", "-m", "fix: document reference inputs and add input preview"],
            cwd=repo,
        )
        sha = run(["git", "rev-parse", "HEAD"], cwd=repo).stdout.strip()
        print(f"[commit] {sha}")

    if args.push:
        run(["git", "push"], cwd=repo)
        print("[push] Done")

    print("[done] federation-portal Inputs repair complete")


if __name__ == "__main__":
    main()
