/**
 * Fix auth guard order: runtime_embed=grafana → session → bypass → render.
 * Usage: node scripts/patch-base44-auth-guard-order.mjs <repo-path> [repo-path...]
 */
import fs from 'node:fs';
import path from 'node:path';

const repos = process.argv.slice(2);
if (repos.length === 0) {
  console.error('Usage: node scripts/patch-base44-auth-guard-order.mjs <repo-path> ...');
  process.exit(1);
}

const runtimeFederationEmbedJs = `export const GRAFANA_RUNTIME_ORIGIN = 'https://satofumigoto.grafana.net';
export const FEDERATION_VIEWER_SESSION_KEY = 'base44_federation_viewer_session';
export const FEDERATION_VIEWER_SESSION_FLAG = 'federationViewerSession';
export const FEDERATION_VIEWER_USER = {
  id: 'federation-viewer',
  email: 'federation-viewer@runtime.local',
  role: 'federation_viewer',
  readOnly: true,
};

/** Sync URL check — must run before any auth guard. */
export function isRuntimeEmbedGrafanaFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get('runtime_embed') === 'grafana';
  } catch {
    return false;
  }
}

export function hasFederationViewerSessionFlag() {
  try {
    return sessionStorage.getItem(FEDERATION_VIEWER_SESSION_FLAG) === 'true';
  } catch {
    return false;
  }
}

export function isOperationalConsoleEmbed() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isGrafanaRuntimeEmbed() {
  if (isRuntimeEmbedGrafanaFromUrl()) return true;
  if (hasFederationViewerSessionFlag()) return true;
  if (!isOperationalConsoleEmbed()) return false;
  try {
    return document.referrer.startsWith(GRAFANA_RUNTIME_ORIGIN);
  } catch {
    return true;
  }
}

export function isFederationViewerMode() {
  return isGrafanaRuntimeEmbed();
}

export function shouldBypassAuthRedirect() {
  return isFederationViewerMode() || hasFederationViewerSession();
}

export function establishFederationViewerSession() {
  try {
    sessionStorage.setItem(FEDERATION_VIEWER_SESSION_FLAG, 'true');
    sessionStorage.setItem(
      FEDERATION_VIEWER_SESSION_KEY,
      JSON.stringify({
        mode: 'federation-viewer',
        readOnly: true,
        establishedAt: Date.now(),
        origin: GRAFANA_RUNTIME_ORIGIN,
      }),
    );
  } catch {
    /* ignore */
  }
  document.documentElement.classList.add('federation-viewer-runtime', 'runtime-embed-grafana');
  document.documentElement.setAttribute('data-runtime-embed', 'grafana');
}

/** Establish session from URL before React auth (index.html / bootstrap). */
export function primeFederationViewerFromUrl() {
  if (!isRuntimeEmbedGrafanaFromUrl()) return false;
  establishFederationViewerSession();
  return true;
}

if (typeof window !== 'undefined') {
  primeFederationViewerFromUrl();
}

export function hasFederationViewerSession() {
  try {
    return (
      hasFederationViewerSessionFlag() || Boolean(sessionStorage.getItem(FEDERATION_VIEWER_SESSION_KEY))
    );
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

export function applyFederationViewerAuthState({
  setUser,
  setIsAuthenticated,
  setIsLoadingAuth,
  setIsLoadingPublicSettings,
  setAuthChecked,
  setAuthError,
}) {
  establishFederationViewerSession();
  setUser(FEDERATION_VIEWER_USER);
  setIsAuthenticated(true);
  setIsLoadingAuth(false);
  setIsLoadingPublicSettings(false);
  setAuthChecked(true);
  setAuthError(null);
}
`;

const federationViewerBootstrapJs = `import { primeFederationViewerFromUrl } from '@/lib/runtimeFederationEmbed';

primeFederationViewerFromUrl();
`;

const indexBootstrap = `(function(){try{var p=new URLSearchParams(location.search);if(p.get('runtime_embed')==='grafana'){sessionStorage.setItem('federationViewerSession','true');document.documentElement.classList.add('runtime-embed-grafana','federation-viewer-runtime');document.documentElement.setAttribute('data-runtime-embed','grafana');}}catch(e){}})();`;

