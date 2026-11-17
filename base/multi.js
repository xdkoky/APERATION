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
const LIVEKEYS=["cur","act","skip","ext","checkin"];
const PERMS=[["most","Most"],["idorend","Időrend"],["szkript","Forgatókönyv"],["stab","Stáb"],["phones","Telefonszámok"],["images","Képek"],["props","Kellékek"],["notes","Megjegyzések"],["lights","Fények"],["takes","Take-napló"],["control","Vezérlés"]];
const PERM_HELP={most:"a Most nézet",idorend:"a napi időrend",szkript:"a forgatókönyv szövege és a sztori",stab:"a stáblista",phones:"a telefonszámok",images:"storyboard és vilkó",props:"kellékek, kontinuitás",notes:"megjegyzések, fontos tudnivalók",lights:"a fények leírása",takes:"take stopper, jó take csillag, jegyzet minden take-hez (a napot nem vezérli)",control:"Kész, Vissza, +5′, take, érkezés"};
const permOf=s=>Object.fromEntries(PERMS.map(([k])=>[k,s.split(" ").includes(k)]));
const ALLPERM=permOf(PERMS.map(p=>p[0]).join(" "));
const PRESETS=[["2nd AD","most idorend szkript stab phones images props notes lights takes control"],["Rendező","most idorend szkript stab phones images props notes lights"],
  ["Operatőr","most idorend szkript stab phones images props notes lights"],["Szkriptes","most idorend szkript stab images props notes takes"],
  ["Világítás","most idorend stab images notes lights"],["Berendező, kellékes","most idorend stab images props notes"],["Smink, jelmez","most idorend stab notes"],
  ["Hang","most idorend szkript stab notes"],["Színész","most idorend szkript"],["Stáb (általános)","most idorend"]];
const RAND=(n,al="ABCDEFGHJKLMNPQRSTUVWXYZ23456789")=>{const a=new Uint32Array(n);crypto.getRandomValues(a);return[...a].map(x=>al[x%al.length]).join("")};
const RID=n=>RAND(n,"abcdefghijkmnpqrstuvwxyz23456789");
const fmtCode=c=>c?c.slice(0,4)+"-"+c.slice(4):"";
const normCode=c=>String(c||"").toUpperCase().replace(/[^A-Z0-9]/g,"");

let MP={on:false};
try{MP=Object.assign({on:false},JSON.parse(localStorage.getItem(MPKEY)||"null")||{})}catch(e){}
MP.ready=false;MP.roles=[];MP.members=[];MP.lastPub=0;MP.lastPush=0;MP.liveTs=0;
const mpSaveLocal=()=>{try{const {on,mode,pid,roleId,code,name,perm,roleName,title}=MP;localStorage.setItem(MPKEY,JSON.stringify({on,mode,pid,roleId,code,name,perm,roleName,title}))}catch(e){}};
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

