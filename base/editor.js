/* ---------- terv (projekt): betöltés, szerkesztés, Excel be/ki ---------- */
const PKEY="diszpo-app-project-v1";
const TYPES=["prep","pres","shoot","move","lunch","res"];
const STYPES=[["sh","Jelenet"],["ac","Akció"],["ch","Szereplő"],["pa","Instrukció"],["dl","Dialógus"],["end","Vége"]];
const uid=()=>Math.random().toString(36).slice(2,9);
let P=null;const IMG={};
const splitList=s=>String(s||"").split(/[,;\n]/).map(x=>x.trim()).filter(Boolean);
const splitLines=s=>String(s||"").split(/\n|;/).map(x=>x.trim()).filter(Boolean);
const shotIds=l=>{const m=String(l||"").match(/\d+\s*\/\s*\d+[A-Za-z]*/g);return m?[...new Set(m.map(x=>x.replace(/\s/g,"")))]:(String(l||"").trim()?[String(l).trim()]:[])};
const hhmm=m=>Number.isFinite(m)?`${String(Math.floor(m/60)%24).padStart(2,"0")}:${String(Math.round(m%60)).padStart(2,"0")}`:"";
function normP(p){
  p=Object.assign({title:"",date:"",call:480,wrapTarget:0,location:"",parking:"",notes:[],blocks:[],groups:[],cast:[],crew:[],script:[],src:""},p||{});
  p.call=Number.isFinite(+p.call)?+p.call:480;p.wrapTarget=+p.wrapTarget||0;
  if(!Array.isArray(p.notes))p.notes=splitLines(p.notes);
  p.blocks=p.blocks.map(b=>Object.assign({type:"shoot",d:10,label:"",setup:"",note:"",group:"",talent:"",props:"",story:"",skippable:false,images:[]},b,
    {_id:b._id||uid(),d:Math.max(0,Math.round(+b.d||0)),type:TYPES.includes(b.type)?b.type:"shoot",images:(b.images||[]).filter(x=>x&&(x.url||x.idb))}));
  p.groups=p.groups.map(g=>Object.assign({code:"",name:"",desc:""},g));
  p.cast=p.cast.map(c=>Object.assign({role:"",name:"",arr:"",ruha:"",smink:"",haj:"",onset:"",phone:""},c));
  p.crew=p.crew.map(c=>Object.assign({dept:"",pos:"",name:"",arr:"",phone:""},c));
  p.script=p.script.map(l=>({t:STYPES.some(s=>s[0]===l.t)?l.t:"ac",x:l.x||"",ids:Array.isArray(l.ids)?l.ids:splitList(l.ids)}));
  return p;
}
function applyProject(){
  const p=P;let t=p.call;
  const blocks=p.blocks.map(b=>{const o={s:t,d:b.d,type:b.type,label:(b.label||"").trim()||TNAME[b.type],setup:b.setup||"",note:b.note||"",group:(b.group||"").trim(),skippable:!!b.skippable};t+=b.d;return o});
  const groups={};p.groups.forEach(g=>{if(String(g.code).trim())groups[String(g.code).trim()]=[g.name||"",g.desc||""]});
  const cast=p.cast.filter(c=>c.name||c.role).map((c,k)=>({...c,k}));
  const crew=p.crew.filter(c=>c.name||c.pos).map(c=>({...c,dept:c.dept||"Stáb"}));
  const shots={},boards=[],vilko=[];
  p.blocks.forEach((b,i)=>{
    if(b.type!=="shoot")return;const lab=blocks[i].label;if(shots[lab])return;
    const ids=shotIds(lab);
    const img=k=>(b.images||[]).filter(x=>x.kind===k).map(x=>{const u=x.url||IMG[x.idb];return u?{id:lab,t:u,f:u}:null}).filter(Boolean);
    const sb=img("sb"),vk=img("vk");boards.push(...sb);vilko.push(...vk);
    const segs=[];let cur=null,head="";
    p.script.forEach(l=>{if(l.t==="sh"&&!(l.ids||[]).length){head=l.x;cur=null;return}
      if((l.ids||[]).some(x=>ids.includes(x))){if(!cur){cur={lab:head,lines:[]};segs.push(cur)}cur.lines.push(l)}else cur=null});
    shots[lab]={ids,talent:splitList(b.talent),offcam:[],props:splitLines(b.props),story:b.story||"",sb,vk,segs};
  });
  D={title:p.title,src:p.src||"saját terv",plan:{call:p.call,targetWrap:p.wrapTarget},blocks,shots,groups,cast,crew,boards,vilko,
    script:p.script.filter(l=>l.x).map(l=>({t:l.t,x:l.x,cov:(l.ids||[]).length?[{ids:l.ids}]:[]})),
    contacts:[...p.crew,...p.cast].filter(c=>c.name&&c.phone).map(c=>({role:c.pos||c.role,name:c.name,phone:c.phone})),
    location:p.location,parking:p.parking,notes:p.notes.filter(Boolean)};
  B=D.blocks.map((b,i)=>({...b,i,e:b.s+b.d}));
  TOTAL=Math.max(1,B.reduce((a,b)=>a+b.d,0));PLAN_WRAP=B.length?B[B.length-1].e:p.call;
  TARGET=Math.max(p.wrapTarget||PLAN_WRAP,PLAN_WRAP);
  CASTBY={};cast.forEach(c=>{if(c.role)CASTBY[c.role.toLowerCase()]=c;if(c.name)CASTBY[c.name.toLowerCase()]=c});
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(p.date||"");HASDATE=!!m;SHOOT_DATE=m?new Date(+m[1],m[2]-1,+m[3]):new Date(2000,0,1);
  TOUR_SHOT=B.find(b=>b.type==="shoot"&&B[b.i+1]&&B[b.i+1].type==="move"&&b.i>2)||B.find(b=>b.type==="shoot"&&B[b.i+1]&&B[b.i+1].type==="move")||B.find(b=>b.type==="shoot")||null;
  if(st.cur&&st.cur.i>=B.length)st.cur=B.length?{...st.cur,i:B.length-1}:null;
  document.title=(p.title?p.title+" · ":"")+"APERATION";
}
function saveP(){if(tour)return;if(isMpAdmin()&&!mpApplying)mpPublishSoon();try{localStorage.setItem(PKEY,JSON.stringify(P))}catch(e){toast("Nem sikerült menteni ezen az eszközön (betelt a tárhely?).",{tone:"late"})}}
function commit(){saveP();applyProject();tick(true);$$("[data-bs]").forEach(x=>{const b=B[+x.dataset.bs];if(b)x.textContent=hm(b.s)});const w=$("#edwrap");w&&(w.innerHTML=wrapLine())}
let cTimer=null;const commitSoon=()=>{clearTimeout(cTimer);cTimer=setTimeout(commit,350)};
function setProject(p,o={}){P=normP(p);if(o.reset){const s=st.sound;st=fresh();st.sound=s;save()}saveP();applyProject();loadImgs();lastHero=null;renderAll()}
function withRemap(fn){
  const old=P.blocks.map(b=>b._id);fn();const n={};P.blocks.forEach((b,i)=>n[b._id]=i);
  const mo=o=>{const r={};for(const k in o){const id=old[k];if(id!=null&&n[id]!=null)r[n[id]]=o[k]}return r};
  st.act=mo(st.act);st.skip=mo(st.skip);st.ext=mo(st.ext);st.takes=mo(st.takes);
  if(st.cur){const id=old[st.cur.i];st.cur=n[id]!=null?{...st.cur,i:n[id]}:(P.blocks.length?{...st.cur,i:Math.min(st.cur.i,P.blocks.length-1)}:null)}
  if(st.sw){const id=old[st.sw.i];st.sw=n[id]!=null?{...st.sw,i:n[id]}:null}
  save();saveP();applyProject();
}

