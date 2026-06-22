const CACHE_NAME = 'cool-cache';

// تنبيه: كودك الأصلي يحتوي على مجلدات عامة مثل '/assets/' و '/src/'
// الدالة cache.addAll تحتاج إلى روابط ملفات حقيقية وصريحة لتتمكن من تحميلها وتخزينها، مثل:
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/libs/leaflet.css',
    '/libs/leaflet.js',
    '/libs/html2canvas.min.js',
    '/libs/pizzip.min.js',
    '/libs/docxtemplater.js',
    '/libs/FileSaver.min.js',
    '/manifest.json'
];

// === كود 1: حدث الـ install ===
self.addEventListener('install', event => {
    console.log('Service Worker: جاري التثبيت وتخزين الملفات...');
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(PRECACHE_ASSETS);
        self.skipWaiting(); // تفعيل السيرفس وركر فوراً دون انتظار
    })());
});

// === كود 2: حدث الـ activate ===
self.addEventListener('activate', event => {
    console.log('Service Worker: تم التنشيط والسيطرة على الصفحات.');
    event.waitUntil(self.clients.claim());
});

// === كود 3: حدث الـ fetch (مصحح بنيوياً) ===
self.addEventListener('fetch', event => {
    // تخطي الطلبات المحلية التي ليست http أو https (لحماية التطبيق من الانهيار)
    if (!event.request.url.startsWith(self.location.origin) && !event.request.url.startsWith('https://')) {
        return;
    }

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);

        // البحث عن الملف في الكاش الخاص بنا
        const cachedResponse = await cache.match(event.request);

        // التحقق إذا كان الملف موجوداً في الكاش
        if (cachedResponse !== undefined) {
            // موجود بالكاش (Cache hit)، أرجعه فوراً ليعمل التطبيق أوفلاين
            return cachedResponse;
        } else {
            // غير موجود، اطلبه من الشبكة والإنترنت
            return fetch(event.request);
        }
    })());
});
