/* ---------- shotlist (Terv → Shotlist) ----------
   A shotok a sztori sorrendjében, jelenetenként: szám, plánméret, optika, mozgás, leírás, szereplők, kellékek,
   sztori, storyboard, megjegyzés. Húzással átrendezhető. Egy gombbal az Időrendbe kerülnek (forgatási blokként),
   ott rakod forgatási sorrendbe. Amit itt beírsz, az időrendben és forgatás közben is megjelenik. */
const SL_SIZES=["Totál","Kistotál","Szekond","Amerikai","Félközeli","Közeli","Nagyközeli","Részlet / inzert","POV","Egyéb"];
const SL_MOVES=["Sticks","Kézi","Dolly","Gimbal","Steadicam","Svenk","Zoom","Daru","Drón","Autó"];
let openSL=null;
const slCode=s=>String(s.code||"").replace(/\s/g,"");
const slScene=s=>(slCode(s).match(/^(\d+)/)||[])[1]||"";
const slSetupOf=s=>[s.size,s.lens,s.move].filter(Boolean).join(", ");
function slScheduled(code){const r=[];B.forEach(b=>{if(b.type==="shoot"&&shotIds(b.label).includes(code))r.push(b)});return r}
function slNextCode(after){
  const all=P.shots.map(slCode).filter(Boolean);
  const base=after?slCode(after):(all[all.length-1]||"");const m=base.match(/^(\d+)\s*\/\s*(\d+)/);
  if(!m)return all.length?"":"1/1";
  let n=+m[2]+1;while(all.includes(`${m[1]}/${n}`))n++;return`${m[1]}/${n}`;
}
function slNewScene(){const sc=Math.max(0,...P.shots.map(s=>+slScene(s)||0))+1;return`${sc}/1`}
function slCard(s,k){
  const code=slCode(s),sch=code?slScheduled(code):[],open=openSL===s._id;
  const status=!code?`<span class="eb-warn sm">${ic("alert",14)}Adj neki számot (pl. 1/1)</span>`
    :sch.length?`<span class="slst ok">${ic("check",13)}Időrendben: ${sch.map(b=>`${hm(b.s)} · ${b.d}′`).join(", ")}</span>`
    :`<span class="slst">Még nincs az időrendben</span>`;
  return`<div class="eb sl" data-k="${k}" data-id="${s._id}" data-list="shots" data-type="shoot">
    <div class="eb-top"><button type="button" class="eb-drag" aria-label="Húzd az átrendezéshez: ${esc(code||"shot")}"><svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor" aria-hidden="true"><circle cx="4" cy="4" r="1.6"/><circle cx="10" cy="4" r="1.6"/><circle cx="4" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="4" cy="16" r="1.6"/><circle cx="10" cy="16" r="1.6"/></svg></button>
      ${fld("code",s.code,{ph:"1/1",cls:"slcode"})}
      <select data-f="size" aria-label="Plánméret"><option value="">Plán…</option>${SL_SIZES.map(x=>`<option ${x===s.size?"selected":""}>${x}</option>`).join("")}${s.size&&!SL_SIZES.includes(s.size)?`<option selected>${esc(s.size)}</option>`:""}</select>
      ${fld("desc",s.desc,{ph:"Mit látunk? (pl. Anna arca, Bence válla felett)",cls:"grow"})}
      <button type="button" class="ib" data-act="sltog" aria-expanded="${open}" aria-label="Részletek">${ic(open?"up":"dn",18)}</button></div>
    <div class="eb-sum sl-sum">${[s.lens,s.move,s.talent].filter(Boolean).map(esc).join(" · ")}</div>
    ${(()=>{const vk=(D&&D.vkByShot&&D.vkByShot[code])||[];return vk.length?`<div class="sl-vk" data-gallery>${vk.map(x=>`<button type="button" class="vkt" data-full="${esc(x.f)}" data-thumb="${esc(x.t)}" data-cap="Vilkó · ${esc(x.id)}" aria-label="Vilkó megnyitása: ${esc(x.id)}"><img src="${esc(x.t)}" alt=""></button>`).join("")}<span>${ic("img",13)}Vilkó${vk.length>1?` (${vk.length})`:""}: ${esc([...new Set(vk.map(x=>x.g?x.g+" · "+x.id:x.id))].join(", "))}</span></div>`:""})()}
    <div class="sl-status">${status}${code&&!sch.length?`<button type="button" class="btn sm" data-act="sltoplan">${ic("plus",14)}Időrendbe</button>`:""}</div>
    <div class="eb-more" ${open?"":"hidden"}>
      <div class="eg">${fld("lens",s.lens,{label:"Optika",ph:"pl. 50 mm"})}${fld("move",s.move,{label:"Mozgás",ph:"pl. Dolly",list:"slmoves"})}${fld("talent",s.talent,{label:"Szereplők (vesszővel)",ph:"Anna, Bence"})}</div>
      ${fld("props",s.props,{label:"Kellékek, kontinuitás (soronként)",area:1,rows:2})}${fld("story",s.story,{label:"Sztori (mi történik)",area:1})}${fld("note",s.note,{label:"Megjegyzés",area:1})}
      ${imgEditor(s,[["sb","Storyboard"]])}
      <div class="eb-act"><button type="button" class="btn sm" data-act="slup">${ic("up",15)}Fel</button><button type="button" class="btn sm" data-act="sldn">${ic("dn",15)}Le</button><button type="button" class="btn sm" data-act="sldup">${ic("dup",15)}Másolat</button><button type="button" class="btn sm" data-act="slins">${ic("plus",15)}Új utána</button><button type="button" class="btn sm danger" data-act="sldel">${ic("x",15)}Törlés</button></div>
    </div></div>`;
}
function shotlistHTML(){
  const n=P.shots.length,uns=P.shots.filter(s=>slCode(s)&&!slScheduled(slCode(s)).length);
  let prev=null;
  const list=P.shots.map((s,k)=>{const sc=slScene(s),h=sc!==prev?`<div class="sl-scene">${sc?`${sc}. jelenet`:"Jelenet nélkül"}</div>`:"";prev=sc;return h+slCard(s,k)}).join("");
  return`<datalist id="slmoves">${SL_MOVES.map(x=>`<option value="${x}">`).join("")}</datalist>
    <section class="card"><div class="card-head"><h2>Shotlist</h2><span class="chip neutral">${n} shot</span></div>
      <p class="muted small">A shotok a <b>sztori sorrendjében</b>. A szám eleje a jelenet (pl. <b>2/3</b> = 2. jelenet 3. shotja). Ha kész, tedd őket az <b>Időrendbe</b>, és ott rakd forgatási sorrendbe. Amit itt beírsz (plán, optika, mozgás, szereplők, kellékek, storyboard), az az időrendben és forgatás közben is megjelenik.</p>
      ${uns.length>1?`<div class="wgrid"><button class="btn solid" type="button" data-act="slallplan">${ic("plus",16)}${uns.length===n?"Mind az időrendbe":`A hiányzó ${uns.length} shot az időrendbe`}</button></div>`:uns.length?"":n?`<p class="muted small" style="color:var(--ok)">${ic("check",14)} Minden shot benne van az időrendben.</p>`:""}</section>
    <div class="eblist" data-dlist="shots">${list||`<p class="muted">Még nincs shot. Kezdd az első jelenettel:</p>`}</div>
    <div class="wgrid add">${n?`<button class="btn sm" type="button" data-act="sladd">${ic("plus",14)}Új shot</button><button class="btn sm" type="button" data-act="slscene">${ic("plus",14)}Új jelenet</button>`:`<button class="btn solid" type="button" data-act="slscene">${ic("plus",16)}Első jelenet (1/1)</button>`}</div>`;
}
function slToPlan(list){
  if(!list.length)return;
  withRemap(()=>{let at=-1;P.blocks.forEach((b,i)=>{if(b.type==="shoot")at=i});at=at<0?P.blocks.length:at+1;
    const nb=list.map(s=>normP({blocks:[{type:"shoot",d:20,label:slCode(s)}]}).blocks[0]);P.blocks.splice(at,0,...nb)});
  renderEdit();
  const sch=slScheduled(slCode(list[0]))[0];
  toast(list.length===1?`${slCode(list[0])} az időrendbe került${sch?` (${hm(sch.s)})`:""}. Az Időrend részen húzd a helyére.`:`${list.length} shot az időrendbe került. Az Időrend részen rakd sorrendbe.`,{tone:"ok",action:"Időrend",fn:()=>{editSec="idorend";renderEdit()}});
}
document.addEventListener("click",e=>{
  const t=e.target.closest&&e.target.closest("button");if(!t||!t.closest('[data-view="terv"]'))return;const a=t.dataset.act;if(!a||!/^sl/.test(a))return;
  const host=t.closest('[data-list="shots"]'),k=host?hostK(host):-1,s=P.shots[k];
  if(a==="sltog"){openSL=openSL===s._id?null:s._id;renderEdit();if(openSL)animIn(document.querySelector(`.eb.sl[data-id="${openSL}"] .eb-more`));return}
  if(a==="sladd"||a==="slscene"){const c=a==="slscene"?slNewScene():slNextCode(P.shots[P.shots.length-1]);
    const ns=normP({shots:[{code:c}]}).shots[0];P.shots.push(ns);openSL=ns._id;commit();renderEdit();
    const el=$(`.eb.sl[data-k="${P.shots.length-1}"]`);el&&el.scrollIntoView({block:"center"});const inp=el&&el.querySelector('[data-f="desc"]');inp&&inp.focus();return}
  if(a==="slallplan"){slToPlan(P.shots.filter(x=>slCode(x)&&!slScheduled(slCode(x)).length));return}
  if(!s)return;
  if(a==="sltoplan"){slToPlan([s]);return}
  if(a==="slup"&&k>0){P.shots.splice(k,1);P.shots.splice(k-1,0,s)}
  else if(a==="sldn"&&k<P.shots.length-1){P.shots.splice(k,1);P.shots.splice(k+1,0,s)}
  else if(a==="sldup"){const c=JSON.parse(JSON.stringify(s));c._id=uid();c.code=slNextCode(s);P.shots.splice(k+1,0,c);openSL=c._id}
  else if(a==="slins"){const c=normP({shots:[{code:slNextCode(s)}]}).shots[0];P.shots.splice(k+1,0,c);openSL=c._id}
  else if(a==="sldel"){P.shots.splice(k,1);commit();renderEdit();toast(`Shot törölve: ${slCode(s)||"névtelen"}`,{action:"Visszavonás",fn:()=>{P.shots.splice(k,0,s);commit();renderEdit()}});return}
  commit();renderEdit();
});
