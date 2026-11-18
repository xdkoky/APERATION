/* ---------- tapintható mozgás ----------
   1) Lenyomás: minden gomb (és sor, jelölő) lenyomásra gyorsan benyomódik, elengedve rugósan, picit túllendülve visszaugrik.
      Gyors koppintásnál is kivárja a benyomódást, hogy érezhető legyen. Ha a koppintásra az app újrarajzolja a gombot,
      a visszaugrás az új gombon folytatódik (nem ugrik).
   2) Kapcsolók és jelölők: ha a váltás után újrarajzolódnak, a régi állapotból csúsznak át az újba.
   3) Szakaszválasztó: a kiválasztott kapszula átcsúszik az új elemre.
   4) Finom rezgés váltáskor és kiválasztáskor (Androidon rezgés, iPhone-on a rendszer kapcsoló-rezgése).
   Mozgáscsökkentésnél csak a rezgés és az állapotváltás marad. */
(()=>{
const RM=matchMedia("(prefers-reduced-motion: reduce)");
const LIN=!!(window.CSS&&CSS.supports&&CSS.supports("transition-timing-function","linear(0, 1)"));
const SPRING=LIN?"linear(0, 0.0512, 0.1761, 0.3378, 0.5083, 0.6683, 0.8061, 0.9158, 0.9966, 1.0503, 1.0811, 1.0937, 1.0931, 1.0837, 1.0695, 1.0534, 1.0377, 1.0236, 1.0121, 1.0032, 0.9971, 0.9933, 0.9914, 0.991, 0.9916, 0.9928, 0.9943, 0.9958, 0.9972, 0.9984, 0.9994, 1.0001, 1)":"cubic-bezier(.34,1.45,.64,1)";
const PRESS='button,a.btn,a.dk,[role="button"],.tl-row,label.chkf,input.sw,input.chk';
const SKIP='.boot,.tabs,.tab-hi';
const MIN=95;   // ennyi ideig legalább benyomva marad (ms)

// egy elem „kulcsa”, amivel újrarajzolás után megtaláljuk az utódját (azonosító vagy data-* jellemzők alapján)
const keyOf=el=>{if(!el||!el.tagName)return null;let s=el.tagName.toLowerCase();if(el.id)return s+"#"+CSS.escape(el.id);let n=0;
  for(const a of el.attributes)if(a.name.startsWith("data-")||a.name==="name"){s+=`[${a.name}="${CSS.escape(a.value)}"]`;n++}
  return n?s:null};
const heir=(el,key)=>{if(el&&el.isConnected)return el;if(!key)return null;try{return document.querySelector(key)}catch(e){return null}};
const scaleNow=el=>{const v=parseFloat(getComputedStyle(el).scale);return isFinite(v)?v:1};

// ---- rezgés ----
let hk=null,hkIn=null;
function haptic(){try{
  if(navigator.vibrate){navigator.vibrate(6);return}
  if(!hk){hk=document.createElement("label");hk.setAttribute("aria-hidden","true");hk.style.display="none";
    hkIn=document.createElement("input");hkIn.type="checkbox";hkIn.setAttribute("switch","");hkIn.tabIndex=-1;hk.append(hkIn);
    for(const t of ["click","change","input"]){hk.addEventListener(t,e=>e.stopPropagation());hkIn.addEventListener(t,e=>e.stopPropagation())}
    document.body.append(hk)}
  hk.click()}catch(e){}}
window.haptic=haptic;

// ---- lenyomás ----
let P=null;   // {el,t,key,s,tm}
const depth=el=>{if(el.matches("input.sw"))return 1;if(el.matches("input.chk,.fi.chkf input"))return .88;if(el.matches(".tl-row"))return .985;
  const r=el.getBoundingClientRect(),m=Math.max(r.width,r.height)||40;return Math.max(.955,1-9/m)};
function pressIn(el,s){if(s>=1||RM.matches)return;const from=scaleNow(el);el.__ta&&el.__ta.cancel();
  el.__ta=el.animate([{scale:String(from)},{scale:String(s)}],{duration:110,easing:"cubic-bezier(.2,.9,.3,1)",fill:"forwards"})}
function springBack(el,from){if(RM.matches){el.__ta&&el.__ta.cancel();return}
  if(from==null)from=scaleNow(el);el.__ta&&el.__ta.cancel();el.__ta=null;if(Math.abs(from-1)<.002)return;
  const a=el.animate([{scale:String(from)},{scale:"1"}],{duration:580,easing:SPRING});el.__ta=a;a.onfinish=()=>{if(el.__ta===a)el.__ta=null}}
function release(now){if(!P)return;const p=P;clearTimeout(p.tm);
  const go=()=>{if(P===p)P=null;p.el.classList.remove("prs");const n=heir(p.el,p.key);if(!n)return;
    if(n!==p.el){n.classList.remove("prs");springBack(n,p.s)}else springBack(n)};
  const left=MIN-(performance.now()-p.t);if(now||left<=0)go();else p.tm=setTimeout(go,left)}
addEventListener("pointerdown",e=>{if(e.button>0)return;let el=e.target&&e.target.closest&&e.target.closest(PRESS);
  if(!el||el.closest(SKIP)||el.disabled||el.getAttribute("aria-disabled")==="true")return;
  if(el.matches("label.chkf"))el=el.querySelector("input")||el;
  if(P)release(true);const s=depth(el);P={el,t:performance.now(),key:keyOf(el),s,x:e.clientX,y:e.clientY,tm:0};
  el.classList.add("prs");pressIn(el,s)},{capture:true,passive:true});
addEventListener("pointermove",e=>{if(P&&!P.tm&&Math.hypot(e.clientX-P.x,e.clientY-P.y)>10)release(true)},{capture:true,passive:true});
addEventListener("pointerup",()=>release(false),{capture:true});
addEventListener("pointercancel",()=>release(true),{capture:true});
addEventListener("dragstart",()=>release(true),{capture:true});
// billentyűzettel (Enter/szóköz) is
addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&!e.repeat){const el=document.activeElement;
  if(el&&el.matches&&el.matches("button,a.btn")&&!el.closest(SKIP)){if(P)release(true);const s=depth(el);P={el,t:performance.now(),key:keyOf(el),s,x:0,y:0,tm:0};pressIn(el,s)}}},true);