/* képek a készüléken (IndexedDB) */
const idb=(()=>{let o;const open=()=>o=o||new Promise((res,rej)=>{const r=indexedDB.open("diszpo-app",1);r.onupgradeneeded=()=>r.result.createObjectStore("img");r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
  const tx=(m,f)=>open().then(db=>new Promise((res,rej)=>{const t=db.transaction("img",m),q=f(t.objectStore("img"));t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error)}));
  return{put:(k,v)=>tx("readwrite",s=>s.put(v,k)),get:k=>tx("readonly",s=>s.get(k)),del:k=>tx("readwrite",s=>s.delete(k))}})();
async function loadImgs(){let n=0;for(const b of P.blocks)for(const x of b.images||[])if(x.idb&&!IMG[x.idb]){try{const bl=await idb.get(x.idb);if(bl){IMG[x.idb]=URL.createObjectURL(bl);n++}}catch(e){}}
  if(n){applyProject();if(view!=="terv")renderAll();else renderEdit()}}
async function shrink(file){
  try{const bm=await createImageBitmap(file),k=Math.min(1,2400/Math.max(bm.width,bm.height));if(k>=1&&file.size<1.5e6)return file;
    const c=document.createElement("canvas");c.width=Math.round(bm.width*k);c.height=Math.round(bm.height*k);c.getContext("2d").drawImage(bm,0,0,c.width,c.height);
    return await new Promise(r=>c.toBlob(b=>r(b||file),"image/jpeg",.86))}catch(e){return file}}

/* fájlok mentése */
async function saveFile(name,data,mime){
  try{const dl=window.claude&&claude.use?await claude.use("downloads"):null;
    if(dl){try{await dl.save({filename:name,data});return}catch(e){if(e&&e.code==="declined")return;}}}catch(e){}
  const url=URL.createObjectURL(data instanceof Blob?data:new Blob([data],{type:mime||"application/octet-stream"}));
  const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
let xlsxP=null;
function needXLSX(){if(window.XLSX)return Promise.resolve(window.XLSX);
  return xlsxP=xlsxP||new Promise((res,rej)=>{const s=document.createElement("script");s.src=XLSX_SRC;s.onload=()=>window.XLSX?res(window.XLSX):rej();s.onerror=()=>{xlsxP=null;rej(new Error("xlsx"))};document.head.append(s)})}
async function downloadSablon(){
  try{const r=await fetch(SABLON_URL);if(!r.ok)throw 0;await saveFile("Forgatasi_sablon.xlsx",await r.blob());}
  catch(e){try{await needXLSX();await saveFile("Forgatasi_sablon.xlsx",exportBook(normP(MINTA)));}catch(x){toast("A sablont most nem sikerült letölteni.",{tone:"late"})}}
}

/* ---------- Excel → terv ---------- */
const nk=s=>String(s??"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]/g,"");
const cellS=v=>{if(v==null)return"";let s=String(v).trim();return/^[-–—]$/.test(s)?"":s};
function tmin(v){
  if(v===""||v==null)return null;
  if(typeof v==="number"){if(v<1)return Math.round(v*1440);if(v%1)return Math.round((v%1)*1440);return v<=24?v*60:v}
  if(v instanceof Date)return v.getHours()*60+v.getMinutes();
  const m=String(v).match(/(\d{1,2})\s*[:.]\s*(\d{2})/);return m?+m[1]*60+ +m[2]:null;
}
function dmin(v){
  if(v===""||v==null)return null;
  if(typeof v==="number")return v<1&&v>0?Math.round(v*1440):Math.round(v);
  const s=String(v);const hm_=s.match(/^(\d{1,2}):(\d{2})/);if(hm_)return +hm_[1]*60+ +hm_[2];
  const m=s.replace(",",".").match(/\d+(\.\d+)?/);return m?Math.round(+m[0]):null;
}
const capWords=s=>s&&s===s.toUpperCase()&&/[A-ZÁÉÍÓÖŐÚÜŰ]{3}/.test(s)?s.toLowerCase().replace(/(^|[\s\-.])(\S)/g,(a,b,c)=>b+c.toUpperCase()):s;
function typeOf(v,label){
  const k=nk(v);
  if(/^(elok|prep|setup|felall)/.test(k))return"prep";if(/^(prez|pres)/.test(k))return"pres";if(/^(forg|shoot|felvet)/.test(k))return"shoot";
  if(/^(atal|opti|move|valt)/.test(k))return"move";if(/^(ebed|lunch|szunet)/.test(k))return"lunch";if(/^(tart|res|puffer)/.test(k))return"res";
  const l=nk(label);if(/ebed/.test(l))return"lunch";if(/^(atallas|optika)/.test(l))return"move";if(/^\d+\/?\d/.test(String(label||"").trim()))return"shoot";if(/tartalek/.test(l))return"res";return"prep";
}
const yes=v=>/^(igen|i|x|y|yes|true|1|kihagyhato)$/.test(nk(v));
const COLDEF={
 timeline:[["sb",h=>/storyboard|rajz/.test(h)],["vk",h=>/vilko|fenyterv|vilagitasiterv/.test(h)],["start",h=>/^(kezdes|kezd|start|idopont)/.test(h)],["end",h=>/^(veg|vege|end)/.test(h)],
  ["d",h=>/^(perc|raszantido|idotartam|hossz|duration|tartam|ido(perc)?$|min)/.test(h)&&!/eredeti|elteres/.test(h)],["type",h=>/^(tipus|type|fajta)/.test(h)],
  ["label",h=>/^(blokk|jel|shot|feladat|label|megnevezes|esemeny)/.test(h)],["setup",h=>/^(beallitas|setup|optika|kamera)/.test(h)],["note",h=>/^(megjegyzes|note|leiras|komment)/.test(h)],
  ["group",h=>/^(feny|light)/.test(h)],["talent",h=>/^(szereplo|talent|szinesz|cast)/.test(h)],["props",h=>/^(kellek|props|kontinuitas)/.test(h)],["story",h=>/^(sztori|story|tortenet)/.test(h)],["skip",h=>/^(kihagyhato|skip|opcionalis)/.test(h)]],
 crew:[["dept",h=>/^(reszleg|dept|osztaly|csapat)/.test(h)],["pos",h=>/^(pozicio|beosztas|munkakor|position)/.test(h)],["name",h=>/^(nev|name)/.test(h)],["arr",h=>/^(erkezes|call|arr)/.test(h)],["phone",h=>/^(telefon|tel|phone|mobil)/.test(h)]],
 cast:[["role",h=>/^(szerep|karakter|role|character)/.test(h)],["name",h=>/^(szinesz|nev|name|actor)/.test(h)],["arr",h=>/^(erkezes|arr|call)/.test(h)],["ruha",h=>/^(ruha|jelmez)/.test(h)],["smink",h=>/^smink/.test(h)],["haj",h=>/^haj/.test(h)],["onset",h=>/^(setre|onset|forgatasra|keszen)/.test(h)],["phone",h=>/^(telefon|tel|phone|mobil)/.test(h)]],
 groups:[["code",h=>/^(kod|code|jel$)/.test(h)],["name",h=>/^(nev|feny|name|megnevezes)/.test(h)],["desc",h=>/^(leiras|desc|reszletek|eszkozok)/.test(h)]],
 script:[["t",h=>/^(tipus|type)/.test(h)],["x",h=>/^(szoveg|text|sor)/.test(h)],["ids",h=>/^(shot|ids|felsnitt)/.test(h)]]
};
function mapCols(row,kind){const m={};row.forEach((v,c)=>{const h=nk(v);if(!h)return;for(const [k,f] of COLDEF[kind])if(m[k]==null&&f(h)){m[k]=c;break}});return m}
function headerKind(row){
  if(row.filter(v=>cellS(v)).length<2)return null;
  let m=mapCols(row,"crew");if(m.pos!=null&&m.name!=null)return["crew",m];
  m=mapCols(row,"cast");if(row.some(v=>/^(szinesz|actor)/.test(nk(v)))||(m.role!=null&&m.name!=null&&(m.ruha!=null||m.smink!=null||m.onset!=null||m.arr!=null)))return["cast",m];
  m=mapCols(row,"script");if(m.x!=null&&m.t!=null)return["script",m];
  m=mapCols(row,"groups");if(m.code!=null&&(m.name!=null||m.desc!=null))return["groups",m];
  m=mapCols(row,"timeline");if(m.label!=null&&(m.d!=null||m.start!=null)&&(m.type!=null||m.setup!=null||m.note!=null))return["timeline",m];
  return null;
}
function parseDate(v){
  if(typeof v==="number"&&v>20000&&window.XLSX){const d=XLSX.SSF.parse_date_code(v);if(d)return`${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`}
  const m=String(v||"").match(/(20\d\d)\s*[.\-\/]\s*(\d{1,2})\s*[.\-\/]\s*(\d{1,2})/);return m?`${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`:"";
}
function importBook(wb,fname){
  const R={blocks:[],cast:[],crew:[],groups:[],script:[],notes:[],warn:[]},kv={};let firstText="",dateGuess="";const contacts=[];
  const phoneRe=/^\+?[\d][\d\s\-\/()]{6,}$/;
  for(const sn of wb.SheetNames){
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,raw:true,defval:""});
    let i=0;
    while(i<rows.length){
      const row=rows[i]||[],hk=headerKind(row);
      if(hk){const [kind,m]=hk;i++;let empty=0,dept="";const out=[];
        for(;i<rows.length;i++){
          const r=rows[i]||[];if(!r.some(v=>cellS(v))){if(++empty>=2)break;continue}empty=0;
          if(headerKind(r)){break}
          const g=k=>m[k]==null?"":r[m[k]];
          if(kind==="timeline"){
            const label=cellS(g("label"));if(nk(label)==="wrap"){i++;break}
            if(!label&&!cellS(g("type"))&&dmin(g("d"))==null)continue;
            out.push({type:typeOf(g("type"),label),d:dmin(g("d")),_s:tmin(g("start")),_e:tmin(g("end")),label,setup:cellS(g("setup")),note:cellS(g("note")),group:cellS(g("group")),
              talent:cellS(g("talent")),props:cellS(g("props")),story:cellS(g("story")),skippable:yes(g("skip")),
              images:[...splitList(g("sb")).filter(u=>/^https?:|^data:/.test(u)).map(u=>({kind:"sb",url:u})),...splitList(g("vk")).filter(u=>/^https?:|^data:/.test(u)).map(u=>({kind:"vk",url:u}))]});
          }else if(kind==="crew"){
            const pos=cellS(g("pos")),name=cellS(g("name"));
            if(pos&&!name&&!cellS(g("arr"))&&r.filter(v=>cellS(v)).length===1){dept=pos===pos.toUpperCase()?pos.charAt(0)+pos.slice(1).toLowerCase():pos;continue}
            if(!pos&&!name)continue;
            out.push({dept:cellS(g("dept"))||dept,pos:capWords(pos),name:capWords(name),arr:hhmm(tmin(g("arr"))),phone:cellS(g("phone"))});
          }else if(kind==="cast"){
            const name=cellS(g("name")),role=cellS(g("role"));if(!name&&!role)continue;
            const t=k=>{const v=g(k);const x=tmin(v);return x!=null?hhmm(x):cellS(v)};
            out.push({role:capWords(role),name:capWords(name),arr:t("arr"),ruha:t("ruha"),smink:t("smink"),haj:t("haj"),onset:t("onset"),phone:cellS(g("phone"))});
          }else if(kind==="groups"){
            const code=cellS(g("code"));if(!code)continue;out.push({code,name:cellS(g("name")),desc:cellS(g("desc"))});
          }else if(kind==="script"){
            const x=cellS(g("x"));if(!x)continue;const k=nk(g("t"));
            const t=/^(jel|hely|sh|scene|int|ext|belso|kulso)/.test(k)?"sh":/^(szerep|karakter|ch|nev)/.test(k)?"ch":/^(instr|zarojel|pa|paren)/.test(k)?"pa":/^(dial|szov|dl|beszed)/.test(k)?"dl":/^(veg|end)/.test(k)?"end":"ac";
            out.push({t,x,ids:shotIds(cellS(g("ids"))).length&&cellS(g("ids"))?splitList(g("ids")).flatMap(shotIds):[]});
          }
        }
        if(kind==="timeline"){if(out.length>R.blocks.length)R.blocks=out}else if(!R[kind].length)R[kind]=out;
        continue;
      }
      // kulcs–érték sorok (Crew call, Tervezett wrap, Cím, …)
      row.forEach((v,c)=>{
        const s=cellS(v);if(!s||typeof v==="number")return;
        if(!firstText&&i<3&&s.length>1&&!/[:]/.test(s))firstText=s;
        if(!dateGuess&&i<8)dateGuess=parseDate(s);
        let key=s,val="";const ci=s.indexOf(":");
        if(ci>0&&ci<30){key=s.slice(0,ci);val=s.slice(ci+1).trim()}
        if(!val){for(let c2=c+1;c2<row.length;c2++)if(cellS(row[c2])!==""){val=row[c2];break}}
        const k=nk(key);if(!k)return;
        const put=(n,x)=>{if(kv[n]==null&&x!==""&&x!=null)kv[n]=x};
        if(/^(crewcall|call|kezdes|munkakezdes)$/.test(k))put("call",val);
        else if(/^(tervezettwrap|wrap|wraphatar|wrapcel|celwrap)$/.test(k))put("wrap",val);
        else if(/^(cim|projekt|projektcim|film|filmcim|cimfilm)$/.test(k))put("title",val);
        else if(/^(datum|forgatasinap|nap)$/.test(k))put("date",val);
        else if(/^helyszin/.test(k))put("loc",val);
        else if(/^parkolas/.test(k))put("park",val);
        else if(/^(fontos|megjegyzes|biztonsag)/.test(k)&&c===0&&val&&typeof val==="string")R.notes.push(/^biztonsag/.test(k)?"BIZTONSÁG: "+val:val);
        else if(ci>0&&val&&typeof val==="string"&&/^[A-ZÁÉÍÓÖŐÚÜŰa-záéíóöőúüű0-9 .\-]{2,30}$/.test(key)&&/\s/.test(val)){
          const nx=cellS((rows[i+1]||[])[c]);if(phoneRe.test(nx))contacts.push({pos:key.trim(),name:val,phone:nx});
        }
      });
      i++;
    }
  }
  // kezdés/vég → percek, ha nincs perc oszlop
  R.blocks.forEach((b,k)=>{if(b.d==null){const n=R.blocks[k+1];b.d=b._e!=null&&b._s!=null?b._e-b._s:(n&&n._s!=null&&b._s!=null?n._s-b._s:0);if(b.d<0)b.d+=1440}});
  const call=tmin(kv.call)??(R.blocks[0]&&R.blocks[0]._s)??480;
  R.blocks.forEach(b=>{delete b._s;delete b._e});
  contacts.forEach(c=>{const m=R.crew.find(x=>nk(x.name)===nk(c.name));if(m){if(!m.phone)m.phone=c.phone}else R.crew.unshift({dept:"Kapcsolat",pos:c.pos,name:c.name,arr:"",phone:c.phone})});
  if(!R.blocks.length)R.warn.push("Nem találtam időrend-táblázatot. Kell egy fejlécsor, benne legalább: Perc (vagy Kezdés), Típus és Blokk / shot.");
  const zero=R.blocks.filter(b=>!b.d).length;if(zero)R.warn.push(`${zero} blokknál nincs megadva idő (0 perc). A Terv fülön pótolhatod.`);
  return normP({title:cellS(kv.title)||firstText||String(fname||"").replace(/\.[^.]+$/,""),date:parseDate(kv.date)||dateGuess,call,wrapTarget:tmin(kv.wrap)||0,
    location:cellS(kv.loc),parking:cellS(kv.park),notes:R.notes,blocks:R.blocks,groups:R.groups,cast:R.cast,crew:R.crew,script:R.script,src:fname||"Excel",_warn:R.warn});
}
let pending=null;
async function importFile(file){
  if(!file)return;
  if(/\.json$/i.test(file.name)){try{pending=normP(JSON.parse(await file.text()));pending._warn=[];pending.src=file.name;editSec="fajl";location.hash="#terv";renderEdit()}catch(e){toast("Ez a fájl nem olvasható.",{tone:"late"})}return}
  toast("Táblázat beolvasása…");
  try{const X=await needXLSX();const wb=X.read(await file.arrayBuffer(),{type:"array"});pending=importBook(wb,file.name)}
  catch(e){toast(e&&e.message==="xlsx"?"Az Excel-olvasó nem töltődött be. Van internet?":"Ezt a fájlt nem sikerült beolvasni.",{tone:"late"});return}
  editSec="fajl";if(location.hash!=="#terv")location.hash="#terv";else renderEdit();window.scrollTo({top:0});
}

/* ---------- terv → Excel ---------- */
function exportBook(p){
  const wb=XLSX.utils.book_new();wb.Props={Title:p.title||"Forgatási terv",Author:AUTHOR,Company:"APERATION"};const add=(name,rows,w)=>{const ws=XLSX.utils.aoa_to_sheet(rows);ws["!cols"]=w.map(x=>({wch:x}));XLSX.utils.book_append_sheet(wb,ws,name)};
  const yn=b=>b?"igen":"";let t=p.call;
  add("Projekt",[["Mező","Érték"],["Cím",p.title],["Dátum",p.date],["Crew call",hhmm(p.call)],["Tervezett wrap",p.wrapTarget?hhmm(p.wrapTarget):""],["Helyszín",p.location],["Parkolás",p.parking],...(p.notes.length?p.notes:[""]).map(n=>["Fontos",n])],[18,60]);
  add("Időrend",[["Kezdés","Vége","Perc","Típus","Blokk / shot","Beállítás","Megjegyzés","Fény","Szereplők","Kellékek","Sztori","Kihagyható","Storyboard kép (URL)","Vilkó kép (URL)"],
    ...p.blocks.map(b=>{const s=t;t+=b.d;const u=k=>(b.images||[]).filter(x=>x.kind===k&&x.url).map(x=>x.url).join("\n");
      return[hm(s),hm(t),b.d,TNAME[b.type],b.label,b.setup,b.note,b.group,b.talent,b.props,b.story,yn(b.skippable),u("sb"),u("vk")]})],[7,7,6,12,16,26,34,7,16,28,30,10,24,24]);
  add("Szereplők",[["Szerep","Színész","Érkezés","Ruha","Smink","Haj","Setre","Telefon"],...p.cast.map(c=>[c.role,c.name,c.arr,c.ruha,c.smink,c.haj,c.onset,c.phone])],[14,20,8,8,8,8,8,16]);
  add("Stáb",[["Részleg","Pozíció","Név","Érkezés","Telefon"],...p.crew.map(c=>[c.dept,c.pos,c.name,c.arr,c.phone])],[20,18,22,8,16]);
  add("Fények",[["Kód","Név","Leírás"],...p.groups.map(g=>[g.code,g.name,g.desc])],[8,24,60]);
  add("Szkript",[["Típus","Szöveg","Shotok"],...p.script.map(l=>[(STYPES.find(s=>s[0]===l.t)||[])[1]||"Akció",l.x,(l.ids||[]).join(", ")])],[12,80,16]);
  return new Blob([XLSX.write(wb,{bookType:"xlsx",type:"array"})],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}
async function exportNow(){
  try{await needXLSX()}catch(e){toast("Az Excel-író nem töltődött be. Van internet?",{tone:"late"});return}
  const name=(P.title||"terv").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^A-Za-z0-9]+/g,"_").replace(/^_|_$/g,"").slice(0,40)||"terv";
  await saveFile(`${name}${P.date?"_"+P.date:""}.xlsx`,exportBook(P));
  if(P.blocks.some(b=>(b.images||[]).some(x=>x.idb)))toast("A készülékről feltöltött képek nem kerülnek az Excelbe, csak a linkek.");
}

