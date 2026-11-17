/* ---------- közös munka (multiplayer, Firebase) ----------
   A projekt létrehozója (admin) pozíciókat oszt ki: mindegyikhez tartozik egy belépőkód és egy láthatósági beállítás.
   A szerver minden pozíciónak külön, már megszűrt tervet ad (views/{pozíció}), így a rejtett adat el sem jut a telefonra.
   A nap állását (live/state) mindenki látja, de csak a „Vezérlés” jogú pozíciók írhatják. Szabályok: firebase/firestore.rules. */
const FBCFG=/*__FBCFG__*/null;
const FB_SRC=/*__FBSRC__*/null;
const FB_EMU=/^(localhost|127\.)/.test(location.hostname)&&/[?&]emu\b/.test(location.search);
const FBC=FB_EMU?{apiKey:"demo-key",projectId:"demo-diszpo",authDomain:"localhost"}:FBCFG;
const MP_AVAIL=!!(FB_SRC&&FBC);
const PAGES_URL="https://xdkoky.github.io/APERATION/base/";
const MPKEY="diszpo-app-multi-v1",LOCALP="diszpo-app-project-local",LOCALS="diszpo-app-state-local";
const LIVEKEYS=["cur","act","skip","ext","checkin","rnote"];
const PERMS=[["most","Most"],["idorend","Időrend"],["szkript","Forgatókönyv"],["stab","Stáb"],["phones","Telefonszámok"],["images","Képek"],["props","Kellékek"],["notes","Megjegyzések"],["lights","Fények"],["takes","Take-napló"],["control","Vezérlés"]];
const PERM_HELP={most:"a Most nézet",idorend:"a napi időrend",szkript:"a forgatókönyv szövege és a sztori",stab:"a stáblista",phones:"a telefonszámok",images:"storyboard és vilkó",props:"kellékek, kontinuitás",notes:"megjegyzések, fontos tudnivalók",lights:"a fények leírása",takes:"take stopper, jó take csillag, jegyzet minden take-hez (a napot nem vezérli)",control:"Kész, Vissza, +5′, take, érkezés"};
const permOf=s=>Object.fromEntries(PERMS.map(([k])=>[k,s.split(" ").includes(k)]));
const ALLPERM=permOf(PERMS.map(p=>p[0]).join(" "));
const PRESETS=[["Rendező","most idorend szkript stab phones images props notes lights"],
  ["1st AD","most idorend szkript stab phones images props notes lights takes control"],["2nd AD","most idorend szkript stab phones images props notes lights takes control"],
  ["Szkriptes","most idorend szkript stab images props notes takes"],["Stáb (általános)","most idorend stab notes"]];
const RAND=(n,al="ABCDEFGHJKLMNPQRSTUVWXYZ23456789")=>{const a=new Uint32Array(n);crypto.getRandomValues(a);return[...a].map(x=>al[x%al.length]).join("")};
const RID=n=>RAND(n,"abcdefghijkmnpqrstuvwxyz23456789");
const JOINKEY="aperation-join";
const inviteURL=c=>PAGES_URL+"?join="+fmtCode(c);
(()=>{const m=location.search.match(/[?&]join=([A-Za-z0-9-]{8,9})/);if(!m)return;
  try{localStorage.setItem(JOINKEY,m[1].toUpperCase().replace(/[^A-Z0-9]/g,""))}catch(e){}
  try{const q=location.search.replace(/([?&])join=[^&]*&?/,"$1").replace(/[?&]$/,"");history.replaceState(null,"",location.pathname+q+location.hash)}catch(e){}})();
const pendingJoin=()=>{try{return localStorage.getItem(JOINKEY)||""}catch(e){return""}};
async function mpInvite(code,role){
  const url=inviteURL(code),text=`Meghívó${P.title?` a(z) „${P.title}” diszpóhoz`:" egy közös diszpóhoz"} (APERATION, ${role}). Kód: ${fmtCode(code)}`;
  if(navigator.share){try{await navigator.share({title:"APERATION meghívó",text,url});return}catch(e){if(e&&e.name==="AbortError")return}}
  copyText(text+"\n"+url);
}
const fmtCode=c=>c?c.slice(0,4)+"-"+c.slice(4):"";
const normCode=c=>String(c||"").toUpperCase().replace(/[^A-Z0-9]/g,"");

let MP={on:false};
try{MP=Object.assign({on:false},JSON.parse(localStorage.getItem(MPKEY)||"null")||{})}catch(e){}
MP.ready=false;MP.roles=[];MP.members=[];MP.lastPub=0;MP.lastPush=0;MP.liveTs=0;
const mpSaveLocal=()=>{if(typeof PV!=="undefined"&&PV)return;try{const {on,mode,pid,roleId,code,name,perm,roleName,title}=MP;localStorage.setItem(MPKEY,JSON.stringify({on,mode,pid,roleId,code,name,perm,roleName,title}))}catch(e){}};
const isMember=()=>MP.on&&MP.mode==="member";
const isMpAdmin=()=>MP.on&&MP.mode==="admin";
const canCtl=()=>!MP.on||MP.mode==="admin"||!!(MP.perm&&MP.perm.control);
const RO=()=>!canCtl();
/* take-napló: a szkriptes vezérlés nélkül is mérhet, csillagozhat, jegyzetelhet */
const canTake=()=>canCtl()||!!(MP.perm&&MP.perm.takes);
let mpApplying=false;

/* Firebase betöltése (helyi fájlokból, offline gyorsítótárral) */
let fbP=null,fdb=null,fauth=null,UID=null;
function needFB(){if(window.firebase&&firebase.firestore)return Promise.resolve();
  return fbP=fbP||FB_SRC.reduce((pr,src)=>pr.then(()=>new Promise((res,rej)=>{const s=document.createElement("script");s.src=src;s.onload=res;s.onerror=()=>{fbP=null;rej(new Error("fb"))};document.head.append(s)})),Promise.resolve())}
async function fbInit(){
  if(!MP_AVAIL)throw new Error("na");
  await needFB();
  if(!fdb){firebase.initializeApp(FBC);fauth=firebase.auth();fdb=firebase.firestore();
    if(FB_EMU){fauth.useEmulator("http://127.0.0.1:9099");fdb.useEmulator("127.0.0.1",8080)}
    try{await fdb.enablePersistence({synchronizeTabs:true})}catch(e){}}
  if(!fauth.currentUser){await new Promise(r=>{const u=fauth.onAuthStateChanged(()=>{u();r()})});if(!fauth.currentUser)await fauth.signInAnonymously()}
  UID=fauth.currentUser.uid;
}
const pref=()=>fdb.collection("projects").doc(MP.pid);
let mpErrShown=0;
function mpErr(e){console.warn("közös munka:",e);const c=e&&e.code||"";
  if(Date.now()-mpErrShown<15000)return;mpErrShown=Date.now();
  toast(c==="permission-denied"?"Ehhez nincs jogod a közös projektben.":"A közös szerver most nem érhető el. Ami itt történik, mentődik, és később szinkronizál.",{tone:"warn"})}

/* képek megosztása: a telefonról feltöltött képek (storyboard, vilkó) a közös projektben a Firestore-ba kerülnek,
   kisebbítve, darabolva (imgmeta/{kulcs}: {n, mime}, imgdata/{kulcs}__{i}: {d}), és a többiek letöltik a saját készülékükre. */
const IMGCH=700000;
const imgKeys=p=>{const s=new Set();for(const b of [...(p.blocks||[]),...(p.groups||[]),...(p.shots||[])])for(const x of b.images||[])if(x.idb)s.add(x.idb);return[...s]};
const blobB64=bl=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(",")[1]||"");r.onerror=rej;r.readAsDataURL(bl)});
const b64Blob=(d,mime)=>{const s=atob(d),a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return new Blob([a],{type:mime||"image/jpeg"})};
async function shrinkShare(bl){
  try{const bm=await createImageBitmap(bl),k=Math.min(1,1600/Math.max(bm.width,bm.height));if(k>=1&&bl.size<450000)return bl;
    const c=document.createElement("canvas");c.width=Math.round(bm.width*k);c.height=Math.round(bm.height*k);const g=c.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,c.width,c.height);g.drawImage(bm,0,0,c.width,c.height);
    return await new Promise(r=>c.toBlob(b=>r(b||bl),"image/jpeg",.8))}catch(e){return bl}}
let upBusy=false,upAgain=false;const imgFetching=new Set();
/* takarítás: a képek a közös szerveren az utolsó használat után 30 nappal törlődnek.
   Amíg egy kép benne van a tervben, a szerkesztő appja naponta egyszer meghosszabbítja (expireAt).
   A törlést a Firestore TTL-szabálya végzi (imgmeta, imgdata · expireAt); ha az nincs beállítva,
   a szerkesztő appja is kitakarítja a lejártakat, amikor megnyitja a projektet. */
