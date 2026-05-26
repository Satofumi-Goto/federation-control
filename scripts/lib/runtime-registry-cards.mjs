/**
 * Grafana text-panel HTML renderer driven by Runtime Registry.
 * Cards are render-only — routing via <a> tags, no window.location / window.open.
 */

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const registryDataPath = path.resolve(__dirname, '../../src/runtime/registry/runtimeRegistryData.json');

export function loadCanonicalRegistry() {
  try {
    return JSON.parse(fs.readFileSync(registryDataPath, 'utf8'));
  } catch {
    return [];
  }
}

function resolveTarget(target) {
  if (!target) return { href: '/', targetMode: '_self' };
  switch (target.type) {
    case 'grafana-runtime':
    case 'grafana-dashboard':
      return { href: target.url, targetMode: '_top' };
    case 'base44-viewer': {
      const sep = target.url.includes('?') ? '&' : '?';
      return { href: `${target.url}${sep}runtime_embed=grafana&public_view=1`, targetMode: '_top' };
    }
    case 'seneschal':
      return { href: target.url, targetMode: '_top' };
    case 'internal-runtime':
      return { href: target.url || '/', targetMode: '_self' };
    default:
      return { href: target.url || '/', targetMode: '_self' };
  }
}

export function registryCardHtml(entry) {
  const { href, targetMode } = resolveTarget(entry.target);
  return `<a href="${esc(href)}" target="${esc(targetMode)}" rel="noreferrer"
    style="display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px;width:100%;height:100%;min-height:0;padding:10px;text-decoration:none;
    background:#fff;border:1px solid ${entry.border || '#e5e7eb'};border-radius:10px;
    box-sizing:border-box;text-align:center;color:#111827;transition:box-shadow .15s;">
    <div style="font-size:20px;line-height:1;">${esc(entry.icon || '●')}</div>
    <div style="font-size:13px;font-weight:800;color:${entry.accent || '#111827'};">${esc(entry.title)}</div>
    <div style="font-size:10px;color:#64748b;">${esc(entry.label || '')}</div>
    <div style="font-size:18px;font-weight:900;color:${entry.accent || '#111827'};">${entry.count ?? ''}</div>
  </a>`;
}

/** Section header for Runtime Cards row. */
export function runtimeCardsSectionHeaderHtml() {
  return `<div class="section-header" style="width:100%;height:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 6px;box-sizing:border-box;">
    <h2 style="margin:0;font-size:12px;font-weight:700;color:var(--text-secondary,#64748b);letter-spacing:.08em;">Runtime Cards</h2>
  </div>`;
}

/**
 * ＋ window panel — creates a new Runtime Card and saves to runtimeRegistryCards in localStorage.
 * On submit, the card appears in the registry row on next rebuild/refresh.
 */
