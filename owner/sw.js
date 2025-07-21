// owner/sw.js - Service Worker for owner's app
self.addEventListener('install', (event) => {
    console.log('Owner Service Worker installed');
    self.skipWaiting(); 
});

self.addEventListener('activate', (event) => {
    console.log('Owner Service Worker activated');
    event.waitUntil(clients.claim());
});

// يمكن إضافة منطق التخزين المؤقت (Caching) هنا لاحقًا لتحسين الأداء
/*
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
*/
