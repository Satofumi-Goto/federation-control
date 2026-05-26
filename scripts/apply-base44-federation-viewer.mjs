/**
 * Apply Base44 Federation Viewer Runtime (runtime_embed=grafana) to a console repo.
 * Usage: node scripts/apply-base44-federation-viewer.mjs <repo-path>
 */
import fs from 'node:fs';
import path from 'node:path';

const GRAFANA_ORIGIN = 'https://satofumigoto.grafana.net';
const root = path.resolve(process.argv[2]);

if (!root) {
  console.error('Usage: node scripts/apply-base44-federation-viewer.mjs <repo-path>');
  process.exit(1);
}

const runtimeFederationEmbedJs = `export const GRAFANA_RUNTIME_ORIGIN = '${GRAFANA_ORIGIN}';
export const FEDERATION_VIEWER_SESSION_KEY = 'base44_federation_viewer_session';
export const FEDERATION_VIEWER_USER = {
  id: 'federation-viewer',
  email: 'federation-viewer@runtime.local',
  role: 'federation_viewer',
  readOnly: true,
};

export function isOperationalConsoleEmbed() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isGrafanaRuntimeEmbed() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('runtime_embed') === 'grafana') return true;
  if (!isOperationalConsoleEmbed()) return false;
  try {
    return document.referrer.startsWith(GRAFANA_RUNTIME_ORIGIN);
  } catch {
    return true;
  }
}

/** Federation Viewer: embedded read-only runtime (runtime_embed=grafana). */
export function isFederationViewerMode() {
  return isGrafanaRuntimeEmbed();
}

export function shouldBypassAuthRedirect() {
  return isFederationViewerMode();
}

export function establishFederationViewerSession() {
  try {
    sessionStorage.setItem(FEDERATION_VIEWER_SESSION_KEY, JSON.stringify({
      mode: 'federation-viewer',
      readOnly: true,
      establishedAt: Date.now(),
      origin: GRAFANA_RUNTIME_ORIGIN,
    }));
  } catch {
    /* ignore */
  }
  document.documentElement.classList.add('federation-viewer-runtime', 'runtime-embed-grafana');
  document.documentElement.setAttribute('data-runtime-embed', 'grafana');
}

export function hasFederationViewerSession() {
  try {
    return Boolean(sessionStorage.getItem(FEDERATION_VIEWER_SESSION_KEY));
  } catch {
    return isFederationViewerMode();
  }
}

export function buildRuntimeReturnUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('runtime_embed', 'grafana');
  return url.toString();
}

export function isOperationDisabled() {
  return isFederationViewerMode();
}
`;

const federationViewerRuntimeJs = `import {
  isFederationViewerMode,
  isOperationDisabled,
  FEDERATION_VIEWER_USER,
  establishFederationViewerSession,
} from './runtimeFederationEmbed';

export { FEDERATION_VIEWER_USER, establishFederationViewerSession };

export function getFederationViewerState() {
  const active = isFederationViewerMode();
  return {
    active,
    readOnly: active,
    operationDisabled: isOperationDisabled(),
    modalSubmitDisabled: active,
    dispatchExecuteDisabled: active,
    displayOnly: [
      'queue',
      'eta',
      'runtimeState',
      'constraint',
      'dispatchState',
      'nodeState',
    ],
  };
}
`;

const federationViewerCss = `/* Base44 Federation Viewer Runtime — iframe embedded in Grafana */
html.federation-viewer-runtime,
html.runtime-embed-grafana {
  width: 100% !important;
  height: 100% !important;
  min-height: 100vh !important;
  margin: 0 !important;
  padding: 0 !important;
  background: #0b1020 !important;
  overflow: auto !important;
}
html.federation-viewer-runtime body,
html.runtime-embed-grafana body {
  width: 100% !important;
  height: 100% !important;
  min-height: 100vh !important;
  margin: 0 !important;
  padding: 0 !important;
  background: #0b1020 !important;
  overflow: auto !important;
}
html.federation-viewer-runtime #root,
html.runtime-embed-grafana #root {
  width: 100% !important;
  height: 100% !important;
  min-height: 100vh !important;
  margin: 0 !important;
  padding: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  flex: 1 1 auto !important;
  overflow: visible !important;
}
.federation-viewer-root {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  min-height: 100vh;
  overflow: auto;
  background: #0b1020;
  box-sizing: border-box;
}
.federation-viewer-operational {
  flex: 1 1 auto;
  min-height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: auto;
  box-sizing: border-box;
}
html.federation-viewer-runtime [data-federation-viewer-shell],
html.runtime-embed-grafana [data-federation-viewer-shell] {
  flex: 1 1 auto;
  min-height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: auto;
}
html.federation-viewer-runtime [data-federation-blocked="true"],
html.federation-viewer-runtime .federation-viewer-blocked {
  pointer-events: none !important;
  opacity: 0.92;
}
html.federation-viewer-runtime a[target="_blank"]:not([data-federation-allow]) {
  pointer-events: none !important;
}
`;

