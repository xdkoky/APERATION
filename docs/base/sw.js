const CACHE="diszpo-base-7874b6f5c4";
const CORE=["./", "Forgatasi_sablon.xlsx", "fonts/courierprime-v11-u-450q2lgwslOqpF-6gQ8kELaw9pWt-.woff2", "fonts/courierprime-v11-u-450q2lgwslOqpF-6gQ8kELawFpWg.woff2", "fonts/courierprime-v11-u-4k0q2lgwslOqpF-6gQ8kELY7pMT-7fq8Ho.woff2", "fonts/courierprime-v11-u-4k0q2lgwslOqpF-6gQ8kELY7pMT-Dfqw.woff2", "fonts/courierprime-v11-u-4n0q2lgwslOqpF-6gQ8kELawRZVsf6lvg.woff2", "fonts/courierprime-v11-u-4n0q2lgwslOqpF-6gQ8kELawRZWMf6.woff2", "fonts/inter-v20-UcC73FwrK3iLTeHuS-nVMrMxCp50SjIa1ZL7.woff2", "fonts/inter-v20-UcC73FwrK3iLTeHuS-nVMrMxCp50SjIa25L7SUc.woff2", "icon-180.png", "icon-192.png", "icon-512.png", "manifest.json", "vendor/xlsx.full.min.js"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("diszpo-base-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET"||new URL(e.request.url).origin!==location.origin)return;
  e.respondWith((async()=>{
    const hit=await caches.match(e.request,{ignoreSearch:true});if(hit)return hit;
    try{return await fetch(e.request)}catch(err){if(e.request.mode==="navigate")return caches.match("./");throw err}
  })());
});
