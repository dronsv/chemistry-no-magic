/**
 * generate-precache-manifest.mjs
 *
 * Scans dist/ after astro build and emits dist/precache-manifest.json.
 * Called at end of the build pipeline.
 *
 * Output shape:
 * {
 *   version: "{bundleHash}",
 *   shell: "/app-shell/",
 *   assets: ["/_astro/..."],
 *   data: { core: [...], locale: { ru: [...], en: [...], pl: [...], es: [...] } },
 *   pages: { ru: [...], en: [...], pl: [...], es: [...], _shared: [...] }
 * }
 */

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = join(__dirname, '../../dist');

const LOCALES = ['ru', 'en', 'pl', 'es'];

/**
 * Canonical section names that are rendered as React islands (client-side only).
 * Their index pages should NOT be included in the pages precache because
 * they have no useful static HTML shell to cache.
 */
const REACT_ISLAND_SECTIONS = new Set([
  'periodic-table',
  'substances',
  'bonds',
  'oxidation-states',
  'reactions',
  'ions',
  'calculations',
  'diagnostics',
  'exam',
  'profile',
  'search',
  'settings',
  'processes',
  'physical-foundations',
  'competencies',
]);

/**
 * Map of localized slugs → canonical section name.
 * Built from the same SLUG_MAP as src/lib/i18n.ts.
 */
const LOCALIZED_SLUG_TO_CANONICAL = {
  // periodic-table
  'tablica-okresowa': 'periodic-table',
  'tabla-periodica': 'periodic-table',
  // substances
  substancje: 'substances',
  sustancias: 'substances',
  // bonds
  wiazania: 'bonds',
  enlaces: 'bonds',
  // oxidation-states
  'stopnie-utlenienia': 'oxidation-states',
  'estados-oxidacion': 'oxidation-states',
  // reactions
  reakcje: 'reactions',
  reacciones: 'reactions',
  // ions
  jony: 'ions',
  iones: 'ions',
  // calculations
  obliczenia: 'calculations',
  calculos: 'calculations',
  // diagnostics
  diagnostyka: 'diagnostics',
  diagnostico: 'diagnostics',
  // exam
  egzamin: 'exam',
  examen: 'exam',
  // profile
  profil: 'profile',
  perfil: 'profile',
  // search
  szukaj: 'search',
  buscar: 'search',
  // settings
  ustawienia: 'settings',
  ajustes: 'settings',
  // processes
  procesy: 'processes',
  procesos: 'processes',
  // competencies
  kompetencje: 'competencies',
  competencias: 'competencies',
};

/**
 * Localized slugs for the exam/compare sub-page (also a react island).
 */
const REACT_ISLAND_SUBSLUGS = new Set(['porownanie', 'comparar']);

/**
 * Given a URL path (relative to dist root, starting with /), determine
 * whether the page is a React island index page that should be skipped.
 *
 * Exported for unit testing.
 *
 * @param {string} urlPath  e.g. "/ru/periodic-table/" or "/pl/tablica-okresowa/"
 * @returns {boolean}
 */
export function isReactIslandPage(urlPath) {
  // Normalize: strip trailing slash then split
  const normalized = urlPath.replace(/\/$/, '');
  const parts = normalized.split('/').filter(Boolean);

  // Must have at least 2 parts: [locale, section]
  if (parts.length < 2) return false;

  const [locale, section, ...rest] = parts;

  // Only handle known locales
  if (!LOCALES.includes(locale)) return false;

  // Resolve section to canonical name
  const canonical = LOCALIZED_SLUG_TO_CANONICAL[section] ?? section;

  // Check top-level react island index pages (no deeper path)
  if (rest.length === 0 && REACT_ISLAND_SECTIONS.has(canonical)) {
    return true;
  }

  // Check exam/compare sub-page (react island):
  // /ru/exam/compare/, /pl/egzamin/porownanie/, /es/examen/comparar/
  if (canonical === 'exam' && rest.length === 1 && (rest[0] === 'compare' || REACT_ISLAND_SUBSLUGS.has(rest[0]))) {
    return true;
  }

  return false;
}

/**
 * Recursively collect all files under a directory.
 * Returns paths relative to the given root with a leading slash.
 *
 * @param {string} dir       Absolute path to directory to scan
 * @param {string} root      Absolute path used as the base for relative URLs
 * @param {string[]} exts    File extensions to include (e.g. ['.js', '.css'])
 * @returns {Promise<string[]>}
 */
async function collectFiles(dir, root, exts) {
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectFiles(fullPath, root, exts);
      results.push(...nested);
    } else if (exts.includes(extname(entry.name))) {
      const rel = '/' + relative(root, fullPath).replace(/\\/g, '/');
      results.push(rel);
    }
  }
  return results;
}

/**
 * Enumerate all JSON data files in the versioned bundle directory.
 * Returns { core: string[], locale: Record<string, string[]> }
 *
 * Locale-specific files (search_index.{locale}.json,
 * name_index.{locale}.json, concept_lookup.{locale}.json,
 * and anything under translations/{locale}/) go into locale buckets.
 * Everything else goes into core.
 *
 * @param {string} bundleDir  Absolute path to /dist/data/{hash}/
 * @param {string} bundleHash
 * @param {string} distDir    Absolute dist root (for URL construction)
 * @returns {Promise<{ core: string[], locale: Record<string, string[]> }>}
 */