/* ---------- szövegből szkript ---------- */
function parseScript(txt){
  const out=[];let prev="";
  String(txt||"").replace(/\r/g,"").split("\n").forEach(raw=>{
    const s=raw.trim();if(!s){prev="";return}
    let t="ac";
    if(/^(\d+\.?\s*)?(BELSŐ|KÜLSŐ|BELSO|KULSO|INT\.?\/EXT|INT|EXT)(?=[\s.\/:,–-]|$)/i.test(s))t="sh";
    else if(/^\(.*\)$/.test(s))t="pa";
    else if(/^(VÉGE|VEGE|THE END|FADE OUT)\.?$/i.test(s))t="end";
    else if(s===s.toUpperCase()&&/[A-ZÁÉÍÓÖŐÚÜŰ]/.test(s)&&s.length<=32&&!/[.!?]$/.test(s))t="ch";
    else if(prev==="ch"||prev==="pa"||prev==="dl")t="dl";
    out.push({t,x:s,ids:[]});prev=t;
  });
  return out;
}

/* ---------- üdvözlő ---------- */
function renderWelcome(v){
  if(isMember()){v.innerHTML=`<div class="welcome"><div class="vh" style="margin-bottom:6px">${esc(MP.title||"Közös projekt")}</div>
    <section class="card"><h2>${MP.ready?"Várakozás a tervre…":"Kapcsolódás…"}</h2><p class="muted">Csatlakoztál${MP.roleName?` <b>${esc(MP.roleName)}</b> pozícióban`:""}. Amint a szerkesztő terve megérkezik, itt látod a napot. Ha sokáig nem jön, ellenőrizd a netet.</p>
    <button type="button" class="btn danger" data-do="mpleave">Kilépés a közös projektből</button></section>${creditLine()}</div>`;return}
  v.innerHTML=`<div class="welcome">
    <h1 class="brand-logo">${LOGO_SVG}</h1>
    <p class="muted">Egy forgatási nap vezérlője: óra, visszaszámláló, várható wrap, shotonként a beállítás, a fény, a kellék és a szkript. Kezdd egy Excel-táblázattal, vagy írd be itt a napot.</p>
    <label class="drop" id="drop">${ic("upload",28)}<b>Excel-táblázat betöltése</b><span class="muted small">Koppints, vagy húzd ide a fájlt (.xlsx, .xls, .ods, .csv)</span><input type="file" accept=".xlsx,.xls,.xlsm,.ods,.csv,.json" data-import hidden></label>
    <div class="wgrid">
      <button class="btn" type="button" data-do="minta">${ic("play",16)}Minta megnyitása</button>
      <button class="btn" type="button" data-do="ures">${ic("edit",16)}Üres terv, beírom</button>
      <button class="btn" type="button" data-do="sablon">${ic("down",16)}Sablon letöltése</button>
      <button class="btn" type="button" data-do="tour">${ic("play",16)}Bemutató · 2 perc</button>
    </div>
    ${MP_AVAIL?`<section class="card joincard"><div class="card-head"><h2>Kódot kaptál a stábtól?</h2><button class="btn sm solid" type="button" data-do="joinform">${ic("users",14)}Csatlakozás kóddal</button></div><div id="joinbox" hidden>${joinHTML()}</div></section>`:""}
    <p class="muted small">A sablonnal működik a legbiztosabban, de a saját táblázatodat is megpróbálja felismerni: kell egy fejlécsor <b>Perc</b> (vagy Kezdés), <b>Típus</b> és <b>Blokk / shot</b> oszlopokkal. A terv csak ezen az eszközön tárolódik.</p>
    ${creditLine()}
  </div>`;
}

