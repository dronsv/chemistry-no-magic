# Offline-First PWA Precaching

## Goal

When a user visits the site on WiFi, automatically cache all files needed for full offline operation. On mobile data, offer manual opt-in. Active locale cached first; remaining locales fetched in background.

## Design Decisions

1. **Hybrid rendering offline**: React-island pages rendered client-side from cached JSON via app-shell; complex Astro pages precached as HTML. Some HTML-precached pages (competency, topic, concept detail) contain embedded React islands that hydrate normally from precached JS/data.
2. **App-shell as Astro page**: `src/pages/app-shell.astro` goes through normal build pipeline — gets correct CSS/JS references, no manual maintenance. Uses `client:load` (exception to `client:idle` convention — justified because this page is only served offline and the router must run immediately).
3. **Connection-aware**: WiFi → silent precache; mobile data → manual trigger from settings; no Connection API → auto-precache (desktop default).
4. **Locale-phased**: Phase 1 = active locale (core JSON + overlays + HTML); Phase 2 = remaining 3 locales in background.
5. **Toast, not banner**: "Доступно офлайн" toast for 3 seconds after completion; no progress bar during download.
6. **Build-time manifest**: `precache-manifest.json` generated as post-build step after `astro build`, enumerates all files the SW needs.
7. **ViewTransitions compatibility**: SW identifies HTML page requests by `Accept` header or URL pattern (`/` suffix, no file extension), not only `request.mode === 'navigate'`. This ensures Astro's ClientRouter SPA-style fetches also hit the correct caching path.
8. **Graceful precache**: individual fetch failures don't abort the batch; completion flag tracks whether precache is fully done; incomplete precache retried on next visit.
9. **Safe cache rotation**: old `precache-{oldHash}` kept alive until new precache completes; only deleted after `PRECACHE_DONE` for new version.

## Page Categorization

### App-shell rendered (React islands, ~16 page types)

These pages are thin Astro wrappers around React components. The offline router renders the same React component from cached JSON.

| Page | Component | URL pattern |
|------|-----------|-------------|
| Periodic table | `PeriodicTablePage` | `/periodic-table/` |
| Substances list | `SubstancesPage` | `/substances/` |
| Bonds | `BondsPage` | `/bonds/` |
| Oxidation states | `OxidationStatesPage` | `/oxidation-states/` |
| Reactions | `ReactionsPage` | `/reactions/` |
| Ions | `IonsPage` | `/ions/` |
| Calculations | `CalculationsPage` | `/calculations/` |
| Diagnostics | `DiagnosticsApp` | `/diagnostics/` |
| Exam | `ExamPage` | `/exam/` |
| Exam compare | `ExamComparison` | `/exam/compare/` |
| Profile | `ProfileApp` | `/profile/` |
| Search | `SearchPage` | `/search/` |
| Settings | `SettingsPage` | `/settings/` |
| Processes | `ProcessesPage` | `/processes/` |
| Physical foundations | `PhysicalFoundationsPage` | `/physical-foundations/` |
| Competency graph | `CompetencyGraphIsland` | `/competencies/` |

All have localized URL variants (en, pl, es). The offline router uses the existing slug map from `src/lib/i18n.ts` to resolve localized URLs to canonical patterns.

### HTML precached (Astro-rendered, ~350 pages per locale)

| Page type | Count (per locale) | Notes |
|-----------|-------------------|-------|
| Landing | 1 | Pure Astro HTML, hero/stats/FAQ |
| International landing | 1 (shared) | Standalone page, no BaseLayout — precached explicitly |
| About | 1 (ru, en only) | Narrative HTML; pl/es don't have about pages |
| Element detail | ~123 | Properties, electron config, reactions (118 elements + concept slugs) |
| Substance detail + concepts | ~188 | Classification, bonds, reactions (80 substances + ~108 concept slug pages) |
| Competency detail | 21 | 7 Astro content components + embedded `CompetencyPracticeIsland` / `CompetencyMasteryIsland` React islands |
| Topic detail | ~7 | Astro metadata/FAQ + `TheoryModulePanel` React island |
| Concept detail (reactions) | ~13 | Astro hierarchy/breadcrumbs + `ConceptModuleIsland` |

Measured size per locale: ~350 pages × ~9 KB avg gzip = ~3.2 MB.

Note: Competency, topic, and concept detail pages contain embedded React islands that hydrate from precached JS assets and cached JSON data — no special handling needed.

