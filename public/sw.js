const CACHE="bigbrother-shell-v3";
const SHELL=["/offline.html","/icon-192.png","/icon-512.png","/favicon.svg"];
// Cache each asset independently: one missing file must not fail the whole install.
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>Promise.all(SHELL.map(url=>cache.add(url).catch(()=>{})))));self.skipWaiting();});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener("fetch",event=>{if(event.request.mode==="navigate"){event.respondWith(fetch(event.request).catch(()=>caches.match("/offline.html")));}});
// Private API responses and authenticated pages are never put in the offline cache.
