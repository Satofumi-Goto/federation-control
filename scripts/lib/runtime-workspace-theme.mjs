/** Theme-adaptive tokens — Grafana CSS variables + SaaS white card fallbacks. */

export const cardBase =
  'background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);border-radius:12px;box-sizing:border-box;color:var(--text-primary,#111827)';

export const rtThemeStyleBlock = `<style>
.rt-root,.rt-root a{text-decoration:none}
.rt-surface{background:var(--background-primary,#fff);color:var(--text-primary,#111827);border:1px solid var(--border-weak,#e5e7eb);border-radius:12px;box-sizing:border-box}
.rt-muted{color:var(--text-secondary,#64748b)}
.rt-accent{color:#0891b2;font-weight:600}
.rt-card{display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;padding:10px 12px;background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);border-radius:10px;color:var(--text-primary,#111827);font-size:15px;font-weight:700;text-align:center;transition:background .15s,border-color .15s,box-shadow .15s}
.rt-card:hover{background:rgba(14,165,233,.08);border-color:#38bdf8;box-shadow:0 1px 4px rgba(14,165,233,.12)}
.rt-nav{display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:0;padding:4px 6px;background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);border-radius:8px;color:var(--text-primary,#111827);font-size:10px;font-weight:700;text-align:center;line-height:1.25;transition:background .15s,border-color .15s}
.rt-nav:hover{background:rgba(14,165,233,.06);border-color:#7dd3fc}
.rt-header-link{display:flex;flex-direction:column;align-items:center;padding:6px 10px;border-radius:10px;background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);min-width:64px;transition:background .15s,border-color .15s}
.rt-header-link:hover{background:rgba(14,165,233,.06);border-color:#7dd3fc}
.rt-fc-btn{width:100%;height:100%;min-height:48px;border:1px solid var(--border-weak,#e5e7eb);border-radius:10px;background:var(--background-primary,#fff);color:#0891b2;font-size:28px;font-weight:700;cursor:pointer;line-height:1;transition:background .15s,border-color .15s,box-shadow .15s}
.rt-fc-btn:hover{background:rgba(14,165,233,.08);border-color:#22d3ee;box-shadow:0 1px 4px rgba(14,165,233,.15)}
</style>`;