const IMG_TTL=30*864e5,IMG_REFRESH=864e5;
const expAt=()=>firebase.firestore.Timestamp.fromMillis(Date.now()+IMG_TTL);
async function mpUploadImgs(){
  if(!fdb||!isMpAdmin()||!MP.ready||PV)return;if(upBusy){upAgain=true;return}upBusy=true;
  const KEY="aperation-mp-up2-"+MP.pid;let done={};try{done=JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch(e){}
  const now=Date.now(),col=n=>pref().collection(n);
  try{for(const k of imgKeys(P)){if(done[k]&&now-done[k]<IMG_REFRESH)continue;
      const meta=col("imgmeta").doc(k),ex=await meta.get().catch(()=>null);
      if(ex&&ex.exists){ // megvan: lejárat meghosszabbítása
        const n=ex.data().n||1,b=fdb.batch(),e=expAt();b.update(meta,{expireAt:e});for(let i=0;i<n;i++)b.update(col("imgdata").doc(k+"__"+i),{expireAt:e});await b.commit().catch(()=>{});
      }else{const bl=await idb.get(k);if(!bl)continue;
        const sm=await shrinkShare(bl),d=await blobB64(sm),n=Math.ceil(d.length/IMGCH),e=expAt();
        for(let i=0;i<n;i++)await col("imgdata").doc(k+"__"+i).set({d:d.slice(i*IMGCH,(i+1)*IMGCH),expireAt:e});
        await meta.set({n,mime:sm.type||"image/jpeg",ts:now,by:UID,expireAt:e})}
      done[k]=now;try{localStorage.setItem(KEY,J(done))}catch(e){}}
    await mpImgCleanup();
  }catch(e){if(e&&e.code==="permission-denied")mpErr(e);else console.warn("képfeltöltés:",e)}
  upBusy=false;if(upAgain){upAgain=false;mpUploadImgs()}
}
async function mpImgCleanup(){
  const KEY="aperation-mp-clean-"+MP.pid,last=+(localStorage.getItem(KEY)||0);if(Date.now()-last<IMG_REFRESH)return;
  const q=await pref().collection("imgmeta").where("expireAt","<",firebase.firestore.Timestamp.now()).limit(50).get();
  for(const d of q.docs){const n=d.data().n||1;for(let i=0;i<n;i++)await pref().collection("imgdata").doc(d.id+"__"+i).delete().catch(()=>{});await d.ref.delete().catch(()=>{})}
  try{localStorage.setItem(KEY,String(Date.now()))}catch(e){}
}
async function mpFetchImgs(){
  if(!fdb||!MP.on||!MP.pid||PV)return;let n=0;
  for(const k of imgKeys(P)){if(IMG[k]||imgFetching.has(k))continue;imgFetching.add(k);
    try{let bl=await idb.get(k);
      if(!bl){const m=await pref().collection("imgmeta").doc(k).get();
        if(m.exists){const {n:cnt,mime}=m.data();let d="";for(let i=0;i<cnt;i++){const c=await pref().collection("imgdata").doc(k+"__"+i).get();d+=c.exists?c.data().d:""}
          bl=b64Blob(d,mime);await idb.put(k,bl)}}
      if(bl){IMG[k]=URL.createObjectURL(bl);n++}}catch(e){if(e&&e.code!=="permission-denied")console.warn("képletöltés:",e)}
    imgFetching.delete(k)}
  if(n){applyProject();if(view==="terv"&&document.activeElement&&document.activeElement.closest('[data-view="terv"]')&&document.activeElement.matches("input,textarea,select"))needRender=true;else renderAll()}
}
/* szűrt terv egy pozíciónak */
function filterP(p,perm){
  const q=JSON.parse(JSON.stringify(p));
  q.blocks.forEach(b=>{b.images=perm.images?(b.images||[]).filter(x=>x.url||x.idb):[];if(!perm.props)b.props="";if(!perm.notes)b.note="";if(!perm.szkript)b.story=""});
  if(!perm.notes)q.notes=[];if(!perm.lights)q.groups=q.groups.map(g=>({...g,desc:""}));
  q.groups=q.groups.map(g=>({...g,images:perm.images&&perm.lights?(g.images||[]).filter(x=>x.url||x.idb):[]}));
  if(!perm.szkript)q.script=[];if(!perm.stab)q.crew=[];
  q.shots=(q.shots||[]).map(s=>({...s,images:perm.images?(s.images||[]).filter(x=>x.url||x.idb):[],props:perm.props?s.props:"",story:perm.szkript?s.story:"",note:perm.notes?s.note:""}));
  if(!perm.phones){q.cast.forEach(c=>c.phone="");q.crew.forEach(c=>c.phone="")}
  return q;
}
/* közös szerkesztés: háromutas összefésülés.
   base = a szerverrel utoljára egyeztetett terv, local = a mi tervünk, remote = ami most a szerveren van.
   Blokkok, shotok, emberek és fények elemenként (_id szerint) fésülődnek, mezőnként; ha ketten ugyanazt
   a mezőt írták át, a később mentő nyer. Így ketten egyszerre írhatják a diszpót. */
const J=JSON.stringify,jeq=(a,b)=>J(a)===J(b),isObj=x=>x&&typeof x==="object"&&!Array.isArray(x);
function merge3(b,l,r){
  if(jeq(l,r)||jeq(r,b))return l;if(jeq(l,b))return r;
  if(Array.isArray(l)&&Array.isArray(r)){
    const idd=a=>Array.isArray(a)&&a.every(x=>isObj(x)&&x._id);
    if(idd(l)&&idd(r)&&idd(b||[]))return mergeIds(b||[],l,r);
    if(Array.isArray(b)&&b.length===l.length&&l.length===r.length)return l.map((x,i)=>merge3(b[i],x,r[i]));
    return l;
  }
  if(isObj(l)&&isObj(r)){const o={},bb=isObj(b)?b:{};
    for(const k of new Set([...Object.keys(l),...Object.keys(r)])){
      if(!(k in l)&&(k in bb)&&jeq(bb[k],r[k]))continue;
      if(!(k in r)&&(k in bb)&&jeq(bb[k],l[k]))continue;
      o[k]=!(k in l)?r[k]:!(k in r)?l[k]:merge3(bb[k],l[k],r[k])}
    return o}
  return l;
}
function mergeIds(b,l,r){
  const M=a=>new Map(a.map(x=>[x._id,x])),Bm=M(b),Lm=M(l),Rm=M(r),ids=a=>a.map(x=>x._id);
  const pick=id=>{const iL=Lm.has(id),iR=Rm.has(id);
    if(iL&&iR)return merge3(Bm.get(id),Lm.get(id),Rm.get(id));
    if(!Bm.has(id))return iL?Lm.get(id):Rm.get(id);
    const x=iL?Lm.get(id):Rm.get(id);return jeq(x,Bm.get(id))?null:x}; // az egyik oldal törölte; ha a másik közben módosította, marad
  const both=id=>Bm.has(id)&&Lm.has(id)&&Rm.has(id);
  const moved=!jeq(ids(l).filter(both),ids(b).filter(both));
  const prim=moved?ids(l):ids(r),sec=moved?ids(r):ids(l),order=[...prim];
  sec.forEach((id,i)=>{if(order.includes(id))return;let j=i-1;while(j>=0&&!order.includes(sec[j]))j--;order.splice(j<0?0:order.indexOf(sec[j])+1,0,id)});
  return order.map(pick).filter(Boolean);
}
let pubT=null,pubBusy=false,pubAgain=false,needRender=false;
const BASEKEY="aperation-mp-base";
function setBase(x){MP.base=x;try{localStorage.setItem(BASEKEY,J({pid:MP.pid,p:x}))}catch(e){}}
try{const b=JSON.parse(localStorage.getItem(BASEKEY)||"null");if(b&&MP.on&&b.pid===MP.pid)MP.base=b.p}catch(e){}
function mpPublishSoon(){if(!isMpAdmin()||!MP.ready||tour||mpApplying)return;clearTimeout(pubT);pubT=setTimeout(mpPublish,900)}
async function mpPublish(){
  if(!fdb||!isMpAdmin())return;if(pubBusy){pubAgain=true;return}pubBusy=true;
  const sent=JSON.parse(J(P)),base=MP.base?JSON.parse(J(MP.base)):null,r0=pref(),ref=r0.collection("views").doc("__admin");let out=null;
  try{
    await fdb.runTransaction(async tx=>{
      const cur=await tx.get(ref);let remote=null;
      if(cur.exists){try{remote=normP(JSON.parse(cur.data().plan))}catch(e){}}
      const merged=remote&&base&&!jeq(remote,base)?normP(merge3(base,sent,remote)):sent,ts=Date.now();
      tx.set(ref,{plan:J(merged),perm:ALLPERM,roleName:"Szerkesztő",ts,by:UID});
      for(const r of MP.roles)tx.set(r0.collection("views").doc(r.id),{plan:J(filterP(merged,r.perm)),perm:r.perm,roleName:r.name,ts,by:UID});
      tx.update(r0,{title:merged.title||"",ts});
      out={merged,ts};
    });
    MP.lastPub=out.ts;setBase(out.merged);if(MP._recTitle!==out.merged.title){MP._recTitle=out.merged.title;myProjRec()}
    if(!jeq(out.merged,sent)){ // közben másik szerkesztő is írt: az ő változásai bekerülnek nálunk is
      const now=jeq(P,sent)?out.merged:normP(merge3(sent,P,out.merged));
      mpApplyPlan(now);if(!jeq(now,out.merged))pubAgain=true;
    }else if(!jeq(P,sent))pubAgain=true;
  }catch(e){if(e&&e.code==="permission-denied")mpErr(e);else setTimeout(mpPublishSoon,4000)}
  pubBusy=false;if(pubAgain){pubAgain=false;mpPublishSoon()}
  mpUploadImgs();
}
// a terv cseréje úgy, hogy gépelés közben ne ugorjon el a kurzor (a mező elhagyásakor frissül)
function mpApplyPlan(p){
  mpApplying=true;P=normP(p);saveP();applyProject();mpApplying=false;tabKey="";
  if(view==="terv"&&document.activeElement&&document.activeElement.closest('[data-view="terv"]')&&document.activeElement.matches("input,textarea,select")){needRender=true;tick(true)}
  else renderAll();
}
// mező elhagyásakor frissítünk; ha közben egy másik mezőbe lépett, újrarajzolás után oda tesszük vissza a kurzort
document.addEventListener("focusout",()=>setTimeout(()=>{if(!needRender)return;const a=document.activeElement;
  let sel=null;if(a&&a.closest('[data-view="terv"]')&&a.matches("input,textarea,select")&&a.dataset.f){const h=a.closest("[data-id]");sel=(h&&h.dataset.id?`[data-id="${h.dataset.id}"] `:"")+`[data-f="${a.dataset.f}"]`}
  needRender=false;renderAll();
  if(sel){const n=document.querySelector('[data-view="terv"] '+sel);if(n){n.focus({preventScroll:true});try{const l=n.value.length;n.setSelectionRange(l,l)}catch(e){}}}},60));
/* a nap állása */
let pushT=null;
function mpPush(){
  if(!MP.on||!MP.ready||mpApplying||tour||st.sim.on||!canCtl())return;
  clearTimeout(pushT);pushT=setTimeout(()=>{const ts=Date.now();MP.lastPush=MP.liveTs=ts;
    const x={};LIVEKEYS.forEach(k=>x[k]=st[k]);pref().collection("live").doc("state").set({s:JSON.stringify(x),ts,by:UID}).catch(mpErr)},200);
}
function mpOnLive(s){
  if(!s.exists)return;const d=s.data();if(d.ts<=MP.liveTs)return;
  if(tour){MP.pendLive=s;return}
  MP.liveTs=d.ts;let x;try{x=JSON.parse(d.s)}catch(e){return}
  LIVEKEYS.forEach(k=>{st[k]=x[k]??fresh()[k]});
  mpApplying=true;save();mpApplying=false;lastHero=null;
  if(document.activeElement&&document.activeElement.matches(".tk-note")){takesHold=true;tick(true)}
  else if(view==="terv"&&document.activeElement&&document.activeElement.closest('[data-view="terv"]'))tick(true);else renderAll();
}
/* take-ek külön dokumentumban (live/takes), blokkonként összefésülve, hogy a szkriptes és az AD ne írja felül egymást */
let takesT=null,takesDirty=new Set(),takesAll=false;
function mpPushTakes(keys){
  if(!MP.on||!MP.ready||mpApplying||tour||st.sim.on||!canTake())return;
  if(keys==null)takesAll=true;else[].concat(keys).forEach(k=>takesDirty.add(String(k)));
  clearTimeout(takesT);takesT=setTimeout(()=>{const ts=Date.now();MP.takesTs=ts;const t={};
    const ks=takesAll?Object.keys(st.takes):[...takesDirty];ks.forEach(k=>t[k]=JSON.stringify(st.takes[k]||[]));
    const all=takesAll;takesAll=false;takesDirty.clear();
    pref().collection("live").doc("takes").set({t,sw:st.sw?JSON.stringify(st.sw):"",ts,by:UID},all?{}:{merge:true}).catch(mpErr)},200);
}
let takesHold=false;
function mpOnTakes(s){
  if(!s.exists)return;const d=s.data();if(d.by===UID&&d.ts<=(MP.takesTs||0))return;
  if(tour){MP.pendTakes=s;return}
  const t={};for(const k in d.t||{}){try{const a=JSON.parse(d.t[k]);if(a&&a.length)t[k]=a}catch(e){}}
  st.takes=t;try{st.sw=d.sw?JSON.parse(d.sw):null}catch(e){st.sw=null}
  mpApplying=true;save();mpApplying=false;
  // jegyzetírás közben nem rajzolunk újra (elveszne a fókusz); a mező elhagyásakor frissül
  if(document.activeElement&&document.activeElement.matches(".tk-note")){takesHold=true;return}
  takesRedraw();
}
function takesRedraw(){takesHold=false;if(!B.length)return;if(view==="most")renderMost();else if(view==="idorend")renderTimeline()}
function mpOnView(s){
  if(!s.exists){if(isMember())mpLost();return}
  const d=s.data();
  if(isMpAdmin()&&d.by===UID&&d.ts<=MP.lastPub)return;
  if(tour){MP.pendView=s;return}
  let p;try{p=JSON.parse(d.plan)}catch(e){return}
  if(isMpAdmin()){
    const remote=normP(p);MP.title=remote.title;mpSaveLocal();
    if(MP.base&&jeq(remote,MP.base))return;
    // ha nálunk van még el nem küldött változás, összefésüljük, és visszaküldjük
    const local=MP.base&&!jeq(P,MP.base)?normP(merge3(MP.base,P,remote)):remote;
    setBase(remote);if(!jeq(local,P))mpApplyPlan(local);if(!jeq(local,remote))mpPublishSoon();
    mpFetchImgs();return;
  }
  if(isMember()){MP.perm=d.perm;MP.roleName=d.roleName}
  MP.title=p.title;mpSaveLocal();
  mpApplying=true;P=normP(p);saveP();applyProject();mpApplying=false;mpFetchImgs();
  tabKey="";if(view==="terv"&&document.activeElement&&document.activeElement.closest('[data-view="terv"]'))tick(true);else renderAll();
}
function mpFlush(){const v=MP.pendView,l=MP.pendLive,tk=MP.pendTakes;MP.pendView=MP.pendLive=MP.pendTakes=null;if(v)mpOnView(v);if(l)mpOnLive(l);if(tk)mpOnTakes(tk)}
let unsubs=[];
function mpStop(){presLeave();unsubs.forEach(u=>{try{u()}catch(e){}});unsubs=[];MP.ready=false;MP.pres=[];presPaint()}
function mpListen(){
  mpStop();const r0=pref(),vid=isMpAdmin()?"__admin":MP.roleId;
  unsubs.push(r0.collection("views").doc(vid).onSnapshot(mpOnView,e=>e.code==="permission-denied"&&isMember()?mpLost():mpErr(e)));
  unsubs.push(r0.collection("live").doc("state").onSnapshot(mpOnLive,e=>e.code==="permission-denied"&&isMember()?mpLost():mpErr(e)));
  // jelenlét: ki melyik részen, melyik blokkon/mezőn dolgozik (csak a szerkesztők látják egymást)
  if(isMpAdmin()){unsubs.push(r0.collection("presence").onSnapshot(q=>{MP.pres=q.docs.filter(d=>d.id!==UID).map(d=>({uid:d.id,...d.data()}));presPaint()},e=>{if(e.code!=="permission-denied")mpErr(e)}));setTimeout(()=>presTouch(true),300)}
  // képek: ha valaki feltölt egyet, a kis „imgmeta” dokumentum jelzi, és letöltjük
  unsubs.push(r0.collection("imgmeta").onSnapshot(()=>mpFetchImgs(),e=>{if(e.code!=="permission-denied")mpErr(e)}));
  unsubs.push(r0.collection("live").doc("takes").onSnapshot(mpOnTakes,e=>e.code==="permission-denied"&&isMember()?mpLost():mpErr(e)));
  // ha a szerkesztő kitilt, a saját tagsági dokumentum eltűnik
  if(MP.roleId!=="__owner")unsubs.push(r0.collection("members").doc(UID).onSnapshot(s=>{if(!s.exists&&!s.metadata.hasPendingWrites&&!s.metadata.fromCache)mpLost()},e=>{if(e.code==="permission-denied")mpLost()}));
  if(isMpAdmin()){
    unsubs.push(r0.collection("roles").onSnapshot(q=>{
      MP.roles=q.docs.filter(d=>d.id!=="__admin").map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.order||0)-(b.order||0));
      const a=q.docs.find(d=>d.id==="__admin");MP.adminCode=a?a.data().code:"";
      // régebbi projektek: a szkriptes és a 2nd AD megkapja a take-naplót
      MP.roles.forEach(r=>{if(r.perm&&r.perm.takes===undefined){r.perm.takes=/szkript|1st ad|2nd ad/i.test(r.name||"");mpRoleSave(r)}});
      mpTeamRefresh()},mpErr));
    unsubs.push(r0.collection("members").onSnapshot(q=>{MP.members=q.docs.map(d=>({uid:d.id,...d.data()}));mpTeamRefresh()},mpErr));
  }
  MP.ready=true;
}
function mpTeamRefresh(){if(view==="terv"&&editSec==="csapat"&&!(document.activeElement&&document.activeElement.closest(".team")))renderEdit()}
function mpLost(){if(!MP.on||MP.leaving)return;MP.leaving=true;toast("Kikerültél a közös projektből: a szerkesztő törölte a pozíciódat vagy kitiltott.",{tone:"late",ms:8000});mpLeave(true)}