/* szűrt terv egy pozíciónak */
function filterP(p,perm){
  const q=JSON.parse(JSON.stringify(p));
  q.blocks.forEach(b=>{b.images=perm.images?(b.images||[]).filter(x=>x.url):[];if(!perm.props)b.props="";if(!perm.notes)b.note="";if(!perm.szkript)b.story=""});
  if(!perm.notes)q.notes=[];if(!perm.lights)q.groups=q.groups.map(g=>({...g,desc:""}));
  q.groups=q.groups.map(g=>({...g,images:perm.images&&perm.lights?(g.images||[]).filter(x=>x.url):[]}));
  if(!perm.szkript)q.script=[];if(!perm.stab)q.crew=[];
  q.shots=(q.shots||[]).map(s=>({...s,images:perm.images?(s.images||[]).filter(x=>x.url):[],props:perm.props?s.props:"",story:perm.szkript?s.story:"",note:perm.notes?s.note:""}));
  if(!perm.phones){q.cast.forEach(c=>c.phone="");q.crew.forEach(c=>c.phone="")}
  return q;
}
let pubT=null;
function mpPublishSoon(){if(!isMpAdmin()||!MP.ready||tour||mpApplying)return;clearTimeout(pubT);pubT=setTimeout(mpPublish,1200)}
function mpPublish(){
  if(!fdb||!isMpAdmin())return;const ts=Date.now();MP.lastPub=ts;const b=fdb.batch(),r0=pref();
  b.set(r0.collection("views").doc("__admin"),{plan:JSON.stringify(P),perm:ALLPERM,roleName:"Szerkesztő",ts,by:UID});
  for(const r of MP.roles)b.set(r0.collection("views").doc(r.id),{plan:JSON.stringify(filterP(P,r.perm)),perm:r.perm,roleName:r.name,ts,by:UID});
  b.update(r0,{title:P.title||"",ts});
  return b.commit().catch(mpErr);
}
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
function takesRedraw(){takesHold=false;if(view==="most")renderMost();else if(view==="idorend")renderTimeline()}
function mpOnView(s){
  if(!s.exists){if(isMember())mpLost();return}
  const d=s.data();
  if(isMpAdmin()&&(d.by===UID||d.ts<=MP.lastPub))return;
  if(tour){MP.pendView=s;return}
  let p;try{p=JSON.parse(d.plan)}catch(e){return}
  if(isMember()){MP.perm=d.perm;MP.roleName=d.roleName}
  MP.title=p.title;mpSaveLocal();
  mpApplying=true;P=normP(p);saveP();applyProject();mpApplying=false;
  tabKey="";if(view==="terv"&&document.activeElement&&document.activeElement.closest('[data-view="terv"]'))tick(true);else renderAll();
}
function mpFlush(){const v=MP.pendView,l=MP.pendLive,tk=MP.pendTakes;MP.pendView=MP.pendLive=MP.pendTakes=null;if(v)mpOnView(v);if(l)mpOnLive(l);if(tk)mpOnTakes(tk)}
let unsubs=[];
function mpStop(){unsubs.forEach(u=>{try{u()}catch(e){}});unsubs=[];MP.ready=false}
function mpListen(){
  mpStop();const r0=pref(),vid=isMpAdmin()?"__admin":MP.roleId;
  unsubs.push(r0.collection("views").doc(vid).onSnapshot(mpOnView,e=>e.code==="permission-denied"&&isMember()?mpLost():mpErr(e)));
  unsubs.push(r0.collection("live").doc("state").onSnapshot(mpOnLive,e=>e.code==="permission-denied"&&isMember()?mpLost():mpErr(e)));
  unsubs.push(r0.collection("live").doc("takes").onSnapshot(mpOnTakes,e=>e.code==="permission-denied"&&isMember()?mpLost():mpErr(e)));
  // ha a szerkesztő kitilt, a saját tagsági dokumentum eltűnik
  if(MP.roleId!=="__owner")unsubs.push(r0.collection("members").doc(UID).onSnapshot(s=>{if(!s.exists&&!s.metadata.hasPendingWrites&&!s.metadata.fromCache)mpLost()},e=>{if(e.code==="permission-denied")mpLost()}));
  if(isMpAdmin()){
    unsubs.push(r0.collection("roles").onSnapshot(q=>{
      MP.roles=q.docs.filter(d=>d.id!=="__admin").map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.order||0)-(b.order||0));
      const a=q.docs.find(d=>d.id==="__admin");MP.adminCode=a?a.data().code:"";
      // régebbi projektek: a szkriptes és a 2nd AD megkapja a take-naplót
      MP.roles.forEach(r=>{if(r.perm&&r.perm.takes===undefined){r.perm.takes=/szkript|2nd ad/i.test(r.name||"");mpRoleSave(r)}});
      mpTeamRefresh()},mpErr));
    unsubs.push(r0.collection("members").onSnapshot(q=>{MP.members=q.docs.map(d=>({uid:d.id,...d.data()}));mpTeamRefresh()},mpErr));
  }
  MP.ready=true;
}
function mpTeamRefresh(){if(view==="terv"&&editSec==="csapat"&&!(document.activeElement&&document.activeElement.closest(".team")))renderEdit()}
function mpLost(){if(!MP.on||MP.leaving)return;MP.leaving=true;toast("Kikerültél a közös projektből: a szerkesztő törölte a pozíciódat vagy kitiltott.",{tone:"late",ms:8000});mpLeave(true)}

