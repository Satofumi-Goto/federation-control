import fs from 'node:fs';
import path from 'node:path';

const grafanaUrl = process.env.GRAFANA_URL;
const grafanaToken = process.env.GRAFANA_TOKEN;

if (!grafanaUrl || !grafanaToken) {
  console.error('GRAFANA_URL and GRAFANA_TOKEN are required.');
  process.exit(1);
}

const dashboardDir = path.resolve('dashboards');
const files = fs.readdirSync(dashboardDir).filter((file) => file.endsWith('.json'));

if (files.length === 0) {
  console.log('No dashboard JSON files found.');
  process.exit(0);
}

for (const file of files) {
  const fullPath = path.join(dashboardDir, file);
  const raw = fs.readFileSync(fullPath, 'utf8');
  const dashboard = JSON.parse(raw);

  const payload = {
    dashboard: {
      ...dashboard,
      id: null,
      uid: dashboard.uid || file.replace(/\.json$/, '').replace(/[^a-zA-Z0-9_-]/g, '-'),
    },
    overwrite: true,
    message: `Deploy ${file} from GitHub Actions`,
  };

  const response = await fetch(`${grafanaUrl.replace(/\/$/, '')}/api/dashboards/db`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${grafanaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  if (!response.ok) {
    console.error(`Failed to deploy ${file}: ${response.status} ${text}`);
    process.exit(1);
  }

  console.log(`Deployed ${file}: ${text}`);
}
