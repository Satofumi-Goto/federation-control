/**
 * Federation Viewer embed diagnostics + storage fallback (iframe / partitioned storage).
 * Usage: node scripts/patch-base44-federation-diagnostics.mjs <repo-path> ...
 */
import fs from 'node:fs';
import path from 'node:path';

const repos = process.argv.slice(2);
if (repos.length === 0) {
  console.error('Usage: node scripts/patch-base44-federation-diagnostics.mjs <repo-path> ...');
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

const DIAG_PREFIX = '[federation-viewer]';

export function federationViewerDiag(message, detail) {
  if (!isRuntimeEmbedGrafanaFromUrl() && !window.__FEDERATION_VIEWER_RUNTIME__) return;
  if (detail !== undefined) {
    console.info(DIAG_PREFIX, message, detail);
  } else {
    console.info(DIAG_PREFIX, message);
  }
}

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
  } catch (err) {
    federationViewerDiag('sessionStorage read failed', err?.message);
    return Boolean(window.__FEDERATION_VIEWER_RUNTIME__);
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
  if (window.__FEDERATION_VIEWER_RUNTIME__) return true;
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
  window.__FEDERATION_VIEWER_RUNTIME__ = true;
  let storageOk = true;
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
  } catch (err) {
    storageOk = false;
    federationViewerDiag('establishFederationViewerSession: sessionStorage blocked', err?.message);
  }
  document.documentElement.classList.add('federation-viewer-runtime', 'runtime-embed-grafana');
  document.documentElement.setAttribute('data-runtime-embed', 'grafana');
  federationViewerDiag('establishFederationViewerSession', {
    storageOk,
    flag: sessionStorage.getItem(FEDERATION_VIEWER_SESSION_FLAG),
    embedded: isOperationalConsoleEmbed(),
    referrer: document.referrer?.slice(0, 80) || '',
  });
}

export function primeFederationViewerFromUrl() {
  if (!isRuntimeEmbedGrafanaFromUrl()) return false;
  establishFederationViewerSession();
  federationViewerDiag('primeFederationViewerFromUrl: ok');
  return true;
}

if (typeof window !== 'undefined') {
  primeFederationViewerFromUrl();
}

export function hasFederationViewerSession() {
  try {
    return (
      Boolean(window.__FEDERATION_VIEWER_RUNTIME__) ||
      hasFederationViewerSessionFlag() ||
      Boolean(sessionStorage.getItem(FEDERATION_VIEWER_SESSION_KEY))
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
  if (typeof setAuthChecked === 'function') setAuthChecked(true);
  setAuthError(null);
  federationViewerDiag('applyFederationViewerAuthState: viewer authenticated');
}
`;

const federationViewerBootstrapJs = `import { primeFederationViewerFromUrl, federationViewerDiag } from '@/lib/runtimeFederationEmbed';

const primed = primeFederationViewerFromUrl();
federationViewerDiag('federationViewerBootstrap.js executed', { primed });
`;

const indexBootstrap = `(function(){try{var p=new URLSearchParams(location.search);if(p.get('runtime_embed')==='grafana'){window.__FEDERATION_VIEWER_RUNTIME__=true;try{sessionStorage.setItem('federationViewerSession','true');}catch(e){console.info('[federation-viewer] index bootstrap: sessionStorage blocked',e&&e.message);}document.documentElement.classList.add('runtime-embed-grafana','federation-viewer-runtime');document.documentElement.setAttribute('data-runtime-embed','grafana');console.info('[federation-viewer] index.html bootstrap ok');}}catch(e){console.warn('[federation-viewer] index bootstrap error',e);}})();`;

const shellDiagEffect = `    federationViewerDiag('FederationViewerShell mount', {
      operationDisabled: state.operationDisabled,
      active: state.active,
    });
`;

for (const root of repos.map((r) => path.resolve(r))) {
  console.log('Patching', root);
  const embedPath = path.join(root, 'src/lib/runtimeFederationEmbed.js');
  fs.writeFileSync(embedPath, runtimeFederationEmbedJs);

  fs.writeFileSync(
    path.join(root, 'src/lib/federationViewerBootstrap.js'),
    federationViewerBootstrapJs,
  );

  const shellPath = path.join(root, 'src/components/FederationViewerShell.jsx');
  if (fs.existsSync(shellPath)) {
    let shell = fs.readFileSync(shellPath, 'utf8');
    if (!shell.includes('federationViewerDiag')) {
      shell = shell.replace(
        "import { establishFederationViewerSession, getFederationViewerState } from '@/lib/federationViewerRuntime';",
        `import { establishFederationViewerSession, getFederationViewerState } from '@/lib/federationViewerRuntime';
import { federationViewerDiag } from '@/lib/runtimeFederationEmbed';`,
      );
      shell = shell.replace(
        '    establishFederationViewerSession();\n    const blockSubmit',
        `    establishFederationViewerSession();
${shellDiagEffect}    const blockSubmit`,
      );
    }
    fs.writeFileSync(shellPath, shell);
  }

  const indexPath = path.join(root, 'index.html');
  if (fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, 'utf8');
    html = html.replace(
      /<script>\(function\(\)\{try\{var p=new URLSearchParams[\s\S]*?<\/script>/,
      `<script>${indexBootstrap}</script>`,
    );
    if (!html.includes('__FEDERATION_VIEWER_RUNTIME__')) {
      html = html.replace('<head>', `<head>\n    <script>${indexBootstrap}</script>`);
    }
    fs.writeFileSync(indexPath, html);
  }

  console.log('  ok');
}

console.log('Done.');