/* létrehozás, belépés, kilépés */
async function mpCreate(btn){
  if(btn){btn.disabled=true;btn.textContent="Létrehozás…"}
  try{
    await fbInit();const pid=RID(20),r0=fdb.collection("projects").doc(pid),ts=Date.now();
    await r0.set({owner:UID,title:P.title||"",created:ts,ts});
    const b=fdb.batch(),acode=RAND(8);
    const myname=(($("#myname")||{}).value||MP.name||"").trim();
    MP={...MP,base:null,on:true,mode:"admin",pid,roleId:"__owner",code:acode,name:myname,perm:ALLPERM,roleName:"Szerkesztő",title:P.title,roles:[],members:[]};
    let tpl=null;try{tpl=JSON.parse(localStorage.getItem("aperation-team-tpl")||"null")}catch(e){}
    const list=Array.isArray(tpl)&&tpl.length?tpl.map(r=>[r.name,Object.assign(permOf(""),r.perm||{})]):PRESETS.map(([n,s])=>[n,permOf(s)]);
    try{localStorage.removeItem("aperation-team-tpl")}catch(e){}
    list.forEach(([name,perm],k)=>{const id=RID(12),code=RAND(8);MP.roles.push({id,name,perm,code,order:k});
      b.set(r0.collection("roles").doc(id),{name,perm,code,order:k});b.set(fdb.collection("codes").doc(code),{pid,roleId:id})});
    b.set(r0.collection("roles").doc("__admin"),{name:"Szerkesztő (társ-AD)",admin:true,code:acode,order:-1});b.set(fdb.collection("codes").doc(acode),{pid,roleId:"__admin"});
    await b.commit();MP.adminCode=acode;mpSaveLocal();mpListen();await mpPublish();mpPush();mpPushTakes(null);myProjRec();
    toast("Közös projekt kész. Oszd ki a kódokat a stábnak.",{tone:"ok"});
  }catch(e){mpErr(e);MP.on=false;mpSaveLocal()}
  renderAll();
}
async function mpJoin(raw,name){
  const c=normCode(raw);if(c.length!==8){toast("A kód 8 karakter, pl. ABCD-2345.");return false}
  if(!name.trim()){toast("Írd be a neved, hogy a szerkesztő lássa, ki csatlakozott.");return false}
  try{
    await fbInit();const cd=await fdb.collection("codes").doc(c).get();
    if(!cd.exists){toast("Nincs ilyen kód. Ellenőrizd, vagy kérj újat a szerkesztőtől.",{tone:"late"});return false}
    const {pid,roleId}=cd.data();
    // társszerkesztőnek fiók kell; stábpozícióra fiók nélkül is lehet csatlakozni
    if(roleId==="__admin"&&AUTH_REQ&&!accLoad()){try{localStorage.setItem(JOINKEY,c);localStorage.setItem(JOINNAME,name.trim())}catch(e){}
      authForce="Ez társszerkesztői meghívó: a diszpó szerkesztéséhez előbb lépj be, vagy hozz létre fiókot. Utána automatikusan csatlakozol.";authMode=accLoad()?"in":"reg";authShow(true);return false}
    await fdb.collection("projects").doc(pid).collection("members").doc(UID).set({code:c,roleId,name:name.trim(),joined:Date.now()});
    if(!MP.on){try{localStorage.setItem(LOCALP,JSON.stringify(P));localStorage.setItem(LOCALS,JSON.stringify(st))}catch(e){}}
    MP={...MP,base:null,on:true,mode:roleId==="__admin"?"admin":"member",pid,roleId,code:c,name:name.trim(),perm:roleId==="__admin"?ALLPERM:null,roleName:"",title:"",roles:[],members:[],lastPub:0,liveTs:0};
    if(isMember()){P=normP({});applyProject()}
    const s=st.sound;st=fresh();st.sound=s;mpApplying=true;save();mpApplying=false;
    try{localStorage.removeItem(JOINKEY)}catch(e){}
    myProjRec();
    mpSaveLocal();mpListen();if(isMpAdmin()){editSec="projekt";location.hash="#terv"}else location.hash="#most";renderAll();
    toast(isMember()?"Csatlakoztál. A terv mindjárt megjelenik.":"Csatlakoztál társszerkesztőként: együtt írjátok a diszpót.",{tone:"ok"});return true;
  }catch(e){mpErr(e);return false}
}
async function mpLeave(silent){
  if(PV){pvStop();return}
  const was={...MP};mpStop();
  if(was.mode==="member"&&fdb&&UID&&!silent){try{await fdb.collection("projects").doc(was.pid).collection("members").doc(UID).delete()}catch(e){}}
  if(!silent&&was.mode==="member"&&fdb&&UID&&was.pid){fdb.collection("users").doc(UID).collection("projects").doc(was.pid).delete().catch(()=>{})}
  MP={on:false,ready:false,roles:[],members:[],lastPub:0,lastPush:0,liveTs:0,leaving:false};mpSaveLocal();
  if(was.mode!=="admin"||was.roleId!=="__owner"){
    let p=null,s=null;try{p=JSON.parse(localStorage.getItem(LOCALP)||"null");s=JSON.parse(localStorage.getItem(LOCALS)||"null")}catch(e){}
    P=normP(p||{});saveP();applyProject();st=Object.assign(fresh(),s||{});save();
    try{localStorage.removeItem(LOCALP);localStorage.removeItem(LOCALS)}catch(e){}
  }
  tabKey="";location.hash="#most";renderAll();if(!silent)toast("Kiléptél a közös projektből.");
}
async function mpDeleteProject(){
  try{const r0=pref();
    for(const sub of ["presence","views","roles","members","live","imgmeta","imgdata"]){const q=await r0.collection(sub).get();for(const d of q.docs){if(sub==="roles"&&d.data().code){try{await fdb.collection("codes").doc(d.data().code).delete()}catch(e){}}await d.ref.delete()}}
    await r0.delete();
    fdb.collection("users").doc(UID).collection("projects").doc(MP.pid).delete().catch(()=>{});
  }catch(e){mpErr(e);return}
  MP.roleId="__owner";await mpLeave(true);toast("A közös projekt törölve. A terv megmaradt ezen az eszközön.",{tone:"ok"});
}
/* pozíciók kezelése (admin) */
async function mpRoleSave(r){try{await pref().collection("roles").doc(r.id).set({name:r.name,perm:r.perm,code:r.code,order:r.order||0});mpPublishSoon()}catch(e){mpErr(e)}}
async function mpRoleAdd(){const code=RAND(8),id=RID(12),r={id,name:"Új pozíció",perm:permOf("most idorend"),code,order:(MP.roles.length?Math.max(...MP.roles.map(x=>x.order||0)):0)+1};
  try{await fdb.collection("codes").doc(code).set({pid:MP.pid,roleId:id});MP.roles.push(r);await mpRoleSave(r);renderEdit()}catch(e){mpErr(e)}}
