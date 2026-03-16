# Offline-First PWA Precaching — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the entire site work offline by precaching JSON data, JS/CSS assets, and Astro-rendered HTML pages in the background on WiFi.

**Architecture:** Build-time script generates `precache-manifest.json` listing all cacheable files. Service worker downloads them in background. React-island pages render client-side via an app-shell fallback; Astro-rendered pages served from HTML cache. Connection-aware: auto on WiFi, manual opt-in on mobile data.

**Tech Stack:** Astro 5, React 19, Service Worker API, Cache API, BroadcastChannel, Network Information API

**Spec:** `docs/superpowers/specs/2026-03-16-offline-pwa-precache-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `scripts/lib/generate-precache-manifest.mjs` | CREATE | Scan `dist/` after build → `dist/precache-manifest.json` |
| `src/pages/app-shell.astro` | CREATE | Minimal layout page with OfflineRouter |
| `src/features/offline/OfflineRouter.tsx` | CREATE | Client-side URL → React component router |
| `src/features/offline/route-map.ts` | CREATE | Route table: canonical path → dynamic import |
| `src/features/offline/offline-router.css` | CREATE | Loading spinner styles |
| `src/lib/offline-precache.ts` | CREATE | Connection-aware precache trigger |
| `src/components/OfflineToast.tsx` | CREATE | Toast notification on precache completion |
| `src/components/offline-toast.css` | CREATE | Toast fade animation styles |
| `public/sw.js` | MODIFY | Add precache logic, app-shell fallback, HTML detection |
| `src/layouts/BaseLayout.astro` | MODIFY | Mount toast, call initPrecache after SW register |
| `src/features/settings/SettingsPage.tsx` | MODIFY | Add offline mode section |
| `src/features/settings/settings-page.css` | MODIFY | Offline section styles |
| `messages/ru.json` | MODIFY | Add offline-related i18n keys |
| `messages/en.json` | MODIFY | Add offline-related i18n keys |
| `messages/pl.json` | MODIFY | Add offline-related i18n keys |
| `messages/es.json` | MODIFY | Add offline-related i18n keys |
| `package.json` | MODIFY | Add postbuild script |
| `astro.config.mjs` | MODIFY | Exclude app-shell from sitemap |

---

## Chunk 1: Build-time Precache Manifest

### Task 1: Precache manifest generator

**Files:**
- Create: `scripts/lib/generate-precache-manifest.mjs`

**Context:** After `astro build` completes, `dist/` contains all built files: `_astro/*.{js,css}`, `data/{hash}/**/*.json`, and `**/*.html` pages. This script scans `dist/` and outputs a structured JSON manifest the SW can consume.

The manifest needs to classify HTML pages as either "react-island" (served via app-shell offline) or "astro-rendered" (precached as HTML). React-island pages are identified by their canonical path matching a known list (periodic-table index, substances index, bonds index, etc.).

- [ ] **Step 1: Create the generator script**

```javascript
// scripts/lib/generate-precache-manifest.mjs
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, relative, extname } from 'path';

const DIST = 'dist';

// Canonical prefixes of React-island index pages (no dynamic params).
// These are rendered client-side via app-shell offline — no HTML precache needed.
const REACT_ISLAND_PAGES = new Set([
  'periodic-table', 'substances', 'bonds', 'oxidation-states',
  'reactions', 'ions', 'calculations', 'diagnostics', 'exam',
  'profile', 'search', 'settings', 'processes', 'physical-foundations',
  'competencies',
]);

// Localized slug → canonical mapping for section indexes
// (just the first path segment after locale prefix)
const LOCALIZED_SLUGS = {
  'tablica-okresowa': 'periodic-table',
  'tabla-periodica': 'periodic-table',
  'substancje': 'substances',
  'sustancias': 'substances',
  'wiazania': 'bonds',
  'enlaces': 'bonds',
  'stopnie-utlenienia': 'oxidation-states',
  'estados-oxidacion': 'oxidation-states',
  'reakcje': 'reactions',
  'reacciones': 'reactions',
  'jony': 'ions',
  'iones': 'ions',
  'obliczenia': 'calculations',
  'calculos': 'calculations',
  'diagnostyka': 'diagnostics',
  'diagnostico': 'diagnostics',
  'egzamin': 'exam',
  'examen': 'exam',
  'profil': 'profile',
  'perfil': 'profile',
  'szukaj': 'search',
  'buscar': 'search',
  'ustawienia': 'settings',
  'ajustes': 'settings',
  'procesy': 'processes',
  'procesos': 'processes',
  'kompetencje': 'competencies',
  'competencias': 'competencies',
};

const LOCALES = ['ru', 'en', 'pl', 'es'];

/**
 * Recursively collect all files under dir matching predicate.
 */
function walk(dir, predicate, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, predicate, out);
    } else if (predicate(full)) {
      out.push('/' + relative(DIST, full));
    }
  }
  return out;
}

/**
 * Determine if an HTML page URL is a react-island index page.
 * React-island pages: /{locale}/{section}/index.html where section is in REACT_ISLAND_PAGES.
 * Also handles nested like /exam/compare/.
 */
function isReactIslandPage(urlPath) {
  // Strip trailing index.html
  const clean = urlPath.replace(/index\.html$/, '').replace(/\/$/, '');
  // Split into segments: ['', 'ru', 'periodic-table'] or ['', 'en', 'exam', 'compare']
  const segs = clean.split('/').filter(Boolean);
  if (segs.length < 2) return false;

  const locale = segs[0];
  if (!LOCALES.includes(locale)) return false;

  const section = segs[1];
  const canonical = LOCALIZED_SLUGS[section] || section;

  // Exact section index: /{locale}/{section}/
  if (segs.length === 2 && REACT_ISLAND_PAGES.has(canonical)) return true;

  // Exam compare: /{locale}/exam/compare/ or /{locale}/egzamin/porownanie/
  if (segs.length === 3 && canonical === 'exam') {
    const sub = segs[2];
    if (sub === 'compare' || sub === 'porownanie' || sub === 'comparar') return true;
  }

  return false;
}