## Architecture

### Build-time

```
npm run build:data          (data pipeline → dist/data/{hash}/)
    ↓
astro build                 (pages → dist/**/*.html, assets → dist/_astro/)
    ↓
generate-precache-manifest  (post-build step → dist/precache-manifest.json)
```

Integration point: `postbuild` npm script (runs after `astro build`) or Astro integration with `astro:build:done` hook.

**`scripts/lib/generate-precache-manifest.mjs`** (new):
- Scans `dist/_astro/` for all JS/CSS files → `assets[]` (includes code-split chunks for lazy-loaded React islands)
- Reads `dist/data/latest/manifest.json` → enumerates all JSON paths → `data.core[]` + `data.locale{}`
- Scans `dist/` for HTML pages, classifying each as "react-island" or "astro-rendered" using a static list of React-island URL prefixes → `pages{locale}[]` (only astro-rendered)
- Adds international landing page (`/index.html`) explicitly
- Outputs `dist/precache-manifest.json`

**`src/pages/app-shell.astro`** (new):
- Uses `BaseLayout` (gets nav, CSS, meta tags)
- Body: `<div id="offline-root"><p>Loading...</p></div>`
- Loads: `<OfflineRouter client:load />` (deliberate exception — offline-only page, router must execute immediately)
- Excluded from sitemap via `filter` option in `@astrojs/sitemap` config

### Offline Router

**`src/features/offline/OfflineRouter.tsx`** (new, ~80 lines):

```
pathname → stripLocalePrefix() → reverseSlugLookup() → match route → dynamic import → render
```

- Uses `src/lib/i18n.ts` slug map for locale-aware URL resolution
- Route table: 16 entries mapping canonical path prefix → `() => import('../../features/X/XPage')`
- Dynamic imports reference the same modules that Astro pages use, so they resolve to the same code-split chunks already in `assets[]`
- Detects locale from URL prefix or cookie `PARAGLIDE_LOCALE`
- Passes `locale` prop to rendered component
- Shows loading spinner during dynamic import
- If no route matches: shows generic offline message (page should have been HTML-cached)

### Service Worker (`public/sw.js`)

**New cache**: `precache-{bundleHash}` alongside existing `pages-v1`, `assets-v1`, `data-v1`.

**Install event** (unchanged): precache `offline.html` + `manifest.webmanifest`.

**Activate event** (simplified):
1. Clean old caches EXCEPT `precache-*` (those are cleaned after new precache completes)
2. Claim clients

**Precache trigger** (one-step): `initPrecache()` sends `START_PRECACHE` on `serviceWorker.ready` — no round-trip handshake needed. SW guards against duplicate runs.

**New: `precache()` function** triggered by message from main thread:
1. Fetch `/precache-manifest.json`
2. If `precache-{version}` already has completion flag → skip (already done)
3. Open `precache-{version}` cache
4. Cache `shell` (app-shell page)
5. Cache all `assets[]` (JS/CSS) — batch of 10 concurrent fetches
6. Cache all `data.core[]` — batch of 10
7. Cache `data.locale[activeLocale][]` — batch of 10
8. Cache `pages[activeLocale][]` — batch of 10
9. Set completion flag: `cache.put('__precache_complete__', new Response('1'))`
10. Post `{type: 'PRECACHE_DONE'}` to clients
11. Delete old `precache-{otherHash}` caches now that new one is complete
12. After idle: cache remaining `data.locale[*][]` + `pages[*][]`

**Error handling**: individual fetch failures logged and skipped; batch continues. Completion flag only set if all files succeed. On next visit, if flag is missing, precache retries (step 2 check fails → re-run).

**Fetch handler changes** (HTML page requests):

Detect HTML requests by: `request.mode === 'navigate'` OR (`request.headers.get('Accept')?.includes('text/html')` AND URL has no file extension or ends with `/`). This covers both browser navigation and Astro ViewTransitions SPA-style fetches.

```
HTML request → network fetch
  ├─ success → cache in pages-v1, return response
  └─ failure (offline) →
       ├─ pages-v1 cache hit → return cached HTML
       ├─ precache-{hash} cache hit → return cached HTML
       └─ no cache hit → return app-shell from precache-{hash}
              (offline router renders React component from cached JSON)
              └─ no app-shell → return offline.html
```

Data and asset fetch handlers unchanged (already cache-first).

### Connection-Aware Trigger