async function mpRoleNewCode(r){const old=r.code,code=RAND(8);
  try{await fdb.collection("codes").doc(code).set({pid:MP.pid,roleId:r.id});await fdb.collection("codes").doc(old).delete();r.code=code;await mpRoleSave(r);renderEdit();toast("Új kód: "+fmtCode(code)+". A régi kóddal már nem lehet belépni; aki bent van, bent marad.")}catch(e){mpErr(e)}}
async function mpAdminNewCode(){const code=RAND(8),old=MP.adminCode;
  try{await fdb.collection("codes").doc(code).set({pid:MP.pid,roleId:"__admin"});if(old)await fdb.collection("codes").doc(old).delete();await pref().collection("roles").doc("__admin").set({name:"Szerkesztő (társ-AD)",admin:true,code,order:-1});MP.adminCode=code;renderEdit()}catch(e){mpErr(e)}}
async function mpRoleDel(r){
  try{const r0=pref();await fdb.collection("codes").doc(r.code).delete();await r0.collection("views").doc(r.id).delete();await r0.collection("roles").doc(r.id).delete();
    for(const m of MP.members.filter(m=>m.roleId===r.id))await r0.collection("members").doc(m.uid).delete();
    MP.roles=MP.roles.filter(x=>x!==r);renderEdit()}catch(e){mpErr(e)}}
async function mpKick(uid){try{await pref().collection("members").doc(uid).delete()}catch(e){mpErr(e)}}
function copyText(t){try{navigator.clipboard.writeText(t).then(()=>toast("Kimásolva: "+t),()=>toast(t))}catch(e){toast(t)}}

