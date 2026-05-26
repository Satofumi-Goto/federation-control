/** Federation Add — scoped global onboarding (overlay trigger, not anonymous +). */

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function federationAddPanelHtml(routes) {
  const seeds = routes.federationConnect?.seedSystems ?? [];
  const panelTitle = routes.federationConnect?.panelTitle ?? 'Federation Add';
  const scopes = routes.federationConnect?.scopes ?? [
    'Runtime',
    'Knowledge',
    'KPI',
    'Operational',
    'Artifact',
  ];

  const scopeChips = scopes
    .map(
      (s) =>
        `<span style="padding:2px 6px;border-radius:999px;font-size:8px;font-weight:600;color:#475569;border:1px solid #e5e7eb;">${esc(s)}</span>`,
    )
    .join('');

  const listItems = seeds.length
    ? seeds
        .map(
          (it) =>
            `<div style="padding:5px;margin-top:4px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;font-size:8px;"><strong>${esc(it.name)}</strong></div>`,
        )
        .join('')
    : `<div style="margin-top:6px;font-size:9px;color:#64748b;">No systems</div>`;

  return `<div class="federation-add-panel" style="width:100%;height:100%;display:flex;flex-direction:column;padding:6px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-sizing:border-box;">
  <div style="font-size:10px;font-weight:800;color:#0891b2;">${esc(panelTitle)}</div>
  <div style="margin-top:4px;font-size:8px;color:#64748b;line-height:1.35;">Scoped onboarding</div>
  <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:3px;">${scopeChips}</div>
  <a href="#fed-overlay-federation-add" style="margin-top:8px;display:flex;align-items:center;justify-content:center;gap:4px;padding:8px;border:1px dashed #cbd5e1;border-radius:8px;text-decoration:none;color:#0891b2;font-size:11px;font-weight:700;">
    <span style="font-size:16px;">+</span> Add
  </a>
  <div style="margin-top:8px;font-size:9px;font-weight:700;color:#0891b2;">Registered</div>
  ${listItems}
</div>`;
}

export function federationConnectPanelHtml(routes) {
  return federationAddPanelHtml(routes);
}
