/**
 * Apply Grafana Runtime Federation iframe embed settings to a Base44 app repo.
 * Usage: node scripts/apply-base44-grafana-embed.mjs <path-to-base44-app-repo>
 */
import fs from 'node:fs';
import path from 'node:path';

const GRAFANA_ORIGIN = 'https://satofumigoto.grafana.net';
const repoRoot = process.argv[2];

if (!repoRoot) {
  console.error('Usage: node scripts/apply-base44-grafana-embed.mjs <repo-path>');
  process.exit(1);
}

const root = path.resolve(repoRoot);

const runtimeFederationEmbedJs = `export const GRAFANA_RUNTIME_ORIGIN = '${GRAFANA_ORIGIN}';

export function isOperationalConsoleEmbed() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isGrafanaRuntimeEmbed() {
  if (!isOperationalConsoleEmbed()) return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('runtime_embed') === 'grafana') return true;
  try {
    return document.referrer.startsWith(GRAFANA_RUNTIME_ORIGIN);
  } catch {
    return true;
  }
}

export function buildRuntimeReturnUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('runtime_embed', 'grafana');
  return url.toString();
}
`;

const publicHeaders = `/*
  Content-Security-Policy: frame-ancestors ${GRAFANA_ORIGIN} 'self'
`;

const viteEmbedPlugin = `/**
 * Grafana Runtime Federation — allow iframe embed from satofumigoto.grafana.net
 */
export function grafanaRuntimeEmbedHeaders() {
  const csp = "frame-ancestors ${GRAFANA_ORIGIN} 'self'";
  const apply = (_req, res, next) => {
    res.setHeader("Content-Security-Policy", csp);
    next();
  };
  return {
    name: "grafana-runtime-embed-headers",
    configureServer(server) {
      server.middlewares.use(apply);
    },
    configurePreviewServer(server) {
      server.middlewares.use(apply);
    },
  };
}
`;

function writeFile(rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.endsWith('\n') ? content : `${content}\n`);
  console.log(`Wrote ${rel}`);
}

writeFile('src/lib/runtimeFederationEmbed.js', runtimeFederationEmbedJs);
writeFile('src/lib/grafanaRuntimeEmbedHeaders.js', viteEmbedPlugin);
writeFile('public/_headers', publicHeaders);

const configPath = path.join(root, 'base44/config.jsonc');
if (fs.existsSync(configPath)) {
  const raw = fs.readFileSync(configPath, 'utf8');
  const embedBlock = `  "runtimeFederation": {
    "grafanaEmbedOrigin": "${GRAFANA_ORIGIN}",
    "allowIframeEmbed": true,
    "preventEmbedding": false,
    "frameAncestors": [
      "${GRAFANA_ORIGIN}",
      "'self'"
    ]
  }`;
  if (!raw.includes('runtimeFederation')) {
    const updated = raw.trimEnd().replace(
      /(\s*"outputDirectory":\s*"\.\/dist"\s*\r?\n\s*\})\s*\}\s*$/s,
      `$1,\n${embedBlock}\n}\n`
    );
    fs.writeFileSync(configPath, updated);
    console.log('Updated base44/config.jsonc');
  } else if (raw.includes('\n,\n  "runtimeFederation"')) {
    const fixed = raw.replace(/\n,\n  "runtimeFederation"/, ',\n  "runtimeFederation"');
    fs.writeFileSync(configPath, fixed);
    console.log('Fixed base44/config.jsonc comma');
  }
}

const vitePath = path.join(root, 'vite.config.js');
if (fs.existsSync(vitePath)) {
  let vite = fs.readFileSync(vitePath, 'utf8');
  if (!vite.includes('grafanaRuntimeEmbedHeaders')) {
    vite = vite.replace(
      /import base44 from "@base44\/vite-plugin"/,
      `import base44 from "@base44/vite-plugin"\nimport { grafanaRuntimeEmbedHeaders } from './src/lib/grafanaRuntimeEmbedHeaders.js'`
    );
    vite = vite.replace(/plugins:\s*\[/, 'plugins: [\n    grafanaRuntimeEmbedHeaders(),');
    fs.writeFileSync(vitePath, vite);
    console.log('Updated vite.config.js');
  }
}

const authPath = path.join(root, 'src/lib/AuthContext.jsx');
if (fs.existsSync(authPath)) {
  let auth = fs.readFileSync(authPath, 'utf8');
  if (!auth.includes('runtimeFederationEmbed')) {
    auth = auth.replace(
      "import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';",
      `import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';\nimport { buildRuntimeReturnUrl, isGrafanaRuntimeEmbed } from '@/lib/runtimeFederationEmbed';`
    );
    auth = auth.replace(
      'base44.auth.logout(window.location.href);',
      'base44.auth.logout(isGrafanaRuntimeEmbed() ? buildRuntimeReturnUrl() : window.location.href);'
    );
    auth = auth.replace(
      'base44.auth.redirectToLogin(window.location.href);',
      'base44.auth.redirectToLogin(isGrafanaRuntimeEmbed() ? buildRuntimeReturnUrl() : window.location.href);'
    );
    fs.writeFileSync(authPath, auth);
    console.log('Updated src/lib/AuthContext.jsx');
  }
}

const docs = `# Grafana Runtime iframe embed

Operational Console is embedded in Grafana Runtime Federation Workspace (\`${GRAFANA_ORIGIN}\`).

## HTTP headers

- \`public/_headers\`: \`Content-Security-Policy: frame-ancestors ${GRAFANA_ORIGIN} 'self'\`
- Do **not** enable Base44 Dashboard → Security → **Prevent Embedding** (X-Frame-Options) for this app.

## App runtime

- \`?runtime_embed=grafana\` keeps login return inside the embed dashboard.
- \`src/lib/runtimeFederationEmbed.js\` detects Grafana iframe context.

## Canonical

See \`Satofumi-Goto/federation-control\`: \`RUNTIME_FEDERATION_WORKSPACE_RULE.md\`, \`BASE44_OPERATIONAL_CONSOLE_IFRAME_EMBED.md\`.
`;
writeFile('docs/grafana-runtime-iframe-embed.md', docs);

console.log('Done:', root);
