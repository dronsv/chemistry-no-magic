import { test, expect } from '@playwright/test';

/**
 * Core navigation smoke tests — verify key pages load without errors.
 * Uses <title> tag for heading verification since React island pages
 * render h1 client-side after hydration.
 */

const CORE_PAGES = [
  { path: '/', title: 'Химия без магии' },
  { path: '/periodic-table/', title: 'Периодическая таблица' },
  { path: '/substances/', title: 'Каталог веществ' },
  { path: '/bonds/', title: 'Химическая связь' },
  { path: '/oxidation-states/', title: 'Степени окисления' },
  { path: '/reactions/', title: 'Реакции' },
  { path: '/calculations/', title: 'Расчёты' },
  { path: '/exam/', title: 'Экзамен' },
  { path: '/profile/', title: 'Профиль' },
  { path: '/search/', title: 'Поиск' },
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
  await page.goto('/');
  const nav = page.locator('nav');
  await expect(nav).toBeVisible();
  // Home link (flask icon) — use first() to avoid strict mode with multiple a[href="/"]
  await expect(nav.locator('a[href="/"]').first()).toBeVisible();
});

test('no console errors on home page', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/');
  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});
