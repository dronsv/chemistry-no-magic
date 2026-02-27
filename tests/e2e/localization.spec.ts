import { test, expect } from '@playwright/test';

/**
 * Localization smoke tests — verify pages render in each locale
 * without Russian text leaking into non-Russian locales.
 * Uses <title> tag for content verification (h1 is client-rendered on React pages).
 */

const LOCALE_PAGES = [
  {
    locale: 'en',
    pages: [
      { path: '/en/', title: 'Chemistry Without Magic' },
      { path: '/en/periodic-table/', title: 'Periodic Table' },
      { path: '/en/bonds/', title: 'Chemical Bonds' },
      { path: '/en/exam/', title: 'Exam' },
    ],
  },
  {
    locale: 'pl',
    pages: [
      { path: '/pl/', title: 'Chemia bez magii' },
      { path: '/pl/tablica-okresowa/', title: 'Układ okresowy' },
      { path: '/pl/wiazania/', title: 'Wiązania chemiczne' },
      { path: '/pl/egzamin/', title: 'Egzamin' },
    ],
  },
  {
    locale: 'es',
    pages: [
      { path: '/es/', title: 'Química sin magia' },
      { path: '/es/tabla-periodica/', title: 'Tabla periódica' },
      { path: '/es/enlaces/', title: 'Enlaces químicos' },
      { path: '/es/examen/', title: 'Examen' },
    ],
  },
];

// Russian characters pattern — Cyrillic block
const CYRILLIC_RE = /[\u0400-\u04FF]/;

for (const { locale, pages } of LOCALE_PAGES) {
  test.describe(`Locale: ${locale}`, () => {
    for (const { path, title } of pages) {
      test(`${path} renders in ${locale}`, async ({ page }) => {
        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        await expect(page).toHaveTitle(new RegExp(title));
      });
    }

    test(`${locale} home title has no Russian`, async ({ page }) => {
      await page.goto(pages[0].path);
      const title = await page.title();
      expect(CYRILLIC_RE.test(title)).toBe(false);
    });
  });
}