/* ---------- TERV nézet ---------- */
let editSec="idorend",openEB=null;
const fld=(f,v,o={})=>{const ph=o.ph?` placeholder="${esc(o.ph)}"`:"",l=o.label?`<span class="flab">${o.label}</span>`:"";
  if(o.area)return`<label class="fi ${o.cls||""}">${l}<textarea data-f="${f}" rows="${o.rows||2}"${ph}>${esc(v)}</textarea></label>`;
  return`<label class="fi ${o.cls||""}">${l}<input data-f="${f}" type="${o.type||"text"}" value="${esc(v)}"${ph}${o.list?` list="${o.list}"`:""}${o.type==="number"?' inputmode="numeric" min="0" step="5"':""}${o.im?` inputmode="${o.im}"`:""}></label>`};
const wrapLine=()=>B.length?`Crew call ${hm(P.call)} · ${B.length} blokk · ${B.filter(b=>b.type==="shoot").length} forgatás · tervezett vég <b>${hm(PLAN_WRAP)}</b>${P.wrapTarget?` · wrap-határ ${hm(P.wrapTarget)}`:""}${PLAN_WRAP>P.wrapTarget&&P.wrapTarget?` <span style="color:var(--late)">(+${PLAN_WRAP-P.wrapTarget}′)</span>`:""}`:"Még nincs blokk a tervben.";
function blockCard(b,k){
  const imgs=(b.images||[]).map((x,n)=>{const u=x.url||IMG[x.idb];return`<span class="ethumb">${u?`<img src="${esc(u)}" alt="">`:`<i>${ic("img",18)}</i>`}<em>${x.kind==="sb"?"Storyboard":"Vilkó"}</em><button type="button" data-imgdel="${n}" aria-label="Kép törlése">${ic("x",14)}</button></span>`}).join("");
  const open=openEB===b._id;
  return`<div class="eb" data-k="${k}" data-list="blocks" data-type="${b.type}">
    <div class="eb-top"><span class="eb-t num" data-bs="${k}">${B[k]?hm(B[k].s):""}</span>
      <select data-f="type" aria-label="Típus">${TYPES.map(t=>`<option value="${t}" ${t===b.type?"selected":""}>${TNAME[t]}</option>`).join("")}</select>
      <label class="fi mins"><input data-f="d" type="number" inputmode="numeric" min="0" step="5" value="${b.d}" aria-label="Perc"><span>perc</span></label>
      ${fld("label",b.label,{ph:b.type==="shoot"?"Shot, pl. 1/1":TNAME[b.type],cls:"grow"})}
      <button type="button" class="ib" data-act="tog" aria-expanded="${open}" aria-label="Részletek">${ic(open?"up":"dn",18)}</button></div>
    <div class="eb-more" ${open?"":"hidden"}>
      <div class="eg">${fld("setup",b.setup,{label:"Beállítás",ph:"pl. CU, 50 mm, sticks"})}${fld("group",b.group,{label:"Fény",ph:"kód, pl. A",list:"glist"})}</div>
      ${fld("note",b.note,{label:"Megjegyzés",area:1})}
      ${b.type==="shoot"?`<div class="eg">${fld("talent",b.talent,{label:"Szereplők (vesszővel)",ph:"Anna, Bence"})}<label class="fi chkf"><input type="checkbox" data-f="skippable" ${b.skippable?"checked":""}><span>Csúszásnál kihagyható</span></label></div>
      ${fld("props",b.props,{label:"Kellékek, kontinuitás (soronként)",area:1,rows:3})}${fld("story",b.story,{label:"Sztori",area:1})}
      <div class="fi"><span class="flab">Képek</span><div class="ethumbs">${imgs}</div>
        <div class="eimg"><label class="btn sm">${ic("plus",14)}Storyboard<input type="file" accept="image/*" data-addimg="sb" multiple hidden></label><label class="btn sm">${ic("plus",14)}Vilkó<input type="file" accept="image/*" data-addimg="vk" multiple hidden></label>
        <input type="url" placeholder="vagy kép-link (https://…)" data-imgurl aria-label="Kép linkje"><select data-imgkind aria-label="Kép fajtája"><option value="sb">Storyboard</option><option value="vk">Vilkó</option></select><button type="button" class="btn sm" data-act="imgurl">Hozzáad</button></div></div>`
      :`<label class="fi chkf"><input type="checkbox" data-f="skippable" ${b.skippable?"checked":""}><span>Csúszásnál kihagyható</span></label>`}
      <div class="eb-act"><button type="button" class="btn sm" data-act="up">${ic("up",15)}Fel</button><button type="button" class="btn sm" data-act="dn">${ic("dn",15)}Le</button><button type="button" class="btn sm" data-act="dup">${ic("dup",15)}Másolat</button><button type="button" class="btn sm" data-act="ins">${ic("plus",15)}Új utána</button><button type="button" class="btn sm danger" data-act="del">${ic("x",15)}Törlés</button></div>
    </div></div>`;
}
function rowsTable(list,cols,addLabel){
  return`<div class="etab">${P[list].map((r,k)=>`<div class="er" data-list="${list}" data-k="${k}">${cols.map(([f,l,o])=>fld(f,r[f]||"",Object.assign({label:l},o||{}))).join("")}<button type="button" class="ib del" data-act="rowdel" aria-label="Sor törlése">${ic("x",16)}</button></div>`).join("")}</div>
    <button type="button" class="btn sm" data-act="rowadd" data-list="${list}">${ic("plus",14)}${addLabel}</button>`;
}
function importPreview(){
  const p=pending,sh=p.blocks.filter(b=>b.type==="shoot").length,tot=p.blocks.reduce((a,b)=>a+b.d,0);
  return`<section class="card prev"><div class="card-head"><h2>Beolvasva: ${esc(p.src)}</h2></div>
    <div class="rows">${[["Cím",p.title||"–"],["Dátum",p.date||"nincs megadva"],["Crew call",hm(p.call)],["Időrend",`${p.blocks.length} blokk, ebből ${sh} forgatás · ${Math.floor(tot/60)} óra ${tot%60} perc · vége ${hm(p.call+tot)}`],
      ["Szereplők",p.cast.length+" fő"],["Stáb",p.crew.length+" fő"],["Fények",p.groups.length+" beállítás"],["Szkript",p.script.length+" sor"]].map(([a,b])=>`<div class="row" style="grid-template-columns:96px minmax(0,1fr)"><small>${a}</small><b>${esc(b)}</b></div>`).join("")}</div>
    ${(p._warn||[]).length?`<ul class="list">${p._warn.map(w=>`<li class="warn">${esc(w)}</li>`).join("")}</ul>`:""}
    <p class="muted small">A betöltés lecseréli a mostani tervet, és a nap állását (kész blokkok, take-ek) is nullázza.</p>
    <div class="wgrid"><button class="btn solid" type="button" data-do="load" ${p.blocks.length?"":"disabled"}>Betöltés</button><button class="btn" type="button" data-do="cancel">Mégse</button></div></section>`;
}
function renderEdit(){
  const v=$('[data-view="terv"]');
  const secs=[["fajl","Fájl"],["idorend","Időrend"],["projekt","Projekt"],["emberek","Emberek"],["szkript","Szkript"],["csapat","Csapat"]];
  let body="";
  if(editSec==="fajl")body=`${pending?importPreview():""}
    <section class="card"><h2>Excel-táblázat betöltése</h2>
      <label class="drop" id="drop">${ic("upload",26)}<b>Fájl kiválasztása</b><span class="muted small">vagy húzd ide (.xlsx, .xls, .ods, .csv)</span><input type="file" accept=".xlsx,.xls,.xlsm,.ods,.csv,.json" data-import hidden></label>
      <p class="muted small">A <b>Forgatási sablon</b> lapjait (Projekt, Időrend, Szereplők, Stáb, Fények, Szkript) pontosan ismeri. Más táblázatból a fejlécsorok alapján dolgozik: időrendhez kell <b>Perc</b> vagy <b>Kezdés</b>, <b>Típus</b> és <b>Blokk / shot</b> oszlop.</p></section>
    <section class="card"><h2>Mentés és sablon</h2><div class="wgrid">
      <button class="btn" type="button" data-do="export" ${P.blocks.length?"":"disabled"}>${ic("down",16)}Terv mentése Excelbe</button>
      <button class="btn" type="button" data-do="sablon">${ic("down",16)}Üres sablon letöltése</button></div>
      <p class="muted small">Az elmentett Excel ugyanebben a formában van, mint a sablon: átküldheted, javíthatod gépen, és visszatöltheted.</p></section>
    <section class="card"><h2>Új terv</h2><div class="wgrid">
      <button class="btn" type="button" data-do="minta">${ic("play",16)}Minta betöltése</button>
      <button class="btn danger" type="button" data-do="ures">${ic("x",16)}Üres terv</button></div></section>`;
  else if(editSec==="idorend")body=`<p class="muted small" id="edwrap">${wrapLine()}</p>
    <datalist id="glist">${P.groups.filter(g=>g.code).map(g=>`<option value="${esc(g.code)}">${esc(g.name)}</option>`).join("")}</datalist>
    ${P.blocks.length?"":`<section class="card empty"><h2>Üres a terv</h2><p class="muted">Add hozzá az első blokkot az alábbi gombokkal, sorban, ahogy a nap megy: érkezés, előkészület, forgatás, átállás, ebéd… A crew callt és a dátumot a <b>Projekt</b> részen állítod. Ha Excelben már megvan a nap, töltsd be a <b>Fájl</b> részen.</p></section>`}
    <div class="eblist">${P.blocks.map(blockCard).join("")}</div>
    <div class="wgrid add"><button class="btn sm" type="button" data-addb="shoot">${ic("plus",14)}Forgatás</button><button class="btn sm" type="button" data-addb="move">${ic("plus",14)}Átállás</button><button class="btn sm" type="button" data-addb="prep">${ic("plus",14)}Előkészület</button><button class="btn sm" type="button" data-addb="lunch">${ic("plus",14)}Ebéd</button><button class="btn sm" type="button" data-addb="res">${ic("plus",14)}Tartalék</button></div>`;
  else if(editSec==="projekt")body=`<section class="card"><h2>A nap</h2><div class="eg">
      ${fld("title",P.title,{label:"Cím",cls:"span2"})}${fld("date",P.date,{label:"Dátum",type:"date"})}${fld("call",hhmm(P.call),{label:"Crew call",type:"time"})}
      ${fld("wrapTarget",P.wrapTarget?hhmm(P.wrapTarget):"",{label:"Wrap-határ (eddig kell végezni)",type:"time"})}${fld("location",P.location,{label:"Helyszín"})}${fld("parking",P.parking,{label:"Parkolás",cls:"span2"})}</div>
      ${fld("notes",P.notes.join("\n"),{label:"Fontos (soronként; a BIZTONSÁG kezdetű sor pirosan látszik)",area:1,rows:4})}
      <p class="muted small">A megadott napon az app magától élesben indul. Dátum nélkül az Info fülön kapcsold be: „Ma forgatunk”.</p></section>
    <section class="card"><h2>Fénybeállítások</h2><p class="muted small">A kódot írd az Időrendben a blokk Fény mezőjébe; az app így jelzi, mikor változik a fény.</p>
      ${rowsTable("groups",[["code","Kód",{cls:"w1"}],["name","Név"],["desc","Leírás",{cls:"span2"}]],"Új fény")}</section>`;
  else if(editSec==="emberek")body=`<section class="card"><h2>Szereplők</h2><p class="muted small">A Szerep (pl. Anna) ugyanaz legyen, amit az Időrendben a Szereplők mezőbe írsz.</p>
      ${rowsTable("cast",[["role","Szerep"],["name","Színész"],["arr","Érkezés",{ph:"8:00",cls:"w1",im:"numeric"}],["ruha","Ruha",{cls:"w1"}],["smink","Smink",{cls:"w1"}],["haj","Haj",{cls:"w1"}],["onset","Setre",{cls:"w1"}],["phone","Telefon",{type:"tel"}]],"Új szereplő")}</section>
    <section class="card"><h2>Stáb</h2>${rowsTable("crew",[["dept","Részleg"],["pos","Pozíció"],["name","Név"],["arr","Érkezés",{ph:"8:00",cls:"w1"}],["phone","Telefon",{type:"tel"}]],"Új stábtag")}</section>`;
  else if(editSec==="csapat")body=teamHTML();
  else body=`<section class="card"><h2>Szkript beillesztése szövegként</h2>
      <textarea id="scrpaste" rows="5" placeholder="Másold ide a forgatókönyvet. BELSŐ./KÜLSŐ. = jelenet, NAGYBETŰS név = szereplő, utána a dialógus, (zárójel) = instrukció."></textarea>
      <div class="wgrid"><button class="btn sm" type="button" data-do="scradd">Hozzáfűzés a végéhez</button><button class="btn sm danger" type="button" data-do="scrrep">Csere</button></div></section>
    <section class="card"><h2>Sorok</h2><p class="muted small">A <b>Shotok</b> mezőbe írd, melyik shot veszi a sort (pl. 1/1, 1/2). A Most nézetben a shotnál ezek a sorok jelennek meg.</p>
      <div class="etab">${P.script.map((l,k)=>`<div class="er sr" data-list="script" data-k="${k}"><label class="fi w2"><span class="flab">Típus</span><select data-f="t">${STYPES.map(([a,b])=>`<option value="${a}" ${a===l.t?"selected":""}>${b}</option>`).join("")}</select></label>
        ${fld("x",l.x,{label:"Szöveg",area:1,cls:"span2"})}${fld("ids",(l.ids||[]).join(", "),{label:"Shotok",ph:"1/1, 1/2",cls:"w2"})}<button type="button" class="ib del" data-act="rowdel" aria-label="Sor törlése">${ic("x",16)}</button></div>`).join("")}</div>
      <button type="button" class="btn sm" data-act="rowadd" data-list="script">${ic("plus",14)}Új sor</button></section>`;
  renderTabs();$$(".tabs a").forEach(a=>{if(a.getAttribute("href")==="#terv")a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});placeInd();
  v.innerHTML=`<div class="vh">Terv</div><div class="seg esec" role="group" aria-label="Szakasz">${secs.map(([k,l])=>`<button type="button" data-sec="${k}" aria-pressed="${editSec===k}">${l}</button>`).join("")}</div><div class="stack">${body}</div>`;
}
/* események (egyszer, delegálva) */
function sure(btn,msg){if(btn.dataset.armed)return true;const h=btn.innerHTML;btn.dataset.armed="1";btn.classList.add("armed");btn.textContent=msg;
  setTimeout(()=>{if(btn.isConnected){delete btn.dataset.armed;btn.classList.remove("armed");btn.innerHTML=h}},4000);return false}