async function enumerateDataFiles(bundleDir, bundleHash, distDir) {
  const core = [];
  const locale = Object.fromEntries(LOCALES.map((l) => [l, []]));

  const allFiles = await collectFiles(bundleDir, distDir, ['.json']);

  for (const filePath of allFiles) {
    // filePath is like /data/92d4f6a56917/elements.json

    // Check if it's in translations/{locale}/
    const transMatch = filePath.match(
      new RegExp(`^/data/${bundleHash}/translations/(${LOCALES.join('|')})/`)
    );
    if (transMatch) {
      locale[transMatch[1]].push(filePath);
      continue;
    }

    // Check locale-specific index files at bundle root:
    // search_index.{locale}.json, name_index.{locale}.json, concept_lookup.{locale}.json
    const localeFileMatch = filePath.match(
      new RegExp(`^/data/${bundleHash}/(?:search_index|name_index|concept_lookup)\\.(${LOCALES.join('|')})\\.json$`)
    );
    if (localeFileMatch) {
      locale[localeFileMatch[1]].push(filePath);
      continue;
    }

    core.push(filePath);
  }

  // Sort for determinism
  core.sort();
  for (const l of LOCALES) locale[l].sort();

  return { core, locale };
}

/**
 * Scan dist/ for HTML pages and classify them by locale.
 * Returns { ru: string[], en: string[], pl: string[], es: string[], _shared: string[] }
 *
 * React-island index pages are excluded.
 * /app-shell/ and /offline.html are excluded.
 * Files under _astro/ are excluded.
 *
 * @param {string} distDir
 * @returns {Promise<Record<string, string[]>>}
 */
async function collectPages(distDir) {
  const pages = Object.fromEntries([...LOCALES, '_shared'].map((k) => [k, []]));

  const allHtml = await collectFiles(distDir, distDir, ['.html']);

  for (const filePath of allHtml) {
    // Skip _astro/ directory
    if (filePath.startsWith('/_astro/')) continue;

    // Skip /offline.html
    if (filePath === '/offline.html') continue;

    // Skip /app-shell/ (not built yet, but guard for future)
    if (filePath.startsWith('/app-shell/')) continue;

    // Convert file path to URL path: /ru/periodic-table/index.html → /ru/periodic-table/
    const urlPath = filePath.endsWith('/index.html')
      ? filePath.slice(0, -'index.html'.length)
      : filePath;

    // Skip react island pages
    if (isReactIslandPage(urlPath)) continue;

    // Classify by locale prefix
    let classified = false;
    for (const locale of LOCALES) {
      if (urlPath.startsWith(`/${locale}/`) || urlPath === `/${locale}/index.html` || urlPath === `/${locale}`) {
        pages[locale].push(urlPath);
        classified = true;
        break;
      }
    }

    // No locale prefix → shared (e.g. /index.html redirect, root pages)
    if (!classified) {
      pages._shared.push(urlPath);
    }
  }

  // Sort for determinism
  for (const key of Object.keys(pages)) pages[key].sort();

  return pages;
}

/**
 * Main entry point. Reads dist/ and writes dist/precache-manifest.json.
 */
export async function generatePrecacheManifest() {
  // 1. Read manifest to get bundle hash
  const manifestPath = join(DIST_DIR, 'data/latest/manifest.json');
  const manifestRaw = await readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestRaw);
  const bundleHash = manifest.bundle_hash;

  // 2. Collect JS/CSS assets from _astro/
  const astroDir = join(DIST_DIR, '_astro');
  const assets = await collectFiles(astroDir, DIST_DIR, ['.js', '.css']);
  assets.sort();

  // 3. Enumerate data files
  const bundleDir = join(DIST_DIR, 'data', bundleHash);
  const { core: dataCore, locale: dataLocale } = await enumerateDataFiles(bundleDir, bundleHash, DIST_DIR);

  // 4. Collect HTML pages
  const pages = await collectPages(DIST_DIR);

  // 5. Build output
  const precacheManifest = {
    version: bundleHash,
    shell: '/app-shell/',
    assets,
    data: {
      core: dataCore,
      locale: dataLocale,
    },
    pages,
  };

  // 6. Write output
  const outPath = join(DIST_DIR, 'precache-manifest.json');
  await writeFile(outPath, JSON.stringify(precacheManifest, null, 2), 'utf-8');

  console.log(`precache-manifest.json written (${bundleHash})`);
  console.log(`  assets: ${assets.length}`);
  console.log(`  data.core: ${dataCore.length}`);
  for (const l of LOCALES) {
    console.log(`  data.locale.${l}: ${dataLocale[l].length}`);
  }
  for (const key of [...LOCALES, '_shared']) {
    console.log(`  pages.${key}: ${pages[key].length}`);
  }

  return precacheManifest;
}

// Run when executed directly
generatePrecacheManifest().catch((err) => {
  console.error('generate-precache-manifest failed:', err);
  process.exit(1);
});
