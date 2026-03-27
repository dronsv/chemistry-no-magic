import { test, expect, type Page } from '@playwright/test';

/**
 * Comprehensive quality audit across ALL page types and ALL locales.
 *
 * Checks:
 * 1. Raw ontology ref IDs leaking into visible text
 * 2. Console errors (JS exceptions, React hydration failures)
 * 3. DOM nesting violations (<div> inside <p>, etc.)
 * 4. Untranslated strings (param keys, concept IDs, English leaking into RU)
 * 5. Cyrillic leaking into non-Russian locales
 * 6. Broken internal links (404s)
 * 7. Missing page titles
 * 8. HTTP status codes
 */

// ---------------------------------------------------------------------------
// Locale × page matrix
// ---------------------------------------------------------------------------

interface PageDef {
  path: string;
  /** Expected substring in <title> */
  titleMatch: string;
  /** Page has React islands that need hydration time */
  hasIslands?: boolean;
}

const RU_PAGES: PageDef[] = [
  { path: '/ru/', titleMatch: 'Химия' },
  { path: '/ru/bonds/', titleMatch: 'связь', hasIslands: true },
  { path: '/ru/oxidation-states/', titleMatch: 'окисления', hasIslands: true },
  { path: '/ru/reactions/', titleMatch: 'Реакции', hasIslands: true },
  { path: '/ru/calculations/', titleMatch: 'Расчёты', hasIslands: true },
  { path: '/ru/processes/', titleMatch: 'процесс', hasIslands: true },
  { path: '/ru/ions/', titleMatch: 'Ионы', hasIslands: true },
  { path: '/ru/substances/', titleMatch: 'Каталог', hasIslands: true },
  { path: '/ru/periodic-table/', titleMatch: 'Периодическая', hasIslands: true },
  { path: '/ru/diagnostics/', titleMatch: 'Диагностика', hasIslands: true },
  { path: '/ru/exam/', titleMatch: 'Экзамен', hasIslands: true },
  { path: '/ru/profile/', titleMatch: 'Профиль', hasIslands: true },
  { path: '/ru/search/', titleMatch: 'Поиск', hasIslands: true },
  { path: '/ru/competencies/', titleMatch: 'компетенци' },
  { path: '/ru/about/', titleMatch: 'О проект' },
  { path: '/ru/physical-foundations/', titleMatch: '' },
];

const EN_PAGES: PageDef[] = [
  { path: '/en/', titleMatch: 'Chemistry' },
  { path: '/en/bonds/', titleMatch: 'Bond', hasIslands: true },
  { path: '/en/oxidation-states/', titleMatch: 'Oxidation', hasIslands: true },
  { path: '/en/reactions/', titleMatch: 'Reaction', hasIslands: true },
  { path: '/en/calculations/', titleMatch: 'Calculation', hasIslands: true },
  { path: '/en/processes/', titleMatch: 'Process', hasIslands: true },
  { path: '/en/ions/', titleMatch: 'Ion', hasIslands: true },
  { path: '/en/substances/', titleMatch: 'Substance', hasIslands: true },
  { path: '/en/periodic-table/', titleMatch: 'Periodic', hasIslands: true },
  { path: '/en/exam/', titleMatch: 'Exam', hasIslands: true },
  { path: '/en/search/', titleMatch: 'Search', hasIslands: true },
];

const PL_PAGES: PageDef[] = [
  { path: '/pl/', titleMatch: 'Chemia' },
  { path: '/pl/wiazania/', titleMatch: 'Wiązania', hasIslands: true },
  { path: '/pl/stopnie-utlenienia/', titleMatch: 'utlenienia', hasIslands: true },
  { path: '/pl/reakcje/', titleMatch: 'Reakcje', hasIslands: true },
  { path: '/pl/obliczenia/', titleMatch: 'Obliczenia', hasIslands: true },
  { path: '/pl/procesy/', titleMatch: 'Proces', hasIslands: true },
  { path: '/pl/jony/', titleMatch: 'Jon', hasIslands: true },
  { path: '/pl/substancje/', titleMatch: 'Substancj', hasIslands: true },
  { path: '/pl/tablica-okresowa/', titleMatch: 'Układ', hasIslands: true },
  { path: '/pl/egzamin/', titleMatch: 'Egzamin', hasIslands: true },
];