function fieldSet(el){
  const f=el.dataset.f,host=el.closest("[data-list]"),list=host&&host.dataset.list,k=host?+host.dataset.k:-1;
  const obj=list?P[list][k]:P;if(!obj)return;
  let val=el.type==="checkbox"?el.checked:el.value;
  if(f==="d")val=Math.max(0,Math.round(+val||0));
  else if(f==="call")val=tmin(val)??obj.call;
  else if(f==="wrapTarget")val=tmin(val)||0;
  else if(f==="notes")val=splitLines(val);
  else if(f==="ids")val=splitList(val).flatMap(shotIds);
  obj[f]=val;
  if(f==="type"){const c=el.closest(".eb");c&&(c.dataset.type=val);commit();renderEdit();return}
  commitSoon();
}
const tv=()=>$('[data-view="terv"]');
document.addEventListener("input",e=>{const el=e.target;if(!el.dataset||!el.dataset.f||!el.closest('[data-view="terv"]'))return;if(el.tagName!=="SELECT"&&el.type!=="checkbox"&&el.type!=="date"&&el.type!=="time")fieldSet(el)});
document.addEventListener("change",e=>{const el=e.target;
  if(el.matches&&el.matches("[data-import]")){importFile(el.files[0]);el.value="";return}
  if(el.dataset&&el.dataset.addimg){addImages(el,[...el.files]);return}
  if(el.dataset&&el.dataset.f&&el.closest('[data-view="terv"]')){if(el.tagName==="SELECT"||el.type==="checkbox"||el.type==="date"||el.type==="time")fieldSet(el);else{clearTimeout(cTimer);commit()}}});
