# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the Astro app: `pages/` for locale-specific routes, `features/` for feature modules, `components/` for shared UI, `lib/` for domain logic and loaders, and `layouts/` plus `styles/` for page shells and global styling. Source chemistry content lives in `data-src/` and is compiled into hashed bundles in `dist/data/` by the build pipeline. Locale messages live in `messages/`; static assets live in `public/`. Keep `docs/` for current architecture notes and `Docs/` for legacy specs. The standalone MCP package lives in `packages/ontology-mcp/`.

## Build, Test, and Development Commands
Use `npm run dev` to rebuild data and start Astro on `localhost:4321`. Use `npm run build:data` to refresh generated data only, and `npm run validate:data` to run pipeline validation without rebuilding bundles. Use `npm run build` for the full production build, `npm run preview` to serve the built site, `npm test` for Vitest unit tests, `npm run test:e2e` for Playwright coverage, and `npm run lint:ontology` for ontology-specific checks. For the MCP package, run `npm --prefix packages/ontology-mcp test` or `npm --prefix packages/ontology-mcp build`.

## Coding Style & Naming Conventions
Follow the existing TypeScript/Astro style: 2-space indentation, single quotes, semicolons, trailing commas, and ES modules. Use `PascalCase` for React and Astro component files, `camelCase` for utilities, and `kebab-case` for CSS files. Keep pure chemistry and derivation logic in `src/lib/`, not in UI components. Put editable content in `data-src/`, and do not hand-edit generated output in `dist/`.

## Testing Guidelines
Unit tests use Vitest and live beside domain code under `src/**/__tests__/*.test.ts`; e2e coverage lives in `tests/e2e/*.spec.ts`. Add or update tests for every behavior change, especially around data validation, derivation logic, i18n, and route generation. Run `npm test` before opening a PR; run `npm run test:e2e` when changing navigation, rendering, or locale flows.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commit style, typically `feat(scope): ...` or `fix(scope): ...`; keep that format and use a concrete scope such as `ontology`, `task-engine`, or `i18n`. PRs should state the user-visible change, note any affected data bundles or locales, link the issue when applicable, and include screenshots for UI changes. Call out any follow-up migration or validation command reviewers should run.
