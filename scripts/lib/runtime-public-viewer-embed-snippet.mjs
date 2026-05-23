/** Snippet appended to runtimeFederationEmbed.js for /viewer/* public read-only mode. */

export const RUNTIME_PUBLIC_VIEW_EMBED_SNIPPET = `
export const RUNTIME_PUBLIC_VIEW_SESSION_FLAG = 'runtimePublicViewSession';
export const RUNTIME_PUBLIC_VIEW_USER = {
  id: 'runtime-public-viewer',
  email: 'runtime-viewer@runtime.local',
  role: 'runtime_public_viewer',
  readOnly: true,
};

export function isRuntimePublicViewPath() {
  try {
    return /^\\/viewer(\\/|$)/i.test(window.location.pathname);
  } catch {
    return false;
  }
}

export function isRuntimePublicView() {
  if (typeof window !== 'undefined' && window.__RUNTIME_PUBLIC_VIEW__) return true;
  return isRuntimePublicViewPath();
}

export function establishRuntimePublicViewSession() {
  if (typeof window !== 'undefined') {
    window.__RUNTIME_PUBLIC_VIEW__ = true;
  }
  try {
    sessionStorage.setItem(RUNTIME_PUBLIC_VIEW_SESSION_FLAG, 'true');
  } catch {
    /* ignore */
  }
  document.documentElement.classList.add('runtime-public-view', 'runtime-embed-grafana');
  document.documentElement.setAttribute('data-runtime-public-view', 'true');
  document.documentElement.setAttribute('data-runtime-embed', 'grafana');
  if (isRuntimeEmbedGrafanaFromUrl()) {
    establishFederationViewerSession();
  } else {
    try {
      sessionStorage.setItem(FEDERATION_VIEWER_SESSION_FLAG, 'true');
    } catch {
      /* ignore */
    }
  }
}

export function primeRuntimePublicViewFromPath() {
  if (!isRuntimePublicViewPath()) return false;
  establishRuntimePublicViewSession();
  return true;
}

export function isRuntimePublicViewOperationDisabled() {
  return isRuntimePublicView();
}

export function isRuntimePublicViewWriteBlocked(action) {
  if (!isRuntimePublicView()) return false;
  const blocked = new Set([
    'save',
    'delete',
    'knowledgeExport',
    'documentExport',
    'syncRefactor',
    'sync-refactor',
    'knowledge-export',
    'document-export',
  ]);
  return blocked.has(String(action || '').toLowerCase());
}
`;

export const RUNTIME_PUBLIC_VIEW_INDEX_BOOTSTRAP = `(function(){try{var path=location.pathname||'';if(path.indexOf('/viewer')===0){window.__RUNTIME_PUBLIC_VIEW__=true;try{sessionStorage.setItem('runtimePublicViewSession','true');}catch(e){}document.documentElement.classList.add('runtime-public-view');document.documentElement.setAttribute('data-runtime-public-view','true');}var q=new URLSearchParams(location.search);if(q.get('runtime_embed')==='grafana'){try{sessionStorage.setItem('federationViewerSession','true');}catch(e2){}document.documentElement.classList.add('runtime-embed-grafana');document.documentElement.setAttribute('data-runtime-embed','grafana');}}catch(e){}})();`;
