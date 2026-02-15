# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Chemistry Without Magic" (Химия без магии) — an adaptive learning platform for OGE (Russian high school chemistry exam) preparation. CDN-first static site with no backend; all personalization runs client-side.

**Language**: Russian for all user-facing content, documentation, and data fields (name_ru, etc.).

## Commands

```bash
npm run dev        # Dev server at localhost:4321
npm run build      # Production build to ./dist/
npm run preview    # Preview production build locally
npm run astro      # Run Astro CLI (e.g., astro add, astro check)
```

No test runner is configured yet. When added, it will likely be Vitest (per tech stack docs).

## Architecture

### Stack
- **Astro 5** (static-first) with **React islands** for interactive components
- **TypeScript** (strict mode, extends `astro/tsconfigs/strict`)
- **ES Modules** (`"type": "module"` in package.json)

### Key Directories
- `src/pages/` — Astro file-based routing
- `src/components/` — Astro and React components
- `src/layouts/` — Page layout templates
- `public/` — Static assets served as-is
- `Docs/` — 10 project specification documents (Russian). Start with `02_technical_spec.md` for features, `09_mvp_roadmap.md` for phases

### Data Architecture (CDN-first)
All chemistry data lives in static JSON bundles under `/data/{bundle_hash}/`:
- **Immutable versioning**: bundles addressed by content hash, cached for a year
- **Entry point**: `/data/latest/manifest.json` (short cache) points to current `bundle_hash`
- **Key bundles**: `elements.json`, `ions.json`, `rules/`, `templates/`, `substances/`, `indices/`
- JSON Schema validation in CI for all data files

### Adaptive Learning Engine
- **BKT (Bayesian Knowledge Tracing)** for probabilistic skill assessment — see `Docs/07_adaptive_bkt_math_model.md`
- Competency levels on [0,1] scale; <0.6 triggers remediation
- BKT params stored per-competency in `rules/bkt_params.json`
- User state: `P(L)` values in localStorage, attempt history in IndexedDB

### Client-Side Storage
- **localStorage**: BKT P(L) values, user settings
- **IndexedDB**: attempt history, cached data
- PWA with offline support planned

## Development Stages

The project follows a 8-stage MVP roadmap (Docs/09_mvp_roadmap.md):
- Stage 0: Foundation — data bundles, manifest, validation
- Stage 1: Diagnostics — BKT engine, competency profiling
- Stages 2–6: Content modules (periodic table, classification, reactions, energetics, calculations)
- Stage 7: Polish — search, PWA, expanded reference

Stage 0 (Foundation) and Stage 1 (Diagnostics + BKT) are complete. Currently working on Stage 2 (Periodic table learning module).

## Coding Practices

### Performance & Bundle Size
- **No heavy libraries for small tasks.** Before adding a dependency, check if the needed functionality can be implemented in a small utility function. If only a fraction of a library is needed, extract or reimplement that part.
- **Lazy-load React islands.** Only hydrate interactive components on the client; everything else stays static Astro HTML.
- **Load JSON data on demand.** Never import entire data bundles upfront — fetch only the specific file needed for the current view via `src/lib/data-loader.ts`.
- **Optimize assets at build time.** Use Astro's built-in image optimization, minification, and compression. Prefer `.webp`/`.avif` for images, compress JSON bundles with gzip/brotli during deploy.
- **Tree-shake aggressively.** Use named imports, avoid barrel files (`index.ts` re-exports) that defeat tree-shaking.

### Code Structure & Decomposition
- **Keep source files small and focused.** One concern per file. If a file grows beyond ~150–200 lines, split it into smaller modules.
- **Decompose into pure functions.** Extract logic into small, testable functions. Prefer pure functions over stateful classes.
- **Separate data, logic, and presentation.** Data processing (BKT math, electron configs, classification rules) must live in standalone `src/lib/` modules independent of UI components.
- **Group by feature, not by type.** Each feature gets its own directory under `src/features/` with components, styles, helpers co-located. Example: `src/features/periodic-table/`, `src/features/diagnostics/`.

### Data vs Code Boundary
- **Course content → JSON in `data-src/`.** Anything a teacher or translator would edit: explanations, theory texts, exercise templates, competency names/descriptions, exception explanations. Uses `_ru` suffix convention for future i18n (`reason_ru`, `name_ru`).
- **Computation rules → TypeScript in `src/lib/`.** Universal physics/math that never changes regardless of language: Klechkowski filling order, subshell capacities, BKT formulas, Hund's rule. These are algorithms, not content.
- **New data files** must be added to the build pipeline (`scripts/build-data.mjs`), manifest (`scripts/lib/generate-manifest.mjs`), manifest types (`src/types/manifest.ts`), and data loader (`src/lib/data-loader.ts`).

### Existing Patterns (follow these when adding new features)
- **React island pattern:** Astro page imports React component with `client:idle`. Component loads data on mount via `data-loader.ts`, manages own state.
  ```astro
  <FeatureApp client:idle />
  ```
- **Data loading pattern:** `loadElements()`, `loadBktParams()`, etc. — async functions that fetch manifest, resolve hash, load specific JSON file. Add new loaders following this pattern.
- **BKT integration pattern:** After user action → `bktUpdate(pL, params, correct, hintUsed)` → `saveBktPL(competencyId, newPL)`. Import from `src/lib/bkt-engine.ts` and `src/lib/storage.ts`.
- **SVG visualizations:** Generate programmatically from data (never static images). Use React components with `viewBox` for responsive SVGs. Keep rendering logic in the component, computation in `src/lib/`.
- **CSS approach:** CSS modules per feature (`feature.css` imported in root component), CSS variables from `src/styles/global.css` for colors/spacing. No CSS frameworks.
- **Types:** One file per domain in `src/types/`, no barrel files. Example: `element.ts`, `ion.ts`, `bkt.ts`.

### Deploy Optimization
- **Static-first always.** Pre-render everything possible at build time. Use `client:visible` or `client:idle` directives for React islands — never `client:load` unless strictly required.
- **Immutable caching.** Hash-addressed data bundles (`/data/{hash}/`) get `Cache-Control: immutable`. Only `manifest.json` uses short cache.
- **Minimize client JS.** Astro ships zero JS by default — keep it that way for content pages. Only add JS for genuinely interactive features.

## Git Conventions

- Main branch: `main` (for PRs)
- Current working branch: `master`
