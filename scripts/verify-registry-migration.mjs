/**
 * One-shot verification: Runtime Registry migration completeness.
 * Checks the built dashboard for all migration requirements.
 */
import fs from 'node:fs';

const dash = JSON.parse(fs.readFileSync('grafana/runtime-workspace-v2.json', 'utf8'));
let allContent = '';
dash.panels.forEach((p) => { allContent += p.options?.content ?? ''; });

const issues = [];
function check(label, pass) {
  if (!pass) issues.push(label);
  console.log(`${pass ? 'PASS' : 'FAIL'}: ${label}`);
}

check('No viewPanel= references', !allContent.includes('viewPanel='));
check('No window.location', !allContent.includes('window.location'));
check('No window.open', !allContent.includes('window.open'));
check('No window.top.location', !allContent.includes('window.top.location'));
check('No "Federation collapse governance"', !allContent.includes('Federation collapse governance'));

check('Card: 崩壊制御', allContent.includes('崩壊制御'));
check('Card: 崩壊解析', allContent.includes('崩壊解析'));
check('Card: 改修影響', allContent.includes('改修影響'));
check('Card: 改修提案', allContent.includes('改修提案'));
check('Card: 実装進捗', allContent.includes('実装進捗'));

check('Route: 崩壊制御 → samvklp', allContent.includes('/d/samvklp/collapse-control'));
check('Route: 崩壊解析 → saz2p8x', allContent.includes('/d/saz2p8x/collapse-analysis'));
check('Route: 改修影響 → sambt57', allContent.includes('/d/sambt57/repair-impact'));
check('Route: 改修提案 → sajbd8b', allContent.includes('/d/sajbd8b/repair-proposal'));
check('Route: 実装進捗 → sassvwp', allContent.includes('/d/sassvwp/implement-progress'));

check('＋window: runtimeRegistryCards storage', allContent.includes('runtimeRegistryCards'));
check('＋window: Runtime Card Create dialog', allContent.includes('Runtime Card Create'));
check('＋window: seneschal option', allContent.includes('seneschal'));
check('＋window: internal-runtime option', allContent.includes('internal-runtime'));

check('runtime_embed=grafana preserved', allContent.includes('runtime_embed=grafana'));
check('public_view=1 preserved', allContent.includes('public_view=1'));

check('Routing: <a href only', !allContent.includes('onclick="window'));

console.log(`\n${issues.length === 0 ? 'ALL PASS' : `${issues.length} FAILURES`}`);
process.exit(issues.length === 0 ? 0 : 1);