/* felület: Terv → Csapat */
function teamHTML(){
  if(FB_SRC&&!FBC)return`<section class="card" id="teamcard"><h2>Közös munka</h2><p class="muted">A közös szerver még nincs bekötve ebbe a változatba. Amint a Firebase-projekt beállításai bekerülnek, itt indíthatod a közös projektet.</p></section>`;
  if(!MP_AVAIL)return`<section class="card" id="teamcard"><h2>Közös munka</h2><p class="muted">A stábbal közös használat a <b>telepíthető változatban</b> működik (bármelyik telefonon, fiók nélkül, belépőkóddal). Ebben a nézetben nem érhető el.</p>
    <a class="btn solid" href="${PAGES_URL}" target="_blank" rel="noopener">${ic("arrow",16)}Telepíthető változat megnyitása</a>
    <p class="muted small">Ott a terved Excelként átvihető: itt Fájl → Terv mentése Excelbe, ott Excel betöltése.</p></section>`;
  if(!MP.on)return`<section class="card" id="teamcard"><h2>Közös munka a stábbal</h2>
    <p class="muted">Már a diszpó írásakor dolgozhattok együtt: indítsd el a közös projektet, és küldj <b>meghívó linket</b> vagy kódot. A <b>társszerkesztők</b> veled együtt írják a tervet (shotlist, időrend, emberek, forgatókönyv), a változások pár másodperc alatt mindenkinél megjelennek. A többi pozíció (rendező, 1st AD, 2nd AD, szkriptes, stáb) a kész napot látja a telefonján, és te döntöd el, ki mit lát.</p>
    <ul class="list"><li>Ha ketten egyszerre írtok, az app összefésüli: más-más blokk, shot vagy mező szerkesztése nem írja felül egymást.</li><li>A rejtett adatot (pl. telefonszám, forgatókönyv) a szerver el sem küldi annak, akinek nem szabad látnia.</li><li>Térerő nélkül is megy tovább; amikor visszajön a net, szinkronizál.</li></ul>
    <label class="fi"><span class="flab">A neved (ezt látják a társszerkesztők)</span><input id="myname" autocomplete="name" placeholder="pl. Tóth Tamás" value="${esc(MP.name||"")}"></label>
    <button class="btn solid" type="button" data-do="mpcreate">${ic("users",16)}Közös projekt indítása</button>
    ${P.blocks.length||P.title?"":`<p class="muted small">Üres tervvel is indíthatod: a címet és a napot közösen is kitölthetitek.</p>`}</section>`;
  const cnt=id=>MP.members.filter(m=>m.roleId===id).length;
  return`<div class="team">
    <section class="card" id="teamcard"><div class="card-head"><h2>Közös projekt</h2><span class="chip" style="--c:var(--ok)">${ic("check",14)}Élő</span></div>
      <p class="muted small">A kódot küldd el annak, aki az adott pozícióban dolgozik. A telepíthető változatban: <b>Kezdés → Csatlakozás kóddal</b> (vagy Info fül).</p>
      ${accLoad()?"":`<p class="eb-warn sum">${ic("alert",16)}<span>A közös projekt most ehhez a készülékhez kötődik. <button type="button" class="linkbtn" data-do="gotoacct">Mentsd e-mailhez</button>, hogy telefoncsere vagy -vesztés után is a tiéd maradjon.</span></p>`}
      ${MP.roleId==="__owner"||MP.adminCode?`<div class="code-row"><div><b>Társszerkesztők</b><small>együtt írjátok a diszpót: mindent lát és szerkeszt</small></div><button type="button" class="codebtn num" data-copy="${MP.adminCode||""}">${fmtCode(MP.adminCode||"")}</button><button type="button" class="btn sm" data-do="admincode">Új kód</button></div>
      <button type="button" class="btn solid" data-invite="${MP.adminCode||""}" data-irole="társszerkesztő">${ic("users",16)}Társszerkesztő meghívása (link)</button>`:""}
      <label class="fi"><span class="flab">A neved (ezt látják a társszerkesztők)</span><input id="mynamelive" autocomplete="name" placeholder="pl. Tóth Tamás" value="${esc(MP.name||"")}"></label>
    </section>
    <section class="card"><div class="card-head"><h2>Pozíciók</h2><span class="chip neutral">${MP.roles.length}</span></div>
      <p class="muted small">Koppints a jelölőkre: kiemelve, amit az adott pozíció lát. A <b>Vezérlés</b> jog a nap léptetése.</p>
      <div class="roles">${MP.roles.map(r=>`<div class="role" data-rid="${r.id}">
        <div class="role-top"><input class="rname" data-rname value="${esc(r.name)}" aria-label="Pozíció neve"><button type="button" class="codebtn num" data-copy="${r.code}">${fmtCode(r.code)}</button><button type="button" class="btn sm" data-invite="${r.code}" data-irole="${esc(r.name)}" aria-label="Meghívó link küldése">${ic("arrow",14)}Link</button></div>
        <div class="perms">${PERMS.map(([k,l])=>`<button type="button" class="perm ${r.perm[k]?"on":""} ${k==="control"?"ctl":""}" data-perm="${k}" aria-pressed="${!!r.perm[k]}" title="${esc(PERM_HELP[k])}">${l}</button>`).join("")}</div>
        <div class="role-act"><span class="muted small">${cnt(r.id)} csatlakozott</span><span style="flex:1"></span><button type="button" class="btn sm" data-do="rolecode">Új kód</button><button type="button" class="btn sm danger" data-do="roledel">${ic("x",14)}Törlés</button></div></div>`).join("")}</div>
      <button type="button" class="btn sm" data-do="roleadd">${ic("plus",14)}Új pozíció</button></section>
    <section class="card"><h2>Csatlakozott emberek</h2>${MP.members.length?`<div class="rows">${MP.members.map(m=>{const r=m.roleId==="__admin"?{name:"Szerkesztő"}:MP.roles.find(x=>x.id===m.roleId)||{name:"?"};return`<div class="row" style="grid-template-columns:minmax(0,1fr) auto"><div><b>${esc(m.name||"Névtelen")}</b><small>${esc(r.name)} <span class="pnow" data-presuid="${m.uid}"></span></small></div><button type="button" class="btn sm danger" data-kick="${m.uid}">Kitiltás</button></div>`}).join("")}</div>`:`<p class="muted small">Még senki. Ha valaki beírja a kódját, itt megjelenik.</p>`}</section>
    <section class="card"><h2>Kapcsolat</h2><div class="wgrid">${MP.roleId==="__owner"?`<button type="button" class="btn danger" data-do="mpdelete">${ic("x",16)}Közös projekt törlése</button>`:""}<button type="button" class="btn" data-do="mpleave">Leválasztás erről az eszközről</button></div>
      <p class="muted small">${MP.roleId==="__owner"?"Törlés után a kódok nem működnek, és a stáb telefonjáról is eltűnik a terv. ":""}Leválasztás után ez az eszköz nem szinkronizál tovább; a többieknél minden marad.</p></section>
  </div>`;
}
/* felület: csatlakozás (Kezdés, Info) */
function joinHTML(){
  if(!MP_AVAIL)return"";
  return`<div class="join"><div class="eg"><label class="fi"><span class="flab">Belépőkód</span><input id="jcode" autocomplete="off" autocapitalize="characters" placeholder="ABCD-2345" maxlength="9" class="num" value="${esc(fmtCode(pendingJoin()))}"></label>
    <label class="fi"><span class="flab">A neved</span><input id="jname" autocomplete="name" placeholder="pl. Kiss Anna" value="${esc(MP.name||"")}"></label></div>
    <button type="button" class="btn solid" data-do="join">${ic("users",16)}Csatlakozás</button></div>`;
}
function mpInfoCard(){
  if(isMember())return`<section class="card"><div class="card-head"><h2>Közös projekt</h2><span class="chip" style="--c:var(--ok)">${ic("check",14)}${MP.ready?"Élő":"Kapcsolódás…"}</span></div>
    <div class="rows">${[["Projekt",MP.title||"…"],["Pozíciód",MP.roleName||"…"],["Neved",MP.name],["Vezérlés",canCtl()?"igen":"nem, csak nézed"]].map(([k,x])=>`<div class="row" style="grid-template-columns:110px minmax(0,1fr)"><small>${k}</small><b>${esc(x)}</b></div>`).join("")}</div>
    <button type="button" class="btn danger" data-do="mpleave">Kilépés a közös projektből</button></section>`;
  if(isMpAdmin())return`<section class="card"><div class="card-head"><h2>Közös projekt</h2><span class="chip" style="--c:var(--ok)">${ic("check",14)}Élő</span></div><p class="muted small">A stáb élőben látja a napot. Pozíciók, kódok és jogok: Terv → Csapat.</p><a class="btn" href="#terv" data-sec-go="csapat">${ic("users",16)}Csapat kezelése</a></section>`;
  if(FB_SRC&&!FBC)return"";
  if(!MP_AVAIL)return`<section class="card"><h2>Közös munka</h2><p class="muted small">Kóddal csatlakozni és a stábbal közösen használni a <a href="${PAGES_URL}" target="_blank" rel="noopener">telepíthető változatban</a> lehet.</p></section>`;
  return`<section class="card"><h2>Csatlakozás kóddal</h2><p class="muted small">Ha a szerkesztőtől kaptál kódot, írd be: a telefonodon élőben látod a napot.</p>${joinHTML()}</section>`;
}
/* események */
document.addEventListener("click",async e=>{
  const t=e.target.closest("button,a");if(!t)return;const d=t.dataset;
  if(d.secGo){editSec=d.secGo;return}
  if(d.copy){copyText(fmtCode(d.copy));return}
  if(d.invite){mpInvite(d.invite,d.irole||"");return}
  if(d.kick){if(sure(t,"Biztos?"))mpKick(d.kick);return}
  if(d.perm){const r=MP.roles.find(x=>x.id===t.closest("[data-rid]").dataset.rid);if(!r)return;r.perm[d.perm]=!r.perm[d.perm];t.classList.toggle("on",r.perm[d.perm]);t.setAttribute("aria-pressed",r.perm[d.perm]);mpRoleSave(r);return}
  if(!d.do)return;
  const r=t.closest("[data-rid]")&&MP.roles.find(x=>x.id===t.closest("[data-rid]").dataset.rid);
  if(d.do==="mpcreate")mpCreate(t);
  else if(d.do==="join"){const box=t.closest(".join");t.disabled=true;const ok=await mpJoin(box.querySelector("#jcode").value,box.querySelector("#jname").value);t.disabled=false}
  else if(d.do==="joinform"){const f=$("#joinbox");if(f){f.hidden=!f.hidden;f.hidden||f.querySelector("#jcode").focus()}}
  else if(d.do==="mpleave"){if(sure(t,"Biztos? Koppints újra"))mpLeave(false)}
  else if(d.do==="mpdelete"){if(sure(t,"Biztos? Koppints újra"))mpDeleteProject()}
  else if(d.do==="roleadd")mpRoleAdd();
  else if(d.do==="admincode"){if(sure(t,"Biztos?"))mpAdminNewCode()}
  else if(d.do==="rolecode"&&r){if(sure(t,"Biztos?"))mpRoleNewCode(r)}
  else if(d.do==="roledel"&&r){if(sure(t,"Biztos? Törlöd"))mpRoleDel(r)}
});
document.addEventListener("change",e=>{const el=e.target;if(!el.matches||!el.matches("[data-rname]"))return;const r=MP.roles.find(x=>x.id===el.closest("[data-rid]").dataset.rid);if(r){r.name=el.value.trim()||"Pozíció";mpRoleSave(r)}});
document.addEventListener("input",e=>{const el=e.target;if(el.id==="jcode"){const c=normCode(el.value).slice(0,8);const v=c.length>4?c.slice(0,4)+"-"+c.slice(4):c;if(el.value!==v)el.value=v}});
function mpBoot(){if(MP.on&&MP_AVAIL)fbInit().then(()=>{mpListen();renderAll();setTimeout(mpUploadImgs,3000);setTimeout(myProjRec,5000)}).catch(mpErr)}