const authContextHeader = `import {
  buildRuntimeReturnUrl,
  isGrafanaRuntimeEmbed,
  shouldBypassAuthRedirect,
  establishFederationViewerSession,
  FEDERATION_VIEWER_USER,
  applyFederationViewerAuthState,
  primeFederationViewerFromUrl,
} from '@/lib/runtimeFederationEmbed';`;

function writeFile(root, rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.endsWith('\n') ? content : `${content}\n`);
}

function patchAuthContext(root) {
  const authPath = path.join(root, 'src/lib/AuthContext.jsx');
  if (!fs.existsSync(authPath)) {
    console.warn(`skip AuthContext (missing): ${root}`);
    return;
  }
  let auth = fs.readFileSync(authPath, 'utf8');

  auth = auth.replace(
    /import \{[^}]+\} from '@\/lib\/runtimeFederationEmbed';/s,
    authContextHeader,
  );

  if (!auth.includes('applyFederationViewerAuthState')) {
    auth = auth.replace(
      "import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';",
      `import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';\n${authContextHeader.includes('applyFederationViewerAuthState') ? '' : ''}`,
    );
  }

  if (!auth.includes('const enterFederationViewerRuntime')) {
    auth = auth.replace(
      '  useEffect(() => {\n    checkAppState();\n  }, []);',
      `  useEffect(() => {
    primeFederationViewerFromUrl();
    checkAppState();
  }, []);

  const enterFederationViewerRuntime = () => {
    applyFederationViewerAuthState({
      setUser,
      setIsAuthenticated,
      setIsLoadingAuth,
      setIsLoadingPublicSettings,
      setAuthChecked,
      setAuthError,
    });
  };`,
    );
  }

  if (!auth.includes('if (shouldBypassAuthRedirect()) {\n      enterFederationViewerRuntime();\n      return;\n    }')) {
    auth = auth.replace(
      '  const checkAppState = async () => {\n    try {',
      `  const checkAppState = async () => {
    if (shouldBypassAuthRedirect()) {
      enterFederationViewerRuntime();
      return;
    }
    try {`,
    );
  }

  auth = auth.replace(
    /if \(appParams\.token\) \{\s*\n\s*await checkUserAuth\(\);\s*\n\s*\} else \{\s*\n\s*setIsLoadingAuth\(false\);\s*\n\s*setIsAuthenticated\(false\);\s*\n\s*setAuthChecked\(true\);\s*\n\s*\}/,
    `if (appParams.token) {
          await checkUserAuth();
        } else if (shouldBypassAuthRedirect()) {
          enterFederationViewerRuntime();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          setAuthChecked(true);
        }`,
  );

  auth = auth.replace(
    /if \(reason === 'auth_required'\) \{\s*\n\s*setAuthError\(\{\s*\n\s*type: 'auth_required',\s*\n\s*message: 'Authentication required'\s*\n\s*\}\);/,
    `if (reason === 'auth_required') {
            if (shouldBypassAuthRedirect()) {
              enterFederationViewerRuntime();
            } else {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
            }`,
  );

  if (!auth.includes('const checkUserAuth = async () => {\n    if (shouldBypassAuthRedirect())')) {
    auth = auth.replace(
      '  const checkUserAuth = async () => {\n    try {',
      `  const checkUserAuth = async () => {
    if (shouldBypassAuthRedirect()) {
      enterFederationViewerRuntime();
      return;
    }
    try {`,
    );
  }

  auth = auth.replace(
    /if \(error\.status === 401 \|\| error\.status === 403\) \{\s*\n\s*setAuthError\(\{\s*\n\s*type: 'auth_required',\s*\n\s*message: 'Authentication required'\s*\n\s*\}\);\s*\n\s*\}/,
    `if (error.status === 401 || error.status === 403) {
        if (shouldBypassAuthRedirect()) {
          enterFederationViewerRuntime();
        } else {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
        }
      }`,
  );

  auth = auth.replace(
    /const navigateToLogin = \(\) => \{\s*\n\s*\/\/ Use the SDK's redirectToLogin method\s*\n\s*base44\.auth\.redirectToLogin\([^)]+\);/,
    `const navigateToLogin = () => {
    if (shouldBypassAuthRedirect()) {
      enterFederationViewerRuntime();
      return;
    }
    base44.auth.redirectToLogin(isGrafanaRuntimeEmbed() ? buildRuntimeReturnUrl() : window.location.href);`,
  );

  fs.writeFileSync(authPath, auth);
  console.log(`  patched AuthContext.jsx`);
}

function patchProtectedRoute(root) {
  const p = path.join(root, 'src/components/ProtectedRoute.jsx');
  if (!fs.existsSync(p)) return;
  let src = fs.readFileSync(p, 'utf8');
  if (src.includes('shouldBypassAuthRedirect')) {
    console.log(`  ProtectedRoute.jsx already patched`);
    return;
  }
  src = src.replace(
    "import { useAuth } from '@/lib/AuthContext';",
    `import { useAuth } from '@/lib/AuthContext';\nimport { shouldBypassAuthRedirect } from '@/lib/runtimeFederationEmbed';`,
  );
  src = src.replace(
    'export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {\n  const { isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth } = useAuth();',
    `export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const { isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth } = useAuth();

  if (shouldBypassAuthRedirect()) {
    return <Outlet />;
  }`,
  );
  fs.writeFileSync(p, src);
  console.log(`  patched ProtectedRoute.jsx`);
}

function patchAppJsx(root) {
  const p = path.join(root, 'src/App.jsx');
  if (!fs.existsSync(p)) return;
  let app = fs.readFileSync(p, 'utf8');

  app = app.replace(
    /} else if \(authError\.type === 'auth_required'\) \{\s*\n\s*if \(shouldBypassAuthRedirect\(\)\) \{\s*\n\s*return \(\s*\n\s*<FederationViewerShell>[\s\S]*?<\/FederationViewerShell>\s*\n\s*\);\s*\n\s*\}\s*\n\s*navigateToLogin\(\);\s*\n\s*return null;\s*\n\s*\}/g,
    `} else if (authError.type === 'auth_required') {
      if (!shouldBypassAuthRedirect()) {
        navigateToLogin();
        return null;
      }
    }`,
  );

  app = app.replace(
    /<\/>\s*\n\s*\);\s*\n\};\s*\n\nfunction App\(\)/,
    `</FederationViewerShell>
  );
};

function App()`,
  );

  if (app.includes('FederationViewerShell') && !app.includes("import '@/lib/federationViewerBootstrap'")) {
    // no-op; bootstrap in main.jsx
  }

  fs.writeFileSync(p, app);
  console.log(`  patched App.jsx`);
}

