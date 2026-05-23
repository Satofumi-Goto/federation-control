/** Runtime Draft Create HTML panel (+ window, localStorage draft cards). */

export function runtimeDraftPanelHtml(routes) {
  const draft = routes.runtimeDraft ?? {};
  const storageKey = draft.storageKey ?? 'runtimeDraftCards';
  const seed = JSON.stringify(draft.seedDrafts ?? []);

  return `<div id="rt-draft-root" style="width:100%;height:100%;min-height:0;display:flex;align-items:center;justify-content:center;box-sizing:border-box;">
<button type="button" id="rt-draft-open" title="Runtime Draft Create" style="width:100%;height:100%;min-height:48px;border:1px dashed rgba(251,191,36,.55);border-radius:10px;background:#111827;color:#fbbf24;font-size:28px;font-weight:900;cursor:pointer;line-height:1;">＋</button>
<div id="rt-draft-backdrop" hidden style="position:fixed;inset:0;background:rgba(2,6,12,.72);z-index:9998;"></div>
<div id="rt-draft-dialog" hidden style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(520px,92vw);max-height:84vh;overflow:auto;z-index:9999;background:#0b1220;border:1px solid rgba(251,191,36,.45);border-radius:14px;padding:16px;color:#fff;box-sizing:border-box;font-family:system-ui,sans-serif;">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><div style="font-size:16px;font-weight:900;">Runtime Draft Create</div><button type="button" id="rt-draft-close" style="background:transparent;border:none;color:#94a3b8;font-size:20px;cursor:pointer;">×</button></div>
<form id="rt-draft-form" style="display:flex;flex-direction:column;gap:8px;">
<label style="font-size:10px;color:#94a3b8;">タイトル名</label><input id="rt-draft-title" required style="padding:8px;border-radius:8px;border:1px solid #334155;background:#111827;color:#fff;" />
<label style="font-size:10px;color:#94a3b8;">何を作りたい？</label><textarea id="rt-draft-prompt" required rows="7" placeholder="例: Queue崩壊制御のPLとODD関係を整理したい" style="padding:10px;border-radius:8px;border:1px solid #334155;background:#111827;color:#fff;resize:vertical;"></textarea>
<button type="submit" style="margin-top:4px;padding:10px;border:none;border-radius:8px;background:#ca8a04;color:#111827;font-weight:900;cursor:pointer;">作成</button>
</form>
<div style="margin-top:14px;font-size:11px;font-weight:700;color:#fbbf24;">作成済みカード</div>
<div id="rt-draft-list" style="margin-top:8px;display:flex;flex-direction:column;gap:8px;"></div>
</div></div>
<script>
(function(){
  var SK=${JSON.stringify(storageKey)};
  var SEED=${seed};
  var openBtn=document.getElementById('rt-draft-open');
  var dlg=document.getElementById('rt-draft-dialog');
  var backdrop=document.getElementById('rt-draft-backdrop');
  var closeBtn=document.getElementById('rt-draft-close');
  var form=document.getElementById('rt-draft-form');
  var listEl=document.getElementById('rt-draft-list');
  function load(){try{return JSON.parse(localStorage.getItem(SK)||'[]');}catch(e){return[];}}
  function save(items){try{localStorage.setItem(SK,JSON.stringify(items));}catch(e){}}
  function slug(s){return String(s||'draft').toLowerCase().replace(/[^a-z0-9一-龥ぁ-んァ-ンー]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48)||'draft';}
  function show(on){dlg.hidden=!on;backdrop.hidden=!on;}
  openBtn.addEventListener('click',function(){show(true);render();});
  closeBtn.addEventListener('click',function(){show(false);});
  backdrop.addEventListener('click',function(){show(false);});
  function detailUrl(it){return '/d/sa8ljn4/runtime?runtimeDraft='+encodeURIComponent(it.id||slug(it.title));}
  function render(){
    var items=load();
    if(!items.length&&SEED.length){items=SEED.slice();save(items);}
    listEl.innerHTML='';
    if(!items.length){listEl.innerHTML='<div style="font-size:11px;color:#64748b;">なし</div>';return;}
    items.forEach(function(it,idx){
      var row=document.createElement('div');
      row.style.cssText='padding:10px;background:#111827;border:1px solid #334155;border-radius:8px;font-size:11px;';
      var name=document.createElement('div');name.style.fontWeight='900';name.textContent=it.title||'—';
      var prompt=document.createElement('div');prompt.style.color='#94a3b8';prompt.style.marginTop='4px';prompt.style.wordBreak='break-word';prompt.textContent=it.prompt||'';
      var actions=document.createElement('div');actions.style.marginTop='8px';actions.style.display='flex';actions.style.gap='8px';
      var go=document.createElement('a');go.href=detailUrl(it);go.textContent='開く';go.style.cssText='text-decoration:none;color:#111827;background:#fbbf24;padding:4px 10px;border-radius:6px;font-weight:900;';
      var del=document.createElement('button');del.type='button';del.textContent='削除';del.style.cssText='background:transparent;border:1px solid #ef4444;color:#ef4444;padding:4px 10px;border-radius:6px;cursor:pointer;';
      del.addEventListener('click',function(){var n=load();n.splice(idx,1);save(n);render();});
      actions.appendChild(go);actions.appendChild(del);
      row.appendChild(name);row.appendChild(prompt);row.appendChild(actions);
      listEl.appendChild(row);
    });
  }
  form.addEventListener('submit',function(ev){
    ev.preventDefault();
    var title=document.getElementById('rt-draft-title').value.trim();
    var prompt=document.getElementById('rt-draft-prompt').value.trim();
    if(!title||!prompt){alert('タイトル名と何を作りたいかを入力してください');return;}
    var items=load();
    var id=slug(title)+'-'+Date.now().toString(36);
    items.push({id:id,title:title,prompt:prompt,createdAt:new Date().toISOString()});
    save(items);form.reset();render();show(false);window.location.href=detailUrl({id:id,title:title});
  });
})();
</script>`;
}

