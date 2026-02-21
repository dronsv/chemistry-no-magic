# Chemistry Without Magic / Химия без магии

Adaptive chemistry learning platform with exam preparation for OGE (Russia), EGE (Russia), GCSE (UK), Matura (Poland), and EBAU (Spain).

**Live:** [chemistry.svistunov.online](https://chemistry.svistunov.online)

## Features

- **Interactive periodic table** with electron configurations, orbital diagrams, and property trends
- **80 substances** with detailed properties, reactions, and fun facts (RU/EN/PL/ES)
- **Chemical bonding** analyzer — determine bond type by formula or element pair
- **Oxidation state** calculator with step-by-step rules
- **32 reactions** with molecular/ionic equations and driving forces
- **Exam practice** — 78 OGE tasks from FIPI demos, mock exams with instant grading
- **Cross-exam topics** — 8 unified topics across 5 exam systems
- **Adaptive diagnostics** — BKT-based competency profiling (20 competencies)
- **Multi-language** — Russian (default), English, Polish, Spanish
- **Fully static** — no backend, all personalization client-side (localStorage + IndexedDB)

## Tech Stack

- [Astro 5](https://astro.build/) — static-first with React islands
- [React 19](https://react.dev/) — interactive components (`client:idle`)
- [Paraglide.js](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) — compile-time i18n
- TypeScript (strict mode)
- CDN-first data architecture with immutable hash-addressed JSON bundles

## Quick Start

```bash
npm install
npm run dev          # Dev server at localhost:4321
npm run build        # Production build to ./dist/
npm run build:data   # Rebuild data pipeline only
```

## Project Structure

```
src/
├── pages/           # Astro file-based routing (ru, en, pl, es)
├── features/        # Feature modules (periodic-table, exam, diagnostics, ...)
├── components/      # Shared components (Nav, ChemText, FormulaChip, ...)
├── lib/             # Data loaders, BKT engine, storage, utilities
├── types/           # TypeScript types (one file per domain)
├── layouts/         # Page layout templates
└── styles/          # Global CSS variables and styles

data-src/            # Source data (JSON) — processed by build pipeline
├── elements/        # 118 elements
├── substances/      # 80 substances
├── reactions/       # 32 reactions
├── exam/            # Exam tasks and algorithms (OGE, EGE, GCSE, Matura, EBAU)
├── rules/           # Competencies, BKT params, topic mappings
└── translations/    # Translation overlays (en, pl, es)

scripts/             # Build pipeline and deploy
Docs/                # Design documents (Russian)
```

## Data Architecture

All chemistry data lives in static JSON bundles under `/data/{bundle_hash}/`:
- **Entry point:** `/data/latest/manifest.json` (short cache) points to current bundle
- **Bundles:** elements, ions, substances, reactions, indices, exam tasks, formulas
- **Immutable:** hash-addressed bundles cached for 1 year, only manifest refreshes

## Contributing

Found an error in chemistry content or a bug in the platform?
Please [open an issue](https://github.com/dronsv/chemistry-no-magic/issues).

## License

MIT License. See [LICENSE](LICENSE).
