/* ---------- forgatókönyv: jelölés tervezéskor, olvasás forgatás közben ----------
   Tervezéskor (Terv → Forgatókönyv) a bemásolt szöveg forgatókönyv-formában látszik, a jelenetek számozva.
   Fent a terv beállításai (1/1, 1/2, 2/1 …): egyet kiválasztva a sorokra koppintva jelölöd, melyik részt veszi
   (a jelenet címére koppintva az egész jelenetet, Tartomány módban az első és utolsó sort). A margón minden
   sornál látszik, melyik beállítás veszi. Forgatás közben a Most nézetben az épp forgó beállítás teljes
   jelenete olvasható, a vett sorok kiemelve. */
let scrMode="mark",markShot=null,markRange=false,markAnchor=null;
const natCmp=(a,b)=>String(a).localeCompare(String(b),"hu",{numeric:true});
function planShotIds(){const s=new Set();P.blocks.forEach(b=>{if(b.type==="shoot")shotIds(b.label).forEach(i=>s.add(i))});return[...s].sort(natCmp)}
function scrPasteCard(open){
  return`<section class="card"><h2>${P.script.length?"Szöveg hozzáadása vagy cseréje":"Forgatókönyv beillesztése"}</h2>
    <p class="muted small">Másold be a forgatókönyvet (pl. Wordből vagy PDF-ből). Az app magától szétszedi: <b>BELSŐ. / KÜLSŐ.</b> = jelenet, <b>NAGYBETŰS név</b> = szereplő, utána a dialógus, <b>(zárójel)</b> = instrukció.</p>
    <textarea id="scrpaste" rows="${open?8:4}" placeholder="BELSŐ. KONYHA – NAPPAL&#10;Anna az ablaknál áll.&#10;ANNA&#10;(halkan)&#10;Megint esik."></textarea>
    <div class="wgrid"><button class="btn sm ${P.script.length?"":"solid"}" type="button" data-do="scradd">${P.script.length?"Hozzáfűzés a végéhez":"Beolvasás"}</button>${P.script.length?`<button class="btn sm danger" type="button" data-do="scrrep">Csere</button>`:""}</div></section>`;
}
function scriptEditHTML(){
  const ids=planShotIds();if(!markShot||!ids.includes(markShot))markShot=ids[0]||null;
  if(!P.script.length)return`<section class="card"><h2>Így működik</h2><ol class="gsteps">
      <li>Másold be lent a forgatókönyvet.</li><li>Válaszd ki fent a beállítást (pl. <b>1/2</b>), és koppints a sorokra, amelyeket az a beállítás vesz.</li>
      <li>Forgatás közben a <b>Most</b> nézetben az épp forgó beállításnál a teljes jelenet olvasható, a vett rész kiemelve.</li></ol></section>${scrPasteCard(true)}`;
  const modes=`<div class="seg" style="margin-bottom:12px" role="group" aria-label="Mód">${[["mark","Jelölés"],["edit","Szöveg szerkesztése"]].map(([k,l])=>`<button type="button" data-scrmode="${k}" aria-pressed="${scrMode===k}">${l}</button>`).join("")}</div>`;
  if(scrMode==="edit")return modes+`<section class="card"><h2>Sorok</h2><p class="muted small">Itt a szöveget és a sorok fajtáját javíthatod. Hogy melyik beállítás melyik sort veszi, azt a <b>Jelölés</b> módban állítod be a legkönnyebben.</p>
      <div class="etab">${P.script.map((l,k)=>`<div class="er sr" data-list="script" data-k="${k}"><label class="fi w2"><span class="flab">Típus</span><select data-f="t">${STYPES.map(([a,b])=>`<option value="${a}" ${a===l.t?"selected":""}>${b}</option>`).join("")}</select></label>
        ${fld("x",l.x,{label:"Szöveg",area:1,cls:"span2"})}${fld("ids",(l.ids||[]).join(", "),{label:"Beállítások",ph:"1/1, 1/2",cls:"w2"})}<button type="button" class="ib del" data-act="rowdel" aria-label="Sor törlése">${ic("x",16)}</button></div>`).join("")}</div>
      <button type="button" class="btn sm" data-act="rowadd" data-list="script">${ic("plus",14)}Új sor</button></section>${scrPasteCard(false)}`;
  const cnt=id=>P.script.filter(l=>(l.ids||[]).includes(id)).length,missing=ids.filter(id=>!cnt(id));
  let sc=0;
  const lines=P.script.map((l,k)=>{if(l.t==="sh")sc++;const has=!!markShot&&(l.ids||[]).includes(markShot);
    return`<div class="ln mk ${has?"hot":""} ${markAnchor===k?"anchor":""} ${l.t==="sh"?"scene":""}" data-mline="${k}" ${l.t==="sh"?`data-scene="${sc}"`:""}>
      <div class="gut">${(l.ids||[]).slice().sort(natCmp).map(x=>`<span class="mini ${x===markShot?"hot":""}">${esc(x)}</span>`).join("")}</div>
      <div class="script"><div class="${l.t}">${l.t==="sh"?`<span class="scn">${sc}.</span>`:""}${esc(l.x)}</div></div></div>`}).join("");
  return modes+`${ids.length?`<section class="card scr-help"><p class="muted small">Válaszd ki a beállítást, majd koppints a sorokra, amelyeket az vesz. A <b>jelenet címére</b> koppintva az egész jelenet ki-be kapcsol. Egy sor több beállításhoz is tartozhat.</p>
      ${missing.length?`<p class="eb-warn">${ic("alert",16)}<span>${missing.length===ids.length?"Még egyik beállításhoz sincs kijelölt rész.":`Még nincs kijelölt rész: ${missing.map(esc).join(", ")}.`}</span></p>`:`<p class="muted small" style="color:var(--ok)">${ic("check",14)} Minden beállításhoz van kijelölt rész.</p>`}</section>`:""}
    <section class="card scr-tools">
      ${ids.length?`<div class="schips">${ids.map(id=>`<button type="button" class="schip ${id===markShot?"on":""} ${cnt(id)?"":"empty"}" data-mshot="${esc(id)}" aria-pressed="${id===markShot}">${esc(id)}<small>${cnt(id)||"–"}</small></button>`).join("")}</div>
      <div class="scr-row"><label class="fi chkf"><input type="checkbox" data-mrange ${markRange?"checked":""}><span>Tartomány</span></label>
        <span class="muted small">${markAnchor!=null?"<b>Most koppints az utolsó sorra.</b>":markRange?"Koppints az első, majd az utolsó sorra.":`Jelölés: <b>${esc(markShot)}</b>`}</span></div>`
      :`<p class="muted">A jelöléshez előbb legyenek forgatási blokkok az <b>Időrend</b>ben (pl. 1/1, 1/2).</p>`}
    </section>
    <section class="card fs scr-mark" style="padding:14px 8px;gap:0">${lines}</section>${scrPasteCard(false)}`;
}
function scrSet(i,on){const l=P.script[i];if(!l||!markShot)return;l.ids=l.ids||[];const has=l.ids.includes(markShot);
  if(on&&!has)l.ids.push(markShot);if(!on&&has)l.ids=l.ids.filter(x=>x!==markShot)}