/* ---------- szerepek kipróbálása (egyedül, egy eszközön) ----------
   A szerkesztő megnézheti, mit lát és mit tehet egy pozíció. A terv a szerepre szűrve jelenik meg,
   közben semmi nem mentődik és nem szinkronizál; kilépéskor minden visszaáll. */
let PV=null;
function pvRoles(){if(PV&&PV.roles)return PV.roles;return isMpAdmin()&&MP.roles.length?MP.roles.map(r=>({name:r.name,perm:r.perm})):PRESETS.map(([name,s])=>({name,perm:permOf(s)}))}
function pvHTML(){
  if(!P.blocks.length||isMember())return"";
  const rs=pvRoles();
  return`<section class="card" id="pvcard"><h2>Szerepek kipróbálása</h2>
    <p class="muted small">Nézd meg egyedül, mit lát és mit csinálhat egy pozíció a telefonján (pl. a szkriptes mérheti és csillagozhatja a take-eket, az általános stáb csak a napot és a stáblistát látja). Próba közben semmi nem mentődik és nem megy ki a stábnak; a kilépéskor minden visszaáll.</p>
    <div class="pvlist">${rs.map((r,i)=>`<button type="button" class="btn sm" data-pv="${i}">${ic("play",13)}${esc(r.name)}</button>`).join("")}</div></section>`;
}
function pvStart(i){
  const r=pvRoles()[i];if(!r)return;
  if(!PV){const roles=pvRoles();if(MP.on)mpStop();PV={P0:P,st0:JSON.stringify(st),MP0:MP,roles}}
  else{P=PV.P0;st=JSON.parse(PV.st0)}
  PV.name=r.name;PV.i=i;
  MP={...PV.MP0,on:true,mode:"member",perm:r.perm,roleName:r.name,ready:false,roles:[],members:[]};
  P=normP(filterP(PV.P0,r.perm));applyProject();
  st=Object.assign(fresh(),JSON.parse(PV.st0));
  // ha még nem indult a nap, egy forgatás közepére ugrunk, hogy minden kipróbálható legyen
  if(!st.cur){const sb=B.find(b=>b.type==="shoot")||B[0];if(sb){for(const b of B)if(b.i<sb.i)st.act[b.i]={s:b.s,e:b.e};st.sim={on:true,start:sb.s+6,speed:1,base:Date.now()};st.cur={i:sb.i,at:sb.s+1}}}
  lastHero=null;tabKey="";openRow=null;pvBar();location.hash="#most";renderAll();
}
function pvStop(){
  if(!PV)return;const x=PV;PV=null;
  MP=x.MP0;P=x.P0;st=JSON.parse(x.st0);applyProject();
  if(MP.on)mpListen();
  const b=$("#pvbar");b&&b.remove();document.body.classList.remove("pv");
  lastHero=null;tabKey="";openRow=null;editSec="csapat";location.hash="#terv";renderAll();
  toast("Kiléptél a próbából. Minden a régi.");
}
function pvBar(){
  let b=$("#pvbar");if(!b){b=document.createElement("div");b.id="pvbar";($(".hdr")||document.body).prepend(b);document.body.classList.add("pv")}
  const rs=pvRoles();
  b.innerHTML=`<span class="pv-l">${ic("users",15)}Szerepben:</span><select aria-label="Szerep">${rs.map((r,i)=>`<option value="${i}" ${i===PV.i?"selected":""}>${esc(r.name)}</option>`).join("")}</select><button type="button" class="btn sm solid" data-pvstop>Kilépés</button>`;
  b.querySelector("select").onchange=e=>pvStart(+e.target.value);
  b.querySelector("[data-pvstop]").onclick=pvStop;
}
document.addEventListener("click",e=>{const t=e.target.closest("[data-pv]");if(t)pvStart(+t.dataset.pv)});

/* ---------- jelenlét (mint a Google Docsban) ----------
   Minden szerkesztő egy kis dokumentumot tart fenn (presence/{uid}): név, rész, blokk/shot, mező, időbélyeg.
   Csak akkor ír, ha máshova lép, illetve percenként egyszer életjelként; eltávozáskor törli. */
const PCOL=["#5ac8fa","#ff9f0a","#bf5af2","#30d158","#ff6482","#ffd60a","#64d2ff","#ac8e68"];
const pColor=u=>{let h=0;for(const c of String(u))h=(h*31+c.charCodeAt(0))>>>0;return PCOL[h%PCOL.length]};
const pInit=n=>String(n||"?").trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase()||"?";
const PRES_SEC={projekt:"Projekt",shotlist:"Shotlist",idorend:"Időrend",emberek:"Emberek",szkript:"Forgatókönyv",csapat:"Csapat",fajl:"Fájl"};
const PRES_TTL=150000;
let presLast="",presT=null,presAt=0,presGone=false;
function presState(){
  const a=document.activeElement,inT=view==="terv";
  let id="",f="";
  if(inT&&a&&a.closest&&a.closest('[data-view="terv"]')){const h=a.closest("[data-id]");id=h?h.dataset.id:"";f=a.dataset&&a.dataset.f||""}
  if(inT&&!id)id=editSec==="shotlist"?(typeof openSL!=="undefined"&&openSL)||"":editSec==="idorend"?openEB||"":"";
  return{sec:inT?editSec:"",view,id,f};
}
function presTouch(force){
  if(!isMpAdmin()||!MP.ready||PV||tour||document.hidden||presGone)return;
  clearTimeout(presT);presT=setTimeout(()=>{const s=presState(),k=J(s);
    if(!force&&k===presLast&&Date.now()-presAt<60000)return;presLast=k;presAt=Date.now();
    pref().collection("presence").doc(UID).set({...s,name:MP.name||"Szerkesztő",ts:Date.now()}).catch(()=>{})},force?0:350);
}
function presLeave(){clearTimeout(presT);if(fdb&&UID&&MP.pid&&isMpAdmin()){presLast="";pref().collection("presence").doc(UID).delete().catch(()=>{})}}
function presLive(){return(MP.pres||[]).filter(p=>Date.now()-p.ts<PRES_TTL)}
function presPaint(){
  const live=MP.on&&isMpAdmin()?presLive():[];
  const bar=$("#presbar");
  if(bar)bar.innerHTML=live.map(p=>`<span class="pchip" style="--pc:${pColor(p.uid)}" title="${esc(p.name)} · ${esc(p.view==="terv"?PRES_SEC[p.sec]||"Terv":"nem a Terven")}">${esc(pInit(p.name))}</span>`).join("");
  document.querySelectorAll(".pdot").forEach(x=>x.remove());
  document.querySelectorAll(".pres-on").forEach(x=>{x.classList.remove("pres-on");x.style.removeProperty("--pc");x.removeAttribute("data-pres")});
  for(const p of live){if(p.view!=="terv")continue;const c=pColor(p.uid);
    const sb=document.querySelector(`[data-view="terv"] .esec [data-sec="${p.sec}"]`);
    if(sb){const d=document.createElement("i");d.className="pdot";d.style.setProperty("--pc",c);d.title=p.name;sb.append(d)}
    if(p.sec!==editSec)continue;
    const mark=el=>{if(!el)return;el.classList.add("pres-on");el.style.setProperty("--pc",c);el.setAttribute("data-pres",p.name+" szerkeszti")};
    let host=null;try{host=p.id?document.querySelector(`[data-view="terv"] [data-id="${CSS.escape(p.id)}"]`):null}catch(e){}
    if(host)mark(host);
    if(p.f){let fe=null;try{fe=host?host.querySelector(`[data-f="${CSS.escape(p.f)}"]`):[...document.querySelectorAll(`[data-view="terv"] [data-f="${CSS.escape(p.f)}"]`)].find(x=>!x.closest("[data-id]"))}catch(e){}
      if(fe){const w=fe.closest(".fi")||fe;if(w!==host)mark(w)}}
  }
  // Csapat: ki hol tart
  document.querySelectorAll("[data-presuid]").forEach(x=>{const p=live.find(q=>q.uid===x.dataset.presuid);x.textContent=p?(p.view==="terv"?"most: "+(PRES_SEC[p.sec]||"Terv"):"most: az appban"):""});
}
document.addEventListener("focusin",()=>presTouch());
document.addEventListener("focusout",()=>presTouch());
addEventListener("hashchange",()=>setTimeout(()=>presTouch(),50));
document.addEventListener("visibilitychange",()=>{if(document.hidden)presLeave();else{presGone=false;presTouch(true)}});
addEventListener("pagehide",()=>{presGone=true;presLeave()});
addEventListener("pageshow",()=>{presGone=false});
setInterval(()=>{presTouch();presPaint()},30000);
document.addEventListener("change",e=>{if(e.target&&e.target.id==="mynamelive"){MP.name=e.target.value.trim();mpSaveLocal();presTouch(true);
  if(isMember()||MP.roleId!=="__owner")pref().collection("members").doc(UID).update({name:MP.name}).catch(()=>{})}});