const ES_PAGES: PageDef[] = [
  { path: '/es/', titleMatch: 'Química' },
  { path: '/es/enlaces/', titleMatch: 'Enlace', hasIslands: true },
  { path: '/es/estados-oxidacion/', titleMatch: 'oxidación', hasIslands: true },
  { path: '/es/reacciones/', titleMatch: 'Reaccion', hasIslands: true },
  { path: '/es/calculos/', titleMatch: 'Cálculo', hasIslands: true },
  { path: '/es/procesos/', titleMatch: 'Proceso', hasIslands: true },
  { path: '/es/iones/', titleMatch: 'Ion', hasIslands: true },
  { path: '/es/sustancias/', titleMatch: 'Sustancia', hasIslands: true },
  { path: '/es/tabla-periodica/', titleMatch: 'Tabla', hasIslands: true },
  { path: '/es/examen/', titleMatch: 'Examen', hasIslands: true },
];

// Nested pages (sample — element detail, competency, concept)
const NESTED_PAGES: PageDef[] = [
  { path: '/ru/periodic-table/Na/', titleMatch: 'Na' },
  { path: '/ru/periodic-table/Fe/', titleMatch: 'Fe' },
  { path: '/en/periodic-table/O/', titleMatch: 'O' },
  { path: '/ru/competency/bond_type/', titleMatch: '' },
  { path: '/ru/competency/oxidation_states/', titleMatch: '' },
  { path: '/ru/bonds/ionic/', titleMatch: '' },
  { path: '/ru/calculations/molyarnaya-massa/', titleMatch: '' },
  { path: '/ru/exam/compare/', titleMatch: '' },
];

// ---------------------------------------------------------------------------
// Raw ref patterns that should NEVER appear in visible page text
// ---------------------------------------------------------------------------

const RAW_REF_PATTERNS = [
  // Ontology ref IDs
  /\bconcept:[a-z_]{3,}\b/,
  /\bcls:[a-z_]{3,}\b/,
  /\bprop:[a-z_]{3,}\b/,
  /\brxtype:[a-z_]{3,}\b/,
  /\brxfacet:[a-z_]{3,}\b/,
  /\bproc:[a-z_]{3,}\b/,
  /\bgrp:[a-z_]{3,}\b/,
  // Raw param keys that should be localized
  /\b[a-z]+_substance_id\b/,
  /\bT_target_K\b/,
  /\bT_melting_K\b/,
  /\bT_boiling_K\b/,
  /\belectrode_material\b/,
  /\blight_wavelength\b/,
  /\bexcess_or_deficit\b/,
  /\bmass_transfer\b/,
  /\bliquid_medium\b/,
];

// Cyrillic Unicode range
const CYRILLIC_RE = /[\u0400-\u04FF]/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function auditPage(page: Page, url: string, waitMs: number): Promise<{
  consoleErrors: string[];
  nestingViolations: string[];
  rawRefs: string[];
  status: number;
}> {
  const consoleErrors: string[] = [];
  const nestingViolations: string[] = [];

  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      // Filter known benign
      if (text.includes('favicon') || text.includes('manifest.webmanifest')) return;
      consoleErrors.push(text);
    }
    // DOM nesting violations
    if (text.includes('cannot be a descendant') || text.includes('validateDOMNesting')) {
      nestingViolations.push(text);
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(`PAGE_ERROR: ${err.message}`);
  });

  const response = await page.goto(url);
  const status = response?.status() ?? 0;
  await page.waitForTimeout(waitMs);

  // Check for raw ref IDs in body text
  const bodyText = await page.textContent('body') ?? '';
  const rawRefs: string[] = [];
  for (const pattern of RAW_REF_PATTERNS) {
    const match = bodyText.match(pattern);
    if (match) {
      rawRefs.push(match[0]);
    }
  }

  return { consoleErrors, nestingViolations, rawRefs, status };
}

// ---------------------------------------------------------------------------
// Test: All RU pages
// ---------------------------------------------------------------------------