**`src/lib/offline-precache.ts`** (new, ~30 lines):

```typescript
export function initPrecache(locale: string): void {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.ready.then(sw => {
    const conn = (navigator as any).connection;
    const isWifi = !conn || conn.type === 'wifi' || conn.effectiveType === '4g';

    if (isWifi) {
      sw.active?.postMessage({ type: 'START_PRECACHE', locale });
    }
    // On mobile data: user triggers manually from settings
  });
}
```

Called from `BaseLayout.astro` inline script after SW registration. One-step trigger — no `SW_ACTIVATED` round-trip.

### Toast Notification

**`src/components/OfflineToast.tsx`** (new, ~30 lines):
- Listens to `navigator.serviceWorker` `message` events
- On `PRECACHE_DONE`: shows toast "Доступно офлайн" / "Available offline" (localized via Paraglide) for 3 seconds
- Absolutely positioned bottom-right, z-index above content
- Fade-in/fade-out CSS animation
- Mounted in `BaseLayout.astro` as `<OfflineToast client:idle />`

### Manual Trigger (Settings)

Add to `SettingsPage.tsx`:
- "Офлайн-режим" section
- Button: "Скачать для офлайн-работы" — posts `START_PRECACHE` to SW
- Status indicator: "Загружено" / "Не загружено" (checks for completion flag in precache cache via Cache API)

## Precache Size Estimates (measured)

| Category | Files | Gzip size |
|----------|-------|-----------|
| App shell | 1 | ~3 KB |
| Astro assets (JS+CSS) | ~96 | ~260 KB |
| Core JSON data | ~400 | ~270 KB |
| Active locale overlays | ~60 | ~180 KB |
| Active locale HTML pages | ~350 | ~3,200 KB |
| **Phase 1 total** | **~907** | **~3.9 MB** |
| Remaining 3 locale overlays | ~180 | ~540 KB |
| Remaining 3 locale HTML pages | ~1,050 | ~9,600 KB |
| **Phase 2 total** | **~1,230** | **~10.1 MB** |

Phase 1 (active locale): ~3.9 MB gzip — reasonable for WiFi background download.
Phase 2 (all locales): ~14 MB total — fetched in idle background.

## Cache Lifecycle

1. **First visit (WiFi)**: SW installs → activates → `initPrecache()` sends `START_PRECACHE` → background download ~3.9 MB → toast "Доступно офлайн"
2. **First visit (mobile data)**: SW installs → activates → no auto-precache. User can trigger from settings.
3. **Interrupted precache**: completion flag absent → retried on next visit automatically
4. **Data update** (new `bundle_hash`): SW precaches into `precache-{newHash}` → on completion, old `precache-{oldHash}` deleted. No gap in offline availability.
5. **Subsequent visits**: all data served from cache (cache-first for assets/data, network-first for HTML pages with cache fallback → app-shell fallback)

## Files Changed/Created

| File | Action | Purpose |
|------|--------|---------|
| `scripts/lib/generate-precache-manifest.mjs` | NEW | Build-time manifest generation |
| `package.json` | MODIFY | Add `postbuild` script for precache manifest |
| `src/pages/app-shell.astro` | NEW | Offline shell page with OfflineRouter |
| `src/features/offline/OfflineRouter.tsx` | NEW | Client-side URL → React component router |
| `src/features/offline/route-map.ts` | NEW | Route table: canonical path → dynamic import |
| `src/lib/offline-precache.ts` | NEW | Connection-aware precache trigger |
| `src/components/OfflineToast.tsx` | NEW | Toast notification on precache completion |
| `src/components/offline-toast.css` | NEW | Toast styling + animation |
| `public/sw.js` | MODIFY | Precache logic, app-shell fallback, ViewTransitions-aware HTML detection, message handling |
| `src/layouts/BaseLayout.astro` | MODIFY | Mount OfflineToast, call initPrecache |
| `src/features/settings/SettingsPage.tsx` | MODIFY | Add offline mode section |
| `astro.config.mjs` | MODIFY | Exclude app-shell from sitemap filter |

## Not in Scope

- Background sync for user data (BKT state is in localStorage, works offline already)
- Push notifications for updates
- Automatic SW update prompts
- Compression of data bundles (CDN handles gzip/brotli)
- Selective precache (e.g., only certain exam systems)
- Offline analytics / queue
- Progress bar during precache (reserved for future; completion flag + toast sufficient for MVP)