const federationViewerShellJsx = `import { useEffect } from 'react';
import { establishFederationViewerSession, getFederationViewerState } from '@/lib/federationViewerRuntime';
import '@/styles/federation-viewer.css';

export default function FederationViewerShell({ children }) {
  const state = getFederationViewerState();

  useEffect(() => {
    establishFederationViewerSession();
    const blockSubmit = (e) => {
      if (!state.operationDisabled) return;
      const t = e.target;
      if (t?.closest?.('form') || t?.type === 'submit' || t?.getAttribute?.('role') === 'dialog') {
        if (t?.closest?.('[data-federation-allow]')) return;
        if (e.type === 'submit') e.preventDefault();
      }
    };
    document.addEventListener('submit', blockSubmit, true);
    document.addEventListener('click', (e) => {
      if (!state.dispatchExecuteDisabled) return;
      const el = e.target?.closest?.('[data-dispatch-execute], [data-operation-execute], button[type="submit"]');
      if (el && !el.closest('[data-federation-allow]')) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
    return () => {
      document.removeEventListener('submit', blockSubmit, true);
    };
  }, [state.operationDisabled, state.dispatchExecuteDisabled]);

  return (
    <div className="federation-viewer-root">
      <div className="federation-viewer-operational" data-federation-viewer-shell>
        {children}
      </div>
    </div>
  );
}
`;

const indexBootstrap = `(function(){try{var p=new URLSearchParams(location.search);if(p.get('runtime_embed')==='grafana'){document.documentElement.classList.add('runtime-embed-grafana');document.documentElement.setAttribute('data-runtime-embed','grafana');}}catch(e){}})();`;

function write(rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.endsWith('\n') ? content : `${content}\n`);
  console.log(`Wrote ${rel}`);
}

write('src/lib/runtimeFederationEmbed.js', runtimeFederationEmbedJs);
write('src/lib/federationViewerRuntime.js', federationViewerRuntimeJs);
write('src/styles/federation-viewer.css', federationViewerCss);
write('src/components/FederationViewerShell.jsx', federationViewerShellJsx);

// CSP headers
write('public/_headers', `/*
  Content-Security-Policy: frame-ancestors ${GRAFANA_ORIGIN} 'self'
`);

// vite headers plugin if missing
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

if (!fs.existsSync(path.join(root, 'src/lib/grafanaRuntimeEmbedHeaders.js'))) {
  write(
    'src/lib/grafanaRuntimeEmbedHeaders.js',
    `export function grafanaRuntimeEmbedHeaders() {
  const csp = "frame-ancestors ${GRAFANA_ORIGIN} 'self'";
  const apply = (_req, res, next) => { res.setHeader("Content-Security-Policy", csp); next(); };
  return { name: "grafana-runtime-embed-headers", configureServer(s) { s.middlewares.use(apply); }, configurePreviewServer(s) { s.middlewares.use(apply); } };
}`
  );
}

// index.html bootstrap
const indexPath = path.join(root, 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');
  if (!html.includes('runtime-embed-grafana')) {
    html = html.replace('<head>', `<head>\n    <script>${indexBootstrap}</script>`);
    fs.writeFileSync(indexPath, html);
    console.log('Updated index.html');
  }
}

