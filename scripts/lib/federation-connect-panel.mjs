/** Federation Connect HTML panel (+ window, localStorage systems list). */

export function federationConnectPanelHtml(routes) {
  const fc = routes.federationConnect ?? {};
  const storageKey = fc.storageKey ?? 'runtimeFederationConnectSystems';
  const memoryKey = fc.memoryKey ?? 'runtimeFederationMemory';
  const releasedMemoryKey = fc.releasedMemoryKey ?? 'runtimeReleasedSystemMemory';
  const patterns = JSON.stringify(fc.urlPatterns ?? []);
  const seed = JSON.stringify(fc.seedSystems ?? []);

  return `<div id="rt-fc-root" style="width:100%;height:100%;min-height:0;display:flex;align-items:center;justify-content:center;box-sizing:border-box;">
<button type="button" id="rt-fc-open" title="Federation Connect" style="width:100%;height:100%;min-height:48px;border:1px dashed rgba(56,189,248,.5);border-radius:10px;background:#0f172a;color:#67e8f9;font-size:28px;font-weight:900;cursor:pointer;line-height:1;">＋</button>
<div id="rt-fc-backdrop" hidden style="position:fixed;inset:0;background:rgba(2,6,12,.72);z-index:9998;"></div>
<div id="rt-fc-dialog" hidden style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(420px,92vw);max-height:80vh;overflow:auto;z-index:9999;background:#0b1220;border:1px solid rgba(56,189,248,.45);border-radius:14px;padding:16px;color:#fff;box-sizing:border-box;font-family:system-ui,sans-serif;">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><div style="font-size:16px;font-weight:900;">Federation Connect</div><button type="button" id="rt-fc-close" style="background:transparent;border:none;color:#94a3b8;font-size:20px;cursor:pointer;">×</button></div>
<form id="rt-fc-form" style="display:flex;flex-direction:column;gap:8px;">
<label style="font-size:10px;color:#94a3b8;">名前</label><input id="rt-fc-name" required style="padding:8px;border-radius:8px;border:1px solid #334155;background:#111827;color:#fff;" />
<label style="font-size:10px;color:#94a3b8;">URL</label><input id="rt-fc-url" type="url" required placeholder="https://..." style="padding:8px;border-radius:8px;border:1px solid #334155;background:#111827;color:#fff;" />
<label style="font-size:10px;color:#94a3b8;">repository（optional）</label><input id="rt-fc-repo" style="padding:8px;border-radius:8px;border:1px solid #334155;background:#111827;color:#fff;" />
<button type="submit" style="margin-top:4px;padding:10px;border:none;border-radius:8px;background:#0284c7;color:#fff;font-weight:700;cursor:pointer;">追加</button>
</form>
<div style="margin-top:14px;font-size:11px;font-weight:700;color:#67e8f9;">追加済みシステム</div>
<div id="rt-fc-list" style="margin-top:8px;display:flex;flex-direction:column;gap:8px;"></div>
</div></div>
<script>
(function(){
  var SK=${JSON.stringify(storageKey)};
  var MK=${JSON.stringify(memoryKey)};
  var RK=${JSON.stringify(releasedMemoryKey)};
  var PATTERNS=${patterns};
  var SEED=${seed};
  var openBtn=document.getElementById('rt-fc-open');
  var dlg=document.getElementById('rt-fc-dialog');
  var backdrop=document.getElementById('rt-fc-backdrop');
  var closeBtn=document.getElementById('rt-fc-close');
  var form=document.getElementById('rt-fc-form');
  var listEl=document.getElementById('rt-fc-list');
  function load(k,fallback){try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(fallback||[]));}catch(e){return fallback||[];}}
  function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  function loadSystems(){return load(SK,[]);} 
  function saveSystems(items){save(SK,items);} 
  function urlOk(u){try{var x=new URL(u);if(x.protocol!=='https:'&&x.protocol!=='http:')return false;var h=(x.hostname+x.pathname).toLowerCase();if(h.indexOf('localhost')>=0||/^\\d+\\.\\d+\\.\\d+\\.\\d+/.test(x.hostname))return true;return PATTERNS.some(function(p){return h.indexOf(String(p).toLowerCase())>=0;});}catch(e){return false;}}
  function show(on){dlg.hidden=!on;backdrop.hidden=!on;}
  function sameSystem(a,b){return String(a.url||'')===String(b.url||'')||String(a.repository||'')&&String(a.repository||'')===String(b.repository||'')||String(a.name||'')===String(b.name||'');}
  function releaseSystemMemory(system){
    var memory=load(MK,{});
    var released=load(RK,[]);
    var snapshot={system:system,releasedAt:new Date().toISOString(),memoryBeforeRelease:memory};
    released.push(snapshot);
    save(RK,released);
    if(memory&&typeof memory==='object'){
      if(Array.isArray(memory.selfSystems)){memory.selfSystems=memory.selfSystems.filter(function(x){return !sameSystem(x,system);});}
      if(memory.systemMemory&&typeof memory.systemMemory==='object'){
        Object.keys(memory.systemMemory).forEach(function(k){if(k===system.name||k===system.url||k===system.repository){delete memory.systemMemory[k];}});
      }
      memory.updatedAt=new Date().toISOString();
      memory.lastRelease={name:system.name,url:system.url,repository:system.repository,releasedAt:new Date().toISOString()};
      save(MK,memory);
    }
  }
  function deleteSystem(idx){
    var items=loadSystems();
    var system=items[idx];
    if(!system)return;
    var release=confirm('「'+(system.name||'このシステム')+'」を削除します。関連するRuntime内部記憶も解放しますか？\n\nOK: カードと内部記憶を解放\nキャンセル: カードだけ削除して内部記憶は保持');
    items.splice(idx,1);
    saveSystems(items);
    if(release)releaseSystemMemory(system);
    render();
  }
  openBtn.addEventListener('click',function(){show(true);render();});
  closeBtn.addEventListener('click',function(){show(false);});
  backdrop.addEventListener('click',function(){show(false);});
  function render(){
    var items=loadSystems();
    if(!items.length&&SEED.length){items=SEED.slice();saveSystems(items);}
    listEl.innerHTML='';
    if(!items.length){listEl.innerHTML='<div style="font-size:11px;color:#64748b;">なし</div>';return;}
    items.forEach(function(it,idx){
      var row=document.createElement('div');
      row.style.cssText='padding:10px;background:#111827;border:1px solid #334155;border-radius:8px;font-size:11px;';
      var name=document.createElement('div');name.style.fontWeight='900';name.textContent=it.name||'—';
      var url=document.createElement('div');url.style.color='#67e8f9';url.style.marginTop='4px';url.style.wordBreak='break-all';url.textContent=it.url||'';
      var repo=document.createElement('div');repo.style.color='#94a3b8';repo.style.marginTop='2px';repo.textContent=it.repository?('repository: '+it.repository):'';
      var actions=document.createElement('div');actions.style.marginTop='8px';actions.style.display='flex';actions.style.gap='8px';
      var go=document.createElement('a');go.href=it.url;go.textContent='開く';go.style.cssText='text-decoration:none;color:#fff;background:#0284c7;padding:4px 10px;border-radius:6px;font-weight:700;';
      var del=document.createElement('button');del.type='button';del.textContent='削除';del.style.cssText='background:transparent;border:1px solid #ef4444;color:#ef4444;padding:4px 10px;border-radius:6px;cursor:pointer;';
      del.addEventListener('click',function(){deleteSystem(idx);});
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
    var items=loadSystems();items.push({name:name,url:url,repository:repository||undefined});
    saveSystems(items);form.reset();render();
  });
})();
</script>`;
}
