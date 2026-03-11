import type { SupportedLocale } from '../types/i18n';

export const SUPPORTED_LOCALES: SupportedLocale[] = ['ru', 'en', 'pl', 'es'];
export const DEFAULT_LOCALE: SupportedLocale = 'ru';

/** Map of canonical paths → localized slugs per locale */
const SLUG_MAP: Record<string, Record<SupportedLocale, string>> = {
  '/': { ru: '/ru/', en: '/en/', pl: '/pl/', es: '/es/' },
  '/diagnostics/': {
    ru: '/ru/diagnostics/',
    en: '/en/diagnostics/',
    pl: '/pl/diagnostyka/',
    es: '/es/diagnostico/',
  },
  '/periodic-table/': {
    ru: '/ru/periodic-table/',
    en: '/en/periodic-table/',
    pl: '/pl/tablica-okresowa/',
    es: '/es/tabla-periodica/',
  },
  '/substances/': {
    ru: '/ru/substances/',
    en: '/en/substances/',
    pl: '/pl/substancje/',
    es: '/es/sustancias/',
  },
  '/bonds/': {
    ru: '/ru/bonds/',
    en: '/en/bonds/',
    pl: '/pl/wiazania/',
    es: '/es/enlaces/',
  },
  '/oxidation-states/': {
    ru: '/ru/oxidation-states/',
    en: '/en/oxidation-states/',
    pl: '/pl/stopnie-utlenienia/',
    es: '/es/estados-oxidacion/',
  },
  '/reactions/': {
    ru: '/ru/reactions/',
    en: '/en/reactions/',
    pl: '/pl/reakcje/',
    es: '/es/reacciones/',
  },
  '/calculations/': {
    ru: '/ru/calculations/',
    en: '/en/calculations/',
    pl: '/pl/obliczenia/',
    es: '/es/calculos/',
  },
  '/exam/': {
    ru: '/ru/exam/',
    en: '/en/exam/',
    pl: '/pl/egzamin/',
    es: '/es/examen/',
  },
  '/profile/': {
    ru: '/ru/profile/',
    en: '/en/profile/',
    pl: '/pl/profil/',
    es: '/es/perfil/',
  },
  '/search/': {
    ru: '/ru/search/',
    en: '/en/search/',
    pl: '/pl/szukaj/',
    es: '/es/buscar/',
  },
  '/ions/': {
    ru: '/ru/ions/',
    en: '/en/ions/',
    pl: '/pl/jony/',
    es: '/es/iones/',
  },
  '/competency/': {
    ru: '/ru/competency/',
    en: '/en/competency/',
    pl: '/pl/kompetencja/',
    es: '/es/competencia/',
  },
  '/competencies/': {
    ru: '/ru/competencies/',
    en: '/en/competencies/',
    pl: '/pl/kompetencje/',
    es: '/es/competencias/',
  },
  '/physical-foundations/': {
    ru: '/ru/physical-foundations/',
    en: '/en/physical-foundations/',
    pl: '/pl/physical-foundations/',
    es: '/es/physical-foundations/',
  },
  '/processes/': {
    ru: '/ru/processes/',
    en: '/en/processes/',
    pl: '/pl/procesy/',
    es: '/es/procesos/',
  },
  '/settings/': {
    ru: '/ru/settings/',
    en: '/en/settings/',
    pl: '/pl/ustawienia/',
    es: '/es/ajustes/',
  },
  '/about/': {
    ru: '/ru/about/',
    en: '/en/about/',
    pl: '/pl/o-projekcie/',
    es: '/es/acerca/',
  },
  '/exam/compare/': {
    ru: '/ru/exam/compare/',
    en: '/en/exam/compare/',
    pl: '/pl/egzamin/porownanie/',
    es: '/es/examen/comparar/',
  },
};

