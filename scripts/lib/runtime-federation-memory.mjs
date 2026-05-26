export const RUNTIME_MEMORY_STORAGE_KEYS = {
  systems: 'runtimeFederationConnectSystems',
  drafts: 'runtimeDraftCards',
  memory: 'runtimeFederationMemory',
};

export const RUNTIME_MEMORY_SCOPE = {
  runtimeTop: '/d/sa8ljn4/runtime',
  layers: [
    {
      id: 'self-systems',
      label: '自システム',
      responsibility: '自分が担当する Runtime / 小システム / Excel / URL を保持する',
      storageKey: RUNTIME_MEMORY_STORAGE_KEYS.systems,
    },
    {
      id: 'intake',
      label: '入力統合',
      responsibility: 'Need / KPI / Drift / 外部入力を統合し分類する',
    },
    {
      id: 'intent',
      label: '意図整理',
      responsibility: '自然言語要求を運行意味・KPI・Constraintへ変換する',
    },
    {
      id: 'responsibility',
      label: '責務解析',
      responsibility: '責務境界・依存・同期範囲を解析する',
    },
    {
      id: 'sync-refactor',
      label: '同期改修',
      responsibility: 'Federation 対応改修と Runtime 同期実行を扱う',
    },
    {
      id: 'runtime-drafts',
      label: 'Runtimeカード',
      responsibility: 'Runtime Draft / Knowledge / Document の生成カードを保持する',
      storageKey: RUNTIME_MEMORY_STORAGE_KEYS.drafts,
    },
  ],
  globalSignals: [
    'Queue',
    'ODD',
    'Constraint',
    'ETA',
    'Dispatch',
    'Fleet',
    'Energy',
    'Node',
    'PL',
    'IRR',
    'WBS',
  ],
};

export function runtimeMemoryPanelHtml() {
  return `<div id="rt-memory" style="width:100%;height:100%;box-sizing:border-box;padding:10px 12px;background:linear-gradient(180deg,#0b1220,#02060c);border:1px solid rgba(56,189,248,.28);border-radius:12px;color:#fff;font-family:system-ui,sans-serif;overflow:hidden;">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;height:22px;">
    <div style="font-size:12px;font-weight:900;color:#67e8f9;letter-spacing:.12em;">Runtime全体記憶</div>
    <button type="button" id="rt-memory-refresh" style="border:1px solid rgba(56,189,248,.45);background:#0f172a;color:#67e8f9;border-radius:7px;padding:3px 8px;font-size:10px;font-weight:800;cursor:pointer;">再読込</button>
  </div>
  <div id="rt-memory-summary" style="margin-top:8px;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;font-size:10px;"></div>
  <div style="margin-top:8px;font-size:10px;color:#94a3b8;line-height:1.45;">入力統合・意図整理・責務解析・同期改修・検証は、このRuntime全体記憶を参照する。</div>
</div>
<script>
(function(){
  var KEYS={systems:'runtimeFederationConnectSystems',drafts:'runtimeDraftCards',memory:'runtimeFederationMemory'};
  var summary=document.getElementById('rt-memory-summary');
  var refresh=document.getElementById('rt-memory-refresh');
  function load(k){try{return JSON.parse(localStorage.getItem(k)||'[]');}catch(e){return[];}}
  function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  function rebuild(){
    var systems=load(KEYS.systems);
    var drafts=load(KEYS.drafts);
    var memory={
      updatedAt:new Date().toISOString(),
      selfSystems:systems,
      runtimeDrafts:drafts,
      counts:{systems:systems.length,drafts:drafts.length},
      scope:['自システム','連携探索','ニーズ翻訳','関係整理','同期改修','Runtimeカード'],
      signals:['Queue','ODD','Constraint','ETA','Dispatch','Fleet','Energy','Node','PL','IRR','WBS']
    };
    save(KEYS.memory,memory);
    summary.innerHTML='';
    [
      ['自システム',systems.length,'#3b82f6'],
      ['Runtimeカード',drafts.length,'#fbbf24'],
      ['入力統合','全体参照','#22c55e'],
      ['同期改修','全体参照','#a78bfa']
    ].forEach(function(x){
      var d=document.createElement('div');
      d.style.cssText='padding:7px 6px;border-radius:8px;background:#111827;border-left:3px solid '+x[2]+';min-width:0;';
      d.innerHTML='<div style="color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+x[0]+'</div><div style="font-size:14px;font-weight:900;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+x[1]+'</div>';
      summary.appendChild(d);
    });
  }
  refresh.addEventListener('click',rebuild);
  rebuild();
})();
</script>`;
}