async function addImages(el,files){
  const k=+el.closest("[data-k]").dataset.k,b=P.blocks[k],kind=el.dataset.addimg;
  for(const f of files){const key="img-"+uid();try{const bl=await shrink(f);await idb.put(key,bl);IMG[key]=URL.createObjectURL(bl);b.images.push({kind,idb:key,name:f.name})}catch(e){toast("A képet nem sikerült elmenteni ezen az eszközön.",{tone:"late"})}}
  commit();renderEdit();
}
document.addEventListener("click",async e=>{
  const t=e.target.closest("button,[data-do]");if(!t||!t.closest('[data-view]'))return;const d=t.dataset;
  if(d.sec){editSec=d.sec;renderEdit();return}
  if(d.do){
    if(d.do==="minta"){if(P.blocks.length&&!sure(t,"Biztos? A mostani terv törlődik"))return;setProject(JSON.parse(JSON.stringify(MINTA)),{reset:true});location.hash="#most";toast("Minta betöltve. A Terv fülön átírhatod.")}
    else if(d.do==="ures"){if(P.blocks.length&&!sure(t,"Biztos? A mostani terv törlődik"))return;
      setProject({title:"",call:480,blocks:[{type:"prep",d:30,label:"Érkezés, setup"},{type:"shoot",d:30,label:"1/1"}]},{reset:true});editSec="idorend";openEB=P.blocks[1]._id;location.hash="#terv";renderEdit()}
    else if(d.do==="sablon")downloadSablon();
    else if(d.do==="tour")tourStart();
    else if(d.do==="export")exportNow();
    else if(d.do==="load"&&pending){const p=pending;pending=null;delete p._warn;setProject(p,{reset:true});editSec="idorend";location.hash="#most";toast("Terv betöltve: "+p.blocks.length+" blokk.",{tone:"ok"})}
    else if(d.do==="cancel"){pending=null;renderEdit()}
    else if(d.do==="scradd"||d.do==="scrrep"){const x=parseScript($("#scrpaste").value);if(!x.length)return;P.script=d.do==="scradd"?P.script.concat(x):x;commit();renderEdit();toast(x.length+" sor beolvasva. A Shotok mezőben jelöld, melyik shot veszi.")}
    return;
  }
  if(d.addb){withRemap(()=>{const b=normP({blocks:[{type:d.addb,d:d.addb==="shoot"?20:d.addb==="lunch"?45:10,label:d.addb==="shoot"?"":TNAME[d.addb]}]}).blocks[0];P.blocks.push(b);openEB=b._id});renderEdit();
    const last=$$(".eb");last.length&&last[last.length-1].scrollIntoView({block:"center"});return}
  if(!d.act)return;
  const host=t.closest("[data-k]"),k=host?+host.dataset.k:-1;
  if(d.act==="tog"){const b=P.blocks[k];openEB=openEB===b._id?null:b._id;renderEdit();return}
  if(d.act==="rowadd"){const L=d.list;P[L].push(L==="script"?{t:"ac",x:"",ids:[]}:L==="groups"?{code:"",name:"",desc:""}:L==="cast"?normP({cast:[{}]}).cast[0]:normP({crew:[{}]}).crew[0]);commit();renderEdit();const r=$$(`[data-list="${L}"].er`);r.length&&r[r.length-1].querySelector("input,textarea,select").focus();return}
  if(d.act==="rowdel"){const L=host.dataset.list,old=P[L][k];P[L].splice(k,1);commit();renderEdit();toast("Sor törölve.",{action:"Visszavonás",fn:()=>{P[L].splice(k,0,old);commit();renderEdit()}});return}
  if(d.act==="imgurl"){const u=host.querySelector("[data-imgurl]").value.trim();if(!/^https?:\/\//.test(u)){toast("Teljes linket adj meg (https://…).");return}P.blocks[k].images.push({kind:host.querySelector("[data-imgkind]").value,url:u});commit();renderEdit();return}
  if(d.imgdel!=null){const b=P.blocks[k],x=b.images.splice(+d.imgdel,1)[0];if(x&&x.idb)idb.del(x.idb).catch(()=>{});commit();renderEdit();return}
  if(["up","dn","dup","del","ins"].includes(d.act)){
    let undo=null;
    withRemap(()=>{const b=P.blocks[k];
      if(d.act==="up"&&k>0){P.blocks.splice(k,1);P.blocks.splice(k-1,0,b)}
      else if(d.act==="dn"&&k<P.blocks.length-1){P.blocks.splice(k,1);P.blocks.splice(k+1,0,b)}
      else if(d.act==="dup"){const c=JSON.parse(JSON.stringify(b));c._id=uid();P.blocks.splice(k+1,0,c);openEB=c._id}
      else if(d.act==="ins"){const c=normP({blocks:[{type:"move",d:10,label:"Átállás"}]}).blocks[0];P.blocks.splice(k+1,0,c);openEB=c._id}
      else if(d.act==="del"){P.blocks.splice(k,1);undo=()=>{withRemap(()=>P.blocks.splice(k,0,b));renderEdit()}}});
    renderEdit();const c=$(`.eb[data-k="${d.act==="up"?k-1:d.act==="dn"?k+1:d.act==="del"?k:k+1}"]`);c&&c.scrollIntoView({block:"nearest"});
    if(undo)toast("Blokk törölve.",{action:"Visszavonás",fn:undo});
  }
});
/* húzd ide */
addEventListener("dragover",e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes("Files")){e.preventDefault();document.body.classList.add("dragging")}});
addEventListener("dragleave",e=>{if(!e.relatedTarget)document.body.classList.remove("dragging")});
addEventListener("drop",e=>{document.body.classList.remove("dragging");const f=e.dataTransfer&&e.dataTransfer.files[0];if(!f)return;e.preventDefault();if(/\.(xlsx|xls|xlsm|ods|csv|json)$/i.test(f.name))importFile(f);else toast("Excel-táblázatot (.xlsx) húzz ide.")});

/* indulás: mentett terv, különben üres (üdvözlő) */
(()=>{let p=null;try{p=JSON.parse(localStorage.getItem(PKEY)||"null")}catch(e){}P=normP(p||{});applyProject();loadImgs()})();
mpBoot();