/** Reverse map: localized slug → canonical path */
const REVERSE_SLUG_MAP: Record<string, string> = {};
for (const [canonical, localized] of Object.entries(SLUG_MAP)) {
  for (const slug of Object.values(localized)) {
    REVERSE_SLUG_MAP[slug] = canonical;
  }
}

/**
 * Convert a canonical path to a localized URL.
 *
 * Handles static routes (exact match) and dynamic routes
 * (e.g. `/periodic-table/H/` → `/en/periodic-table/H/`).
 */
export function localizeUrl(path: string, locale: SupportedLocale): string {
  // Exact match in slug map
  const slugged = SLUG_MAP[path];
  if (slugged) return slugged[locale];

  // Dynamic routes: find the parent static route and replace prefix
  for (const [canonical, localized] of Object.entries(SLUG_MAP)) {
    if (canonical !== '/' && path.startsWith(canonical)) {
      const suffix = path.slice(canonical.length);
      return localized[locale] + suffix;
    }
  }

  // Fallback: prefix with locale
  return `/${locale}${path}`;
}

/**
 * Extract the canonical path from any localized URL.
 * Returns the canonical path and detected locale.
 */
export function getCanonicalPath(pathname: string): { canonical: string; locale: SupportedLocale } {
  // Check exact match in reverse map
  if (REVERSE_SLUG_MAP[pathname]) {
    const locale = detectLocaleFromPath(pathname);
    return { canonical: REVERSE_SLUG_MAP[pathname], locale };
  }

  // Check if pathname starts with a locale prefix (all locales including ru)
  for (const locale of SUPPORTED_LOCALES) {
    const prefix = `/${locale}/`;
    if (pathname.startsWith(prefix)) {
      // Find which canonical route this belongs to
      for (const [canonical, localized] of Object.entries(SLUG_MAP)) {
        const localizedPath = localized[locale];
        if (canonical !== '/' && pathname.startsWith(localizedPath)) {
          const suffix = pathname.slice(localizedPath.length);
          return { canonical: canonical + suffix, locale };
        }
      }
      // Fallback: strip prefix
      return { canonical: '/' + pathname.slice(prefix.length), locale };
    }
  }

  // No locale prefix — international page
  return { canonical: pathname, locale: DEFAULT_LOCALE };
}

function detectLocaleFromPath(pathname: string): SupportedLocale {
  for (const locale of SUPPORTED_LOCALES) {
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      return locale;
    }
  }
  return DEFAULT_LOCALE;
}

/**
 * Get all alternate URLs for a canonical path (for hreflang tags).
 */
export function getAlternateUrls(canonicalPath: string): Record<SupportedLocale, string> {
  const result = {} as Record<SupportedLocale, string>;
  for (const locale of SUPPORTED_LOCALES) {
    result[locale] = localizeUrl(canonicalPath, locale);
  }
  return result;
}

/** Base route path per concept kind — used by OntologyRef to build concept page URLs */
export const CONCEPT_KIND_ROUTES: Record<string, string> = {
  substance_class: '/substances/',
  element_group: '/periodic-table/',
  reaction_type: '/reactions/',
  reaction_facet: '/reactions/',
  process: '/processes/',
  property: '/properties/',
};

/** Open Graph locale codes */
export const OG_LOCALE_MAP: Record<SupportedLocale, string> = {
  ru: 'ru_RU',
  en: 'en_US',
  pl: 'pl_PL',
  es: 'es_ES',
};

/** hreflang codes — ru-RU targets Russia specifically (vs ru for global Russian) */
export const HREFLANG_MAP: Record<SupportedLocale, string> = {
  ru: 'ru-RU',
  en: 'en',
  pl: 'pl',
  es: 'es',
};

/** Localized site name */
export const SITE_NAME: Record<SupportedLocale, string> = {
  ru: 'Химия без магии',
  en: 'Chemistry Without Magic',
  pl: 'Chemia bez magii',
  es: 'Química sin magia',
};
