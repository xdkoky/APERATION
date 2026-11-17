// Takarító: a főcímen korábban a Kapaszkodni-app futott, offline gyorsítótárral. Ez a változat
// letörli a régi mentett példányt, leválasztja magát, és újratölti az oldalt, ami így az APERATION-re visz.
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil((async()=>{
  for(const k of await caches.keys())if(k.startsWith("kap-ad-"))await caches.delete(k);
  await self.registration.unregister();
  for(const c of await self.clients.matchAll({type:"window"}))try{c.navigate(c.url)}catch(err){}
})()));
