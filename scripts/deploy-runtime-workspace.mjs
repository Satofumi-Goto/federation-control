import fs from 'node:fs';
import path from 'node:path';

const grafanaUrl = process.env.GRAFANA_URL?.replace(/\/$/, '');
const grafanaToken = process.env.GRAFANA_TOKEN;
const dashboardPath =
  process.env.DASHBOARD_PATH || 'grafana/runtime-workspace-v2.json';

if (!grafanaUrl || !grafanaToken) {
  console.error('GRAFANA_URL and GRAFANA_TOKEN are required.');
  process.exit(1);
}

const resolvedPath = path.resolve(dashboardPath);
const raw = fs.readFileSync(resolvedPath, 'utf8');

let dashboard;
try {
  dashboard = JSON.parse(raw);
} catch (error) {
  console.error(`Invalid JSON in ${dashboardPath}: ${error.message}`);
  process.exit(1);
}

if (!Array.isArray(dashboard.panels) && !dashboard.elements) {
  console.error(
    `Invalid Grafana dashboard schema in ${dashboardPath}: expected panels[] or elements.`,
  );
  process.exit(1);
}

if (!dashboard.uid) {
  console.error(
    `Missing uid in ${dashboardPath}: overwrite deploy requires a stable uid.`,
  );
  process.exit(1);
}

/** Enforce HTML mode on all text panels (Grafana Cloud sanitizer-safe content). */
function normalizeRuntimeTextPanels(dash) {
  if (!Array.isArray(dash.panels)) return;
  for (const panel of dash.panels) {
    if (panel.type !== 'text' || !panel.options) continue;
    const content = panel.options.content ?? '';
    panel.pluginVersion = panel.pluginVersion ?? '11.5.2';
    panel.options = {
      mode: 'html',
      content,
      code: {
        language: 'html',
        showLineNumbers: false,
        showMiniMap: false,
      },
    };
  }
}

normalizeRuntimeTextPanels(dashboard);

const payload = {
  dashboard: {
    ...dashboard,
    id: null,
  },
  overwrite: true,
  message: `Deploy ${dashboardPath} from GitHub Actions`,
};

const response = await fetch(`${grafanaUrl}/api/dashboards/db`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${grafanaToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});

const text = await response.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  body = { raw: text };
}

if (!response.ok || body.status !== 'success') {
  console.error(`Grafana deploy failed (HTTP ${response.status}): ${text}`);
  process.exit(1);
}

console.log(
  `Deployed uid=${body.uid} slug=${body.slug} version=${body.version} url=${body.url}`,
);
