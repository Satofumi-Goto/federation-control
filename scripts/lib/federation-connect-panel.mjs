/** Federation Connect — theme-adaptive white card UI. */

export function federationConnectPanelHtml(routes) {
  const fc = routes.federationConnect ?? {};
  const storageKey = fc.storageKey ?? 'runtimeFederationConnectSystems';
  const patterns = JSON.stringify(fc.urlPatterns ?? []);
  const seed = JSON.stringify(fc.seedSystems ?? []);

  return `<div id="rt-fc-root" class="rt-root" style="width:100%;height:100%;min-height:0;display:flex;align-items:center;justify-content:center;box-sizing:border-box;">
<button type="button" id="rt-fc-open" class="rt-fc-btn" title="Federation Connect">＋</button>
<div id="rt-fc-backdrop" hidden style="position:fixed;inset:0;background:rgba(15,23,42,.25);z-index:9998;"></div>
<div id="rt-fc-dialog" hidden style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(420px,92vw);max-height:80vh;overflow:auto;z-index:9999;background:var(--background-primary,#fff);border:1px solid var(--border-weak,#e5e7eb);border-radius:14px;padding:16px;color:var(--text-primary,#111827);box-sizing:border-box;font-family:system-ui,sans-serif;box-shadow:0 12px 40px rgba(15,23,42,.12);">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><div style="font-size:16px;font-weight:700;">Federation Connect</div><button type="button" id="rt-fc-close" style="background:transparent;border:none;color:var(--text-secondary,#64748b);font-size:20px;cursor:pointer;">×</button></div>
<form id="rt-fc-form" style="display:flex;flex-direction:column;gap:8px;">
<label style="font-size:10px;color:var(--text-secondary,#64748b);">名前</label><input id="rt-fc-name" required style="padding:8px;border-radius:8px;border:1px solid var(--border-weak,#e5e7eb);background:var(--background-primary,#fff);color:var(--text-primary,#111827);" />
<label style="font-size:10px;color:var(--text-secondary,#64748b);">URL</label><input id="rt-fc-url" type="url" required placeholder="https://..." style="padding:8px;border-radius:8px;border:1px solid var(--border-weak,#e5e7eb);background:var(--background-primary,#fff);color:var(--text-primary,#111827);" />
<label style="font-size:10px;color:var(--text-secondary,#64748b);">repository（optional）</label><input id="rt-fc-repo" style="padding:8px;border-radius:8px;border:1px solid var(--border-weak,#e5e7eb);background:var(--background-primary,#fff);color:var(--text-primary,#111827);" />
<button type="submit" style="margin-top:4px;padding:10px;border:none;border-radius:8px;background:#0891b2;color:#fff;font-weight:700;cursor:pointer;">追加</button>
</form>
<div style="margin-top:14px;font-size:11px;font-weight:700;color:#0891b2;">追加済みシステム</div>
<div id="rt-fc-list" style="margin-top:8px;display:flex;flex-direction:column;gap:8px;"></div>
</div></div>
<script>
(function(){
  var SK=${JSON.stringify(storageKey)};
  var PATTERNS=${patterns};
  var SEED=${seed};
  var openBtn=document.getElementById('rt-fc-open');
  var dlg=document.getElementById('rt-fc-dialog');
  var backdrop=document.getElementById('rt-fc-backdrop');
  var closeBtn=document.getElementById('rt-fc-close');
  var form=document.getElementById('rt-fc-form');
  var listEl=document.getElementById('rt-fc-list');
  function load(){try{return JSON.parse(localStorage.getItem(SK)||'[]');}catch(e){return[];}}
  function save(items){try{localStorage.setItem(SK,JSON.stringify(items));}catch(e){}}
  function urlOk(u){try{var x=new URL(u);if(x.protocol!=='https:'&&x.protocol!=='http:')return false;var h=(x.hostname+x.pathname).toLowerCase();if(h.indexOf('localhost')>=0||/^\\d+\\.\\d+\\.\\d+\\.\\d+/.test(x.hostname))return true;return PATTERNS.some(function(p){return h.indexOf(String(p).toLowerCase())>=0;});}catch(e){return false;}}
  function show(on){dlg.hidden=!on;backdrop.hidden=!on;}
  openBtn.addEventListener('click',function(){show(true);render();});
  closeBtn.addEventListener('click',function(){show(false);});
  backdrop.addEventListener('click',function(){show(false);});
  function render(){
    var items=load();
    if(!items.length&&SEED.length){items=SEED.slice();save(items);}
    listEl.innerHTML='';
    if(!items.length){listEl.innerHTML='<div style="font-size:11px;color:var(--text-secondary,#64748b);">なし</div>';return;}
    items.forEach(function(it,idx){
      var row=document.createElement('div');
      row.style.cssText='padding:10px;background:var(--background-secondary,#f8fafc);border:1px solid var(--border-weak,#e5e7eb);border-radius:8px;font-size:11px;color:var(--text-primary,#111827);';
      var name=document.createElement('div');name.style.fontWeight='700';name.textContent=it.name||'—';
      var url=document.createElement('div');url.style.color='#0891b2';url.style.marginTop='4px';url.style.wordBreak='break-all';url.textContent=it.url||'';
      var repo=document.createElement('div');repo.style.color='var(--text-secondary,#64748b)';repo.style.marginTop='2px';repo.textContent=it.repository?('repository: '+it.repository):'';
      var actions=document.createElement('div');actions.style.marginTop='8px';actions.style.display='flex';gap='8px';
      var go=document.createElement('a');go.href=it.url;go.textContent='開く';go.style.cssText='text-decoration:none;color:#fff;background:#0891b2;padding:4px 10px;border-radius:6px;font-weight:700;';
      var del=document.createElement('button');del.type='button';del.textContent='削除';del.style.cssText='background:transparent;border:1px solid #ef4444;color:#ef4444;padding:4px 10px;border-radius:6px;cursor:pointer;';
      del.addEventListener('click',function(){var n=load();n.splice(idx,1);save(n);render();});
      actions.appendChild(go);actions.appendChild(del);
      row.appendChild(name);row.appendChild(url);if(it.repository)row.appendChild(repo);row.appendChild(actions);
      listEl.appendChild(row);
    });
  }
  form.addEventListener('submit',function(ev){
    ev.preventDefault();
    var name=document.getElementById('rt-fc-name').value.trim();
    var url=document.getElementById('rt-fc-url').value.trim();
    var repository=document.getElementById('rt-fc-repo').value.trim();
    if(!name||!url||!urlOk(url)){alert('URLを確認してください（Base44 / Grafana / Excel / Sheets / Planner / HILS / Queue / ETA / Internal SaaS）');return;}
    var items=load();items.push({name:name,url:url,repository:repository||undefined});
    save(items);form.reset();render();
  });
})();
</script>`;
}
