// Service Worker — Chemistry Without Magic PWA
// Precache-aware with app-shell fallback and ViewTransitions support
'use strict';

var CACHE_VERSION = 'v1';
var PAGES_CACHE = 'pages-' + CACHE_VERSION;
var ASSETS_CACHE = 'assets-' + CACHE_VERSION;
var DATA_CACHE = 'data-' + CACHE_VERSION;

var PRECACHE_PREFIX = 'precache-';
var COMPLETION_FLAG = '__precache_complete__';

var INSTALL_URLS = [
  '/offline.html',
  '/manifest.webmanifest',
];

// Guard against duplicate precache runs
var _precaching = false;

// --- Install: precache essentials ---
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(ASSETS_CACHE).then(function(cache) {
      return cache.addAll(INSTALL_URLS);
    })
  );
  self.skipWaiting();
});

// --- Activate: clean old caches (except precache-*), claim clients ---
self.addEventListener('activate', function(event) {
  var keepCaches = [PAGES_CACHE, ASSETS_CACHE, DATA_CACHE];
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names
          .filter(function(name) {
            // Keep known caches and all precache-* caches
            if (keepCaches.indexOf(name) !== -1) return false;
            if (name.indexOf(PRECACHE_PREFIX) === 0) return false;
            return true;
          })
          .map(function(name) { return caches.delete(name); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// --- Message handler: START_PRECACHE ---
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'START_PRECACHE') {
    var locale = event.data.locale || 'ru';
    precache(locale);
  }
});

// --- Fetch: route by request type ---
self.addEventListener('fetch', function(event) {
  var request = event.request;
  var url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // HTML page requests: ViewTransitions-compatible detection
  if (isHtmlRequest(request, url)) {
    event.respondWith(networkFirstPage(request));
    return;
  }

  var pathname = url.pathname;

  // Hashed Astro assets: cache-first (immutable)
  if (pathname.indexOf('/_astro/') === 0) {
    event.respondWith(cacheFirst(request, ASSETS_CACHE));
    return;
  }

  // Data manifest: network-first
  if (pathname === '/data/latest/manifest.json') {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // Data bundles (hash-addressed): cache-first, multi-cache lookup
  if (pathname.indexOf('/data/') === 0 && pathname !== '/data/latest/manifest.json') {
    event.respondWith(cacheFirstMulti(request));
    return;
  }

  // Other static assets (.css, .js, .svg, .png, .woff2, etc.): cache-first
  if (/\.(css|js|svg|png|jpg|jpeg|webp|avif|ico|woff2?)$/.test(pathname)) {
    event.respondWith(cacheFirst(request, ASSETS_CACHE));
    return;
  }

  // Default: network-first
  event.respondWith(networkFirst(request, ASSETS_CACHE));
});

// --- HTML request detection (ViewTransitions-compatible) ---
function isHtmlRequest(request, url) {
  // Standard navigation
  if (request.mode === 'navigate') return true;

  // ViewTransitions SPA-style fetches: Accept includes text/html
  // AND URL looks like a page (ends with / or has no file extension)
  var accept = request.headers.get('Accept') || '';
  if (accept.indexOf('text/html') !== -1) {
    var pathname = url.pathname;
    // Ends with slash — it's a page
    if (pathname.charAt(pathname.length - 1) === '/') return true;
    // No file extension — likely a page
    var lastSegment = pathname.split('/').pop();
    if (lastSegment && lastSegment.indexOf('.') === -1) return true;
  }

  return false;
}

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

/**
 * Cache-first with multi-cache lookup for /data/* requests.
 * Checks data-v1 first, then any precache-* caches.
 */
function cacheFirstMulti(request) {
  return caches.open(DATA_CACHE).then(function(dataCache) {
    return dataCache.match(request).then(function(cached) {
      if (cached) return cached;

      // Check precache-* stores
      return caches.keys().then(function(names) {
        var precacheNames = names.filter(function(n) {
          return n.indexOf(PRECACHE_PREFIX) === 0;
        });
        return searchCaches(precacheNames, request);
      }).then(function(precached) {
        if (precached) return precached;

        // Not in any cache — fetch from network
        return fetch(request).then(function(response) {
          if (response.ok) {
            dataCache.put(request, response.clone());
          }
          return response;
        });
      });
    });
  });
}

/**
 * Search through a list of cache names for a matching request.
 */
function searchCaches(cacheNames, request) {
  if (cacheNames.length === 0) return Promise.resolve(undefined);

  return caches.open(cacheNames[0]).then(function(cache) {
    return cache.match(request).then(function(cached) {
      if (cached) return cached;
      return searchCaches(cacheNames.slice(1), request);
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

/**
 * Network-first for HTML pages with app-shell fallback chain:
 * network → pages cache → precache → app-shell → offline.html
 */
function networkFirstPage(request) {
  return caches.open(PAGES_CACHE).then(function(pagesCache) {
    return fetch(request).then(function(response) {
      if (response.ok) {
        pagesCache.put(request, response.clone());
      }
      return response;
    }).catch(function() {
      // Offline fallback chain
      return pagesCache.match(request).then(function(cached) {
        if (cached) return cached;

        // Search precache-* stores for this page
        return caches.keys().then(function(names) {
          var precacheNames = names.filter(function(n) {
            return n.indexOf(PRECACHE_PREFIX) === 0;
          });
          return searchCaches(precacheNames, request);
        }).then(function(precached) {
          if (precached) return precached;

          // Try app-shell from precache
          return findAppShell().then(function(shell) {
            if (shell) return shell;

            // Last resort: offline.html
            return caches.match('/offline.html');
          });
        });
      });
    });
  });
}

/**
 * Find the app-shell page in any precache-* cache.
 */
function findAppShell() {
  return caches.keys().then(function(names) {
    var precacheNames = names.filter(function(n) {
      return n.indexOf(PRECACHE_PREFIX) === 0;
    });
    return searchCaches(precacheNames, new Request('/app-shell/'));
  });
}

// --- Precache logic ---

/**
 * Main precache function. Triggered by START_PRECACHE message.
 * Phase 1: shell + assets + core data + active locale data + active locale pages + shared pages
 * Phase 2: remaining locale data + pages (lower priority)
 */
function precache(activeLocale) {
  if (_precaching) return;
  _precaching = true;

  fetch('/precache-manifest.json').then(function(response) {
    if (!response.ok) {
      _precaching = false;
      return; // Manifest absent in dev mode — skip silently
    }
    return response.json();
  }).then(function(manifest) {
    var version = manifest.version;
    var cacheName = PRECACHE_PREFIX + version;

    // Check if already completed
    return caches.open(cacheName).then(function(cache) {
      return cache.match(COMPLETION_FLAG).then(function(flagResponse) {
        if (flagResponse) {
          // Already completed — skip, but still clean old caches
          _precaching = false;
          return cleanOldPrecaches(cacheName);
        }

        // Build Phase 1 URL list
        var phase1Urls = [];

        // App shell
        if (manifest.shell) {
          phase1Urls.push(manifest.shell);
        }

        // Assets (JS/CSS)
        if (manifest.assets) {
          phase1Urls = phase1Urls.concat(manifest.assets);
        }

        // Core data
        if (manifest.data && manifest.data.core) {
          phase1Urls = phase1Urls.concat(manifest.data.core);
        }

        // Active locale data
        if (manifest.data && manifest.data.locale && manifest.data.locale[activeLocale]) {
          phase1Urls = phase1Urls.concat(manifest.data.locale[activeLocale]);
        }

        // Active locale pages
        if (manifest.pages && manifest.pages[activeLocale]) {
          phase1Urls = phase1Urls.concat(manifest.pages[activeLocale]);
        }

        // Shared pages
        if (manifest.pages && manifest.pages._shared) {
          phase1Urls = phase1Urls.concat(manifest.pages._shared);
        }

        // Run Phase 1
        return batchFetch(cache, phase1Urls, 10).then(function(failures) {
          if (failures === 0) {
            // Full success — set completion flag, notify clients, clean old caches
            return cache.put(COMPLETION_FLAG, new Response('1')).then(function() {
              return notifyClients({ type: 'PRECACHE_DONE' });
            }).then(function() {
              return cleanOldPrecaches(cacheName);
            }).then(function() {
              // Start Phase 2 in background
              _precaching = false;
              return startPhase2(manifest, activeLocale, cache);
            });
          } else {
            // Partial failure — don't set flag, don't notify, don't clean
            console.warn('[SW] Precache Phase 1 incomplete: ' + failures + ' failures. Will retry next visit.');
            _precaching = false;
          }
        });
      });
    });
  }).catch(function(err) {
    console.error('[SW] Precache failed:', err);
    _precaching = false;
  });
}

/**
 * Phase 2: cache remaining locales' data + pages at lower priority.
 */
function startPhase2(manifest, activeLocale, cache) {
  var LOCALES = ['ru', 'en', 'pl', 'es'];
  var phase2Urls = [];

  // Remaining locale data
  if (manifest.data && manifest.data.locale) {
    LOCALES.forEach(function(loc) {
      if (loc !== activeLocale && manifest.data.locale[loc]) {
        phase2Urls = phase2Urls.concat(manifest.data.locale[loc]);
      }
    });
  }

  // Remaining locale pages
  if (manifest.pages) {
    LOCALES.forEach(function(loc) {
      if (loc !== activeLocale && manifest.pages[loc]) {
        phase2Urls = phase2Urls.concat(manifest.pages[loc]);
      }
    });
  }

  if (phase2Urls.length === 0) return Promise.resolve();

  return batchFetch(cache, phase2Urls, 5).then(function(failures) {
    if (failures > 0) {
      console.warn('[SW] Precache Phase 2: ' + failures + ' failures (non-critical).');
    }
  }).catch(function(err) {
    console.warn('[SW] Precache Phase 2 error:', err);
  });
}

/**
 * Batch-fetch URLs into a cache with concurrency limit.
 * Skips URLs already present in the cache.
 * Returns the number of failures.
 */
function batchFetch(cache, urls, concurrency) {
  var failures = 0;
  var index = 0;

  function fetchOne() {
    if (index >= urls.length) return Promise.resolve();
    var url = urls[index++];

    return cache.match(url).then(function(existing) {
      if (existing) return; // Already cached — skip

      return fetch(url).then(function(response) {
        if (response.ok) {
          return cache.put(url, response);
        } else {
          failures++;
          console.warn('[SW] Precache fetch failed (' + response.status + '): ' + url);
        }
      }).catch(function(err) {
        failures++;
        console.warn('[SW] Precache fetch error: ' + url, err);
      });
    });
  }

  // Each worker picks the next URL, fetches it, then loops
  function runWorker() {
    return fetchOne().then(function() {
      if (index < urls.length) return runWorker();
    });
  }

  // Start N parallel workers (N = concurrency)
  var workerPromises = [];
  for (var i = 0; i < Math.min(concurrency, urls.length); i++) {
    workerPromises.push(runWorker());
  }

  return Promise.all(workerPromises).then(function() {
    return failures;
  });
}

/**
 * Send a message to all controlled clients.
 */
function notifyClients(message) {
  return self.clients.matchAll().then(function(clientList) {
    clientList.forEach(function(client) {
      client.postMessage(message);
    });
  });
}

/**
 * Delete old precache-* caches, keeping only the specified current one.
 */
function cleanOldPrecaches(currentCacheName) {
  return caches.keys().then(function(names) {
    return Promise.all(
      names
        .filter(function(name) {
          return name.indexOf(PRECACHE_PREFIX) === 0 && name !== currentCacheName;
        })
        .map(function(name) {
          return caches.delete(name);
        })
    );
  });
}
