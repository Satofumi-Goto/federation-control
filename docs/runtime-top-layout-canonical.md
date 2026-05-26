# Runtime Top Layout Canonical Spec

## Purpose

This document fixes the current Runtime Top issues before and during the 7-step Governance migration.

The issue is NOT solved by connecting the 4 consoles.

The current defects are layout / panel role / link binding issues inside Grafana Runtime Top.

---

## Current defects

1. Top-left panel is not the Obsidian Knowledge Graph.
2. Top-right panel is not the Grafana / Runtime Federation graph.
3. The standalone plus button is in the wrong place.
4. `自システム` remains as a section title.
5. Operational Systems section should match the attached card layout.
6. `運行制御アーキテクチャ` is visible but not linked to its target page.
7. Lower document/output area must be named `System Artifacts`.
8. Old diagram-style Japanese labels remain where IT artifact terms should be used.

---

## Correct top layout

### Top-left panel

Name:

```text
Obsidian Knowledge Graph
```

Role:

```text
Knowledge / Obsidian graph visualization
```

Must NOT show as a generic Runtime Memory panel unless it is explicitly the Obsidian graph view.

### Top-right panel

Name:

```text
Runtime Federation Graph
```

Role:

```text
Grafana-side Runtime / Federation relationship graph
```

This is the Grafana runtime graph side, not another Obsidian memory panel.

---

## Plus button rule

The plus button must NOT be placed in a standalone right-side vertical column.

Correct placement:

```text
Operational Systems                                      [+]
System Artifacts                                        [+]
```

Rules:

- One plus button per section header.
- Place the plus button at the far right of the section title row.
- Do not use floating action button placement.
- Do not use a separate vertical plus-only panel.
- Do not place plus buttons inside random cards.

---

## Middle section

### Section title

Replace:

```text
自システム
```

with:

```text
Operational Systems
```

Meaning:

```text
Existing and newly built operational systems that are subject to federation / governance.
```

### Cards

Cards should remain Japanese labels:

- フリート運用
- サービス拠点
- 生活取引
- 都市運行

Each card must be a linked card, not a static panel.

Expected links:

- フリート運用 → Fleet Operations Console
- サービス拠点 → Service Hub Console
- 生活取引 → Life Transaction Console
- 都市運行 → Urban Operation Console

Known preview URLs:

```text
https://fleet-operations-console.base44.app
https://service-hub-console.base44.app
https://life-ledger-link.base44.app
https://urban-operation-console.base44.app
```

If public dashboard uses a proxied / public URL, bind through the dashboard link mechanism, but the card must navigate.

---

## Lower section

### Section title

Use:

```text
System Artifacts
```

Meaning:

```text
Documents / design outputs required to make the system viable and governable.
```

### Artifact cards

Use IT artifact terms. Avoid Japanese diagram-storage wording.

Recommended card labels:

- Collapse Control Architecture
- Functional Topology
- Federation Sequence
- Business Simulation
- Cost Recovery Plan
- WBS
- Service Operations
- PL
- IRR

`運行制御アーキテクチャ` must not remain as an unlinked static card. If used, link it to the corresponding artifact page. Prefer the English label:

```text
Operational Control Architecture
```

---

## Link binding requirements

All cards must have working navigation.

Minimum QA targets:

- フリート運用 opens Fleet Operations Console.
- サービス拠点 opens Service Hub Console.
- 生活取引 opens Life Transaction Console.
- 都市運行 opens Urban Operation Console.
- Operational Control Architecture / Collapse Control Architecture opens its artifact page.
- Business Simulation opens business simulation page.
- PL opens PL page.
- IRR opens IRR page.

No card may remain visual-only.

---

## What NOT to do

Do NOT solve this by merely connecting the 4 consoles.

That does not fix:

- top-left graph role mismatch
- top-right graph role mismatch
- section title mismatch
- plus button placement
- unlinked artifact cards
- old diagram wording

---

## QA checklist

Search dashboard/source for old labels:

```text
自システム
崩壊制御アーキテクチャ
機能アーキテクチャ図
シーケンス図
```

Allowed only if intentionally retained as hidden metadata. Not allowed as final UI titles.

Visual QA:

- Top-left = Obsidian Knowledge Graph.
- Top-right = Runtime Federation Graph.
- Section title = Operational Systems.
- Section title = System Artifacts.
- Plus appears at right edge of each section header.
- No standalone right-side plus column.
- Operational Systems cards match the attached four-card layout.
- Artifact cards are linked.
