// @ts-check
import { defineConfig } from 'astro/config';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Load route policy for sitemap filtering
let _routePolicy;
try {
  _routePolicy = JSON.parse(readFileSync(join(process.cwd(), 'data-src/route_policy.json'), 'utf-8'));
} catch {
  _routePolicy = { elements: { mode: 'all' }, substances: { mode: 'all' } };
}
function _inSitemap(policy, id) {
  if (!policy || policy.mode === 'all') return true;
  return (policy.sitemap ?? policy.full ?? []).includes(id);
}

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

/**
 * Last git commit date for given paths (any locale).
 * Returns Date object or null if git unavailable.
 */
function gitDate(...paths) {
  try {
    const args = paths.map(p => `"${p}"`).join(' ');
    const out = execSync(`git log -1 --format=%cI -- ${args}`, { encoding: 'utf-8' }).trim();
    return out ? new Date(out) : null;
  } catch {
    return null;
  }
}

// Last-modified dates per data source — computed once at build time
const D = {
  elements:    gitDate('data-src/elements.json', 'data-src/translations/en/elements.json',
                       'data-src/translations/pl/elements.json', 'data-src/translations/es/elements.json'),
  substances:  gitDate('data-src/substances'),
  reactions:   gitDate('data-src/reactions'),
  bonds:       gitDate('data-src/theory_modules/bonds_and_crystals.json', 'data-src/rules/bond_theory.json'),
  calculations: gitDate('data-src/theory_modules/calculations.json', 'data-src/rules/calculations_data.json'),
  oxidation:   gitDate('data-src/theory_modules/oxidation_states.json', 'data-src/rules/oxidation_rules.json'),
  competencies: gitDate('data-src/rules/competencies.json', 'data-src/rules/bkt_params.json'),
  ions:        gitDate('data-src/ions.json', 'data-src/translations/en/ions.json'),
  ui:          gitDate('messages', 'src/layouts', 'src/components/Nav.astro'),
};
const FALLBACK = new Date('2026-01-01');

/** Map a sitemap URL to its real last-modified date. */
function lastmod(url) {
  const p = url.replace(SITE_URL, '');
  // Element detail pages (any locale)
  if (
    (p.includes('/periodic-table/') || p.includes('/tablica-okresowa/') || p.includes('/tabla-periodica/')) &&
    !p.endsWith('/periodic-table/') && !p.endsWith('/tablica-okresowa/') && !p.endsWith('/tabla-periodica/')
  ) return D.elements ?? FALLBACK;
  // Substance detail pages
  if (
    (p.includes('/substances/') || p.includes('/substancje/') || p.includes('/sustancias/')) &&
    !p.endsWith('/substances/') && !p.endsWith('/substancje/') && !p.endsWith('/sustancias/')
  ) return D.substances ?? FALLBACK;
  // Reaction detail pages
  if (
    (p.includes('/reactions/') || p.includes('/reakcje/') || p.includes('/reacciones/')) &&
    !p.endsWith('/reactions/') && !p.endsWith('/reakcje/') && !p.endsWith('/reacciones/')
  ) return D.reactions ?? FALLBACK;
  // Bonds pages (section + detail)
  if (p.includes('/bonds') || p.includes('/wiazania') || p.includes('/enlaces')) return D.bonds ?? FALLBACK;
  // Calculations pages
  if (p.includes('/calculations') || p.includes('/obliczenia') || p.includes('/calculos')) return D.calculations ?? FALLBACK;
  // Oxidation states pages
  if (p.includes('/oxidation-states') || p.includes('/stopnie-utlenienia') || p.includes('/estados-oxidacion')) return D.oxidation ?? FALLBACK;
  // Competency pages
  if (p.includes('/competency/') || p.includes('/kompetencja/') || p.includes('/competencia/')) return D.competencies ?? FALLBACK;
  // Ions
  if (p.includes('/ions') || p.includes('/jony') || p.includes('/iones')) return D.ions ?? FALLBACK;
  // Section indexes and everything else: use most recently changed of ui/elements/substances
  const latest = [D.ui, D.elements, D.substances, D.bonds].filter(Boolean);
  return latest.length ? new Date(Math.max(...latest.map(d => d.getTime()))) : FALLBACK;
}

/** Assign crawl priority based on page type. */
function priority(url) {
  const p = url.replace(SITE_URL, '');
  if (p === '/') return 1.0;

  // Main section pages (any locale)
  const sectionSuffixes = [
    '/periodic-table/', '/tablica-okresowa/', '/tabla-periodica/',
    '/substances/', '/substancje/', '/sustancias/',
    '/reactions/', '/reakcje/', '/reacciones/',
    '/bonds/', '/wiazania/', '/enlaces/',
    '/calculations/', '/obliczenia/', '/calculos/',
    '/oxidation-states/', '/stopnie-utlenienia/', '/estados-oxidacion/',
    '/ions/', '/jony/', '/iones/',
    '/diagnostics/', '/diagnostyka/', '/diagnostico/',
    '/competencies/', '/kompetencje/', '/competencias/',
  ];
  if (sectionSuffixes.some(s => p.endsWith(s) || p === s.slice(0, -1))) return 0.9;

  // Element detail pages — encyclopaedic core content
  if (p.includes('/periodic-table/') || p.includes('/tablica-okresowa/') || p.includes('/tabla-periodica/')) return 0.8;

  // Exam comparison — unique cross-system content
  if (p.includes('/compare') || p.includes('/porownanie') || p.includes('/comparar')) return 0.8;

  // Competency detail pages
  if (p.includes('/competency/') || p.includes('/kompetencja/') || p.includes('/competencia/')) return 0.7;

  // Substance & reaction detail pages
  if (p.includes('/substances/') || p.includes('/substancje/') || p.includes('/sustancias/')) return 0.6;
  if (p.includes('/reactions/') || p.includes('/reakcje/') || p.includes('/reacciones/')) return 0.6;

  return 0.5;
}

// https://astro.build/config
const SITE_URL = process.env.SITE_URL || 'https://ru.chemistry.online';

export default defineConfig({
  site: SITE_URL,
  i18n: {
    defaultLocale: 'ru',
    locales: ['ru', 'en', 'pl', 'es'],
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
  vite: {
    plugins: [
      paraglideVitePlugin({
        project: './project.inlang',
        outdir: './src/paraglide',
      }),
    ],
  },
  integrations: [
    react(),
    sitemap({
      filter: (page) => {
        if (page.includes('/profile/') || page.includes('/profil/') || page.includes('/perfil/')) return false;
        // Element detail pages — filter by sitemap policy
        const elMatch = page.match(/\/(periodic-table|tablica-okresowa|tabla-periodica)\/([^/]+)\//);
        if (elMatch) return _inSitemap(_routePolicy.elements, elMatch[2]);
        // Substance detail pages — filter by sitemap policy (skip class slug pages with Cyrillic)
        const subMatch = page.match(/\/(substances|substancje|sustancias)\/([^/]+)\//);
        if (subMatch && !/[а-яА-Я]/.test(subMatch[2])) return _inSitemap(_routePolicy.substances, subMatch[2]);
        return true;
      },
      serialize: (item) => {
        const p = priority(item.url);
        return {
          ...item,
          priority: p,
          changefreq: p >= 0.8 ? 'monthly' : 'weekly',
          lastmod: lastmod(item.url),
        };
      },
    }),
  ],
});
