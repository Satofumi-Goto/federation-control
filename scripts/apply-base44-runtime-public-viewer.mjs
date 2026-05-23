/**
 * Runtime Public Viewer Layer — /viewer/* routes, login-free read-only, runtime_embed=grafana.
 * Usage: node scripts/apply-base44-runtime-public-viewer.mjs <repo-path> <consoleKey>
 *   consoleKey: fleet | serviceHub | life | urban
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RUNTIME_PUBLIC_VIEW_EMBED_SNIPPET,
  RUNTIME_PUBLIC_VIEW_INDEX_BOOTSTRAP,
} from './lib/runtime-public-viewer-embed-snippet.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'base44-runtime-viewer-spec.json'), 'utf8'),
);

const root = path.resolve(process.argv[2]);
const consoleKey = process.argv[3];

if (!root || !consoleKey) {
  console.error(
    'Usage: node scripts/apply-base44-runtime-public-viewer.mjs <repo-path> <fleet|serviceHub|life|urban>',
  );
  process.exit(1);
}

const consoleSpec = spec.consoles[consoleKey];
if (!consoleSpec) {
  console.error(`Unknown console key: ${consoleKey}`);
  process.exit(1);
}

const GRAFANA_ORIGIN = 'https://satofumigoto.grafana.net';
const viewerPath = consoleSpec.viewerPath;
const viewerPathStar = `${viewerPath}/*`;

function write(rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.endsWith('\n') ? content : `${content}\n`);
  console.log(`  wrote ${rel}`);
}

const runtimePublicViewerRuntimeJs = `import {
  isRuntimePublicView,
  isRuntimePublicViewOperationDisabled,
  establishRuntimePublicViewSession,
  RUNTIME_PUBLIC_VIEW_USER,
  isRuntimeEmbedGrafanaFromUrl,
} from './runtimeFederationEmbed';

export { RUNTIME_PUBLIC_VIEW_USER, establishRuntimePublicViewSession };

export function getRuntimePublicViewerState() {
  const active = isRuntimePublicView();
  return {
    active,
    readOnly: active,
    operationDisabled: isRuntimePublicViewOperationDisabled(),
    modalSubmitDisabled: active,
    dispatchExecuteDisabled: active,
    saveDisabled: active,
    deleteDisabled: active,
    federationConnectDisabled: active,
    runtimeDraftCreateDisabled: active,
    displayOnly: true,
  };
}

export function applyRuntimePublicViewAuthState(authSetters) {
  establishRuntimePublicViewSession();
  authSetters.setUser(RUNTIME_PUBLIC_VIEW_USER);
  authSetters.setIsAuthenticated(true);
  authSetters.setIsLoadingAuth(false);
  authSetters.setIsLoadingPublicSettings?.(false);
  authSetters.setAuthChecked(true);
  authSetters.setAuthError(null);
}
`;

const runtimePublicViewerCss = `/* Runtime Public Viewer — Grafana same-tab /viewer/* */
html.runtime-public-view,
html.runtime-public-view.runtime-embed-grafana {
  width: 100% !important;
  min-height: 100vh !important;
  margin: 0 !important;
  background: var(--background-primary, #f8fafc) !important;
}
html.runtime-public-view #root {
  width: 100% !important;
  min-height: 100vh !important;
  display: flex !important;
  flex-direction: column !important;
}
.runtime-public-viewer-root {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100vh;
  background: var(--background-primary, #f8fafc);
}
.runtime-public-viewer-banner {
  flex: 0 0 auto;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 700;
  color: #0891b2;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  text-align: center;
}
.runtime-public-viewer-operational {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
}
html.runtime-public-view [data-runtime-draft-create],
html.runtime-public-view [data-federation-connect],
html.runtime-public-view [data-runtime-federation-connect] {
  display: none !important;
  pointer-events: none !important;
}
html.runtime-public-view [data-runtime-blocked='true'] {
  pointer-events: none !important;
  opacity: 0.88;
}
html.runtime-public-view button[type='submit']:not([data-runtime-allow]),
html.runtime-public-view [data-delete]:not([data-runtime-allow]),
html.runtime-public-view [data-save]:not([data-runtime-allow]) {
  pointer-events: none !important;
  opacity: 0.5;
}
`;

const runtimePublicViewerShellJsx = `import { useEffect } from 'react';
import { establishRuntimePublicViewSession, getRuntimePublicViewerState } from '@/lib/runtimePublicViewerRuntime';
import '@/styles/runtime-public-viewer.css';

export default function RuntimePublicViewerShell({ children }) {
  const state = getRuntimePublicViewerState();

  useEffect(() => {
    establishRuntimePublicViewSession();
    const block = (e) => {
      if (!state.operationDisabled) return;
      const t = e.target;
      if (t?.closest?.('[data-runtime-allow]')) return;
      if (e.type === 'submit') e.preventDefault();
      if (t?.closest?.('[data-delete], [data-save], [data-runtime-draft-create], [data-federation-connect]')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('submit', block, true);
    document.addEventListener('click', block, true);
    return () => {
      document.removeEventListener('submit', block, true);
      document.removeEventListener('click', block, true);
    };
  }, [state.operationDisabled]);

  return (
    <div className="runtime-public-viewer-root" data-runtime-public-view="true">
      <div className="runtime-public-viewer-banner">
        都市OS Runtime Viewer · ${consoleSpec.labelJa} · read-only · runtime_embed=grafana
      </div>
      <div className="runtime-public-viewer-operational" data-runtime-viewer-shell>
        {children}
      </div>
    </div>
  );
}
`;

const runtimeViewerBootstrapJs = `import { primeRuntimePublicViewFromPath, primeFederationViewerFromUrl } from '@/lib/runtimeFederationEmbed';

primeRuntimePublicViewFromPath();
primeFederationViewerFromUrl();
`;

function mergeRuntimeFederationEmbed() {
  const embedPath = path.join(root, 'src/lib/runtimeFederationEmbed.js');
  if (!fs.existsSync(embedPath)) {
    console.error('  missing runtimeFederationEmbed.js — run patch-base44-auth-guard-order.mjs first');
    process.exit(1);
  }
  let src = fs.readFileSync(embedPath, 'utf8');
  if (!src.includes('isRuntimePublicView')) {
    src = src.replace(
      /export function shouldBypassAuthRedirect\(\) \{\s*\n\s*return[^}]+\}/,
      `export function shouldBypassAuthRedirect() {
  return isRuntimePublicView() || isFederationViewerMode() || hasFederationViewerSession();
}`,
    );
    src = src.replace(
      /export function isOperationDisabled\(\) \{\s*\n\s*return[^}]+\}/,
      `export function isOperationDisabled() {
  return isRuntimePublicView() || isFederationViewerMode();
}`,
    );
    if (!src.includes('RUNTIME_PUBLIC_VIEW_SESSION_FLAG')) {
      src = src.replace(
        /if \(typeof window !== 'undefined'\) \{\s*\n\s*primeFederationViewerFromUrl\(\);\s*\n\}/,
        `${RUNTIME_PUBLIC_VIEW_EMBED_SNIPPET}

if (typeof window !== 'undefined') {
  primeRuntimePublicViewFromPath();
  primeFederationViewerFromUrl();
}`,
      );
      if (!src.includes('primeRuntimePublicViewFromPath')) {
        src += RUNTIME_PUBLIC_VIEW_EMBED_SNIPPET;
        src += `\nif (typeof window !== 'undefined') {\n  primeRuntimePublicViewFromPath();\n  primeFederationViewerFromUrl();\n}\n`;
      }
    }
  }
  fs.writeFileSync(embedPath, src);
  console.log('  merged runtimeFederationEmbed.js (public viewer)');
}

function patchAuthContext() {
  const authPath = path.join(root, 'src/lib/AuthContext.jsx');
  if (!fs.existsSync(authPath)) return;
  let auth = fs.readFileSync(authPath, 'utf8');
  if (!auth.includes('isRuntimePublicView')) {
    auth = auth.replace(
      /from '@\/lib\/runtimeFederationEmbed';/,
      `from '@/lib/runtimeFederationEmbed';
import { applyRuntimePublicViewAuthState } from '@/lib/runtimePublicViewerRuntime';
import { isRuntimePublicView } from '@/lib/runtimeFederationEmbed';`,
    );
  }
  if (!auth.includes('enterRuntimePublicView')) {
    auth = auth.replace(
      /const enterFederationViewerRuntime = \(\) => \{/,
      `const enterRuntimePublicView = () => {
    applyRuntimePublicViewAuthState({
      setUser,
      setIsAuthenticated,
      setIsLoadingAuth,
      setIsLoadingPublicSettings,
      setAuthChecked,
      setAuthError,
    });
  };

  const enterFederationViewerRuntime = () => {`,
    );
    auth = auth.replace(
      '    if (shouldBypassAuthRedirect()) {\n      enterFederationViewerRuntime();\n      return;\n    }',
      `    if (isRuntimePublicView()) {
      enterRuntimePublicView();
      return;
    }
    if (shouldBypassAuthRedirect()) {
      enterFederationViewerRuntime();
      return;
    }`,
    );
  }
  fs.writeFileSync(authPath, auth);
  console.log('  patched AuthContext.jsx');
}

function patchProtectedRoute() {
  const p = path.join(root, 'src/components/ProtectedRoute.jsx');
  if (!fs.existsSync(p)) return;
  let src = fs.readFileSync(p, 'utf8');
  if (!src.includes('Outlet')) {
    src = src.replace(
      "import { Navigate, useLocation } from 'react-router-dom';",
      "import { Navigate, Outlet, useLocation } from 'react-router-dom';",
    );
  }
  if (!src.includes('shouldBypassAuthRedirect')) {
    src = src.replace(
      "import { useAuth } from '@/lib/AuthContext';",
      `import { useAuth } from '@/lib/AuthContext';
import { shouldBypassAuthRedirect, isRuntimePublicView } from '@/lib/runtimeFederationEmbed';`,
    );
    src = src.replace(
      'export default function ProtectedRoute',
      `export default function ProtectedRoute`,
    );
    src = src.replace(
      /const \{ isAuthenticated[^}]+\} = useAuth\(\);/,
      (m) => `${m}

  if (shouldBypassAuthRedirect() || isRuntimePublicView()) {
    return <Outlet />;
  }`,
    );
  }
  fs.writeFileSync(p, src);
  console.log('  patched ProtectedRoute.jsx');
}

function extractWildcardRouteBlock(appSrc) {
  const patterns = [
    /<Route\s+path=["']\/\*["'][^>]*>([\s\S]*?)<\/Route>/,
    /<Route\s+path=["']\*["'][^>]*>([\s\S]*?)<\/Route>/,
  ];
  for (const re of patterns) {
    const m = appSrc.match(re);
    if (m) return m[0];
  }
  const single = appSrc.match(
    /<Route\s+path=["']\/\*["'][^/]*element=\{([\s\S]*?)\}\s*\/>/,
  );
  if (single) {
    return `<Route path="*" element={${single[1]}} />`;
  }
  return null;
}

function patchAppJsx() {
  const appPath = path.join(root, 'src/App.jsx');
  if (!fs.existsSync(appPath)) return;
  let app = fs.readFileSync(appPath, 'utf8');

  if (!app.includes('RuntimePublicViewerShell')) {
    app = app.replace(
      /import FederationViewerShell from '@\/components\/FederationViewerShell';/,
      `import FederationViewerShell from '@/components/FederationViewerShell';
import RuntimePublicViewerShell from '@/components/RuntimePublicViewerShell';`,
    );
    if (!app.includes('RuntimePublicViewerShell')) {
      app = app.replace(
        /import \{ AuthProvider/,
        `import RuntimePublicViewerShell from '@/components/RuntimePublicViewerShell';
import { AuthProvider`,
      );
    }
  }

  const viewerRouteMarker = `path="${viewerPath}`;
  if (!app.includes(viewerRouteMarker)) {
    const wildcard = extractWildcardRouteBlock(app);
    const inner = wildcard
      ? wildcard.replace(/path=["']\/\*["']/, 'path="*"').replace(/path=["']\*["']/, 'path="*"')
      : '<Route path="*" element={<div className="p-6 text-sm text-slate-600">Runtime Viewer</div>} />';

    const viewerTree = `
    <Route
      path="${viewerPathStar}"
      element={
        <RuntimePublicViewerShell>
          <Routes>
            ${inner}
          </Routes>
        </RuntimePublicViewerShell>
      }
    />`;

    app = app.replace(/<Routes>/, `<Routes>${viewerTree}`);
    console.log(`  inserted viewer route ${viewerPathStar}`);
  }

  fs.writeFileSync(appPath, app);
  console.log('  patched App.jsx');
}

function patchIndexHtml() {
  const indexPath = path.join(root, 'index.html');
  if (!fs.existsSync(indexPath)) return;
  let html = fs.readFileSync(indexPath, 'utf8');
  if (!html.includes('__RUNTIME_PUBLIC_VIEW__')) {
    const tag = `<script>${RUNTIME_PUBLIC_VIEW_INDEX_BOOTSTRAP}</script>`;
    html = html.replace(/<script>\(function\(\)\{try\{var p=new URLSearchParams[\s\S]*?<\/script>/, tag);
    if (!html.includes('__RUNTIME_PUBLIC_VIEW__')) {
      html = html.replace('<head>', `<head>\n    ${tag}`);
    }
    fs.writeFileSync(indexPath, html);
    console.log('  patched index.html');
  }
}

function patchMain() {
  const mainPath = path.join(root, 'src/main.jsx');
  if (!fs.existsSync(mainPath)) return;
  let main = fs.readFileSync(mainPath, 'utf8');
  if (!main.includes('runtimeViewerBootstrap')) {
    main = main.replace(
      /import '@\/lib\/federationViewerBootstrap'/,
      `import '@/lib/runtimeViewerBootstrap'`,
    );
    if (!main.includes('runtimeViewerBootstrap')) {
      main = main.replace(
        /import App from '@\/App\.jsx'/,
        `import '@/lib/runtimeViewerBootstrap'\nimport App from '@/App.jsx'`,
      );
    }
    fs.writeFileSync(mainPath, main);
    console.log('  patched main.jsx');
  }
}

function patchConfig() {
  const cfgPath = path.join(root, 'base44/config.jsonc');
  if (!fs.existsSync(cfgPath)) return;
  let cfg = fs.readFileSync(cfgPath, 'utf8');
  if (!cfg.includes('runtimePublicViewer')) {
    const block = `
  "runtimePublicViewer": {
    "viewerPath": "${viewerPath}",
    "embedQuery": "${spec.embedQuery}",
    "readOnly": true,
    "publicAccess": true
  },`;
    cfg = cfg.replace(/"runtimeFederation"\s*:\s*\{/, `${block}\n  "runtimeFederation": {`);
    fs.writeFileSync(cfgPath, cfg);
    console.log('  patched base44/config.jsonc');
  }
}

console.log(`Applying Runtime Public Viewer to ${root} (${consoleKey} → ${viewerPath})`);

write('src/lib/runtimePublicViewerRuntime.js', runtimePublicViewerRuntimeJs);
write('src/styles/runtime-public-viewer.css', runtimePublicViewerCss);
write('src/components/RuntimePublicViewerShell.jsx', runtimePublicViewerShellJsx);
write('src/lib/runtimeViewerBootstrap.js', runtimeViewerBootstrapJs);

mergeRuntimeFederationEmbed();
patchAuthContext();
patchProtectedRoute();
patchAppJsx();
patchIndexHtml();
patchMain();
patchConfig();

write(
  'docs/runtime-public-viewer.md',
  `# Runtime Public Viewer

- Path: \`${viewerPath}?${spec.embedQuery}\`
- \`window.__RUNTIME_PUBLIC_VIEW__ = true\`
- Login-free read-only; no auth redirect / onboarding / app launcher
- Grafana row3 links to viewer URL (not root app URL)
`,
);

console.log('Done.');
