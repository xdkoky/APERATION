/* ---------- nyomtatható változatok ----------
   Diszpó, forgatókönyv, shotlist, szkriptlap az aktuális tervből. Nyomtatás (vagy PDF-mentés) a böngésző
   nyomtatási ablakával; ha az nem érhető el, a dokumentum HTML-fájlként menthető és onnan nyomtatható. */
const PRINT_CSS=/*__PRINT_CSS__*/"";
const PR_KINDS=[["diszpo","Diszpó"],["forgatokonyv","Forgatókönyv"],["shotlist","Shotlist"],["szkriptlap","Szkriptlap"]];
const prDate=()=>HASDATE?SHOOT_DATE.toLocaleDateString("hu-HU",{year:"numeric",month:"long",day:"numeric",weekday:"long"}):"";
const prHead=(kind)=>`<div class="pr-head"><div><div class="kind">${kind}</div><h1>${esc(D.title||"Forgatási nap")}</h1></div><div class="meta">${esc(prDate())}${D.location?`<br>${esc(D.location)}`:""}</div></div>`;
const prFoot=()=>`<div class="foot">APERATION™ · © ${COPY_YEAR} ${esc(AUTHOR)} · nyomtatva ${new Date().toLocaleString("hu-HU",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</div>`;
const prNotes=ns=>ns.length?`<ul class="notes">${ns.map(n=>`<li class="${isWarn(n)?"warn":""}">${esc(n)}</li>`).join("")}</ul>`:"";
const prLines=ls=>ls.map(l=>`<div class="${l.t}">${esc(l.x)}</div>`).join("");
const prShoots=()=>B.filter(b=>b.type==="shoot");
function prDiszpo(){
  const sh=prShoots(),lunch=B.find(b=>b.type==="lunch");
  const facts=[["Crew call",hm(D.plan.call)],["Első forgatás",sh[0]?hm(sh[0].s):"–"],["Ebéd",lunch?`${hm(lunch.s)}–${hm(lunch.e)}`:"–"],["Tervezett wrap",hm(PLAN_WRAP)],
    ...(D.plan.targetWrap?[["Wrap-határ",hm(TARGET)]]:[]),["Shotok",String(sh.length)],...(D.parking?[["Parkolás",D.parking]]:[])];
  const depts=[...new Set(D.crew.map(c=>c.dept))];
  return`<div class="pr-doc">${prHead("Napi diszpó")}
    <div class="facts">${facts.map(([k,v])=>`<div><small>${k}</small><b>${esc(v)}</b></div>`).join("")}</div>
    ${D.notes.length?`<h2>Fontos</h2>${prNotes(D.notes)}`:""}
    <h2>Időrend</h2><table><thead><tr><th class="num">Kezdés</th><th class="num">Vége</th><th class="num">Perc</th><th>Típus</th><th>Blokk / shot</th><th>Beállítás</th><th>Fény</th><th>Megjegyzés</th></tr></thead>
    <tbody>${B.map(b=>`<tr class="${b.type}"><td class="num">${hm(b.s)}</td><td class="num">${hm(b.e)}</td><td class="num">${b.d}′</td><td>${esc(TNAME[b.type])}</td><td>${esc(b.label)}</td><td>${esc(b.setup)}</td><td>${esc(b.group)}</td><td>${esc(b.note)}</td></tr>`).join("")}
    <tr class="shoot"><td class="num">${hm(PLAN_WRAP)}</td><td></td><td></td><td></td><td>WRAP</td><td colspan="3"></td></tr></tbody></table>
    ${D.cast.length?`<h2>Szereplők</h2><table><thead><tr><th>Szerep</th><th>Színész</th><th class="num">Érkezés</th><th class="num">Ruha</th><th class="num">Smink</th><th class="num">Haj</th><th class="num">Setre</th><th>Telefon</th></tr></thead>
      <tbody>${D.cast.map(c=>`<tr><td><b>${esc(c.role)}</b></td><td>${esc(c.name)}</td><td class="num">${esc(c.arr)}</td><td class="num">${esc(c.ruha)}</td><td class="num">${esc(c.smink)}</td><td class="num">${esc(c.haj)}</td><td class="num">${esc(c.onset)}</td><td class="num">${esc(c.phone||"")}</td></tr>`).join("")}</tbody></table>`:""}
    ${D.crew.length?`<h2>Stáb</h2><table><thead><tr><th>Pozíció</th><th>Név</th><th class="num">Érkezés</th><th>Telefon</th></tr></thead>
      <tbody>${depts.map(dp=>`<tr class="dept"><td colspan="4">${esc(dp)}</td></tr>${D.crew.filter(c=>c.dept===dp).map(c=>`<tr><td>${esc(c.pos)}</td><td><b>${esc(c.name)}</b></td><td class="num">${esc(c.arr)}</td><td class="num">${esc(c.phone||"")}</td></tr>`).join("")}`).join("")}</tbody></table>`:""}
    ${Object.keys(D.groups).length?`<h2>Fénybeállítások</h2><table><tbody>${Object.entries(D.groups).map(([k,g])=>`<tr><td style="width:14mm"><b>${esc(k)}</b></td><td><b>${esc(g[0])}</b>${g[1]?` · ${esc(g[1])}`:""}</td></tr>`).join("")}</tbody></table>`:""}
    ${prFoot()}</div>`;
}
function prScript(){
  if(!D.script.length)return`<div class="pr-doc">${prHead("Forgatókönyv")}<p>A tervben nincs szkript. A Terv → Szkript részen bemásolható.</p>${prFoot()}</div>`;
  let prev="";
  return`<div class="pr-doc">${prHead("Forgatókönyv")}<div class="scr">${D.script.map(l=>{const ids=[...new Set(l.cov.flatMap(c=>c.ids))],key=ids.join(", "),show=key&&key!==prev;prev=key;
    return`<div class="ln"><div class="tag">${show?esc(key):""}</div><div class="${l.t}">${esc(l.x)}</div></div>`}).join("")}</div>${prFoot()}</div>`;
}
function prShotlist(){
  const sh=prShoots();
  return`<div class="pr-doc">${prHead("Shotlist")}<table class="sl"><thead><tr><th class="num">#</th><th class="num">Idő</th><th>Shot</th><th>Beállítás · fény</th><th>Szereplők · kellék</th><th>Sztori · megjegyzés</th><th>Storyboard</th></tr></thead><tbody>
    ${sh.map((b,n)=>{const s=D.shots[b.label]||{talent:[],props:[],sb:[],vk:[],story:""},g=G(b.group);
      return`<tr><td class="num">${n+1}</td><td class="num">${hm(b.s)}<br><small>${b.d}′</small></td><td><span class="shot">${esc(b.label)}</span></td>
        <td>${esc(b.setup)}${b.group?`<br><small><b>${esc(b.group)}</b>${g?` · ${esc(g[0])}`:""}</small>`:""}</td>
        <td>${esc(s.talent.join(", "))}${s.props.length?`<br><small>${s.props.map(esc).join(" · ")}</small>`:""}</td>
        <td>${esc(s.story)}${b.note?`<br><small>${esc(b.note)}</small>`:""}</td>
        <td class="img">${s.sb.slice(0,2).map(x=>`<img src="${esc(x.f)}" alt="">`).join("")}</td></tr>`}).join("")}
    </tbody></table>${prFoot()}</div>`;
}
function prSkript(){
  const sh=prShoots();
  if(!sh.length)return`<div class="pr-doc">${prHead("Szkriptlap")}<p>A tervben nincs forgatási blokk.</p></div>`;
  const rows=10;
  return`<div class="pr-doc">${sh.map((b,n)=>{const s=D.shots[b.label]||{talent:[],segs:[],props:[]};
    const ex=s.segs.flatMap(g=>g.lines).slice(0,14);
    return`<div class="sk"><div class="sk-head"><div class="shot">${esc(b.label)}</div>
      <div class="info"><b>${esc(b.setup||"")}</b>${b.group?` · fény ${esc(b.group)}`:""}<br>${hm(b.s)}–${hm(b.e)} · ${b.d}′${s.talent.length?` · ${esc(s.talent.join(", "))}`:""}</div>
      <div class="proj">${esc(D.title||"")}<br>Szkriptlap ${n+1} / ${sh.length}</div></div>
      ${ex.length?`<div class="sk-ex">${prLines(ex)}</div>`:""}
      <table><thead><tr><th style="width:12mm">Take</th><th style="width:16mm">Idő</th><th style="width:14mm">Hossz</th><th style="width:12mm">Jó?</th><th>Megjegyzés (játék, szöveg, technika)</th></tr></thead>
      <tbody>${Array.from({length:rows},(_,i)=>`<tr><td class="num">${i+1}</td><td></td><td></td><td style="text-align:center">☐</td><td></td></tr>`).join("")}</tbody></table>
      <div class="two"><div class="box"><small>Kontinuitás: ruha, kellék, pozíció, irány</small>${s.props&&s.props.length?`<div style="font-size:8pt;color:#555;margin-top:2pt">${s.props.map(esc).join(" · ")}</div>`:""}<div class="lines"></div></div>
        <div class="box"><small>Optika · hang · egyéb</small><div class="lines"></div></div></div>
    </div>`}).join("")}</div>`;
}
const PRINT={diszpo:prDiszpo,forgatokonyv:prScript,shotlist:prShotlist,szkriptlap:prSkript};
function prBuild(kinds){return`<div class="pr">${kinds.map(k=>PRINT[k]()).join('<div class="pr-break"></div>')}</div>`}
function prName(kinds){const t=(D.title||"terv").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^A-Za-z0-9]+/g,"_").replace(/^_|_$/g,"").slice(0,40)||"terv";
  return`${t}_${kinds.length>1?"nyomtatvanyok":kinds[0]}${P.date?"_"+P.date:""}`}
