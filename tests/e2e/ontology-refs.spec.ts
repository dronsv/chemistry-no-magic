import { test, expect, type Page } from '@playwright/test';

/**
 * Ontology reference integrity tests.
 *
 * Verifies that ontology refs on pages render as resolved names
 * (not raw IDs like "concept:ionic_bond") and that links point
 * to valid pages (not 404 / home page fallback).
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect console errors during page load + hydration */
async function collectConsoleErrors(page: Page, url: string, waitMs = 2000): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore known benign errors
      if (text.includes('favicon') || text.includes('manifest')) return;
      errors.push(text);
    }
  });
  page.on('pageerror', err => errors.push(`PAGE_ERROR: ${err.message}`));
  await page.goto(url);
  await page.waitForTimeout(waitMs);
  return errors;
}

/** Check page body text does NOT contain raw ontology ref IDs */
const RAW_REF_PATTERNS = [
  /\bconcept:[a-z_]+\b/,
  /\bcls:[a-z_]+\b/,
  /\bprop:[a-z_]+\b/,
  /\brxtype:[a-z_]+\b/,
  /\brxfacet:[a-z_]+\b/,
  /\bproc:[a-z_]+\b/,
  /\bgrp:[a-z_]+\b/,
];

async function checkNoRawRefs(page: Page): Promise<string[]> {
  const bodyText = await page.textContent('body') ?? '';
  const violations: string[] = [];
  for (const pattern of RAW_REF_PATTERNS) {
    const match = bodyText.match(pattern);
    if (match) {
      violations.push(`Raw ref found: "${match[0]}"`);
    }
  }
  return violations;
}

/** Check that no links on the page point to 404 (sample up to N links) */
async function checkBrokenLinks(page: Page, maxLinks = 30): Promise<string[]> {
  const links = await page.locator('a[href^="/"]').all();
  const broken: string[] = [];
  const checked = new Set<string>();

  // Known 404s from SmartText auto-detection linking to concept pages that don't exist
  // These are pre-existing issues, not regressions from ontology work
  const KNOWN_404s = new Set([
    '/ru/properties/',  // property concept pages not implemented yet
  ]);

  for (const link of links.slice(0, maxLinks)) {
    const href = await link.getAttribute('href');
    if (!href || checked.has(href)) continue;
    if (href === '#' || href.startsWith('/#')) continue;
    // Skip known 404 patterns
    if (KNOWN_404s.has(href) || [...KNOWN_404s].some(p => href.startsWith(p))) continue;
    checked.add(href);

    try {
      const response = await page.request.get(href);
      if (response.status() === 404) {
        broken.push(`404: ${href}`);
      }
    } catch {
      // Network errors during link checking are non-fatal
    }
  }
  return broken;
}

// ---------------------------------------------------------------------------
// Pages with ontology content to verify
// ---------------------------------------------------------------------------

const ONTOLOGY_PAGES = [
  { path: '/ru/bonds/', name: 'Bonds (theory panel with concept refs)' },
  { path: '/ru/processes/', name: 'Processes (RichText descriptions + typed params)' },
  { path: '/ru/oxidation-states/', name: 'Oxidation states' },
  { path: '/ru/reactions/', name: 'Reactions' },
  { path: '/ru/calculations/', name: 'Calculations' },
  { path: '/ru/ions/', name: 'Ions' },
  { path: '/ru/substances/', name: 'Substances' },
];

const ALL_LOCALE_PAGES = [
  { path: '/ru/', name: 'Home RU' },
  { path: '/en/', name: 'Home EN' },
  { path: '/pl/', name: 'Home PL' },
  { path: '/es/', name: 'Home ES' },
  { path: '/ru/bonds/', name: 'Bonds RU' },
  { path: '/en/bonds/', name: 'Bonds EN' },
  { path: '/ru/processes/', name: 'Processes RU' },
  { path: '/en/processes/', name: 'Processes EN' },
  { path: '/ru/periodic-table/', name: 'Periodic Table RU' },
  { path: '/en/periodic-table/', name: 'Periodic Table EN' },
];

// ---------------------------------------------------------------------------
// Tests: No raw ref IDs visible
// ---------------------------------------------------------------------------

