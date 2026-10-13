// Network-only worker: never cache auth responses, student data or signed files.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{if(event.request.method==='GET')event.respondWith(fetch(event.request));});
