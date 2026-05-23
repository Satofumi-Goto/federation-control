/** Federation Connect — sanitizer-safe HTML only (no script/style/svg). */

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function federationConnectPanelHtml(routes) {
  const discovery = routes.row1?.discovery ?? '/runtime_discovery';
  const seeds = routes.federationConnect?.seedSystems ?? [];

  const listItems = seeds.length
    ? seeds
        .map(
          (it) =>
            `<div style="padding:8px;margin-top:6px;background:var(--background-secondary,#f8fafc);border:1px solid var(--border-weak,#e5e7eb);border-radius:8px;font-size:10px;color:var(--text-primary,#111827);">
              <div style="font-weight:700;">${esc(it.name)}</div>
              <div style="margin-top:3px;color:#0891b2;word-break:break-all;font-size:9px;">${esc(it.url)}</div>
              ${it.repository ? `<div style="margin-top:2px;color:var(--text-secondary,#64748b);font-size:9px;">repository: ${esc(it.repository)}</div>` : ''}
              <div style="margin-top:6px;"><a href="${esc(it.url)}" style="display:inline-block;text-decoration:none;color:#fff;background:#0891b2;padding:4px 10px;border-radius:6px;font-size:9px;font-weight:700;">開く</a></div>
            </div>`,
        )
        .join('')
    : `<div style="margin-top:8px;font-size:10px;color:var(--text-secondary,#64748b);">登録なし</div>`;

  return `<div style="width:100%;height:100%;min-height:0;display:flex;flex-direction:column;box-sizing:border-box;padding:6px;background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);border-radius:10px;">
  <details style="width:100%;flex:1;display:flex;flex-direction:column;">
    <summary style="list-style:none;cursor:pointer;width:100%;flex:1;min-height:40px;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;color:#0891b2;border:1px dashed var(--border-weak,#cbd5e1);border-radius:8px;background:var(--background-primary,#fff);">＋</summary>
    <div style="margin-top:8px;padding:8px;border-top:1px solid var(--border-weak,#e5e7eb);font-family:system-ui,sans-serif;">
      <div style="font-size:12px;font-weight:700;color:var(--text-primary,#111827);">Federation Connect</div>
      <div style="margin-top:6px;font-size:9px;color:var(--text-secondary,#64748b);line-height:1.45;">
        名前 · URL · repository（任意）<br/>
        追加・同期は <a href="${esc(discovery)}" style="color:#0891b2;font-weight:700;text-decoration:none;">連携探索</a> または Runtime 全体記憶と連動。
      </div>
      <div style="margin-top:10px;font-size:10px;font-weight:700;color:#0891b2;">追加済みシステム</div>
      ${listItems}
    </div>
  </details>
</div>`;
}
