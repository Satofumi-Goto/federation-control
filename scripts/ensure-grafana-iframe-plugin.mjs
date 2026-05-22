/**
 * Ensure nmcclain-iframe-panel is installed on the Grafana instance before
 * deploying Federation Viewer dashboards that use type: nmcclain-iframe-panel.
 */
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve('.');
const spec = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'grafana/runtime-federation-viewer.json'), 'utf8'),
);
const pluginId = spec.iframePanel?.type || 'nmcclain-iframe-panel';
const pluginVersion = spec.iframePanel?.pluginVersion || '1.0.1';
const pluginZipUrl =
  process.env.GRAFANA_IFRAME_PLUGIN_URL ||
  `https://github.com/nmcclain/nmcclain-iframe-panel/releases/download/v${pluginVersion}/${pluginId}-${pluginVersion}.zip`;

const grafanaUrl = process.env.GRAFANA_URL?.replace(/\/$/, '');
const grafanaToken = process.env.GRAFANA_TOKEN;

if (!grafanaUrl || !grafanaToken) {
  console.error('GRAFANA_URL and GRAFANA_TOKEN are required.');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${grafanaToken}`,
  'Content-Type': 'application/json',
};

async function listPlugins() {
  const res = await fetch(`${grafanaUrl}/api/plugins?embedded=0`, { headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`list plugins failed (${res.status}): ${text}`);
  }
  return JSON.parse(text);
}

async function installPlugin() {
  const body = JSON.stringify({ pluginUrl: pluginZipUrl });
  const res = await fetch(`${grafanaUrl}/api/plugins/${pluginId}/install`, {
    method: 'POST',
    headers,
    body,
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

async function main() {
  const plugins = await listPlugins();
  const installed = plugins.find((p) => p.id === pluginId);
  if (installed) {
    console.log(`Plugin already present: ${pluginId} (version ${installed.info?.version || 'unknown'})`);
    return;
  }

  console.log(`Installing ${pluginId} from ${pluginZipUrl}`);
  const result = await installPlugin();
  if (result.ok) {
    console.log(`Installed ${pluginId}`);
    return;
  }

  console.warn(
    `Could not install ${pluginId} via API (${result.status}). Federation Viewer dashboards require this panel plugin.`,
  );
  console.warn(result.text.slice(0, 500));
  console.warn(
    'Manual: Admin → Plugins → install nmcclain-iframe-panel, or enable unsigned plugin loading for your stack.',
  );
  console.warn('See GRAFANA_IFRAME_PANEL.md');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
