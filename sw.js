// ACF Security Site Assessment — Service Worker v3
// Network-first for app shell (always get latest when online).
// Cache-first for satellite tiles (serve instantly from cache, fetch+cache if missing).

var APP_SHELL_CACHE = 'acf-app-shell-v3';
var TILE_CACHE_NAME  = 'acf-gaza-satellite-tiles-v1'; // keep same name so downloaded tiles survive updates

var APP_SHELL_FILES = [
  './index.html',
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

// Allow the new SW to take over immediately without waiting for old tabs to close
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then(function (cache) {
      return Promise.all(APP_SHELL_FILES.map(function (url) {
        return cache.add(url).catch(function (err) {
          console.warn('[SW] Could not precache', url, err);
        });
      }));
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (name) {
        // Delete old app-shell caches but keep the tile cache
        if (name !== APP_SHELL_CACHE && name !== TILE_CACHE_NAME) {
          console.log('[SW] Deleting old cache:', name);
          return caches.delete(name);
        }
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (e) { return; }

  // ── Satellite map tiles ──────────────────────────────────────────────────
  // Match by URL string (not Request object) to avoid credential/header mismatches.
  // Cache-first: serve instantly from tile store if available, otherwise fetch & cache.
  if (url.hostname === TILE_HOST) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then(function (cache) {
        // Match using the plain URL string with ignoreSearch:true in case Leaflet ever
        // appends a query parameter for cache-busting
        return cache.match(req.url, { ignoreSearch: true }).then(function (cached) {
          if (cached) {
            return cached;
          }
          // Not in cache — try network and store for next time
          return fetch(req.url, { mode: 'cors', credentials: 'omit' }).then(function (resp) {
            if (resp && (resp.ok || resp.type === 'opaque')) {
              cache.put(req.url, resp.clone());
            }
            return resp;
          }).catch(function () {
            // Truly offline and tile not cached — return an empty 1x1 transparent PNG
            // so Leaflet shows a blank tile instead of a broken-image icon
            var blankPNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
            var bytes = Uint8Array.from(atob(blankPNG), function(c){ return c.charCodeAt(0); });
            return new Response(bytes.buffer, {
              status: 200,
              headers: { 'Content-Type': 'image/png' }
            });
          });
        });
      })
    );
    return;
  }

  // ── App shell (same origin) ──────────────────────────────────────────────
  // Network-first: always try to get the latest version from GitHub Pages.
  // Falls back to the cached copy only when there is genuinely no network.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req).then(function (resp) {
        if (resp && resp.ok) {
          var copy = resp.clone();
          caches.open(APP_SHELL_CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return resp;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || new Response('Offline — file not cached yet.', { status: 503 });
        });
      })
    );
    return;
  }

  // Everything else (CDN scripts, external APIs) — pass through normally
});
