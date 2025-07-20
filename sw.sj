// تم تعديل CACHE_NAME ليعكس أن المسارات الآن تشمل '/e-mall/'
const CACHE_NAME = 'my-pwa-cache-v1-e-mall'; // اسم ذاكرة التخزين المؤقت
const urlsToCache = [
  '/e-mall/', // المسار الأساسي للمشروع
  '/e-mall/index.html',
  '/e-mall/style.css',
  '/e-mall/script.js',
  '/e-mall/manifest.json',
  '/e-mall/images/icon-192x192.png', // تأكد من وجود هذه الأيقونات في مجلد /e-mall/images/
  '/e-mall/images/icon-512x512.png',
  '/e-mall/images/maskable_icon.png',
  // أضف هنا أي أصول أخرى تريد تخزينها مؤقتًا، مثل صور الشعار الافتراضية، الخطوط، إلخ.
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css'
];

// حدث التثبيت: يتم تشغيله عندما يتم تثبيت Service Worker لأول مرة
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching App Shell');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Service Worker: Cache addAll failed', error);
      })
  );
});

// حدث التفعيل: يتم تشغيله عندما يصبح Service Worker نشطًا
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // تأكد من أن Service Worker يتحكم في جميع العملاء
  return self.clients.claim();
});

// حدث الجلب: يتم تشغيله عندما تطلب الصفحة موارد
self.addEventListener('fetch', (event) => {
  // تخطي طلبات Google Apps Script JSON لمنع التخزين المؤقت للبيانات الديناميكية
  if (event.request.url.includes('script.google.com/macros/s/')) {
    return fetch(event.request);
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // إذا كان المورد موجودًا في ذاكرة التخزين المؤقت، قم بإرجاعه
        if (response) {
          console.log('Service Worker: Fetching from cache', event.request.url);
          return response;
        }
        // وإلا، قم بجلب المورد من الشبكة
        console.log('Service Worker: Fetching from network', event.request.url);
        return fetch(event.request)
          .then((networkResponse) => {
            // يمكنك هنا تخزين الاستجابات الجديدة مؤقتًا إذا أردت
            // على سبيل المثال:
            // if (networkResponse.ok && networkResponse.type === 'basic') {
            //   const responseToCache = networkResponse.clone();
            //   caches.open(CACHE_NAME).then((cache) => {
            //     cache.put(event.request, responseToCache);
            //   });
            // }
            return networkResponse;
          })
          .catch(() => {
            // إذا فشل الجلب من الشبكة (مثل عدم الاتصال بالإنترنت)
            // يمكنك هنا إرجاع صفحة "غير متصل" مخصصة
            return new Response('<h1>أنت غير متصل بالإنترنت.</h1>', {
                headers: { 'Content-Type': 'text/html' }
            });
          });
      })
  );
});