/* létrehozás, belépés, kilépés */
async function mpCreate(btn){
  if(!P.blocks.length){toast("Előbb legyen egy terv: tölts be Excelt, vagy írd be a napot.");return}
  if(btn){btn.disabled=true;btn.textContent="Létrehozás…"}
  try{
    await fbInit();const pid=RID(20),r0=fdb.collection("projects").doc(pid),ts=Date.now();
    await r0.set({owner:UID,title:P.title||"",created:ts,ts});
    const b=fdb.batch(),acode=RAND(8);
    MP={...MP,on:true,mode:"admin",pid,roleId:"__owner",code:acode,name:"",perm:ALLPERM,roleName:"Szerkesztő",title:P.title,roles:[],members:[]};
    PRESETS.forEach(([name,s],k)=>{const id=RID(12),code=RAND(8),perm=permOf(s);MP.roles.push({id,name,perm,code,order:k});
      b.set(r0.collection("roles").doc(id),{name,perm,code,order:k});b.set(fdb.collection("codes").doc(code),{pid,roleId:id})});
    b.set(r0.collection("roles").doc("__admin"),{name:"Szerkesztő (társ-AD)",admin:true,code:acode,order:-1});b.set(fdb.collection("codes").doc(acode),{pid,roleId:"__admin"});
    await b.commit();MP.adminCode=acode;mpSaveLocal();mpListen();await mpPublish();mpPush();mpPushTakes(null);
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
    await fdb.collection("projects").doc(pid).collection("members").doc(UID).set({code:c,roleId,name:name.trim(),joined:Date.now()});
    if(!MP.on){try{localStorage.setItem(LOCALP,JSON.stringify(P));localStorage.setItem(LOCALS,JSON.stringify(st))}catch(e){}}
    MP={...MP,on:true,mode:roleId==="__admin"?"admin":"member",pid,roleId,code:c,name:name.trim(),perm:roleId==="__admin"?ALLPERM:null,roleName:"",title:"",roles:[],members:[],lastPub:0,liveTs:0};
    if(isMember()){P=normP({});applyProject()}
    const s=st.sound;st=fresh();st.sound=s;mpApplying=true;save();mpApplying=false;
    mpSaveLocal();mpListen();location.hash="#most";renderAll();
    toast(isMember()?"Csatlakoztál. A terv mindjárt megjelenik.":"Csatlakoztál szerkesztőként.",{tone:"ok"});return true;
  }catch(e){mpErr(e);return false}
}
async function mpLeave(silent){
  const was={...MP};mpStop();
  if(was.mode==="member"&&fdb&&UID&&!silent){try{await fdb.collection("projects").doc(was.pid).collection("members").doc(UID).delete()}catch(e){}}
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
    for(const sub of ["views","roles","members","live"]){const q=await r0.collection(sub).get();for(const d of q.docs){if(sub==="roles"&&d.data().code){try{await fdb.collection("codes").doc(d.data().code).delete()}catch(e){}}await d.ref.delete()}}
    await r0.delete();
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
    <p class="muted">Ha megosztod a tervet, minden pozíció (2nd AD, operatőr, szkriptes, kellékes, színész…) kap egy <b>belépőkódot</b>. Aki beírja, a saját telefonján élőben látja a napot: mi megy most, mennyit csúsztunk, mi jön. Te döntöd el pozíciónként, <b>ki mit lát</b>, és ki <b>vezérelheti</b> a napot (Kész, +5′, take, érkezések).</p>
    <ul class="list"><li>A rejtett adatot (pl. telefonszám, forgatókönyv) a szerver el sem küldi annak, akinek nem szabad látnia.</li><li>Térerő nélkül is megy tovább; amikor visszajön a net, szinkronizál.</li><li>A terv szerkesztése nálad marad. A változtatások pár másodperc múlva mindenkinél megjelennek.</li></ul>
    <button class="btn solid" type="button" data-do="mpcreate" ${P.blocks.length?"":"disabled"}>${ic("users",16)}Közös projekt indítása</button>
    ${P.blocks.length?"":`<p class="muted small">Előbb legyen egy terv a Fájl vagy az Időrend részen.</p>`}</section>`;
  const cnt=id=>MP.members.filter(m=>m.roleId===id).length;
  return`<div class="team">
    <section class="card" id="teamcard"><div class="card-head"><h2>Közös projekt</h2><span class="chip" style="--c:var(--ok)">${ic("check",14)}Élő</span></div>
      <p class="muted small">A kódot küldd el annak, aki az adott pozícióban dolgozik. A telepíthető változatban: <b>Kezdés → Csatlakozás kóddal</b> (vagy Info fül).</p>
      ${MP.roleId==="__owner"||MP.adminCode?`<div class="code-row"><div><b>Szerkesztői kód</b><small>társ-AD-nak: mindent lát és szerkeszt</small></div><button type="button" class="codebtn num" data-copy="${MP.adminCode||""}">${fmtCode(MP.adminCode||"")}</button><button type="button" class="btn sm" data-do="admincode">Új kód</button></div>`:""}
    </section>
    <section class="card"><div class="card-head"><h2>Pozíciók</h2><span class="chip neutral">${MP.roles.length}</span></div>
      <p class="muted small">Koppints a jelölőkre: kiemelve, amit az adott pozíció lát. A <b>Vezérlés</b> jog a nap léptetése.</p>
      <div class="roles">${MP.roles.map(r=>`<div class="role" data-rid="${r.id}">
        <div class="role-top"><input class="rname" data-rname value="${esc(r.name)}" aria-label="Pozíció neve"><button type="button" class="codebtn num" data-copy="${r.code}">${fmtCode(r.code)}</button></div>
        <div class="perms">${PERMS.map(([k,l])=>`<button type="button" class="perm ${r.perm[k]?"on":""} ${k==="control"?"ctl":""}" data-perm="${k}" aria-pressed="${!!r.perm[k]}" title="${esc(PERM_HELP[k])}">${l}</button>`).join("")}</div>
        <div class="role-act"><span class="muted small">${cnt(r.id)} csatlakozott</span><span style="flex:1"></span><button type="button" class="btn sm" data-do="rolecode">Új kód</button><button type="button" class="btn sm danger" data-do="roledel">${ic("x",14)}Törlés</button></div></div>`).join("")}</div>
      <button type="button" class="btn sm" data-do="roleadd">${ic("plus",14)}Új pozíció</button></section>
    <section class="card"><h2>Csatlakozott emberek</h2>${MP.members.length?`<div class="rows">${MP.members.map(m=>{const r=m.roleId==="__admin"?{name:"Szerkesztő"}:MP.roles.find(x=>x.id===m.roleId)||{name:"?"};return`<div class="row" style="grid-template-columns:minmax(0,1fr) auto"><div><b>${esc(m.name||"Névtelen")}</b><small>${esc(r.name)}</small></div><button type="button" class="btn sm danger" data-kick="${m.uid}">Kitiltás</button></div>`}).join("")}</div>`:`<p class="muted small">Még senki. Ha valaki beírja a kódját, itt megjelenik.</p>`}</section>
    <section class="card"><h2>Kapcsolat</h2><div class="wgrid">${MP.roleId==="__owner"?`<button type="button" class="btn danger" data-do="mpdelete">${ic("x",16)}Közös projekt törlése</button>`:""}<button type="button" class="btn" data-do="mpleave">Leválasztás erről az eszközről</button></div>
      <p class="muted small">${MP.roleId==="__owner"?"Törlés után a kódok nem működnek, és a stáb telefonjáról is eltűnik a terv. ":""}Leválasztás után ez az eszköz nem szinkronizál tovább; a többieknél minden marad.</p></section>
  </div>`;
}
/* felület: csatlakozás (Kezdés, Info) */
function joinHTML(){
  if(!MP_AVAIL)return"";
  return`<div class="join"><div class="eg"><label class="fi"><span class="flab">Belépőkód</span><input id="jcode" autocomplete="off" autocapitalize="characters" placeholder="ABCD-2345" maxlength="9" class="num"></label>
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
function mpBoot(){if(MP.on&&MP_AVAIL)fbInit().then(()=>{mpListen();renderAll()}).catch(mpErr)}