// AuthContext
const authPath = path.join(root, 'src/lib/AuthContext.jsx');
if (fs.existsSync(authPath)) {
  let auth = fs.readFileSync(authPath, 'utf8');
  if (!auth.includes('shouldBypassAuthRedirect')) {
    auth = auth.replace(
      "import { buildRuntimeReturnUrl, isGrafanaRuntimeEmbed } from '@/lib/runtimeFederationEmbed';",
      `import {
  buildRuntimeReturnUrl,
  isGrafanaRuntimeEmbed,
  shouldBypassAuthRedirect,
  establishFederationViewerSession,
  FEDERATION_VIEWER_USER,
} from '@/lib/runtimeFederationEmbed';`
    );
    auth = auth.replace(
      'if (appParams.token) {\n          await checkUserAuth();\n        } else {\n          setIsLoadingAuth(false);\n          setIsAuthenticated(false);\n          setAuthChecked(true);\n        }',
      `if (appParams.token) {
          await checkUserAuth();
        } else if (shouldBypassAuthRedirect()) {
          establishFederationViewerSession();
          setUser(FEDERATION_VIEWER_USER);
          setIsAuthenticated(true);
          setIsLoadingAuth(false);
          setAuthChecked(true);
          setAuthError(null);
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          setAuthChecked(true);
        }`
    );
    auth = auth.replace(
      "if (reason === 'auth_required') {\n            setAuthError({\n              type: 'auth_required',\n              message: 'Authentication required'\n            });",
      `if (reason === 'auth_required') {
            if (shouldBypassAuthRedirect()) {
              establishFederationViewerSession();
              setUser(FEDERATION_VIEWER_USER);
              setIsAuthenticated(true);
              setAuthError(null);
            } else {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
            }`
    );
    auth = auth.replace(
      'if (error.status === 401 || error.status === 403) {\n        setAuthError({\n          type: \'auth_required\',\n          message: \'Authentication required\'\n        });\n      }',
      `if (error.status === 401 || error.status === 403) {
        if (shouldBypassAuthRedirect()) {
          establishFederationViewerSession();
          setUser(FEDERATION_VIEWER_USER);
          setIsAuthenticated(true);
          setAuthError(null);
        } else {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
        }
      }`
    );
    auth = auth.replace(
      'const navigateToLogin = () => {\n    // Use the SDK\'s redirectToLogin method\n    base44.auth.redirectToLogin',
      `const navigateToLogin = () => {
    if (shouldBypassAuthRedirect()) {
      establishFederationViewerSession();
      setUser(FEDERATION_VIEWER_USER);
      setIsAuthenticated(true);
      setAuthError(null);
      return;
    }
    base44.auth.redirectToLogin`
    );
    fs.writeFileSync(authPath, auth);
    console.log('Updated AuthContext.jsx');
  }
}

// App.jsx
const appPath = path.join(root, 'src/App.jsx');
if (fs.existsSync(appPath)) {
  let app = fs.readFileSync(appPath, 'utf8');
  if (!app.includes('FederationViewerShell')) {
    app = app.replace(
      "import { AuthProvider, useAuth } from '@/lib/AuthContext';",
      `import { AuthProvider, useAuth } from '@/lib/AuthContext';
import FederationViewerShell from '@/components/FederationViewerShell';
import { shouldBypassAuthRedirect } from '@/lib/runtimeFederationEmbed';`
    );
    if (app.includes('navigateToLogin();')) {
      app = app.replace(
        /} else if \(authError\.type === 'auth_required'\) \{\s*\n\s*\/\/ Redirect to login automatically\s*\n\s*navigateToLogin\(\);\s*\n\s*return null;\s*\n\s*\}/,
        `} else if (authError.type === 'auth_required') {
      if (shouldBypassAuthRedirect()) {
        return (
          <FederationViewerShell>
            <div className="flex items-center justify-center min-h-[40vh] text-slate-300 text-sm">Federation Viewer · establishing session…</div>
          </FederationViewerShell>
        );
      }
      navigateToLogin();
      return null;
    }`
      );
      app = app.replace(
        /} else if \(authError\.type === 'auth_required'\) \{\s*\n\s*navigateToLogin\(\);\s*\n\s*return null;\s*\n\s*\}/,
        `} else if (authError.type === 'auth_required') {
      if (shouldBypassAuthRedirect()) {
        return (
          <FederationViewerShell>
            <div className="flex items-center justify-center min-h-[40vh] text-slate-300 text-sm">Federation Viewer · session</div>
          </FederationViewerShell>
        );
      }
      navigateToLogin();
      return null;
    }`
      );
    }
    const returnRoutes = app.match(/return \(\s*\n\s*<Routes>/);
    if (returnRoutes && !app.includes('<FederationViewerShell>')) {
      app = app.replace(
        /return \(\s*\n\s*<Routes>/,
        `return (
    <FederationViewerShell>
      <Routes>`
      );
      app = app.replace(
        /<\/Routes>\s*\n\s*\);/,
        `</Routes>
    </FederationViewerShell>
  );`
      );
    }
    if (app.includes('<>') && app.includes('<Routes>')) {
      app = app.replace(
        /return \(\s*\n\s*<>\s*\n/,
        `return (
    <FederationViewerShell>
`
      );
      app = app.replace(/<\/>\s*\n\s*\);/g, (m, offset) => {
        const before = app.slice(0, offset);
        if (before.includes('FederationViewerShell') && !before.includes('</FederationViewerShell>')) {
          return `</FederationViewerShell>\n  );`;
        }
        return m;
      });
    }
    fs.writeFileSync(appPath, app);
    console.log('Updated App.jsx');
  }
}

write(
  'docs/base44-federation-viewer-runtime.md',
  `# Base44 Federation Viewer Runtime

When \`runtime_embed=grafana\`:

- Federation Viewer read-only session (no login redirect)
- Operations disabled; Queue/ETA/Runtime/Constraint/Dispatch/Node visible
- iframe minimal chrome — see federation-control BASE44_FEDERATION_VIEWER_RUNTIME.md
`
);

console.log('Done:', root);
console.log('Run: node scripts/patch-base44-auth-guard-order.mjs', root);
