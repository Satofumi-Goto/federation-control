/**
 * Build all 5 Federation Runtime Operational Surface dashboards.
 *
 * Reads real runtime_data/ and generates deployable Grafana JSON:
 *   - collapse-control  (uid: samvklp)  崩壊制御
 *   - collapse-analysis  (uid: saz2p8x)  崩壊解析
 *   - repair-impact      (uid: sambt57)  改修影響
 *   - repair-proposal    (uid: sajbd8b)  改修提案
 *   - implement-progress (uid: sassvwp)  実装進捗
 */

import fs from 'node:fs';
import path from 'node:path';

import { buildCollapseControl } from './surfaces/collapse-control-surface.mjs';
import { buildCollapseAnalysis } from './surfaces/collapse-analysis-surface.mjs';
import { buildRepairImpact } from './surfaces/repair-impact-surface.mjs';
import { buildRepairProposal } from './surfaces/repair-proposal-surface.mjs';
import { buildImplementProgress } from './surfaces/implement-progress-surface.mjs';

const OUT_DIR = path.resolve('grafana/dashboards');
const DEPLOY_DIR = path.resolve('dashboards');

const builders = [
  { fn: buildCollapseControl, file: 'collapse-control.json' },
  { fn: buildCollapseAnalysis, file: 'collapse-analysis.json' },
  { fn: buildRepairImpact, file: 'repair-impact.json' },
  { fn: buildRepairProposal, file: 'repair-proposal.json' },
  { fn: buildImplementProgress, file: 'implement-progress.json' },
];

let totalPanels = 0;

for (const { fn, file } of builders) {
  const dashboard = fn();
  const raw = JSON.stringify(dashboard, null, 2) + '\n';

  for (const dir of [OUT_DIR, DEPLOY_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, file), raw);
  }

  totalPanels += dashboard.panels.length;
  console.log(`  ✓ ${file} (uid: ${dashboard.uid}, ${dashboard.panels.length} panels)`);
}

console.log(`\nBuilt ${builders.length} operational surfaces (${totalPanels} total panels)`);
