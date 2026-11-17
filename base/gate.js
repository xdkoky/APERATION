/* ---------- telepítési feltétel (csak a telepíthető változatban) ----------
   Telefonon és tableten (iOS, Android) az app csak a főképernyőről indítva működik: böngészőben megnyitva
   egy útmutató takarja el, ami lépésről lépésre megmutatja a telepítést. Számítógépen nincs feltétel. */
const GATE=/*__GATE__*/false;
const UA=navigator.userAgent;
const IS_IOS=/iPhone|iPad|iPod/.test(UA)||(/Macintosh/.test(UA)&&navigator.maxTouchPoints>1);
const IS_ANDROID=/Android/i.test(UA);
const STANDALONE=matchMedia("(display-mode: standalone)").matches||matchMedia("(display-mode: fullscreen)").matches||matchMedia("(display-mode: minimal-ui)").matches||navigator.standalone===true;
const DEV_BYPASS=/^(localhost|127\.)/.test(location.hostname)&&/[?&]nogate\b/.test(location.search);
const GATED=GATE&&(IS_IOS||IS_ANDROID)&&!STANDALONE&&!DEV_BYPASS;
let installEvt=null;
function gateHTML(){
  const shareIc='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-4px"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
  const dots='<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align:-4px"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
  const vdots='<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align:-4px"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';
  const inApp=IS_IOS?!/Safari\//.test(UA)||/FBAN|FBAV|Instagram|Messenger|GSA\//.test(UA):/; wv\)|FBAN|FBAV|Instagram/.test(UA);
  const link=`<button type="button" class="btn" id="gcopy">${ic("copy",16)}Link másolása</button>`;
  let steps;
  if(inApp)steps=`<p class="muted">Ezt a linket most egy másik alkalmazás (pl. Messenger, Instagram, Gmail) belső böngészője nyitotta meg. Innen nem lehet a főképernyőre tenni.</p>
    <ol class="gsteps"><li>Koppints a jobb felső sarokban a ${dots} vagy ${shareIc} gombra.</li><li>Válaszd: <b>Megnyitás ${IS_IOS?"Safariban":"Chrome-ban"}</b> (vagy „Megnyitás böngészőben”).</li><li>Ott ezt az oldalt újra látod, a teendőkkel.</li></ol>${link}`;
  else if(IS_IOS)steps=`<ol class="gsteps">
      <li>Koppints a <b>Megosztás</b> gombra ${shareIc}. Safariban alul vagy a címsor mellett van; ha nem látod, előbb a ${dots} gombra.</li>
      <li>Görgess le, és válaszd: <b>Főképernyőhöz adás</b>.</li>
      <li>Ha van <b>Megnyitás webappként</b> kapcsoló, maradjon bekapcsolva. A név legyen <b>APERATION</b>.</li>
      <li>Koppints a <b>Hozzáadás</b> gombra.</li>
      <li>Zárd be a Safarit, és indítsd az appot a főképernyőn az <b>APERATION</b> ikonnal.</li></ol>
    <p class="muted small">Chrome-ban és más böngészőben iPhone-on is megy: Megosztás ${shareIc} → Főképernyőhöz adás.</p>`;
  else steps=`<button type="button" class="btn solid gbig" id="ginstall" hidden>${ic("down",18)}APERATION telepítése</button>
    <ol class="gsteps" id="gmanual">
      <li>Koppints a böngésző menüjére: ${vdots} (Chrome-ban jobb felül).</li>
      <li>Válaszd: <b>Alkalmazás telepítése</b> vagy <b>Hozzáadás a kezdőképernyőhöz</b>. Samsung Interneten: ☰ → Oldal hozzáadása → Kezdőképernyő.</li>
      <li>Erősítsd meg: <b>Telepítés</b>.</li>
      <li>Indítsd az appot a kezdőképernyőn vagy az alkalmazások között az <b>APERATION</b> ikonnal.</li></ol>`;
  return`<div class="gate-in"><div class="brand-logo" style="margin:0 auto 6px">${LOGO_SVG}</div>
    <section class="card"><h2>Tedd ki a főképernyőre</h2>
      <p class="muted">Az APERATION telefonon csak a főképernyőről indítva működik. Így <b>net nélkül is</b> fut a forgatáson, teljes képernyős, nem alszik el, és a terved biztonságban az appban marad.</p>
      ${steps}<p class="gdone" id="gdone" hidden>${ic("check",18)}Kész! Most indítsd az appot a főképernyőről.</p></section>
    ${creditLine()}</div>`;
}
function gateShow(){
  const g=document.createElement("div");g.className="gate";g.id="gate";g.setAttribute("role","dialog");g.setAttribute("aria-modal","true");g.setAttribute("aria-label","Telepítés a főképernyőre");
  g.innerHTML=gateHTML();document.body.append(g);document.documentElement.classList.add("gated");
  const c=g.querySelector("#gcopy");c&&(c.onclick=()=>copyText(location.href.split("#")[0]));
  const ib=g.querySelector("#ginstall");
  const offer=()=>{if(ib&&installEvt){ib.hidden=false}};
  offer();addEventListener("gate-prompt",offer);
  ib&&(ib.onclick=async()=>{if(!installEvt)return;installEvt.prompt();try{const r=await installEvt.userChoice;if(r.outcome==="accepted"){g.querySelector("#gdone").hidden=false;ib.hidden=true}}catch(e){}installEvt=null});
  addEventListener("appinstalled",()=>{const d=g.querySelector("#gdone");d&&(d.hidden=false);ib&&(ib.hidden=true)});
}
addEventListener("beforeinstallprompt",e=>{if(!GATED)return;e.preventDefault();installEvt=e;dispatchEvent(new Event("gate-prompt"))});
if(GATED)gateShow();