/* ---------- fiók: a hozzáférés e-mailhez kötése ----------
   Alapból névtelen (anonim) belépéssel megy minden, ami a készülékhez kötött. Ha e-mailt és jelszót adsz hozzá,
   ugyanaz a felhasználó marad (a tulajdonosi jog is), és egy másik eszközön belépve visszakapod a közös projektjeidet.
   A projektek listája: users/{uid}/projects/{pid}. */
const ACCKEY="aperation-account";
const accLoad=()=>{try{return JSON.parse(localStorage.getItem(ACCKEY)||"null")}catch(e){return null}};
const accSave=a=>{try{if(a){localStorage.setItem(ACCKEY,J(a));localStorage.setItem("aperation-had-acc","1")}else localStorage.removeItem(ACCKEY)}catch(e){}};
let accList=null,accBusy=false;
function myProjRec(){
  if(!fdb||!UID||!MP.on||!MP.pid||PV)return;
  fdb.collection("users").doc(UID).collection("projects").doc(MP.pid).set({title:P.title||MP.title||"",roleId:MP.roleId||"",roleName:MP.roleName||"",code:MP.code||"",mode:MP.mode||"",name:MP.name||"",ts:Date.now()},{merge:true}).catch(()=>{});
}
const accErr=e=>{const c=e&&e.code||"";return{
  "auth/email-already-in-use":"Ez az e-mail már egy fiókhoz tartozik. Lépj be vele lent.",
  "auth/credential-already-in-use":"Ez az e-mail már egy fiókhoz tartozik. Lépj be vele lent.",
  "auth/invalid-email":"Ez nem érvényes e-mail-cím.",
  "auth/weak-password":"A jelszó legyen legalább 6 karakter.",
  "auth/missing-password":"Add meg a jelszót.",
  "auth/wrong-password":"Hibás e-mail vagy jelszó.","auth/invalid-credential":"Hibás e-mail vagy jelszó.","auth/invalid-login-credentials":"Hibás e-mail vagy jelszó.","auth/user-not-found":"Hibás e-mail vagy jelszó.",
  "auth/too-many-requests":"Túl sok próbálkozás. Várj pár percet.",
  "auth/operation-not-allowed":"Az e-mailes belépés még nincs bekapcsolva a Firebase-ben (Authentication → Sign-in method → Email/Password).",
  "auth/network-request-failed":"Nincs internet. Próbáld újra, ha van térerő."}[c]||("Nem sikerült: "+(c||e))};
function acctCard(){
  if(!MP_AVAIL||isMember()&&!accLoad())return"";
  const a=accLoad();
  if(a)return`<section class="card" id="acctcard"><div class="card-head"><h2>Fiók</h2><span class="chip" style="--c:var(--ok)">${ic("check",14)}Mentve</span></div>
    <p class="muted small">Bejelentkezve: <b>${esc(a.email)}</b>. Ha elveszik vagy cseréled a telefonod, egy másik eszközön ezzel belépve visszakapod a közös projektjeidet, tulajdonosként is.</p>
    <div class="wgrid"><button class="btn" type="button" data-do="accprojs">${ic("list",16)}Közös projektjeim</button><button class="btn" type="button" data-do="accout">Kijelentkezés</button></div>
    <div id="acclist">${accListHTML()}</div></section>`;
  return`<section class="card" id="acctcard"><h2>Fiók</h2>
    <p class="muted small">A közös projektek most <b>ehhez a készülékhez</b> kötődnek. Kösd őket e-mailhez: ha elveszik, összetörik vagy cseréled a telefonod, egy másik eszközön belépve visszakapod őket, a tulajdonosi joggal együtt. Nem kell hozzá semmit telepíteni.</p>
    <div class="eg"><label class="fi"><span class="flab">E-mail</span><input id="accmail" type="email" autocomplete="email" inputmode="email" placeholder="nev@pelda.hu"></label>
      <label class="fi"><span class="flab">Jelszó (legalább 6 karakter)</span><input id="accpw" type="password" autocomplete="current-password"></label></div>
    <div class="wgrid"><button class="btn solid" type="button" data-do="acclink">${ic("check",16)}Hozzáférés mentése</button><button class="btn" type="button" data-do="accin">Belépés meglévő fiókba</button></div>
    <p class="muted small"><b>Hozzáférés mentése:</b> ezen a készüléken az eddigi projektek az új fiókhoz kerülnek. <b>Belépés:</b> ha egy másik eszközön már mentetted, itt visszakapod. <button type="button" class="linkbtn" data-do="accreset">Elfelejtett jelszó</button></p></section>`;
}
function accListHTML(){
  if(accList==null)return"";
  if(!accList.length)return`<p class="muted small">Még nincs közös projekted ezzel a fiókkal.</p>`;
  return`<div class="rows">${accList.map(r=>`<div class="row" style="grid-template-columns:minmax(0,1fr) auto"><div><b>${esc(r.title||"Névtelen projekt")}</b><small>${esc(r.roleId==="__owner"?"tulajdonos":r.mode==="admin"?"társszerkesztő":r.roleName||"tag")}${MP.on&&MP.pid===r.id?" · ezen az eszközön nyitva":""}</small></div>${MP.on&&MP.pid===r.id?"":`<button class="btn sm" type="button" data-accopen="${esc(r.id)}">Megnyitás</button>`}</div>`).join("")}</div>`;
}
async function accRefreshList(){
  try{await fbInit();const q=await fdb.collection("users").doc(UID).collection("projects").get();
    accList=q.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.ts||0)-(a.ts||0))}catch(e){accList=[];toast(accErr(e),{tone:"warn"})}
  const l=$("#acclist");if(l)l.innerHTML=accListHTML();
}
async function accLink(btn){
  const m=($("#accmail")||{}).value||"",pw=($("#accpw")||{}).value||"";if(!m.trim()||!pw){toast("Add meg az e-mailt és a jelszót.");return}
  if(accBusy)return;accBusy=true;btn.disabled=true;
  try{await fbInit();const u=fauth.currentUser;
    await u.linkWithCredential(firebase.auth.EmailAuthProvider.credential(m.trim(),pw));
    accSave({email:m.trim()});if(MP.on)myProjRec();toast("Hozzáférés mentve. Másik eszközön ezzel az e-maillel lépj be.",{tone:"ok",ms:6000});renderAll();
  }catch(e){toast(accErr(e),{tone:"warn",ms:7000})}
  accBusy=false;btn.disabled=false;
}
async function accIn(btn){
  const m=($("#accmail")||{}).value||"",pw=($("#accpw")||{}).value||"";if(!m.trim()||!pw){toast("Add meg az e-mailt és a jelszót.");return}
  if(MP.on&&MP.roleId==="__owner"&&!sure(btn,"Ezen az eszközön van saját közös projekt, ami nincs mentve. Biztos?"))return;
  if(accBusy)return;accBusy=true;btn.disabled=true;
  try{await fbInit();
    if(MP.on)await mpLeave(true);
    await fauth.signInWithEmailAndPassword(m.trim(),pw);UID=fauth.currentUser.uid;
    accSave({email:m.trim()});toast("Beléptél. Válaszd ki, melyik közös projektet nyitod meg.",{tone:"ok"});
    location.hash="#info";renderAll();await accRefreshList();
  }catch(e){toast(accErr(e),{tone:"warn",ms:7000})}
  accBusy=false;btn.disabled=false;
}
async function accOpen(pid){
  const r=(accList||[]).find(x=>x.id===pid);if(!r)return;
  try{await fbInit();
    const ok=await fdb.collection("projects").doc(pid).get().then(d=>d.exists).catch(()=>false);
    if(!ok){toast("Ez a közös projekt már nem létezik.",{tone:"warn"});fdb.collection("users").doc(UID).collection("projects").doc(pid).delete().catch(()=>{});accList=accList.filter(x=>x.id!==pid);const l=$("#acclist");if(l)l.innerHTML=accListHTML();return}
    if(MP.on)await mpLeave(true);
    try{localStorage.setItem(LOCALP,JSON.stringify(P));localStorage.setItem(LOCALS,JSON.stringify(st))}catch(e){}
    const admin=r.mode==="admin";
    MP={...MP,base:null,on:true,mode:admin?"admin":"member",pid,roleId:r.roleId,code:r.code,name:r.name||"",perm:admin?ALLPERM:null,roleName:r.roleName||"",title:r.title||"",roles:[],members:[],lastPub:0,liveTs:0,leaving:false};
    if(!admin){P=normP({});applyProject()}
    const s=st.sound;st=fresh();st.sound=s;mpApplying=true;save();mpApplying=false;
    mpSaveLocal();mpListen();if(admin){editSec="projekt";location.hash="#terv"}else location.hash="#most";renderAll();
    toast(`Megnyitva: ${r.title||"közös projekt"}`,{tone:"ok"});
  }catch(e){toast(accErr(e),{tone:"warn"})}
}
async function accOut(btn){
  if(!sure(btn,"Biztos? Koppints újra"))return;
  try{await fbInit();if(MP.on)await mpLeave(true);await fauth.signOut();UID=null;accSave(null);accList=null;authMode="in";authMsg="";toast("Kijelentkeztél ezen az eszközön.");renderAll()}catch(e){toast(accErr(e),{tone:"warn"})}
}
async function accReset(){
  const m=(($("#accmail")||{}).value||"").trim();if(!m){toast("Írd be fent az e-mail-címed, és koppints újra.");return}
  try{await fbInit();await fauth.sendPasswordResetEmail(m);toast("Elküldtük a jelszó-visszaállító e-mailt (nézd meg a spam mappát is).",{tone:"ok",ms:6000})}catch(e){toast(accErr(e),{tone:"warn"})}
}
document.addEventListener("click",e=>{const t=e.target.closest("[data-do],[data-accopen]");if(!t)return;const d=t.dataset;
  if(d.accopen){accOpen(d.accopen);return}
  if(d.do==="acclink")accLink(t);else if(d.do==="accin")accIn(t);else if(d.do==="accout")accOut(t);else if(d.do==="accreset")accReset();
  else if(d.do==="accprojs")accRefreshList();
  else if(d.do==="gotoacct"){location.hash="#info";setTimeout(()=>{const c=$("#acctcard");c&&c.scrollIntoView({block:"start",behavior:"smooth"})},200)}});

