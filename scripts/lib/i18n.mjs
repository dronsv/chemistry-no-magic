/**
 * Build-time i18n utilities.
 * Mirrors src/lib/i18n.ts slug map for URL localization during build.
 */

export const SUPPORTED_LOCALES = ['ru', 'en', 'pl', 'es'];
export const TRANSLATION_LOCALES = ['en', 'pl', 'es']; // non-default locales

const SLUG_MAP = {
  '/': { ru: '/', en: '/en/', pl: '/pl/', es: '/es/' },
  '/diagnostics/': { ru: '/diagnostics/', en: '/en/diagnostics/', pl: '/pl/diagnostyka/', es: '/es/diagnostico/' },
  '/periodic-table/': { ru: '/periodic-table/', en: '/en/periodic-table/', pl: '/pl/tablica-okresowa/', es: '/es/tabla-periodica/' },
  '/substances/': { ru: '/substances/', en: '/en/substances/', pl: '/pl/substancje/', es: '/es/sustancias/' },
  '/bonds/': { ru: '/bonds/', en: '/en/bonds/', pl: '/pl/wiazania/', es: '/es/enlaces/' },
  '/oxidation-states/': { ru: '/oxidation-states/', en: '/en/oxidation-states/', pl: '/pl/stopnie-utlenienia/', es: '/es/estados-oxidacion/' },
  '/reactions/': { ru: '/reactions/', en: '/en/reactions/', pl: '/pl/reakcje/', es: '/es/reacciones/' },
  '/calculations/': { ru: '/calculations/', en: '/en/calculations/', pl: '/pl/obliczenia/', es: '/es/calculos/' },
  '/exam/': { ru: '/exam/', en: '/en/exam/', pl: '/pl/egzamin/', es: '/es/examen/' },
  '/profile/': { ru: '/profile/', en: '/en/profile/', pl: '/pl/profil/', es: '/es/perfil/' },
  '/search/': { ru: '/search/', en: '/en/search/', pl: '/pl/szukaj/', es: '/es/buscar/' },
  '/about/': { ru: '/about/', en: '/en/about/', pl: '/pl/o-projekcie/', es: '/es/acerca/' },
};

/**
 * Convert a canonical path to a localized URL.
 * @param {string} path
 * @param {string} locale
 * @returns {string}
 */
export function localizeUrl(path, locale) {
  if (locale === 'ru') return path;

  const slugged = SLUG_MAP[path];
  if (slugged) return slugged[locale];

  for (const [canonical, localized] of Object.entries(SLUG_MAP)) {
    if (canonical !== '/' && path.startsWith(canonical)) {
      const suffix = path.slice(canonical.length);
      return localized[locale] + suffix;
    }
  }

  return `/${locale}${path}`;
}

/**
 * Apply a translation overlay to an array of objects.
 * Overlay format: { [key]: { field: value, ... } }
 *
 * @param {any[]} items - Base data array
 * @param {Record<string, Record<string, any>> | null} overlay - Translation overlay (keyed by item ID)
 * @param {(item: any) => string} keyFn - Function to extract the key from each item
 * @returns {any[]} Items with overlaid translations
 */
export function applyOverlay(items, overlay, keyFn) {
  if (!overlay || Object.keys(overlay).length === 0) return items;
  return items.map(item => {
    const key = keyFn(item);
    const overrides = overlay[key];
    if (!overrides) return item;
    return { ...item, ...overrides };
  });
}
