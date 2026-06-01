import { test, expect } from '@playwright/test';

/**
 * Core navigation smoke tests — verify key pages load without errors.
 * Uses <title> tag for heading verification since React island pages
 * render h1 client-side after hydration.
 */

// Default (ru) locale is prefix-routed (astro.config.mjs: prefixDefaultLocale:
// true). Content pages live under /ru/; bare "/" serves a locale-detect shell.
const CORE_PAGES = [
  { path: '/ru/', title: 'Химия без магии' },
  { path: '/ru/periodic-table/', title: 'Периодическая таблица' },
  { path: '/ru/substances/', title: 'Каталог веществ' },
  { path: '/ru/bonds/', title: 'Химическая связь' },
  { path: '/ru/oxidation-states/', title: 'Степени окисления' },
  { path: '/ru/reactions/', title: 'Реакции' },
  { path: '/ru/calculations/', title: 'Расчёты' },
  { path: '/ru/exam/', title: 'Экзамен' },
  { path: '/ru/profile/', title: 'Профиль' },
  { path: '/ru/search/', title: 'Поиск' },
];

test.describe('Core page navigation', () => {
  for (const { path, title } of CORE_PAGES) {
    test(`${path} loads with correct title`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle(new RegExp(title));
    });
  }
});

test('nav is visible on home page', async ({ page }) => {
  await page.goto('/ru/');
  const nav = page.locator('nav');
  await expect(nav).toBeVisible();
  // Home link (flask icon) — points to the locale root /ru/; use first() to
  // avoid strict mode with multiple a[href="/ru/"] (nav home + lang switcher)
  await expect(nav.locator('a[href="/ru/"]').first()).toBeVisible();
});

test('no console errors on home page', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/ru/');
  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});
