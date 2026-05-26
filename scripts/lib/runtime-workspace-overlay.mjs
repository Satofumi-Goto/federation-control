/** CSS :target overlay panels (replaces &lt;details&gt; PoC). Sanitizer-safe: no script. */

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const OVERLAY_STYLE = `<style>
.fed-overlay{position:fixed;inset:0;background:rgba(15,23,42,.45);display:none;align-items:flex-end;justify-content:flex-end;z-index:100000;padding:12px;box-sizing:border-box}
.fed-overlay:target{display:flex}
.fed-drawer{width:min(420px,96vw);max-height:92vh;overflow:auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 16px 40px rgba(15,23,42,.2);padding:14px 16px;font-family:system-ui,sans-serif}
.fed-field{margin-top:8px}
.fed-field label{display:block;font-size:9px;font-weight:700;color:#64748b;margin-bottom:3px}
.fed-field input,.fed-field select{width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #e5e7eb;border-radius:8px;font-size:11px}
.fed-scope{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.fed-scope span{padding:3px 8px;border-radius:999px;border:1px solid #e5e7eb;font-size:9px;font-weight:600;color:#475569}
</style>`;

function field(label, name, placeholder = '') {
  return `<div class="fed-field"><label>${esc(label)}</label><input name="${esc(name)}" placeholder="${esc(placeholder)}" /></div>`;
}

function scopeChips(scopes) {
  return `<div class="fed-scope">${scopes.map((s) => `<span>${esc(s)}</span>`).join('')}</div>`;
}

export function overlayStylesHtml() {
  return OVERLAY_STYLE;
}

export function sectionHeaderWithOverlayHtml(title, overlayId, triggerLabel) {
  return `<div class="section-header" style="width:100%;height:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 6px;box-sizing:border-box;">
    <h2 style="margin:0;font-size:12px;font-weight:700;color:var(--text-secondary,#64748b);letter-spacing:.08em;">${esc(title)}</h2>
    <a href="#${esc(overlayId)}" aria-label="${esc(triggerLabel)}" style="display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;border-radius:8px;border:1px dashed var(--border-weak,#cbd5e1);background:var(--background-primary,#fff);color:#0891b2;font-size:20px;font-weight:700;text-decoration:none;line-height:1;">+</a>
  </div>`;
}

export function systemsOnboardingOverlayHtml(overlayId = 'fed-overlay-systems') {
  return `<div id="${esc(overlayId)}" class="fed-overlay">
  <div class="fed-drawer">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
      <div style="font-size:14px;font-weight:800;color:#111827;">Systems onboarding / add</div>
      <a href="#" style="font-size:18px;color:#64748b;text-decoration:none;line-height:1;">×</a>
    </div>
    <div style="margin-top:4px;font-size:9px;color:#64748b;">Operational console registration · viewer session required</div>
    ${field('System Name', 'systemName')}
    ${field('Federation Scope', 'federationScope', 'Operational · Runtime · KPI')}
    ${field('Viewer URL', 'viewerUrl', '/viewer/...?runtime_embed=grafana')}
    ${field('Ownership', 'ownership')}
    ${field('Runtime Tags', 'runtimeTags', 'queue, eta, fleet')}
    ${field('Console Type', 'consoleType', 'fleet | hub | life | urban')}
  </div>
</div>`;
}

export function artifactsCreateOverlayHtml(overlayId = 'fed-overlay-artifacts') {
  return `<div id="${esc(overlayId)}" class="fed-overlay">
  <div class="fed-drawer">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
      <div style="font-size:14px;font-weight:800;color:#111827;">Artifact add / create</div>
      <a href="#" style="font-size:18px;color:#64748b;text-decoration:none;line-height:1;">×</a>
    </div>
    ${field('Artifact Name', 'artifactName')}
    ${field('Artifact Type', 'artifactType', 'topology | sequence | PL | IRR')}
    ${field('Linked Runtime', 'linkedRuntime', 'Queue · Fleet · Hub')}
    ${field('Linked KPI', 'linkedKpi', 'Throughput · ETA')}
    ${field('Linked Federation Scope', 'linkedScope', 'Artifact · Operational')}
  </div>
</div>`;
}

export function federationAddOverlayHtml(overlayId = 'fed-overlay-federation-add') {
  const scopes = ['Runtime', 'Knowledge', 'KPI', 'Operational', 'Artifact'];
  return `<div id="${esc(overlayId)}" class="fed-overlay">
  <div class="fed-drawer">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
      <div style="font-size:14px;font-weight:800;color:#111827;">Federation Add</div>
      <a href="#" style="font-size:18px;color:#64748b;text-decoration:none;line-height:1;">×</a>
    </div>
    <div style="margin-top:4px;font-size:9px;color:#64748b;">Define federation scope ownership</div>
    <div style="margin-top:8px;font-size:9px;font-weight:700;color:#0891b2;">Federation scope</div>
    ${scopeChips(scopes)}
    ${field('Name', 'name')}
    ${field('URL', 'url')}
    ${field('Repository', 'repository', 'optional')}
  </div>
</div>`;
}

export function workspaceOverlaysBundleHtml() {
  return `${overlayStylesHtml()}${systemsOnboardingOverlayHtml()}${artifactsCreateOverlayHtml()}${federationAddOverlayHtml()}`;
}