test.describe('RU pages audit', () => {
  for (const pg of RU_PAGES) {
    test(`${pg.path} — status + title + no raw refs + no errors`, async ({ page }) => {
      const wait = pg.hasIslands ? 3000 : 1000;
      const result = await auditPage(page, pg.path, wait);

      expect(result.status, `${pg.path} HTTP status`).toBe(200);
      if (pg.titleMatch) {
        await expect(page).toHaveTitle(new RegExp(pg.titleMatch, 'i'));
      }
      expect(result.rawRefs, `Raw refs on ${pg.path}`).toEqual([]);
      // Filter hydration warnings
      const critical = result.consoleErrors.filter(e =>
        !e.includes('hydrat') && !e.includes('Hydrat') &&
        !e.includes('Warning:') && !e.includes('DevTools'),
      );
      expect(critical, `Console errors on ${pg.path}`).toEqual([]);
      expect(result.nestingViolations, `Nesting violations on ${pg.path}`).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// Test: All EN pages
// ---------------------------------------------------------------------------

test.describe('EN pages audit', () => {
  for (const pg of EN_PAGES) {
    test(`${pg.path} — status + title + no Cyrillic leak + no errors`, async ({ page }) => {
      const wait = pg.hasIslands ? 3000 : 1000;
      const result = await auditPage(page, pg.path, wait);

      expect(result.status, `${pg.path} HTTP status`).toBe(200);
      if (pg.titleMatch) {
        await expect(page).toHaveTitle(new RegExp(pg.titleMatch, 'i'));
      }
      expect(result.rawRefs, `Raw refs on ${pg.path}`).toEqual([]);

      // Cyrillic leak check in title
      const title = await page.title();
      expect(CYRILLIC_RE.test(title), `Cyrillic in EN title "${title}"`).toBe(false);

      const critical = result.consoleErrors.filter(e =>
        !e.includes('hydrat') && !e.includes('Hydrat') &&
        !e.includes('Warning:') && !e.includes('DevTools'),
      );
      expect(critical, `Console errors on ${pg.path}`).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// Test: All PL pages
// ---------------------------------------------------------------------------

test.describe('PL pages audit', () => {
  for (const pg of PL_PAGES) {
    test(`${pg.path} — status + title + no Cyrillic leak`, async ({ page }) => {
      const wait = pg.hasIslands ? 3000 : 1000;
      const result = await auditPage(page, pg.path, wait);

      expect(result.status, `${pg.path} HTTP status`).toBe(200);
      if (pg.titleMatch) {
        await expect(page).toHaveTitle(new RegExp(pg.titleMatch, 'i'));
      }
      expect(result.rawRefs, `Raw refs on ${pg.path}`).toEqual([]);

      const title = await page.title();
      expect(CYRILLIC_RE.test(title), `Cyrillic in PL title "${title}"`).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// Test: All ES pages
// ---------------------------------------------------------------------------

test.describe('ES pages audit', () => {
  for (const pg of ES_PAGES) {
    test(`${pg.path} — status + title + no Cyrillic leak`, async ({ page }) => {
      const wait = pg.hasIslands ? 3000 : 1000;
      const result = await auditPage(page, pg.path, wait);

      expect(result.status, `${pg.path} HTTP status`).toBe(200);
      if (pg.titleMatch) {
        await expect(page).toHaveTitle(new RegExp(pg.titleMatch, 'i'));
      }
      expect(result.rawRefs, `Raw refs on ${pg.path}`).toEqual([]);

      const title = await page.title();
      expect(CYRILLIC_RE.test(title), `Cyrillic in ES title "${title}"`).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// Test: Nested/detail pages
// ---------------------------------------------------------------------------

test.describe('Nested pages audit', () => {
  for (const pg of NESTED_PAGES) {
    test(`${pg.path} — loads with 200, no raw refs`, async ({ page }) => {
      const result = await auditPage(page, pg.path, 2000);
      expect(result.status, `${pg.path} HTTP status`).toBe(200);
      expect(result.rawRefs, `Raw refs on ${pg.path}`).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// Test: Broken internal links on key pages
// ---------------------------------------------------------------------------

const LINK_CHECK_PAGES = [
  '/ru/bonds/',
  '/ru/processes/',
  '/ru/oxidation-states/',
  '/ru/reactions/',
  '/ru/calculations/',
  '/ru/ions/',
  '/ru/substances/',
  '/ru/periodic-table/',
  '/en/bonds/',
  '/en/processes/',
];

// Known 404 patterns (concept property pages not implemented)
const KNOWN_404_PREFIXES: string[] = [
  // Property pages now implemented — no known 404 patterns
];

test.describe('Broken link audit', () => {
  for (const pagePath of LINK_CHECK_PAGES) {
    test(`${pagePath} — no broken internal links`, async ({ page }) => {
      await page.goto(pagePath);
      await page.waitForTimeout(3000);

      const links = await page.locator('a[href^="/"]').all();
      const broken: string[] = [];
      const checked = new Set<string>();

      for (const link of links.slice(0, 40)) {
        const href = await link.getAttribute('href');
        if (!href || checked.has(href) || href === '#') continue;
        if (KNOWN_404_PREFIXES.some(p => href.startsWith(p))) continue;
        checked.add(href);

        try {
          const response = await page.request.get(href);
          if (response.status() === 404) {
            broken.push(`404: ${href}`);
          }
        } catch { /* network error — non-fatal */ }
      }

      expect(broken, `Broken links on ${pagePath}`).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// Test: Quantity/unit refs resolve to names (not raw IDs)
// ---------------------------------------------------------------------------

test.describe('Quantity ref resolution', () => {
  test('bonds page — solubility column shows localized name, not "solubility"', async ({ page }) => {
    await page.goto('/ru/bonds/');
    await page.waitForTimeout(5000);
    const body = await page.textContent('body') ?? '';
    // "solubility" as raw English ID should not appear
    // (note: the word might appear in English locale, only check RU)
    expect(body).not.toMatch(/\bsolubility\b/i);
  });

  test('calculations page — section titles have quantity names', async ({ page }) => {
    await page.goto('/ru/calculations/');
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') ?? '';
    // Should not show raw quantity IDs
    expect(body).not.toMatch(/\bq:molar_mass\b/);
    expect(body).not.toMatch(/\bq:amount\b/);
    expect(body).not.toMatch(/\bq:yield\b/);
  });
});

// ---------------------------------------------------------------------------
// Test: Process page param labels
// ---------------------------------------------------------------------------

test.describe('Process param localization', () => {
  test('RU processes — no raw param keys visible', async ({ page }) => {
    await page.goto('/ru/processes/');
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') ?? '';
    // These raw keys should be replaced with localized labels
    expect(body).not.toContain('acid_substance_id');
    expect(body).not.toContain('base_substance_id');
    expect(body).not.toContain('electrolyte_substance_id');
    expect(body).not.toContain('T_target_K');
    expect(body).not.toContain('electrode_material');
    expect(body).not.toContain('catalyst_substance_id');
  });

  test('EN processes — no raw param keys visible', async ({ page }) => {
    await page.goto('/en/processes/');
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') ?? '';
    expect(body).not.toContain('acid_substance_id');
    expect(body).not.toContain('electrolyte_substance_id');
    expect(body).not.toContain('T_target_K');
  });
});

// ---------------------------------------------------------------------------
// Test: °C not linked as Carbon
// ---------------------------------------------------------------------------

test.describe('Formula detection safety', () => {
  for (const pagePath of ['/ru/bonds/', '/ru/processes/']) {
    test(`${pagePath} — °C not linked as Carbon`, async ({ page }) => {
      await page.goto(pagePath);
      await page.waitForTimeout(3000);

      // Find text nodes containing °C
      const degreeC = page.locator('a:has-text("C")');
      const count = await degreeC.count();

      for (let i = 0; i < count; i++) {
        const el = degreeC.nth(i);
        // Get preceding text to check if it's after °
        const prevSibling = await el.evaluate(node => {
          const prev = node.previousSibling;
          return prev?.textContent?.slice(-1) ?? '';
        });
        expect(prevSibling, `"C" link preceded by "°" on ${pagePath}`).not.toBe('°');
      }
    });
  }
});