function prDoc(kinds){return`<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(prName(kinds))}</title>
<style>@page{size:A4;margin:12mm}body{margin:0;background:#fff}@media screen{.pr{max-width:190mm;margin:10mm auto;padding:0 6mm}.pr-break{border-top:1px dashed #bbb;margin:12mm 0}}${PRINT_CSS}</style></head><body>${prBuild(kinds)}</body></html>`}
async function doPrint(kinds){
  if(!B.length){toast("Előbb legyen egy terv.");return}
  let root=$("#printroot");if(!root){root=document.createElement("div");root.id="printroot";document.body.append(root)}
  root.innerHTML=prBuild(kinds);
  await Promise.all([...root.querySelectorAll("img")].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r;setTimeout(r,4000)})));
  try{if(document.fonts&&document.fonts.ready)await document.fonts.ready}catch(e){}
  try{window.print()}catch(e){toast("A nyomtatás itt nem érhető el. Mentsd fájlba, és onnan nyomtasd.",{action:"Mentés",fn:()=>prSave(kinds)})}
}
function prSave(kinds){saveFile(prName(kinds)+".html",new Blob([prDoc(kinds)],{type:"text/html"}),"text/html")}
function printCard(){
  return`<section class="card"><h2>Nyomtatás</h2>
    <p class="muted small">A mostani tervből készül, A4-re. A nyomtatás ablakában <b>PDF-be is mentheted</b> (iPhone-on: Nyomtatás → Megosztás → Mentés a Fájlokba). A szkriptlapon shotonként egy oldal, sok hellyel a jegyzeteknek.</p>
    <div class="wgrid">${PR_KINDS.map(([k,l])=>`<button class="btn" type="button" data-print="${k}" ${B.length?"":"disabled"}>${ic("doc",16)}${l}</button>`).join("")}</div>
    <div class="wgrid"><button class="btn solid" type="button" data-print="all" ${B.length?"":"disabled"}>${ic("doc",16)}Mind a négy egyben</button></div>
    <p class="muted small">Ha a nyomtatás nem nyílik meg: <button type="button" class="linkbtn" data-printsave="all" ${B.length?"":"disabled"}>mentés fájlba</button>, és onnan nyomtatható.</p></section>`;
}
document.addEventListener("click",e=>{const t=e.target.closest("[data-print],[data-printsave]");if(!t)return;
  const v=t.dataset.print||t.dataset.printsave,kinds=v==="all"?PR_KINDS.map(x=>x[0]):[v];
  if(t.dataset.printsave)prSave(kinds);else doPrint(kinds)});