export function runtimeDraftCardsPanelHtml(routes) {
  const draft = routes.runtimeDraft ?? {};
  const storageKey = draft.storageKey ?? 'runtimeDraftCards';
  const seed = JSON.stringify(draft.seedDrafts ?? []);

  return `<div id="rt-draft-cards" style="width:100%;height:100%;display:flex;gap:8px;align-items:stretch;box-sizing:border-box;overflow:hidden;"></div>
<script>
(function(){
  var SK=${JSON.stringify(storageKey)};
  var SEED=${seed};
  var root=document.getElementById('rt-draft-cards');
  function load(){try{return JSON.parse(localStorage.getItem(SK)||'[]');}catch(e){return[];}}
  function save(items){try{localStorage.setItem(SK,JSON.stringify(items));}catch(e){}}
  function detailUrl(it){return '/d/sa8ljn4/runtime?runtimeDraft='+encodeURIComponent(it.id||it.title||'draft');}
  var items=load();if(!items.length&&SEED.length){items=SEED.slice();save(items);}root.innerHTML='';
  if(!items.length){root.innerHTML='<div style="display:flex;align-items:center;height:100%;font-size:11px;color:#64748b;">作成済みカードなし</div>';return;}
  items.slice(-5).forEach(function(it){
    var a=document.createElement('a');a.href=detailUrl(it);a.textContent=it.title||'—';
    a.style.cssText='flex:1;min-width:0;display:flex;align-items:center;justify-content:center;text-decoration:none;background:#0f172a;border:1px solid rgba(251,191,36,.35);border-bottom:3px solid #fbbf24;border-radius:10px;color:#fff;font-size:13px;font-weight:900;padding:8px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    root.appendChild(a);
  });
})();
</script>`;
}

export function runtimeDraftDetailPanelHtml() {
  return `<div id="rt-draft-detail" style="width:100%;height:100%;box-sizing:border-box;padding:16px;background:#0b1220;border:1px solid rgba(251,191,36,.35);border-radius:12px;color:#fff;font-family:system-ui,sans-serif;overflow:auto;">
<div id="rt-draft-title" style="font-size:24px;font-weight:900;margin-bottom:8px;">Runtime Draft</div>
<div id="rt-draft-prompt" style="font-size:13px;color:#cbd5e1;line-height:1.6;margin-bottom:16px;"></div>
<div style="display:flex;gap:10px;margin-bottom:16px;">
<button type="button" id="rt-draft-knowledge" style="padding:10px 14px;border:none;border-radius:8px;background:#0284c7;color:#fff;font-weight:900;cursor:pointer;">ナレッジに出力</button>
<button type="button" id="rt-draft-doc" style="padding:10px 14px;border:none;border-radius:8px;background:#fbbf24;color:#111827;font-weight:900;cursor:pointer;">ドキュメントを出力</button>
<a href="/d/sa8ljn4/runtime" style="padding:10px 14px;border:1px solid #334155;border-radius:8px;color:#cbd5e1;text-decoration:none;font-weight:700;">← Runtime</a>
</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;font-size:12px;">
<div style="padding:12px;border-radius:10px;background:#111827;border:1px solid #334155;"><b>Runtime構造</b><br><span style="color:#94a3b8;">生成対象の骨子</span></div>
<div style="padding:12px;border-radius:10px;background:#111827;border:1px solid #334155;"><b>Federation観点</b><br><span style="color:#94a3b8;">Queue / ODD / Constraint</span></div>
<div style="padding:12px;border-radius:10px;background:#111827;border:1px solid #334155;"><b>出力</b><br><span style="color:#94a3b8;">Knowledge / Document</span></div>
</div>
</div>
<script>
(function(){
  var SK='runtimeDraftCards';
  var qs=new URLSearchParams(location.search);var id=qs.get('runtimeDraft');
  function load(){try{return JSON.parse(localStorage.getItem(SK)||'[]');}catch(e){return[];}}
  var item=load().find(function(x){return String(x.id)===String(id);});
  document.getElementById('rt-draft-title').textContent=item?item.title:'Runtime Draft';
  document.getElementById('rt-draft-prompt').textContent=item?item.prompt:'Runtime Draft card が選択されていません。';
  document.getElementById('rt-draft-knowledge').addEventListener('click',function(){alert('ナレッジ出力キューへ追加しました');});
  document.getElementById('rt-draft-doc').addEventListener('click',function(){alert('ドキュメント出力キューへ追加しました');});
})();
</script>`;
}
