/* ---------- automatikus mentés és teljes projektfájl ----------
   1) Minden módosítás azonnal a készülékre mentődik; ha az app háttérbe kerül vagy bezárják, a függő mentés is lezárul.
   2) Percenként (ha változott valami) biztonsági pillanatkép készül egy külön adatbázisba; az utolsó 30 megmarad,
      és a Terv → Fájl → Automatikus mentések részen bármelyik visszaállítható.
   3) „Projekt exportálása”: egyetlen fájl (.aperation.json) a teljes tervvel, a forgatókönyv-jelölésekkel, a képekkel
      és a nap állásával; bármelyik APERATION-ben visszatölthető (Fájl → betöltés, vagy ráhúzva). */
const BK_MAX=30;
const bkdb=(()=>{let o;const open=()=>o=o||new Promise((res,rej)=>{const r=indexedDB.open("aperation-backup",1);
    r.onupgradeneeded=()=>r.result.createObjectStore("snap",{keyPath:"ts"});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
  const tx=(m,f)=>open().then(db=>new Promise((res,rej)=>{const t=db.transaction("snap",m),q=f(t.objectStore("snap"));t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error)}));
  return{put:v=>tx("readwrite",s=>s.put(v)),all:()=>tx("readonly",s=>s.getAll()),del:k=>tx("readwrite",s=>s.delete(k))}})();
let bkSig="",lastSaved=0;
function savedMark(){lastSaved=Date.now();const el=$("#savedind");if(el)el.innerHTML=savedText()}
const savedText=()=>lastSaved?`${ic("check",13)}Mentve ${new Date(lastSaved).toLocaleTimeString("hu-HU",{hour:"2-digit",minute:"2-digit"})}`:"";
async function backupNow(reason){
  if(tour||!P||(!P.blocks.length&&!P.title))return;
  const pj=JSON.stringify(P),sj=JSON.stringify({...st,sim:fresh().sim,sw:null}),sig=pj.length+":"+pj+sj;
  if(sig===bkSig)return;bkSig=sig;
  try{await bkdb.put({ts:Date.now(),title:P.title||"Névtelen projekt",n:P.blocks.length,reason:reason||"",P:pj,st:sj});
    const all=(await bkdb.all()).sort((a,b)=>b.ts-a.ts);for(const x of all.slice(BK_MAX))await bkdb.del(x.ts)}catch(e){}
}
function flushSave(){if(cTimer){clearTimeout(cTimer);cTimer=null;commit()}else saveP();save()}
setInterval(()=>backupNow("percenként"),60000);
setTimeout(()=>backupNow("indulás"),4000);
addEventListener("pagehide",()=>{flushSave();backupNow("bezárás")});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"){flushSave();backupNow("háttérbe")}});
addEventListener("beforeunload",()=>flushSave());
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{})}catch(e){}

async function backupListFill(){
  const box=$("#bklist");if(!box)return;
  let all=[];try{all=(await bkdb.all()).sort((a,b)=>b.ts-a.ts)}catch(e){}
  if(!all.length){box.innerHTML=`<p class="muted small">Még nincs pillanatkép. Az app percenként készít egyet, ha változott valami.</p>`;return}
  const fmt=ts=>new Date(ts).toLocaleString("hu-HU",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
  box.innerHTML=`<div class="rows">${all.slice(0,12).map(x=>`<div class="row" style="grid-template-columns:minmax(0,1fr) auto"><div><b>${esc(x.title)}</b><small>${fmt(x.ts)} · ${x.n} blokk</small></div>
    <button type="button" class="btn sm" data-bkrestore="${x.ts}">Visszaállítás</button></div>`).join("")}</div>
    ${all.length>12?`<p class="muted small">További ${all.length-12} régebbi pillanatkép is megvan.</p>`:""}`;
}
async function backupRestore(ts,btn){
  if(MP.on&&isMember())return;
  if(!sure(btn,"Biztos? Koppints újra"))return;
  let x=null;try{x=(await bkdb.all()).find(s=>s.ts===+ts)}catch(e){}
  if(!x){toast("Ezt a pillanatképet nem találom.",{tone:"late"});return}
  archiveCurrent();
  P=normP(JSON.parse(x.P));saveP();const snd=st.sound;st=Object.assign(fresh(),JSON.parse(x.st||"{}"));st.sound=snd;st.sim=fresh().sim;save();
  applyProject();loadImgs();lastHero=null;tabKey="";location.hash="#most";renderAll();
  toast("Visszaállítva: "+new Date(x.ts).toLocaleTimeString("hu-HU",{hour:"2-digit",minute:"2-digit"})+" állapot. Az előző a Projektek közé került.",{tone:"ok"});
}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-bkrestore]");if(b)backupRestore(b.dataset.bkrestore,b)});

/* teljes projektfájl */
const blobToURL=bl=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(bl)});
async function urlToBlob(u){return(await fetch(u)).blob()}
function projFileName(){const t=(P.title||"projekt").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^A-Za-z0-9]+/g,"_").replace(/^_|_$/g,"").slice(0,40)||"projekt";
  return`${t}${P.date?"_"+P.date:""}.aperation.json`}
async function exportProjectFile(){
  flushSave();
  const images={};
  for(const b of [...P.blocks,...P.groups,...P.shots])for(const x of b.images||[])if(x.idb&&!images[x.idb]){try{const bl=await idb.get(x.idb);if(bl)images[x.idb]=await blobToURL(bl)}catch(e){}}
  const data={app:"APERATION",kind:"projekt",version:1,saved:new Date().toISOString(),project:P,state:{...st,sim:fresh().sim,sw:null},images};
  await saveFile(projFileName(),new Blob([JSON.stringify(data)],{type:"application/json"}),"application/json");
}
function readProjectFile(obj,name){
  if(obj&&obj.app==="APERATION"&&obj.project){const p=normP(obj.project);p._state=obj.state||null;p._images=obj.images||{};p.src=name;p._full=true;p._warn=[];return p}
  const p=normP(obj);p._warn=[];p.src=name;return p;
}
async function applyProjectFileExtras(p){
  const imgs=p._images||{};
  for(const [k,u] of Object.entries(imgs)){try{const bl=await urlToBlob(u);await idb.put(k,bl);IMG[k]=URL.createObjectURL(bl)}catch(e){}}
  if(p._state){const snd=st.sound;st=Object.assign(fresh(),p._state);st.sound=snd;st.sim=fresh().sim;save()}
  applyProject();lastHero=null;renderAll();
}
function exportCard(){
  return`<section class="card"><div class="card-head"><h2>Teljes mentés egy fájlba</h2><span class="chip neutral" id="savedind">${savedText()}</span></div>
    <p class="muted small">Ha kész a terv, mentsd el egyetlen fájlba: benne van <b>minden</b> (időrend, emberek, fények, forgatókönyv a jelölésekkel, képek, a nap állása). Bármelyik üres APERATION-ben visszatölthető: Fájl → betöltés, vagy húzd rá.</p>
    <div class="wgrid"><button class="btn solid" type="button" data-do="projexport" ${P.blocks.length||P.title?"":"disabled"}>${ic("down",16)}Projekt exportálása</button></div></section>
    <section class="card"><h2>Automatikus mentések</h2><p class="muted small">Minden módosítás azonnal mentődik ezen az eszközön. Emellett az app percenként biztonsági pillanatképet készít (az utolsó ${BK_MAX} megmarad), ha valami mégis elveszne.</p>
    <div id="bklist"><p class="muted small">Betöltés…</p></div></section>`;
}
