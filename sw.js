// ACF Security Site Assessment — Service Worker v4
// Strategy:
//   - App shell (index.html + libs): Cache-first with background update
//   - Satellite tiles (Esri): Cache-first, download on demand
//   - Street/terrain tiles (OSM, OpenTopo): Cache-first when available, blank PNG fallback
//   - Everything else: Network-only (pass through)

var CACHE_VERSION    = 'v4-20260705'; // bump this string on every deploy
var APP_SHELL_CACHE  = 'acf-shell-' + CACHE_VERSION;
var TILE_CACHE_SAT   = 'acf-satellite-tiles-v1'; // keep name — preserves downloaded tiles
var TILE_CACHE_STREET= 'acf-street-tiles-v1';

var APP_SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './libs/leaflet.js',
  './libs/leaflet.css',
  './libs/leaflet.css.map',
  './libs/html2canvas.min.js',
  './libs/pizzip.min.js',
  './libs/docxtemplater.js',
  './libs/FileSaver.min.js',
  './libs/sql-wasm.js',
  './libs/sql-wasm.wasm',
  './libs/images/marker-icon.png',
  './libs/images/marker-icon-2x.png',
  './libs/images/marker-shadow.png',
  './libs/images/layers.png',
  './libs/images/layers-2x.png'
];

var TILE_HOSTS = {
  satellite: 'server.arcgisonline.com',
  street:    'tile.openstreetmap.org',
  terrain:   'tile.opentopomap.org'
};

// Transparent 1×1 PNG — returned when a tile is unavailable offline
var BLANK_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
function blankTileResponse() {
  var bytes = Uint8Array.from(atob(BLANK_PNG), function(c){ return c.charCodeAt(0); });
  return new Response(bytes.buffer, { status:200, headers:{ 'Content-Type':'image/png' } });
}

self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── INSTALL: pre-cache app shell ─────────────────────────────────────────────
self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then(function(cache) {
      return Promise.allSettled(
        APP_SHELL_FILES.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[SW] precache skip:', url, err.message || err);
          });
        })
      );
    })
  );
});

// ── ACTIVATE: delete old caches (but keep tile caches) ──────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(key) {
        if (key === APP_SHELL_CACHE || key === TILE_CACHE_SAT || key === TILE_CACHE_STREET) return;
        console.log('[SW] deleting old cache:', key);
        return caches.delete(key);
      }));
    }).then(function() { return self.clients.claim(); })
  );
});

// ── FETCH ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', function(event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch(e) { return; }

  var host = url.hostname;

  // ── Satellite tiles (Esri) — cache-first ──────────────────────────────────
  if (host === TILE_HOSTS.satellite) {
    event.respondWith(serveTile(req.url, TILE_CACHE_SAT));
    return;
  }

  // ── Street / terrain tiles (OSM, OpenTopo) — cache-first ─────────────────
  if (host === TILE_HOSTS.street || host.endsWith(TILE_HOSTS.street)) {
    event.respondWith(serveTile(req.url, TILE_CACHE_STREET));
    return;
  }
  if (host === TILE_HOSTS.terrain || host.endsWith(TILE_HOSTS.terrain)) {
    event.respondWith(serveTile(req.url, TILE_CACHE_STREET));
    return;
  }

  // ── App shell (same origin) — cache-first + background revalidate ─────────
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(APP_SHELL_CACHE).then(function(cache) {
        return cache.match(req).then(function(cached) {
          // Revalidate in background
          var fetchPromise = fetch(req).then(function(resp) {
            if (resp && resp.ok) cache.put(req, resp.clone());
            return resp;
          }).catch(function() { return null; });

          // Return cache immediately if available, else wait for network
          return cached || fetchPromise.then(function(resp) {
            return resp || new Response('Offline — not cached yet.', { status: 503 });
          });
        });
      })
    );
    return;
  }
  // Everything else: pass through
});

// ── TILE HELPER ───────────────────────────────────────────────────────────────
function serveTile(tileUrl, cacheName) {
  return caches.open(cacheName).then(function(cache) {
    return cache.match(tileUrl).then(function(cached) {
      if (cached) return cached;
      return fetch(tileUrl, { mode:'cors', credentials:'omit' })
        .then(function(resp) {
          if (resp && (resp.ok || resp.type === 'opaque')) {
            cache.put(tileUrl, resp.clone());
          }
          return resp;
        })
        .catch(function() { return blankTileResponse(); });
    });
  });
}
