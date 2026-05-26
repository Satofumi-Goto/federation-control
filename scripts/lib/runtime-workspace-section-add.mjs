/** Operational Systems cards + viewer URL enforcement. */

export function viewerModeBadgesHtml() {
  const badges = [
    ['Federated', '#7c3aed', '#f5f3ff'],
    ['Viewer', '#0891b2', '#ecfeff'],
    ['Live', '#16a34a', '#f0fdf4'],
    ['Read-only', '#64748b', '#f8fafc'],
  ];
  return `<div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end;margin-bottom:6px;">${badges
    .map(
      ([label, color, bg]) =>
        `<span style="padding:2px 6px;border-radius:999px;font-size:8px;font-weight:700;color:${color};background:${bg};border:1px solid ${color}33;">${label}</span>`,
    )
    .join('')}</div>`;
}

export function operationalSystemCardHtml(href, title, borderColor = '#3b82f6') {
  const viewerHref = ensureOperationalViewerUrl(href);
  if (!viewerHref) {
    return `<div style="display:block;padding:12px;border-left:3px solid ${borderColor};background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);border-radius:10px;opacity:0.5;font-size:13px;font-weight:700;color:#94a3b8;">${title}<div style="font-size:9px;margin-top:4px;">Viewer URL required</div></div>`;
  }
  return `<a href="${viewerHref}" style="display:block;padding:12px;text-decoration:none;border-left:3px solid ${borderColor};background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);border-radius:10px;color:var(--text-primary,#111827);box-shadow:0 1px 2px rgba(15,23,42,.04);">
    ${viewerModeBadgesHtml()}
    <div style="font-size:13px;font-weight:700;">${title}</div>
  </a>`;
}

export function ensureOperationalViewerUrl(url, embedQuery = 'runtime_embed=grafana') {
  if (!url || typeof url !== 'string') return url;
  if (!url.startsWith('http')) return url;
  try {
    const u = new URL(url);
    const [key, val] = embedQuery.split('=');
    if (key && val && !u.searchParams.has(key)) u.searchParams.set(key, val);
    if (u.hostname.includes('base44.app') && !u.pathname.includes('/viewer/')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function ensureViewerEmbedUrl(url, embedQuery) {
  return ensureOperationalViewerUrl(url, embedQuery);
}
