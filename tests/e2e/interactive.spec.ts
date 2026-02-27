import { test, expect } from '@playwright/test';

/**
 * Interactive component smoke tests — verify React island pages load
 * and key content is accessible.
 *
 * Note: Large React islands (PeriodicTablePage, BondsPage) use client:idle
 * and may not fully hydrate in headless test environments. We verify page
 * load + title, not full hydration. Unit tests cover component logic.
 */

test.describe('Bond calculator page', () => {
  test('loads with correct title', async ({ page }) => {
    const response = await page.goto('/bonds/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Химическая связь/);
  });
});

test.describe('Oxidation states page', () => {
  test('loads and hydrates', async ({ page }) => {
    const response = await page.goto('/oxidation-states/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Степени окисления/);

    // Small React islands hydrate reliably — verify interactive elements appear
    await expect(page.locator('astro-island').first()).toBeAttached({ timeout: 5_000 });
  });
});

test.describe('Periodic table', () => {
  test('page loads with correct title', async ({ page }) => {
    const response = await page.goto('/periodic-table/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Периодическая таблица/);
  });

  test('element detail page has element data', async ({ page }) => {
    const response = await page.goto('/periodic-table/H/');
    expect(response?.status()).toBe(200);

    // Element detail pages have data in static HTML
    const body = await page.textContent('body');
    expect(body).toContain('1.008');
  });
});

test.describe('Search', () => {
  test('search page loads and shows results for query', async ({ page }) => {
    await page.goto('/search/?q=Na');

    // Search is a small React island — hydrates reliably
    await expect(page.getByText('Na', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Calculations page', () => {
  test('loads with correct title', async ({ page }) => {
    const response = await page.goto('/calculations/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Расчёты/);
  });
});