export function runtimeCardCreatePanelHtml() {
  const SK = 'runtimeRegistryCards';
  return `<div id="rt-card-create-root" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
<button type="button" id="rt-card-create-open" title="Runtime Card Create" style="width:100%;height:100%;min-height:48px;border:1px dashed rgba(251,191,36,.55);border-radius:10px;background:#fff;color:#ca8a04;font-size:28px;font-weight:900;cursor:pointer;line-height:1;">＋</button>
<div id="rt-card-backdrop" hidden style="position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:9998;"></div>
<div id="rt-card-dialog" hidden style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(480px,92vw);max-height:84vh;overflow:auto;z-index:9999;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:16px;box-sizing:border-box;font-family:system-ui,sans-serif;box-shadow:0 16px 40px rgba(15,23,42,.18);">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><div style="font-size:15px;font-weight:800;color:#111827;">Runtime Card Create</div><button type="button" id="rt-card-close" style="background:transparent;border:none;color:#94a3b8;font-size:20px;cursor:pointer;">×</button></div>
<form id="rt-card-form" style="display:flex;flex-direction:column;gap:8px;">
<label style="font-size:9px;font-weight:700;color:#64748b;">タイトル</label><input id="rt-card-title" required style="padding:8px;border-radius:8px;border:1px solid #e5e7eb;font-size:12px;" />
<label style="font-size:9px;font-weight:700;color:#64748b;">ラベル</label><input id="rt-card-label" placeholder="例: 要注意 / 進行中" style="padding:8px;border-radius:8px;border:1px solid #e5e7eb;font-size:12px;" />
<label style="font-size:9px;font-weight:700;color:#64748b;">件数</label><input id="rt-card-count" type="number" value="0" style="padding:8px;border-radius:8px;border:1px solid #e5e7eb;font-size:12px;" />
<label style="font-size:9px;font-weight:700;color:#64748b;">アイコン</label><input id="rt-card-icon" value="●" maxlength="4" style="padding:8px;border-radius:8px;border:1px solid #e5e7eb;font-size:16px;width:60px;" />
<label style="font-size:9px;font-weight:700;color:#64748b;">アクセント色</label><input id="rt-card-accent" value="#0891b2" type="color" style="height:32px;border-radius:8px;border:1px solid #e5e7eb;" />
<label style="font-size:9px;font-weight:700;color:#64748b;">Target Type</label>
<select id="rt-card-target-type" style="padding:8px;border-radius:8px;border:1px solid #e5e7eb;font-size:12px;">
<option value="grafana-runtime">grafana-runtime</option>
<option value="grafana-dashboard">grafana-dashboard</option>
<option value="base44-viewer">base44-viewer</option>
<option value="seneschal">seneschal</option>
<option value="internal-runtime">internal-runtime</option>
</select>
<label style="font-size:9px;font-weight:700;color:#64748b;">Target URL</label><input id="rt-card-target-url" required placeholder="https://..." style="padding:8px;border-radius:8px;border:1px solid #e5e7eb;font-size:12px;" />
<button type="submit" style="margin-top:4px;padding:10px;border:none;border-radius:8px;background:#0891b2;color:#fff;font-weight:800;cursor:pointer;">作成</button>
</form>
<div style="margin-top:14px;font-size:10px;font-weight:700;color:#0891b2;">作成済み Runtime Cards</div>
<div id="rt-card-list" style="margin-top:8px;display:flex;flex-direction:column;gap:6px;"></div>
</div></div>
<script>
(function(){
  var SK=${JSON.stringify(SK)};
  var openBtn=document.getElementById('rt-card-create-open');
  var dlg=document.getElementById('rt-card-dialog');
  var backdrop=document.getElementById('rt-card-backdrop');
  var closeBtn=document.getElementById('rt-card-close');
  var form=document.getElementById('rt-card-form');
  var listEl=document.getElementById('rt-card-list');
  function load(){try{return JSON.parse(localStorage.getItem(SK)||'[]');}catch(e){return[];}}
  function save(items){localStorage.setItem(SK,JSON.stringify(items));}
  function show(on){dlg.hidden=!on;backdrop.hidden=!on;}
  openBtn.addEventListener('click',function(){show(true);render();});
  closeBtn.addEventListener('click',function(){show(false);});
  backdrop.addEventListener('click',function(){show(false);});
  function render(){
    var items=load();listEl.innerHTML='';
    if(!items.length){listEl.innerHTML='<div style="font-size:10px;color:#94a3b8;">なし</div>';return;}
    items.forEach(function(it,idx){
      var row=document.createElement('div');
      row.style.cssText='padding:8px;background:#f8fafc;border:1px solid #e5e7eb;border-left:3px solid '+(it.accent||'#0891b2')+';border-radius:8px;font-size:10px;display:flex;justify-content:space-between;align-items:center;';
      row.innerHTML='<div><strong>'+(it.icon||'')+' '+(it.title||'—')+'</strong> <span style="color:#64748b;">'+(it.label||'')+'</span></div>';
      var del=document.createElement('button');del.type='button';del.textContent='×';del.style.cssText='background:transparent;border:none;color:#ef4444;font-size:14px;cursor:pointer;';
      del.addEventListener('click',function(){var n=load();n.splice(idx,1);save(n);render();});
      row.appendChild(del);listEl.appendChild(row);
    });
  }
  form.addEventListener('submit',function(ev){
    ev.preventDefault();
    var t=document.getElementById('rt-card-title').value.trim();
    var url=document.getElementById('rt-card-target-url').value.trim();
    if(!t||!url)return;
    var items=load();
    items.push({
      id:'user-'+Date.now().toString(36),
      title:t,
      label:document.getElementById('rt-card-label').value.trim(),
      count:parseInt(document.getElementById('rt-card-count').value)||0,
      icon:document.getElementById('rt-card-icon').value||'●',
      accent:document.getElementById('rt-card-accent').value,
      border:'rgba(100,100,100,0.3)',
      target:{type:document.getElementById('rt-card-target-type').value,url:url},
      visibility:'active',
      source:'user-created'
    });
    save(items);form.reset();render();
  });
  render();
})();
</script>`;
}

/**
 * Runtime Cards row: loads canonical entries at build time
 * and merges user-created cards from localStorage at runtime via <script>.
 */
export function runtimeCardsRowHtml(canonicalEntries) {
  const staticCards = canonicalEntries
    .filter((e) => e.visibility === 'active')
    .map((e) => registryCardHtml(e))
    .join('');

  return `<div id="rt-registry-cards" style="width:100%;height:100%;display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;align-items:stretch;box-sizing:border-box;">
${staticCards}
</div>
<script>
(function(){
  var SK='runtimeRegistryCards';
  var root=document.getElementById('rt-registry-cards');
  try{
    var items=JSON.parse(localStorage.getItem(SK)||'[]');
    items.forEach(function(e){
      if(e.visibility!=='active')return;
      var target=e.target||{};var href=target.url||'/';var tm='_self';
      if(target.type==='grafana-runtime'||target.type==='grafana-dashboard'||target.type==='seneschal'){tm='_top';}
      else if(target.type==='base44-viewer'){href+=(href.indexOf('?')>-1?'&':'?')+'runtime_embed=grafana&public_view=1';tm='_top';}
      else if(target.type==='internal-runtime'){tm='_self';}
      var a=document.createElement('a');a.href=href;a.target=tm;a.rel='noreferrer';
      a.style.cssText='display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px;padding:10px;text-decoration:none;background:#fff;border:1px solid '+(e.border||'#e5e7eb')+';border-radius:10px;text-align:center;color:#111827;box-sizing:border-box;';
      a.innerHTML='<div style="font-size:20px;">'+(e.icon||'●')+'</div><div style="font-size:13px;font-weight:800;color:'+(e.accent||'#111827')+';">'+(e.title||'')+'</div><div style="font-size:10px;color:#64748b;">'+(e.label||'')+'</div><div style="font-size:18px;font-weight:900;color:'+(e.accent||'#111827')+';">'+(e.count!=null?e.count:'')+'</div>';
      root.appendChild(a);
    });
  }catch(ex){}
})();
</script>`;
}