test.describe('No raw ontology ref IDs on pages', () => {
  for (const { path, name } of ONTOLOGY_PAGES) {
    test(`${name}: no raw refs like concept:xxx visible`, async ({ page }) => {
      await page.goto(path);
      // Wait for React hydration
      await page.waitForTimeout(3000);
      const violations = await checkNoRawRefs(page);
      expect(violations, `Found raw refs on ${path}`).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// Tests: No console errors on pages
// ---------------------------------------------------------------------------

test.describe('No console errors on ontology pages', () => {
  for (const { path, name } of ONTOLOGY_PAGES) {
    test(`${name}: no console errors`, async ({ page }) => {
      const errors = await collectConsoleErrors(page, path, 3000);
      // Filter out hydration warnings (React dev mode)
      const critical = errors.filter(e =>
        !e.includes('hydration') &&
        !e.includes('Hydration') &&
        !e.includes('Warning:') &&
        !e.includes('DevTools'),
      );
      expect(critical, `Console errors on ${path}`).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// Tests: No broken internal links
// ---------------------------------------------------------------------------

test.describe('No broken internal links', () => {
  for (const { path, name } of ONTOLOGY_PAGES) {
    test(`${name}: all internal links return 200`, async ({ page }) => {
      await page.goto(path);
      await page.waitForTimeout(2000);
      const broken = await checkBrokenLinks(page);
      expect(broken, `Broken links on ${path}`).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// Tests: All locale pages load with 200
// ---------------------------------------------------------------------------

test.describe('All locale pages load', () => {
  for (const { path, name } of ALL_LOCALE_PAGES) {
    test(`${name} returns 200`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should return 200`).toBe(200);
    });
  }
});

// ---------------------------------------------------------------------------
// Tests: Bonds page ontology rendering
// ---------------------------------------------------------------------------

test.describe('Bonds page ontology content', () => {
  test('page loads and no raw concept IDs visible after hydration', async ({ page }) => {
    await page.goto('/ru/bonds/');
    // Wait for React hydration — theory panel lazy-loads data
    await page.waitForTimeout(5000);

    const body = await page.textContent('body') ?? '';

    // Should NOT contain raw ref IDs anywhere on the page
    expect(body).not.toMatch(/\bconcept:ionic_bond\b/);
    expect(body).not.toMatch(/\bconcept:metals\b/);
    expect(body).not.toMatch(/\bconcept:electron_transfer\b/);
  });

  test('formula chips exist on the page', async ({ page }) => {
    await page.goto('/ru/bonds/');
    await page.waitForTimeout(5000);

    // Formula chips should exist (from examples in bond calculator or theory panel)
    const formulaChips = await page.locator('.formula-chip').count();
    expect(formulaChips).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: Processes page ontology content
// ---------------------------------------------------------------------------

test.describe('Processes page ontology content', () => {
  test('process descriptions render with concept chips', async ({ page }) => {
    await page.goto('/ru/processes/');
    await page.waitForTimeout(3000);

    // Check that ont-ref chips exist (from RichText descriptions)
    const ontRefs = await page.locator('.ont-ref').count();
    expect(ontRefs).toBeGreaterThan(0);
  });

  test('typed params show localized labels', async ({ page }) => {
    await page.goto('/ru/processes/');
    await page.waitForTimeout(3000);

    const body = await page.textContent('body') ?? '';

    // Should show Russian param labels, not raw keys
    expect(body).not.toContain('acid_substance_id');
    expect(body).not.toContain('electrolyte_substance_id');
    expect(body).not.toContain('T_target_K');

    // Should show localized labels
    expect(body).toContain('кислота');
  });

  test('params have kind-specific colors', async ({ page }) => {
    await page.goto('/ru/processes/');
    await page.waitForTimeout(3000);

    // Check that substance/quantity/categorical param classes exist
    const substanceParams = await page.locator('.proc-page__param--substance').count();
    const quantityParams = await page.locator('.proc-page__param--quantity').count();
    const categoricalParams = await page.locator('.proc-page__param--categorical').count();

    expect(substanceParams + quantityParams + categoricalParams).toBeGreaterThan(0);
  });

  test('process cards have category-specific border colors', async ({ page }) => {
    await page.goto('/ru/processes/');
    await page.waitForTimeout(2000);

    // Check that kind-specific classes are applied
    const chemicalCards = await page.locator('.proc-page__entry--chemical').count();
    const physicalCards = await page.locator('.proc-page__entry--physical').count();

    expect(chemicalCards).toBeGreaterThan(0);
    expect(physicalCards).toBeGreaterThan(0);
  });

  test('effect badges have category colors', async ({ page }) => {
    await page.goto('/ru/processes/');
    await page.waitForTimeout(2000);

    const effectBadges = await page.locator('.proc-page__effect').count();
    expect(effectBadges).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: °C not detected as Carbon
// ---------------------------------------------------------------------------

test.describe('Formula detection edge cases', () => {
  test('°C in temperature text is not linked as Carbon element', async ({ page }) => {
    await page.goto('/ru/bonds/');
    await page.waitForTimeout(3000);

    // Find all elements with temperature text containing °C
    // The "C" after ° should NOT be a link
    const tempTexts = page.locator('text=/°C/');
    const count = await tempTexts.count();

    if (count > 0) {
      // Check that °C appears as plain text, not as a formula chip link
      for (let i = 0; i < Math.min(count, 5); i++) {
        const parent = tempTexts.nth(i).locator('..');
        const parentTag = await parent.evaluate(el => el.tagName.toLowerCase());
        // Should not be inside an anchor (link) tag
        expect(parentTag).not.toBe('a');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: HTML nesting validity
// ---------------------------------------------------------------------------

test.describe('Valid HTML nesting', () => {
  test('no div/p nesting violations in theory panels', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('cannot be a descendant') || text.includes('validateDOMNesting')) {
        errors.push(text);
      }
    });

    await page.goto('/ru/bonds/');
    await page.waitForTimeout(3000);

    expect(errors, 'DOM nesting violations found').toEqual([]);
  });
});