/* ---------- belépés: az app a belépéssel fogad ----------
   Szerkesztéshez (saját diszpó, társszerkesztés) fiók kell. Kivétel: aki egy stábpozícióra kapott meghívót
   (link vagy kód), az fiók nélkül is csatlakozhat. Net nélkül az első indításkor tovább lehet lépni. */
const AUTH_REQ=MP_AVAIL&&!(/^(localhost|127\.)/.test(location.hostname)&&!/[?&]auth\b/.test(location.search));
const JOINNAME="aperation-join-name";
let authMode=(()=>{try{return localStorage.getItem("aperation-had-acc")?"in":"reg"}catch(e){return"reg"}})(),authForce="",authMsg="";
const authSkipped=()=>{try{return sessionStorage.getItem("aperation-authskip")==="1"}catch(e){return false}};
function authNeeded(){
  if(!AUTH_REQ||accLoad()||PV||tour)return false;
  if(authForce)return true;
  if(isMember()||pendingJoin()||authSkipped())return false;
  return true;
}
function authHTML(){
  const legacy=MP.on&&MP.roleId==="__owner";
  if(legacy&&!authForce)authMode="reg";
  const reg=authMode==="reg",off=!navigator.onLine;
  return`<div class="gate-in"><div class="brand-logo">${LOGO_SVG}</div>
    <h1 class="ag-hi">Üdv az APERATION-ben</h1><p class="muted ag-sub">${reg?"Hozz létre egy fiókot: a diszpóid és a közös projektjeid így bármelyik eszközön megmaradnak.":"Lépj be a fiókodba."}</p>
    <section class="card"><div class="seg" role="group" aria-label="Belépés vagy új fiók"><button type="button" data-agmode="in" aria-pressed="${!reg}">Belépés</button><button type="button" data-agmode="reg" aria-pressed="${reg}">Új fiók</button></div>
      ${authForce?`<p class="eb-warn sum">${ic("alert",16)}<span>${esc(authForce)}</span></p>`:legacy?`<p class="eb-warn sum">${ic("alert",16)}<span>Ezen az eszközön már van közös projekted. Hozz létre fiókot, így a tiéd marad, és más eszközön is eléred.</span></p>`:""}
      <div class="eg">${reg?`<label class="fi span2"><span class="flab">A neved (ezt látják a többiek)</span><input id="agname" autocomplete="name" placeholder="pl. Tóth Tamás" value="${esc(MP.name||localStorage.getItem(JOINNAME)||"")}"></label>`:""}
        <label class="fi"><span class="flab">E-mail</span><input id="agmail" type="email" autocomplete="email" inputmode="email" placeholder="nev@pelda.hu"></label>
        <label class="fi"><span class="flab">Jelszó${reg?" (legalább 6 karakter)":""}</span><input id="agpw" type="password" autocomplete="${reg?"new-password":"current-password"}"></label></div>
      <button class="btn solid big" type="button" data-do="agsubmit">${reg?ic("plus",18)+"Fiók létrehozása":ic("arrow",18)+"Belépés"}</button>
      ${authMsg?`<p class="eb-warn sum" id="agmsg">${ic("alert",16)}<span>${esc(authMsg)}</span></p>`:""}
      ${reg?"":`<p class="muted small" style="text-align:center"><button type="button" class="linkbtn" data-do="agreset">Elfelejtett jelszó</button></p>`}</section>
    ${authForce?"":`<section class="card"><h2>Meghívót kaptál a stábtól?</h2><p class="muted small">Ha egy pozícióra hívtak meg (pl. rendező, AD, szkriptes, stáb), fiók nélkül is csatlakozhatsz a kóddal.</p>
      <button class="btn" type="button" data-do="agjoin">${ic("users",16)}Csatlakozás kóddal</button><div id="agjoinbox" hidden>${joinHTML()}</div></section>`}
    ${off?`<section class="card"><p class="muted small">Most nincs internet, ezért a belépés nem megy. Folytathatod fiók nélkül, és később beléphetsz (Info → Fiók).</p><button class="btn" type="button" data-do="agskip">Folytatás net nélkül</button></section>`:""}
    ${creditLine()}</div>`;
}
function authShow(force){
  let g=$("#authgate");
  if(!g){g=document.createElement("div");g.className="authgate";g.id="authgate";g.setAttribute("role","dialog");g.setAttribute("aria-modal","true");g.setAttribute("aria-label","Belépés");document.body.append(g);force=true}
  if(force){const keep={};g.querySelectorAll("input[id]").forEach(i=>{if(i.type!=="password"||authMsg)keep[i.id]=i.value});
    g.innerHTML=authHTML();for(const [k,v] of Object.entries(keep)){const i=g.querySelector("#"+k);if(i&&v)i.value=v}
    document.documentElement.classList.add("authed-gate")}
}
function authGate(){if(authNeeded())authShow(false);else{const g=$("#authgate");if(g){g.remove();document.documentElement.classList.remove("authed-gate")}}}
async function authSubmit(btn){
  const reg=authMode==="reg",m=(($("#agmail")||{}).value||"").trim(),pw=($("#agpw")||{}).value||"",nm=(($("#agname")||{}).value||"").trim();
  if(!m||!pw||reg&&!nm){authMsg=reg?"Add meg a neved, az e-mailt és a jelszót.":"Add meg az e-mailt és a jelszót.";authShow(true);return}
  if(accBusy)return;accBusy=true;btn.disabled=true;authMsg="";
  try{await fbInit();
    if(reg){const u=fauth.currentUser;
      if(u&&u.isAnonymous)await u.linkWithCredential(firebase.auth.EmailAuthProvider.credential(m,pw));
      else await fauth.createUserWithEmailAndPassword(m,pw);
      try{await fauth.currentUser.updateProfile({displayName:nm})}catch(e){}
      MP.name=nm;
    }else{
      if(MP.on)await mpLeave(true);
      await fauth.signInWithEmailAndPassword(m,pw);
      MP.name=fauth.currentUser.displayName||MP.name||"";
    }
    UID=fauth.currentUser.uid;accSave({email:m,name:MP.name});mpSaveLocal();if(MP.on)myProjRec();
    authForce="";accBusy=false;authGate();
    const pj=pendingJoin();
    if(pj){const nn=localStorage.getItem(JOINNAME)||MP.name||m.split("@")[0];try{localStorage.removeItem(JOINNAME)}catch(e){}await mpJoin(pj,nn);return}
    if(reg)toast(`Üdv, ${MP.name}! A fiókod kész.`,{tone:"ok"});
    else{toast("Beléptél.",{tone:"ok"});await accRefreshList();if(accList&&accList.length&&!MP.on){location.hash="#info";setTimeout(()=>{const c=$("#acctcard");c&&c.scrollIntoView({block:"start"})},250)}}
    renderAll();
  }catch(e){authMsg=accErr(e);accBusy=false;btn.disabled=false;authShow(true)}
  accBusy=false;
}
document.addEventListener("click",e=>{const t=e.target.closest("[data-agmode],[data-do]");if(!t||!t.closest("#authgate"))return;const d=t.dataset;
  if(d.agmode){authMode=d.agmode;authMsg="";authShow(true);return}
  if(d.do==="agsubmit")authSubmit(t);
  else if(d.do==="agreset"){const m=(($("#agmail")||{}).value||"").trim();if(!m){authMsg="Írd be fent az e-mail-címed, és koppints újra.";authShow(true);return}
    fbInit().then(()=>fauth.sendPasswordResetEmail(m)).then(()=>toast("Elküldtük a jelszó-visszaállító e-mailt (nézd meg a spam mappát is).",{tone:"ok",ms:6000})).catch(e=>{authMsg=accErr(e);authShow(true)})}
  else if(d.do==="agjoin"){const b=$("#agjoinbox");if(b){b.hidden=!b.hidden;b.hidden||b.querySelector("#jcode").focus()}}
  else if(d.do==="agskip"){try{sessionStorage.setItem("aperation-authskip","1")}catch(e){}authGate()}});
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.closest&&e.target.closest("#authgate")&&e.target.matches("#agpw,#agmail,#agname")){const b=$('#authgate [data-do="agsubmit"]');b&&b.click()}});
addEventListener("online",()=>{if($("#authgate"))authShow(true)});addEventListener("offline",()=>{if($("#authgate"))authShow(true)});