addEventListener("keyup",e=>{if(e.key==="Enter"||e.key===" ")release(false)},true);

// ---- kattintás után: újrarajzolt elemek folytatása, csúszó kapszula, rezgés ----
addEventListener("click",e=>{const t=e.target;if(!t||!t.closest||t===hkIn||t===hk)return;
  const b=t.closest("button");
  // szakaszválasztó: a régi kiválasztott helye
  const seg=b&&b.parentElement&&b.parentElement.classList.contains("seg")?b.parentElement:null;let snap=null;
  if(seg){const o=seg.querySelector(':scope>[aria-pressed="true"]');
    if(o&&o!==b)snap={sig:[...seg.children].filter(x=>x.tagName==="BUTTON").map(x=>x.textContent.trim()).join("|"),x:o.offsetLeft,y:o.offsetTop,w:o.offsetWidth,h:o.offsetHeight}}
  // kiválasztás/kapcsolás (aria-pressed): rezgés még az érintés alatt (iPhone-on csak akkor szólhat). Egyválasztós csoportban
  // (szakaszválasztó, shot-chipek) a már kiválasztottra koppintva nincs rezgés.
  const ap=b&&b.getAttribute("aria-pressed");if(ap!=null&&!(ap==="true"&&b.parentElement&&b.parentElement.matches(".seg,.schips")))haptic();
  requestAnimationFrame(()=>{
    // a lenyomott gomb újrarajzolódott: a visszaugrás az utódon folytatódik, ugyanonnan
    if(P&&!P.el.isConnected){const n=heir(P.el,P.key);clearTimeout(P.tm);const s=P.s;P.el.classList.remove("prs");P=null;if(n){n.classList.remove("prs");springBack(n,s)}}
    if(snap)slide(seg,snap)})},true);

function slide(oldSeg,o){if(RM.matches)return;
  let seg=oldSeg.isConnected?oldSeg:[...document.querySelectorAll(".seg")].find(s=>[...s.children].filter(x=>x.tagName==="BUTTON").map(x=>x.textContent.trim()).join("|")===o.sig);
  if(!seg)return;const n=seg.querySelector(':scope>[aria-pressed="true"]');if(!n)return;
  const to={x:n.offsetLeft,y:n.offsetTop,w:n.offsetWidth,h:n.offsetHeight};if(Math.abs(to.x-o.x)<1&&Math.abs(to.y-o.y)<1)return;
  seg.querySelectorAll(":scope>.seg-ghost").forEach(g=>g.remove());
  const cs=getComputedStyle(n),g=document.createElement("i");g.className="seg-ghost";
  Object.assign(g.style,{left:o.x+"px",top:o.y+"px",width:o.w+"px",height:o.h+"px",borderRadius:cs.borderRadius,
    backgroundColor:cs.backgroundColor,backgroundImage:cs.backgroundImage,boxShadow:cs.boxShadow});
  seg.prepend(g);seg.classList.add("seg-mv");
  const px=v=>v+"px",a=g.animate([{left:px(o.x),top:px(o.y),width:px(o.w),height:px(o.h)},{left:px(to.x),top:px(to.y),width:px(to.w),height:px(to.h)}],
    {duration:560,easing:SPRING,fill:"forwards"});
  const end=()=>{g.remove();if(!seg.querySelector(":scope>.seg-ghost"))seg.classList.remove("seg-mv")};a.onfinish=end;a.oncancel=end}

// ---- kapcsolók, jelölők: rezgés, és ha újrarajzolódtak, a régi állapotból csúsznak át ----
addEventListener("change",e=>{const el=e.target;if(!el||el===hkIn||el.tagName!=="INPUT"||el.type!=="checkbox")return;
  haptic();const key=keyOf(el),now=el.checked;
  requestAnimationFrame(()=>{if(el.isConnected||RM.matches)return;const n=heir(el,key);if(!n||n===el||n.checked!==now)return;
    n.classList.add("tk-nt");n.checked=!now;void n.offsetWidth;n.classList.remove("tk-nt");n.checked=now})},true);
})();