/**
 * Detect locale from HTML page path.
 */
function detectLocale(urlPath) {
  for (const loc of LOCALES) {
    if (urlPath.startsWith(`/${loc}/`)) return loc;
  }
  return null; // international pages (e.g., /index.html)
}

export function generatePrecacheManifest() {
  // 1. Read data manifest for bundle hash
  const dataManifest = JSON.parse(readFileSync(join(DIST, 'data/latest/manifest.json'), 'utf8'));
  const hash = dataManifest.bundle_hash;

  // 2. Collect _astro assets
  const assets = walk(join(DIST, '_astro'), f => /\.(js|css)$/.test(f));

  // 3. Collect data files
  const dataDir = join(DIST, 'data', hash);
  const allDataFiles = walk(dataDir, () => true);

  const coreData = [];
  const localeData = { ru: [], en: [], pl: [], es: [] };

  for (const f of allDataFiles) {
    const translationMatch = f.match(/\/translations\/(ru|en|pl|es)\//);
    if (translationMatch) {
      localeData[translationMatch[1]].push(f);
    } else {
      coreData.push(f);
    }
  }

  // Also add locale-specific search/name indices
  for (const loc of LOCALES) {
    const searchIdx = `/data/${hash}/search_index.${loc}.json`;
    const nameIdx = `/data/${hash}/name_index.${loc}.json`;
    // Move from core to locale if present
    for (const idx of [searchIdx, nameIdx]) {
      const corePos = coreData.indexOf(idx);
      if (corePos !== -1) {
        coreData.splice(corePos, 1);
        localeData[loc].push(idx);
      }
    }
  }

  // 4. Collect HTML pages, classify per locale
  const pages = { ru: [], en: [], pl: [], es: [], _shared: [] };
  const htmlFiles = walk(DIST, f => f.endsWith('.html'));

  for (const f of htmlFiles) {
    // Skip app-shell, offline, non-page files
    if (f.includes('/app-shell/') || f === '/offline.html') continue;
    // Skip _astro directory HTML (shouldn't exist but safety)
    if (f.startsWith('/_astro/')) continue;

    // Skip react-island pages (these use app-shell offline)
    if (isReactIslandPage(f)) continue;

    const locale = detectLocale(f);
    if (locale) {
      pages[locale].push(f);
    } else {
      // International page (e.g., /index.html)
      pages._shared.push(f);
    }
  }

  // 5. Write manifest
  const manifest = {
    version: hash,
    shell: '/app-shell/',
    assets,
    data: { core: coreData, locale: localeData },
    pages,
  };

  const outPath = join(DIST, 'precache-manifest.json');
  writeFileSync(outPath, JSON.stringify(manifest));

  const totalAssets = assets.length;
  const totalCore = coreData.length;
  const totalPages = Object.values(pages).reduce((s, a) => s + a.length, 0);
  console.log(`Precache manifest: ${totalAssets} assets, ${totalCore} core data, ${Object.entries(localeData).map(([k,v]) => `${k}:${v.length}`).join(' ')} locale data, ${totalPages} pages → ${outPath}`);

  return manifest;
}

// Exported for testing
export { isReactIslandPage };

// CLI entry
if (process.argv[1] && process.argv[1].endsWith('generate-precache-manifest.mjs')) {
  generatePrecacheManifest();
}
```

- [ ] **Step 2: Test the generator manually**

Run: `npm run build && node scripts/lib/generate-precache-manifest.mjs`

Expected: `dist/precache-manifest.json` created with console output showing counts. Verify:
- `assets` array contains `_astro/*.js` and `_astro/*.css` files
- `data.core` contains JSON files without locale paths
- `data.locale.ru` contains `translations/ru/` files
- `pages.ru` contains element detail, substance detail, competency pages but NOT `/ru/periodic-table/index.html`
- `pages._shared` contains `/index.html`

- [ ] **Step 3: Integrate into build pipeline**

Modify `package.json` build script — add precache manifest generation after astro build:

```json
"build": "node scripts/build-data.mjs && node scripts/generate-llms-full.mjs && node scripts/generate-feed.mjs && astro build && cp dist/sitemap-index.xml dist/sitemap.xml && node scripts/lib/generate-precache-manifest.mjs",
```

- [ ] **Step 4: Verify build integration**

Run: `npm run build`
Expected: Build completes successfully, `dist/precache-manifest.json` exists at the end.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/generate-precache-manifest.mjs package.json
git commit -m "feat(pwa): add build-time precache manifest generator"
```

---

## Chunk 2: App Shell + Offline Router

### Task 2: Route map

**Files:**
- Create: `src/features/offline/route-map.ts`

**Context:** The route map translates canonical URL paths to dynamic imports of React page components. The offline router uses this to determine which React component to render when the app-shell is served offline. Uses the `getCanonicalPath()` function from `src/lib/i18n.ts` to resolve localized URLs.

- [ ] **Step 1: Create route-map.ts**

```typescript
// src/features/offline/route-map.ts
import type { ComponentType } from 'react';
import type { SupportedLocale } from '../../types/i18n';

export interface RouteEntry {
  /** Canonical path prefix (from i18n.ts SLUG_MAP keys) */
  canonical: string;
  /** Whether this is an exact match or prefix match */
  exact: boolean;
  /** Dynamic import of the React page component */
  load: () => Promise<{ default: ComponentType<{ locale?: SupportedLocale }> }>;
}

/**
 * Route table for offline rendering. Order matters — more specific routes first.
 * Each entry maps a canonical path to a lazy-loaded React component.
 */