document.addEventListener("click",e=>{
  if(!e.target.closest||!e.target.closest('[data-view="terv"]'))return;
  const sm=e.target.closest("[data-scrmode]");if(sm){scrMode=sm.dataset.scrmode;markAnchor=null;renderEdit();return}
  const ch=e.target.closest("[data-mshot]");if(ch){markShot=ch.dataset.mshot;markAnchor=null;renderEdit();
    const f=document.querySelector(".scr-mark .ln.hot")||document.querySelector(`.scr-mark [data-scene="${parseInt(markShot)}"]`);
    f&&f.scrollIntoView({block:"center",behavior:"smooth"});return}
  const ln=e.target.closest("[data-mline]");if(!ln)return;
  if(!markShot){toast("Előbb legyen forgatási blokk az Időrendben.");return}
  const k=+ln.dataset.mline,l=P.script[k];
  if(l.t==="sh"&&!markRange){   // jelenet címe: az egész jelenet ki/be
    let j=k+1;const r=[];while(j<P.script.length&&P.script[j].t!=="sh")r.push(j++);
    const all=r.length&&r.every(i=>(P.script[i].ids||[]).includes(markShot));r.forEach(i=>scrSet(i,!all));
  }else if(markRange){
    if(markAnchor==null){markAnchor=k;scrSet(k,true)}
    else{const a=Math.min(markAnchor,k),b=Math.max(markAnchor,k);for(let i=a;i<=b;i++)if(P.script[i].t!=="sh")scrSet(i,true);markAnchor=null}
  }else scrSet(k,!(l.ids||[]).includes(markShot));
  commit();renderEdit();
});
document.addEventListener("change",e=>{if(e.target.matches&&e.target.matches("[data-mrange]")){markRange=e.target.checked;markAnchor=null;renderEdit()}});

/* forgatás közben: a beállítás teljes jelenete(i) sztori-sorrendben, a vett sorok kiemelve */
let readSize=17;try{readSize=+localStorage.getItem("aperation-read-size")||17}catch(e){}
function sceneRead(ids){
  const sc=[];let cur=null,n=0;
  D.script.forEach(l=>{if(l.t==="sh"){n++;cur={h:l,n,lines:[]};sc.push(cur)}else{if(!cur){cur={h:null,n:0,lines:[]};sc.push(cur)}cur.lines.push(l)}});
  const lid=l=>l.cov.flatMap(c=>c.ids),hit=sc.filter(s=>s.lines.some(l=>lid(l).some(x=>ids.includes(x))));
  if(!hit.length)return"";
  return`<div class="readbar"><span class="muted small">A teljes jelenet, a <b>${esc(ids.join(", "))}</b> által vett rész kiemelve.</span>
      <span class="sizer"><button type="button" class="btn sm" data-rsize="-1" aria-label="Kisebb betű">A−</button><button type="button" class="btn sm" data-rsize="1" aria-label="Nagyobb betű">A+</button></span></div>
    <div class="script read" style="font-size:${readSize}px">${hit.map(s=>`${s.h?`<div class="sh"><span class="scn">${s.n}.</span>${esc(s.h.x)}</div>`:""}${s.lines.map(l=>{const on=lid(l).some(x=>ids.includes(x));
      return`<div class="${l.t} ${on?"on":"off"}">${esc(l.x)}</div>`}).join("")}`).join('<hr class="seghr">')}</div>`;
}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-rsize]");if(!b)return;
  readSize=Math.max(13,Math.min(26,readSize+(+b.dataset.rsize)*2));try{localStorage.setItem("aperation-read-size",readSize)}catch(x){}
  $$(".script.read").forEach(x=>x.style.fontSize=readSize+"px")});