function patchMain(root) {
  const p = path.join(root, 'src/main.jsx');
  if (!fs.existsSync(p)) return;
  let main = fs.readFileSync(p, 'utf8');
  if (!main.includes('federationViewerBootstrap')) {
    main = main.replace(
      /import App from '@\/App\.jsx'/,
      `import '@/lib/federationViewerBootstrap'\nimport App from '@/App.jsx'`,
    );
    fs.writeFileSync(p, main);
    console.log(`  patched main.jsx`);
  }
}

function patchIndexHtml(root) {
  const p = path.join(root, 'index.html');
  if (!fs.existsSync(p)) return;
  let html = fs.readFileSync(p, 'utf8');
  const scriptTag = `<script>${indexBootstrap}</script>`;
  if (html.includes('federationViewerSession')) return;
  html = html.replace(/<script>\(function\(\)\{try\{var p=new URLSearchParams[\s\S]*?<\/script>/, scriptTag);
  if (!html.includes('federationViewerSession')) {
    html = html.replace('<head>', `<head>\n    ${scriptTag}`);
  }
  fs.writeFileSync(p, html);
  console.log(`  patched index.html`);
}

for (const root of repos.map((r) => path.resolve(r))) {
  console.log('Patching', root);
  writeFile(root, 'src/lib/runtimeFederationEmbed.js', runtimeFederationEmbedJs);
  writeFile(root, 'src/lib/federationViewerBootstrap.js', federationViewerBootstrapJs);
  patchAuthContext(root);
  patchProtectedRoute(root);
  patchAppJsx(root);
  patchMain(root);
  patchIndexHtml(root);
}

console.log('Done.');
