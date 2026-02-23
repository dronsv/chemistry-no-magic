// Service Worker — Chemistry Without Magic PWA
'use strict';

const CACHE_VERSION = 'v1';
const PAGES_CACHE = 'pages-' + CACHE_VERSION;
const ASSETS_CACHE = 'assets-' + CACHE_VERSION;
const DATA_CACHE = 'data-' + CACHE_VERSION;

const PRECACHE_URLS = [
  '/offline.html',
  '/manifest.webmanifest',
];

// --- Install: precache essentials ---
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(ASSETS_CACHE).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// --- Activate: clean old caches, claim clients ---
self.addEventListener('activate', function(event) {
  var currentCaches = [PAGES_CACHE, ASSETS_CACHE, DATA_CACHE];
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names
          .filter(function(name) { return currentCaches.indexOf(name) === -1; })
          .map(function(name) { return caches.delete(name); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// --- Fetch: route by request type ---
self.addEventListener('fetch', function(event) {
  var request = event.request;
  var url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Navigation requests (HTML pages): network-first
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }

  var pathname = url.pathname;

  // Hashed Astro assets: cache-first (immutable)
  if (pathname.startsWith('/_astro/')) {
    event.respondWith(cacheFirst(request, ASSETS_CACHE));
    return;
  }

  // Data manifest: network-first
  if (pathname === '/data/latest/manifest.json') {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // Data bundles (hash-addressed): cache-first (immutable)
  if (pathname.startsWith('/data/') && pathname !== '/data/latest/manifest.json') {
    event.respondWith(cacheFirst(request, DATA_CACHE));
    return;
  }

  // Other static assets (.css, .js, .svg, .png, .woff2, etc.): cache-first
  if (/\.(css|js|svg|png|jpg|jpeg|webp|avif|ico|woff2?)$/.test(pathname)) {
    event.respondWith(cacheFirst(request, ASSETS_CACHE));
    return;
  }

  // Default: network with cache fallback
  event.respondWith(networkFirst(request, ASSETS_CACHE));
});

// --- Strategies ---

function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then(function(cache) {
    return cache.match(request).then(function(cached) {
      if (cached) return cached;
      return fetch(request).then(function(response) {
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      });
    });
  });
}

function networkFirst(request, cacheName) {
  return caches.open(cacheName).then(function(cache) {
    return fetch(request).then(function(response) {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    }).catch(function() {
      return cache.match(request);
    });
  });
}

function networkFirstPage(request) {
  return caches.open(PAGES_CACHE).then(function(cache) {
    return fetch(request).then(function(response) {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    }).catch(function() {
      return cache.match(request).then(function(cached) {
        return cached || caches.match('/offline.html');
      });
    });
  });
}
