// ACF Security Site Assessment — Service Worker
// Two jobs:
//  1) Cache the app itself (HTML/CSS/JS) so the whole tool opens with no internet.
//  2) Serve Gaza Strip satellite tiles from cache when offline. Tiles are written
//     into TILE_CACHE_NAME by the "Download Satellite Map (Offline)" button in the
//     app — this worker mainly reads from it, with a network-fallback-and-cache
//     safety net for any tile that wasn't pre-downloaded.

var APP_SHELL_CACHE = 'acf-app-shell-v2';
var TILE_CACHE_NAME = 'acf-gaza-satellite-tiles-v1';

var APP_SHELL_FILES = [
  './acf-security-assessment.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './libs/leaflet.js',
  './libs/leaflet.css',
  './libs/html2canvas.min.js',
  './libs/pizzip.min.js',
  './libs/docxtemplater.js',
  './libs/FileSaver.min.js'
];

var TILE_HOST = 'server.arcgisonline.com';

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then(function (cache) {
      return Promise.all(APP_SHELL_FILES.map(function (url) {
        return cache.add(url).catch(function (err) {
          console.warn('[sw] could not precache', url, err);
        });
      }));
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (name) {
        if (name !== APP_SHELL_CACHE && name !== TILE_CACHE_NAME) {
          return caches.delete(name);
        }
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // Satellite tiles — cache first, network fallback (and cache whatever we fetch)
  if (url.hostname === TILE_HOST) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then(function (cache) {
        return cache.match(req).then(function (cached) {
          if (cached) return cached;
          return fetch(req).then(function (resp) {
            if (resp && (resp.ok || resp.type === 'opaque')) {
              cache.put(req, resp.clone());
            }
            return resp;
          }).catch(function () {
            return cached; // undefined — Leaflet will just show a blank tile
          });
        });
      })
    );
    return;
  }

  // App shell (same-origin) — network FIRST, so updates you upload to GitHub
  // show up immediately whenever there's a connection. Falls back to the
  // last cached copy only when there's genuinely no network (true offline use).
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req).then(function (resp) {
        if (resp && resp.ok) {
          var copy = resp.clone();
          caches.open(APP_SHELL_CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return resp;
      }).catch(function () {
        return caches.match(req);
      })
    );
    return;
  }

  // Everything else (street/terrain tiles, etc.) — normal network, not cached offline
});