export const ROUTES: RouteEntry[] = [
  { canonical: '/exam/compare/', exact: true, load: () => import('../../features/exam/ExamComparison') },
  { canonical: '/periodic-table/', exact: true, load: () => import('../../features/periodic-table/PeriodicTablePage') },
  { canonical: '/substances/', exact: true, load: () => import('../../features/substances/SubstancesPage') },
  { canonical: '/bonds/', exact: true, load: () => import('../../features/bonds/BondsPage') },
  { canonical: '/oxidation-states/', exact: true, load: () => import('../../features/oxidation-states/OxidationStatesPage') },
  { canonical: '/reactions/', exact: true, load: () => import('../../features/reactions/ReactionsPage') },
  { canonical: '/ions/', exact: true, load: () => import('../../features/ions/IonsPage') },
  { canonical: '/calculations/', exact: true, load: () => import('../../features/calculations/CalculationsPage') },
  { canonical: '/diagnostics/', exact: true, load: () => import('../../features/diagnostics/DiagnosticsApp') },
  { canonical: '/exam/', exact: true, load: () => import('../../features/exam/ExamPage') },
  { canonical: '/profile/', exact: true, load: () => import('../../features/profile/ProfileApp') },
  { canonical: '/search/', exact: true, load: () => import('../../features/search/SearchPage') },
  { canonical: '/settings/', exact: true, load: () => import('../../features/settings/SettingsPage') },
  { canonical: '/processes/', exact: true, load: () => import('../../features/processes/ProcessesPage') },
  { canonical: '/physical-foundations/', exact: true, load: () => import('../../features/physical-foundations/PhysicalFoundationsPage') },
  { canonical: '/competencies/', exact: true, load: () => import('../../features/competency/CompetencyGraphIsland') },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/features/offline/route-map.ts
git commit -m "feat(pwa): add offline route map for React island pages"
```

---

### Task 3: OfflineRouter component

**Files:**
- Create: `src/features/offline/OfflineRouter.tsx`
- Create: `src/features/offline/offline-router.css`

**Context:** This React component is the sole content of the app-shell page. When the SW serves the app-shell for an offline navigation to a React-island page, this component reads `window.location.pathname`, resolves it to a canonical path using `getCanonicalPath()`, finds the matching route, dynamically imports the component, and renders it. Shows a spinner during loading. Shows an offline message if no route matches (should be rare — means the page should have been HTML-precached but wasn't).

- [ ] **Step 1: Create offline-router.css**

```css
/* src/features/offline/offline-router.css */
.offline-router-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 40vh;
  gap: 1rem;
  color: var(--text-secondary, #64748b);
}

.offline-router-spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--border-color, #e2e8f0);
  border-top-color: var(--primary, #2563eb);
  border-radius: 50%;
  animation: offline-spin 0.8s linear infinite;
}

@keyframes offline-spin {
  to { transform: rotate(360deg); }
}

.offline-router-error {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary, #64748b);
}

.offline-router-error h2 {
  margin-bottom: 0.5rem;
}
```

- [ ] **Step 2: Create OfflineRouter.tsx**

```tsx
// src/features/offline/OfflineRouter.tsx
import { useState, useEffect, type ComponentType } from 'react';
import { getCanonicalPath } from '../../lib/i18n';
import { ROUTES } from './route-map';
import type { SupportedLocale } from '../../types/i18n';
import './offline-router.css';

export default function OfflineRouter() {
  const [Component, setComponent] = useState<ComponentType<{ locale?: SupportedLocale }> | null>(null);
  const [locale, setLocale] = useState<SupportedLocale>('ru');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pathname = window.location.pathname;
    const { canonical, locale: detectedLocale } = getCanonicalPath(pathname);
    setLocale(detectedLocale);

    // Find matching route
    const route = ROUTES.find(r =>
      r.exact ? canonical === r.canonical : canonical.startsWith(r.canonical)
    );

    if (!route) {
      setError(true);
      setLoading(false);
      return;
    }

    route.load()
      .then(mod => {
        setComponent(() => mod.default);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="offline-router-loading">
        <div className="offline-router-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (error || !Component) {
    return (
      <div className="offline-router-error">
        <h2>Page not available offline</h2>
        <p>This page hasn't been cached yet. Please connect to the internet.</p>
        <button onClick={() => window.history.back()} style={{ marginTop: '1rem', cursor: 'pointer' }}>
          &larr; Go back
        </button>
      </div>
    );
  }

  return <Component locale={locale} />;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to offline router files.

- [ ] **Step 4: Commit**

```bash
git add src/features/offline/OfflineRouter.tsx src/features/offline/offline-router.css
git commit -m "feat(pwa): add OfflineRouter component for client-side rendering"
```

---

### Task 4: App shell Astro page

**Files:**
- Create: `src/pages/app-shell.astro`
- Modify: `astro.config.mjs` (sitemap filter)

**Context:** The app-shell is a minimal Astro page that uses `BaseLayout` for CSS/nav/footer and mounts the `OfflineRouter` with `client:load` (exception to `client:idle` convention — this page is only served offline and the router must execute immediately). It must be excluded from the sitemap.

- [ ] **Step 1: Create app-shell.astro**

```astro
---
// src/pages/app-shell.astro
// Offline app-shell page — served by SW when navigating offline to React-island pages.
// Uses client:load (exception to client:idle convention: this page is only served offline,
// and the router must execute immediately to render the correct component).
import BaseLayout from '../layouts/BaseLayout.astro';
import OfflineRouter from '../features/offline/OfflineRouter';
---

<BaseLayout title="Offline" description="">
  <OfflineRouter client:load />
</BaseLayout>
```

Note: No `noIndex` meta needed — the page is never served online (only via SW offline fallback). Sitemap filter handles SEO exclusion.

- [ ] **Step 2: Exclude app-shell from sitemap**

In `astro.config.mjs`, add to the `filter` function (after the profile filter, around line 145):

```javascript
if (page.includes('/app-shell')) return false;
```

- [ ] **Step 3: Verify build produces app-shell**

Run: `npm run build`
Expected: `dist/app-shell/index.html` exists. `dist/sitemap-index.xml` does NOT contain `app-shell`.

- [ ] **Step 4: Verify precache manifest classifies app-shell correctly**

The app-shell URL should NOT appear in `pages` arrays of `precache-manifest.json` (it's excluded by the `if (f.includes('/app-shell/'))` check in the generator). It should be referenced only via the `shell` field.

- [ ] **Step 5: Commit**

```bash
git add src/pages/app-shell.astro astro.config.mjs
git commit -m "feat(pwa): add app-shell page and exclude from sitemap"
```

---

## Chunk 3: Service Worker

### Task 5: Rewrite SW with precache support

**Files:**
- Modify: `public/sw.js`

**Context:** The current SW (`public/sw.js`, 129 lines) has 3 caches: `pages-v1`, `assets-v1`, `data-v1`. It precaches only `offline.html` and `manifest.webmanifest`. We need to add:

1. A `precache()` function triggered by message from main thread
2. HTML request detection that works with Astro ViewTransitions (check `Accept` header, not just `navigate` mode)
3. App-shell fallback chain for offline navigation
4. Completion tracking via a flag entry in cache
5. Safe cache rotation (old cache kept until new one completes)

The SW must remain a plain JS file (no modules, no build step — it's in `public/`).

- [ ] **Step 1: Rewrite sw.js**

```javascript
// public/sw.js — Chemistry Without Magic PWA
'use strict';

var CACHE_VERSION = 'v1';
var PAGES_CACHE = 'pages-' + CACHE_VERSION;
var ASSETS_CACHE = 'assets-' + CACHE_VERSION;
var DATA_CACHE = 'data-' + CACHE_VERSION;

// Prefix for precache stores: precache-{bundleHash}
var PRECACHE_PREFIX = 'precache-';
var PRECACHE_COMPLETE_KEY = '__precache_complete__';

var PRECACHE_URLS = [
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

// --- Activate: clean old runtime caches, claim clients ---
// Note: precache-* caches are NOT cleaned here — they are cleaned after
// a new precache completes (in the precache function).
self.addEventListener('activate', function(event) {
  var runtimeCaches = [PAGES_CACHE, ASSETS_CACHE, DATA_CACHE];
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names
          .filter(function(name) {
            // Only clean runtime caches, not precache-*
            return runtimeCaches.indexOf(name) === -1 && !name.startsWith(PRECACHE_PREFIX);
          })
          .map(function(name) { return caches.delete(name); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// --- Messages from main thread ---
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'START_PRECACHE') {
    precache(event.data.locale || 'ru');
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

  // HTML page requests: navigate mode OR ViewTransitions fetch with Accept: text/html
  if (isHtmlRequest(request, url)) {
    event.respondWith(handleHtmlRequest(request));
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
  if (pathname.startsWith('/data/')) {
    event.respondWith(cacheFirstMulti(request, [DATA_CACHE, PRECACHE_PREFIX]));
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

// --- HTML request detection ---
// Astro ViewTransitions uses fetch() for SPA navigation, which arrives as
// mode=cors with Accept:text/html — not mode=navigate. We detect both.
function isHtmlRequest(request, url) {
  if (request.mode === 'navigate') return true;
  var accept = request.headers.get('Accept') || '';
  if (!accept.includes('text/html')) return false;
  // Must look like a page URL (no file extension or ends with /)
  var path = url.pathname;
  if (path.endsWith('/') || path.lastIndexOf('.') <= path.lastIndexOf('/')) return true;
  return false;
}

// --- HTML request handler with app-shell fallback ---
function handleHtmlRequest(request) {
  return fetch(request).then(function(response) {
    if (response.ok) {
      // Cache the page for offline use
      var clone = response.clone();
      caches.open(PAGES_CACHE).then(function(cache) {
        cache.put(request, clone);
      });
    }
    return response;
  }).catch(function() {
    // Offline: try caches in order
    return caches.open(PAGES_CACHE).then(function(pagesCache) {
      return pagesCache.match(request);
    }).then(function(cached) {
      if (cached) return cached;
      // Try precache stores for HTML pages
      return matchInPrecache(request);
    }).then(function(result) {
      if (result) return result;
      // App-shell fallback: serve the shell for client-side rendering
      return matchInPrecache(new Request('/app-shell/'));
    }).then(function(shell) {
      if (shell) return shell;
      // Last resort: offline page
      return caches.match('/offline.html');
    });
  });
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

// Cache-first across multiple caches (runtime + any precache-*)
function cacheFirstMulti(request, cacheNames) {
  return caches.keys().then(function(allNames) {
    var toCheck = [];
    for (var i = 0; i < cacheNames.length; i++) {
      var name = cacheNames[i];
      if (name.endsWith('-')) {
        // Prefix match (for precache-)
        for (var j = 0; j < allNames.length; j++) {
          if (allNames[j].startsWith(name)) toCheck.push(allNames[j]);
        }
      } else {
        toCheck.push(name);
      }
    }

    return checkCachesInOrder(request, toCheck, 0);
  }).then(function(cached) {
    if (cached) return cached;
    // Not in any cache — fetch and store in first cache name
    var primaryCache = cacheNames[0].endsWith('-') ? DATA_CACHE : cacheNames[0];
    return caches.open(primaryCache).then(function(cache) {
      return fetch(request).then(function(response) {
        if (response.ok) cache.put(request, response.clone());
        return response;
      });
    });
  });
}

function checkCachesInOrder(request, names, idx) {
  if (idx >= names.length) return Promise.resolve(null);
  return caches.open(names[idx]).then(function(cache) {
    return cache.match(request);
  }).then(function(hit) {
    if (hit) return hit;
    return checkCachesInOrder(request, names, idx + 1);
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

// Search all precache-* caches for a match
function matchInPrecache(request) {
  return caches.keys().then(function(names) {
    var precacheNames = names.filter(function(n) { return n.startsWith(PRECACHE_PREFIX); });
    return checkCachesInOrder(request, precacheNames, 0);
  });
}

// --- Precache logic ---

var _precaching = false;

function precache(locale) {
  if (_precaching) return;
  _precaching = true;

  fetch('/precache-manifest.json').then(function(res) {
    if (!res.ok) throw new Error('No precache manifest');
    return res.json();
  }).then(function(manifest) {
    var cacheName = PRECACHE_PREFIX + manifest.version;

    // Check if already complete
    return caches.open(cacheName).then(function(cache) {
      return cache.match(PRECACHE_COMPLETE_KEY).then(function(flag) {
        if (flag) {
          _precaching = false;
          return; // Already done
        }
        return runPrecache(manifest, cacheName, locale);
      });
    });
  }).catch(function(err) {
    console.warn('[SW] Precache failed:', err);
    _precaching = false;
  });
}

function runPrecache(manifest, cacheName, locale) {
  var cache;
  var allUrls = [];
  var loaded = 0;

  // Phase 1: active locale
  allUrls.push(manifest.shell);
  allUrls = allUrls.concat(manifest.assets);
  allUrls = allUrls.concat(manifest.data.core);

  var localeOverlays = manifest.data.locale[locale] || [];
  allUrls = allUrls.concat(localeOverlays);

  var localePages = manifest.pages[locale] || [];
  allUrls = allUrls.concat(localePages);

  // Shared pages (international landing, etc.)
  var sharedPages = manifest.pages._shared || [];
  allUrls = allUrls.concat(sharedPages);

  var total = allUrls.length;

  return caches.open(cacheName).then(function(c) {
    cache = c;
    return batchFetch(cache, allUrls, 10, function(done) {
      loaded = done;
    });
  }).then(function(failures) {
    if (failures === 0) {
      // Mark complete, notify clients, clean old caches
      return cache.put(PRECACHE_COMPLETE_KEY, new Response('1')).then(function() {
        return self.clients.matchAll();
      }).then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({ type: 'PRECACHE_DONE', locale: locale });
        });
      }).then(function() {
        return cleanOldPrecache(cacheName);
      });
    }
    // Partial — don't set flag, don't notify, don't clean old cache; will retry next time
    console.warn('[SW] Precache partial: ' + failures + ' of ' + total + ' failed');
  }).then(function() {
    // Phase 2: remaining locales (background)
    return precacheRemainingLocales(manifest, cacheName, locale);
  }).then(function() {
    _precaching = false;
  }).catch(function(err) {
    console.warn('[SW] Precache error:', err);
    _precaching = false;
  });
}

function batchFetch(cache, urls, concurrency, onProgress) {
  var idx = 0;
  var done = 0;
  var failures = 0;

  function next() {
    if (idx >= urls.length) return Promise.resolve();
    var url = urls[idx++];
    return cache.match(url).then(function(existing) {
      if (existing) {
        done++;
        onProgress(done);
        return next();
      }
      return fetch(url).then(function(res) {
        if (res.ok) {
          return cache.put(url, res);
        }
        failures++;
      }).catch(function() {
        failures++;
      }).then(function() {
        done++;
        onProgress(done);
        return next();
      });
    });
  }

  // Start `concurrency` parallel chains
  var chains = [];
  for (var i = 0; i < concurrency; i++) {
    chains.push(next());
  }
  return Promise.all(chains).then(function() { return failures; });
}

function cleanOldPrecache(keepCacheName) {
  return caches.keys().then(function(names) {
    return Promise.all(
      names
        .filter(function(n) { return n.startsWith(PRECACHE_PREFIX) && n !== keepCacheName; })
        .map(function(n) { return caches.delete(n); })
    );
  });
}

function precacheRemainingLocales(manifest, cacheName, doneLocale) {
  var locales = ['ru', 'en', 'pl', 'es'].filter(function(l) { return l !== doneLocale; });
  var urls = [];
  for (var i = 0; i < locales.length; i++) {
    var loc = locales[i];
    urls = urls.concat(manifest.data.locale[loc] || []);
    urls = urls.concat(manifest.pages[loc] || []);
  }
  if (urls.length === 0) return Promise.resolve();

  return caches.open(cacheName).then(function(cache) {
    return batchFetch(cache, urls, 5, function() {});
  });
}
```

- [ ] **Step 2: Test SW syntax**

Run: `node -c public/sw.js`
Expected: No syntax errors.

- [ ] **Step 3: Build and verify offline fallback chain**

Run: `npm run build && npm run preview`

In browser DevTools:
1. Visit the site, check SW registers in Application tab
2. In Network tab, go offline
3. Navigate to `/ru/periodic-table/` — should show app-shell with OfflineRouter
4. Navigate to a previously visited page — should show cached HTML

Note: Full precache testing requires the initPrecache trigger (Task 6).

- [ ] **Step 4: Commit**

```bash
git add public/sw.js
git commit -m "feat(pwa): rewrite SW with precache, app-shell fallback, ViewTransitions support"
```

---

## Chunk 4: Precache Trigger + Toast UI

### Task 6: initPrecache + BaseLayout integration

**Files:**
- Create: `src/lib/offline-precache.ts`
- Modify: `src/layouts/BaseLayout.astro`

**Context:** The precache trigger runs on every page load. It waits for `serviceWorker.ready`, checks the connection type, and sends `START_PRECACHE` to the SW. The SW guards against duplicate runs internally. The trigger is called from an inline script in `BaseLayout.astro` right after the existing SW registration block.

Since `offline-precache.ts` uses `navigator.connection` (Network Information API), it needs type augmentation. The API is not available in all browsers — the code handles this gracefully (no API = assume WiFi = auto-precache).

- [ ] **Step 1: Create offline-precache.ts**

```typescript
// src/lib/offline-precache.ts

/**
 * Trigger background precache if on WiFi or no connection info available.
 * On mobile data, precaching is skipped (user can trigger from Settings).
 * The SW guards against duplicate runs, so calling this on every page load is safe.
 */
export function initPrecache(locale: string): void {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.ready.then(reg => {
    if (!reg.active) return;

    const conn = (navigator as unknown as { connection?: { type?: string; effectiveType?: string } }).connection;
    // Auto-precache on WiFi, 4g, or when API unavailable (desktop browsers)
    const shouldAuto = !conn || conn.type === 'wifi' || conn.effectiveType === '4g';

    if (shouldAuto) {
      reg.active.postMessage({ type: 'START_PRECACHE', locale });
    }
  });
}

/**
 * Manually trigger precache regardless of connection type.
 * Called from Settings page when user clicks "Download for offline".
 */
export function triggerPrecache(locale: string): void {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.ready.then(reg => {
    if (!reg.active) return;
    reg.active.postMessage({ type: 'START_PRECACHE', locale });
  });
}

/**
 * Check if precache is complete by looking for the completion flag.
 */
export async function isPrecacheComplete(): Promise<boolean> {
  const names = await caches.keys();
  for (const name of names) {
    if (name.startsWith('precache-')) {
      const cache = await caches.open(name);
      const flag = await cache.match('__precache_complete__');
      if (flag) return true;
    }
  }
  return false;
}
```

- [ ] **Step 2: Add initPrecache to BaseLayout.astro**

In `src/layouts/BaseLayout.astro`, replace the SW registration block (lines 283-288) with:

```astro
<!-- Service Worker registration + offline precache -->
<script is:inline define:vars={{ locale }}>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(function() {
      // Trigger background precache (connection-aware, SW guards against duplicates)
      import('/offline-precache-init.js').catch(function() {});
    });
  }
</script>
```

Wait — `is:inline` scripts can't use `import()` for modules. And we can't import TypeScript in inline scripts. We need a different approach.

**Better approach:** Use a separate non-inline script that Astro bundles:

Replace lines 283-288 in `BaseLayout.astro`:

```astro
<!-- Service Worker registration -->
<script is:inline>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
</script>

<script>
  import { initPrecache } from '../lib/offline-precache';
  const locale = document.cookie.match(/PARAGLIDE_LOCALE=(\w+)/)?.[1] || 'ru';
  initPrecache(locale);
</script>
```

This works because non-inline `<script>` tags in Astro are bundled and deferred. The `initPrecache` call waits for `serviceWorker.ready` internally, so ordering is fine even if the SW register hasn't finished yet.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/offline-precache.ts src/layouts/BaseLayout.astro
git commit -m "feat(pwa): add connection-aware precache trigger in BaseLayout"
```

---

### Task 7: OfflineToast component

**Files:**
- Create: `src/components/OfflineToast.tsx`
- Create: `src/components/offline-toast.css`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `messages/ru.json`, `messages/en.json`, `messages/pl.json`, `messages/es.json`

**Context:** A small React component that listens for `PRECACHE_DONE` messages from the SW and shows a toast notification for 3 seconds. Mounted in BaseLayout as `client:idle` island.

- [ ] **Step 1: Add i18n keys**

Add to `messages/ru.json`:
```json
"offline_ready": "Доступно офлайн",
```

Add to `messages/en.json`:
```json
"offline_ready": "Available offline",
```

Add to `messages/pl.json`:
```json
"offline_ready": "Dostępne offline",
```

Add to `messages/es.json`:
```json
"offline_ready": "Disponible sin conexión",
```

- [ ] **Step 2: Create offline-toast.css**

```css
/* src/components/offline-toast.css */
.offline-toast {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  background: var(--primary, #2563eb);
  color: #fff;
  padding: 0.75rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  opacity: 0;
  transform: translateY(1rem);
  animation: toast-in 0.3s ease forwards;
  pointer-events: none;
}

.offline-toast--hiding {
  animation: toast-out 0.3s ease forwards;
}

@keyframes toast-in {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes toast-out {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(1rem);
  }
}
```

- [ ] **Step 3: Create OfflineToast.tsx**

```tsx
// src/components/OfflineToast.tsx
import { useState, useEffect } from 'react';
import * as m from '../paraglide/messages.js';
import './offline-toast.css';

export default function OfflineToast() {
  const [visible, setVisible] = useState(false);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    function onMessage(event: MessageEvent) {
      if (event.data?.type === 'PRECACHE_DONE') {
        setVisible(true);
        setHiding(false);
        setTimeout(() => {
          setHiding(true);
          setTimeout(() => setVisible(false), 300); // match animation duration
        }, 3000);
      }
    }

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  if (!visible) return null;

  return (
    <div className={`offline-toast${hiding ? ' offline-toast--hiding' : ''}`}>
      {m.offline_ready()}
    </div>
  );
}
```

- [ ] **Step 4: Mount in BaseLayout.astro**

Add after the `</main>` closing tag (before `<slot name="after-main" />`), around line 298:

```astro
<OfflineToast client:idle />
```

And add the import at the top of the frontmatter:

```astro
import OfflineToast from '../components/OfflineToast';
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds. `OfflineToast` chunk appears in `dist/_astro/`.

- [ ] **Step 6: Commit**

```bash
git add src/components/OfflineToast.tsx src/components/offline-toast.css src/layouts/BaseLayout.astro messages/ru.json messages/en.json messages/pl.json messages/es.json
git commit -m "feat(pwa): add OfflineToast notification component"
```

---

## Chunk 5: Settings Page + Tests

### Task 8: Settings page offline section

**Files:**
- Modify: `src/features/settings/SettingsPage.tsx`
- Modify: `src/features/settings/settings-page.css`
- Modify: `messages/ru.json`, `messages/en.json`, `messages/pl.json`, `messages/es.json`

**Context:** Add an "Offline mode" section to the existing Settings page. Shows current status (cached / not cached) and a button to manually trigger precache. Uses `isPrecacheComplete()` and `triggerPrecache()` from `src/lib/offline-precache.ts`.

- [ ] **Step 1: Add i18n keys**

Add to `messages/ru.json`:
```json
"settings_offline_section": "Офлайн-режим",
"settings_offline_description": "Скачайте данные для работы без интернета.",
"settings_offline_download": "Скачать для офлайн-работы",
"settings_offline_status_ready": "Загружено",
"settings_offline_status_not_ready": "Не загружено",
"settings_offline_downloading": "Загрузка..."
```

Add equivalent keys to `en.json`, `pl.json`, `es.json` with localized text:

`messages/en.json`:
```json
"settings_offline_section": "Offline mode",
"settings_offline_description": "Download data for offline use.",
"settings_offline_download": "Download for offline use",
"settings_offline_status_ready": "Downloaded",
"settings_offline_status_not_ready": "Not downloaded",
"settings_offline_downloading": "Downloading..."
```

`messages/pl.json`:
```json
"settings_offline_section": "Tryb offline",
"settings_offline_description": "Pobierz dane do pracy bez internetu.",
"settings_offline_download": "Pobierz do użytku offline",
"settings_offline_status_ready": "Pobrano",
"settings_offline_status_not_ready": "Nie pobrano",
"settings_offline_downloading": "Pobieranie..."
```

`messages/es.json`:
```json
"settings_offline_section": "Modo sin conexión",
"settings_offline_description": "Descarga datos para usar sin internet.",
"settings_offline_download": "Descargar para uso sin conexión",
"settings_offline_status_ready": "Descargado",
"settings_offline_status_not_ready": "No descargado",
"settings_offline_downloading": "Descargando..."
```

- [ ] **Step 2: Add offline section to SettingsPage.tsx**

Add imports at top:
```typescript
import { isPrecacheComplete, triggerPrecache } from '../../lib/offline-precache';
```

Add state variables after existing `useState` calls (around line 30):
```typescript
const [offlineReady, setOfflineReady] = useState<boolean | null>(null);
const [downloading, setDownloading] = useState(false);
```

Add useEffect to check status (after existing useEffect, around line 41):
```typescript
useEffect(() => {
  isPrecacheComplete().then(setOfflineReady).catch(() => setOfflineReady(false));

  function onMessage(event: MessageEvent) {
    if (event.data?.type === 'PRECACHE_DONE') {
      setOfflineReady(true);
      setDownloading(false);
    }
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }
}, []);
```

Add handler function:
```typescript
function handleOfflineDownload() {
  setDownloading(true);
  triggerPrecache(locale);
}
```

Add section before the "Reset" section (before line 134):
```tsx
<section className="settings-section">
  <h2 className="settings-section__title">{m.settings_offline_section()}</h2>
  <p className="settings-section__desc">{m.settings_offline_description()}</p>
  <div className="settings-offline-status">
    <span className={`settings-offline-badge ${offlineReady ? 'settings-offline-badge--ready' : ''}`}>
      {offlineReady === null ? '...' : offlineReady ? m.settings_offline_status_ready() : m.settings_offline_status_not_ready()}
    </span>
    {!offlineReady && (
      <button
        type="button"
        className="settings-option"
        onClick={handleOfflineDownload}
        disabled={downloading}
      >
        <span className="settings-option__label">
          {downloading ? m.settings_offline_downloading() : m.settings_offline_download()}
        </span>
      </button>
    )}
  </div>
</section>
```

- [ ] **Step 3: Add CSS for offline section**

Add to `src/features/settings/settings-page.css`:
```css
.settings-offline-status {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.settings-offline-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  background: var(--bg-tertiary, #f1f5f9);
  color: var(--text-secondary, #64748b);
}

.settings-offline-badge--ready {
  background: #dcfce7;
  color: #166534;
}
```

- [ ] **Step 4: Verify build and TypeScript**

Run: `npx tsc --noEmit && npm run build`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/settings/SettingsPage.tsx src/features/settings/settings-page.css messages/ru.json messages/en.json messages/pl.json messages/es.json
git commit -m "feat(pwa): add offline mode section to Settings page"
```

---

### Task 9: Integration test

**Files:**
- Create: `src/lib/__tests__/offline-precache.test.ts`

**Context:** Unit test for the precache trigger functions. Can't test the full SW flow in Vitest (no service worker), but can test `isPrecacheComplete()` logic and the module exports.

- [ ] **Step 1: Create test file**

```typescript
// src/lib/__tests__/offline-precache.test.ts
import { describe, it, expect } from 'vitest';

describe('offline-precache module', () => {
  it('exports initPrecache function', async () => {
    const mod = await import('../offline-precache');
    expect(typeof mod.initPrecache).toBe('function');
  });

  it('exports triggerPrecache function', async () => {
    const mod = await import('../offline-precache');
    expect(typeof mod.triggerPrecache).toBe('function');
  });

  it('exports isPrecacheComplete function', async () => {
    const mod = await import('../offline-precache');
    expect(typeof mod.isPrecacheComplete).toBe('function');
  });
});
```

- [ ] **Step 2: Create classification unit tests + generator integration test**

```typescript
// src/lib/__tests__/precache-manifest.test.ts
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { isReactIslandPage } from '../../../scripts/lib/generate-precache-manifest.mjs';

describe('isReactIslandPage', () => {
  // React-island index pages → true
  it('identifies /ru/periodic-table/index.html as react island', () => {
    expect(isReactIslandPage('/ru/periodic-table/index.html')).toBe(true);
  });
  it('identifies localized slug /pl/tablica-okresowa/index.html', () => {
    expect(isReactIslandPage('/pl/tablica-okresowa/index.html')).toBe(true);
  });
  it('identifies /en/exam/compare/index.html as react island', () => {
    expect(isReactIslandPage('/en/exam/compare/index.html')).toBe(true);
  });
  it('identifies /es/examen/comparar/index.html as react island', () => {
    expect(isReactIslandPage('/es/examen/comparar/index.html')).toBe(true);
  });
  it('identifies /ru/settings/index.html as react island', () => {
    expect(isReactIslandPage('/ru/settings/index.html')).toBe(true);
  });

  // Astro-rendered pages → false
  it('does NOT classify element detail /ru/periodic-table/H/index.html', () => {
    expect(isReactIslandPage('/ru/periodic-table/H/index.html')).toBe(false);
  });
  it('does NOT classify substance detail /en/substances/h2o/index.html', () => {
    expect(isReactIslandPage('/en/substances/h2o/index.html')).toBe(false);
  });
  it('does NOT classify competency /ru/competency/classification/index.html', () => {
    expect(isReactIslandPage('/ru/competency/classification/index.html')).toBe(false);
  });
  it('does NOT classify locale landing /ru/index.html', () => {
    expect(isReactIslandPage('/ru/index.html')).toBe(false);
  });
  it('does NOT classify international landing /index.html', () => {
    expect(isReactIslandPage('/index.html')).toBe(false);
  });
});

// Integration tests against actual build output (skip if not built)

const DIST = 'dist';
const MANIFEST_PATH = join(DIST, 'precache-manifest.json');

describe('precache-manifest.json', () => {
  // Skip if dist doesn't exist (not built yet)
  const hasManifest = existsSync(MANIFEST_PATH);

  it.skipIf(!hasManifest)('exists after build', () => {
    expect(existsSync(MANIFEST_PATH)).toBe(true);
  });

  it.skipIf(!hasManifest)('has correct structure', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
    expect(manifest.version).toBeTruthy();
    expect(manifest.shell).toBe('/app-shell/');
    expect(Array.isArray(manifest.assets)).toBe(true);
    expect(manifest.data.core).toBeDefined();
    expect(manifest.data.locale.ru).toBeDefined();
    expect(manifest.data.locale.en).toBeDefined();
    expect(manifest.pages.ru).toBeDefined();
  });

  it.skipIf(!hasManifest)('assets include JS and CSS files', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
    const jsFiles = manifest.assets.filter((f: string) => f.endsWith('.js'));
    const cssFiles = manifest.assets.filter((f: string) => f.endsWith('.css'));
    expect(jsFiles.length).toBeGreaterThan(0);
    expect(cssFiles.length).toBeGreaterThan(0);
  });

  it.skipIf(!hasManifest)('does not include app-shell in pages', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
    const allPages = Object.values(manifest.pages).flat() as string[];
    expect(allPages.some((p: string) => p.includes('app-shell'))).toBe(false);
  });

  it.skipIf(!hasManifest)('does not include react-island index pages in pages', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
    const ruPages = manifest.pages.ru as string[];
    // Periodic table index should NOT be in pages (it's a react island)
    expect(ruPages.some((p: string) => p === '/ru/periodic-table/index.html')).toBe(false);
    // But element detail pages SHOULD be
    expect(ruPages.some((p: string) => p.includes('/periodic-table/H/'))).toBe(true);
  });

  it.skipIf(!hasManifest)('includes shared pages', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
    expect(manifest.pages._shared).toBeDefined();
    expect(manifest.pages._shared.length).toBeGreaterThan(0);
    expect(manifest.pages._shared).toContain('/index.html');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: All existing tests pass + new offline-precache tests pass. Generator tests skip if no build output.

- [ ] **Step 4: Run build + full test**

Run: `npm run build && npm test`
Expected: All tests pass including generator manifest tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/__tests__/offline-precache.test.ts src/lib/__tests__/precache-manifest.test.ts
git commit -m "test(pwa): add offline precache and manifest generator tests"
```

---

### Task 10: End-to-end verification

**Files:** none (manual verification)

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: Builds successfully. `dist/precache-manifest.json` exists.

- [ ] **Step 2: All tests pass**

Run: `npm test`
Expected: All tests pass (1221+ existing + new tests).

- [ ] **Step 3: Manual QA in browser**

Run: `npm run preview`

1. Open browser at `http://localhost:4322/ru/periodic-table/`
2. Open DevTools → Application → Service Workers → verify SW registered
3. Wait a few seconds (precache should start silently)
4. Check Application → Cache Storage → `precache-{hash}` should be populated
5. Toast "Доступно офлайн" should appear after precache completes
6. Go offline (DevTools → Network → Offline checkbox)
7. Navigate to `/ru/bonds/` — should render via app-shell + OfflineRouter
8. Navigate to `/ru/periodic-table/H/` — should render from cached HTML
9. Navigate to `/ru/settings/` — should render via app-shell; offline badge should show "Загружено"
10. Go back online, navigate normally — everything works as before

- [ ] **Step 4: Test mobile data path**

In DevTools → Network → set throttling to "Slow 3G":
1. Clear all caches (Application → Storage → Clear site data)
2. Reload page
3. SW should NOT auto-precache (connection throttled, not WiFi)
4. Navigate to Settings → "Офлайн-режим" section visible
5. Click "Скачать для офлайн-работы"
6. Toast should appear when done

- [ ] **Step 5: Commit any fixes from QA**

If any issues found during QA, fix and commit with descriptive messages.
