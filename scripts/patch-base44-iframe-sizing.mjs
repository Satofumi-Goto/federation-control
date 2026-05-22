/**
 * Fix Federation Viewer iframe render sizing (height-0 collapse in embed).
 * Usage: node scripts/patch-base44-iframe-sizing.mjs <repo-path> [repo-path...]
 */
import fs from 'node:fs';
import path from 'node:path';

const repos = process.argv.slice(2);
if (repos.length === 0) {
  console.error('Usage: node scripts/patch-base44-iframe-sizing.mjs <repo-path> ...');
  process.exit(1);
}

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

.federation-viewer-banner {
  flex: 0 0 auto;
  position: sticky;
  top: 0;
  z-index: 99999;
  padding: 4px 12px;
  font-size: 10px;
  font-weight: 700;
  color: #67e8f9;
  background: linear-gradient(90deg, #0b1220, #02060c);
  border-bottom: 1px solid rgba(56, 189, 248, 0.35);
  pointer-events: none;
  text-align: center;
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
  min-height: calc(100vh - 28px);
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
      <div className="federation-viewer-banner">
        Runtime Federation Viewer · read-only · Operational Runtime
      </div>
      <div className="federation-viewer-operational" data-federation-viewer-shell>
        {children}
      </div>
    </div>
  );
}
`;

const embedSizingBlock = `
/* Federation Viewer iframe embed — prevent height-0 collapse */
html.runtime-embed-grafana,
html.federation-viewer-runtime {
  width: 100%;
  height: 100%;
  min-height: 100vh;
}

html.runtime-embed-grafana body,
html.federation-viewer-runtime body {
  width: 100%;
  height: 100%;
  min-height: 100vh;
  margin: 0;
  padding: 0;
}

html.runtime-embed-grafana #root,
html.federation-viewer-runtime #root {
  width: 100%;
  height: 100%;
  min-height: 100vh;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
`;

function patchIndexCss(root) {
  const indexPath = path.join(root, 'src/index.css');
  if (!fs.existsSync(indexPath)) return;
  let css = fs.readFileSync(indexPath, 'utf8');
  if (css.includes('Federation Viewer iframe embed')) return;
  css = `${css.trimEnd()}\n${embedSizingBlock}\n`;
  fs.writeFileSync(indexPath, css);
  console.log('  patched src/index.css');
}

for (const root of repos.map((r) => path.resolve(r))) {
  console.log('Patching', root);
  const cssPath = path.join(root, 'src/styles/federation-viewer.css');
  fs.mkdirSync(path.dirname(cssPath), { recursive: true });
  fs.writeFileSync(cssPath, federationViewerCss);
  console.log('  wrote src/styles/federation-viewer.css');

  const shellPath = path.join(root, 'src/components/FederationViewerShell.jsx');
  if (fs.existsSync(shellPath)) {
    fs.writeFileSync(shellPath, federationViewerShellJsx);
    console.log('  wrote src/components/FederationViewerShell.jsx');
  }

  patchIndexCss(root);
}

console.log('Done.');
