/* Cache only the public app shell. Account requests and workout data never enter CacheStorage. */
const CACHE='gainshub-shell-v15';
const SHELL=['./','./index.html','./styles.css','./config.js','./js/data.js','./js/sync.js','./js/records.js','./js/history.js','./js/updates.js','./js/app.js','./vendor/supabase.min.js','./assets/training-art.png','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./manifest.webmanifest'];
self.addEventListener('install',event=>{
  // Bypass the HTTP cache: a new worker must not install an older cached stylesheet.
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL.map(path=>
    new Request(new URL(path,self.registration.scope),{cache:'reload'})
  ))));
  // Updated shells activate after old tabs close, avoiding mixed application versions.
});
self.addEventListener('message',event=>{
  if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('gainshub-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  const allowed=new Set(SHELL.map(file=>new URL(file,self.registration.scope).href));
  if(url.origin!==self.location.origin||!allowed.has(url.href))return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(event.request);
    return cached||fetch(event.request);
  }));
});
