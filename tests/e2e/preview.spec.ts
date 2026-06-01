import { test, expect } from '@playwright/test';

/**
 * Semantic Preview Layer smoke tests.
 *
 * The preview layer wraps ontology refs in <OntInteractiveRef>, which renders
 * a <span className="ont-iref ..."> wrapper. FormulaChip (element/substance/ion
 * paths) and ConceptRef both wrap their content in it, so any hydrated page with
 * FormulaChips or concept refs should contain `.ont-iref`.
 *
 * /ru/calculations/ renders TheoryModulePanel equations and FormulaChips, which
 * are wrapped in OntInteractiveRef (span.ont-iref). The default (ru) locale is
 * prefix-routed (astro.config.mjs: prefixDefaultLocale: true), so the live route
 * is /ru/calculations/ — matching the /ru/* paths used by ontology-refs.spec.ts
 * and full-audit.spec.ts. This island hydrates ~56 .ont-iref wrappers in headless
 * Chrome well within the timeout.
 */

test('ontology refs render interactive wrappers', async ({ page }) => {
  await page.goto('/ru/calculations/');
  const wrappers = page.locator('.ont-iref');
  await expect(wrappers.first()).toBeVisible({ timeout: 10_000 });
});

test('preview-bearing page loads without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('favicon') || text.includes('manifest')) return;
      errors.push(text);
    }
  });
  page.on('pageerror', err => errors.push(`PAGE_ERROR: ${err.message}`));
  await page.goto('/ru/calculations/');
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});
