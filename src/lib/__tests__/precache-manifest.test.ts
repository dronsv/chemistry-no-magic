import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { isReactIslandPage } from '../../../scripts/lib/generate-precache-manifest.mjs';

describe('isReactIslandPage', () => {
  // React-island index pages → true (URL paths, not file paths)
  it('identifies /ru/periodic-table/ as react island', () => {
    expect(isReactIslandPage('/ru/periodic-table/')).toBe(true);
  });
  it('identifies localized slug /pl/tablica-okresowa/', () => {
    expect(isReactIslandPage('/pl/tablica-okresowa/')).toBe(true);
  });
  it('identifies /en/exam/compare/ as react island', () => {
    expect(isReactIslandPage('/en/exam/compare/')).toBe(true);
  });
  it('identifies /es/examen/comparar/ as react island', () => {
    expect(isReactIslandPage('/es/examen/comparar/')).toBe(true);
  });
  it('identifies /ru/settings/ as react island', () => {
    expect(isReactIslandPage('/ru/settings/')).toBe(true);
  });

  // Astro-rendered pages → false
  it('does NOT classify element detail /ru/periodic-table/H/', () => {
    expect(isReactIslandPage('/ru/periodic-table/H/')).toBe(false);
  });
  it('does NOT classify substance detail /en/substances/h2o/', () => {
    expect(isReactIslandPage('/en/substances/h2o/')).toBe(false);
  });
  it('does NOT classify competency /ru/competency/classification/', () => {
    expect(isReactIslandPage('/ru/competency/classification/')).toBe(false);
  });
  it('does NOT classify locale landing /ru/', () => {
    expect(isReactIslandPage('/ru/')).toBe(false);
  });
  it('does NOT classify international landing /', () => {
    expect(isReactIslandPage('/')).toBe(false);
  });
});

// Integration tests against actual build output (skip if not built)

const DIST = 'dist';
const MANIFEST_PATH = join(DIST, 'precache-manifest.json');

describe('precache-manifest.json', () => {
  const hasManifest = existsSync(MANIFEST_PATH);

  it.skipIf(!hasManifest)('exists after build', () => {
    expect(existsSync(MANIFEST_PATH)).toBe(true);
  });

  it.skipIf(!hasManifest)('has correct structure', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
    expect(manifest.version).toBeTruthy();
    expect(manifest.shell).toBe('/app-shell/');
    expect(Array.isArray(manifest.assets)).toBe(true);
    expect(manifest.data.core).toBeDefined();
    expect(manifest.data.locale.ru).toBeDefined();
    expect(manifest.data.locale.en).toBeDefined();
    expect(manifest.pages.ru).toBeDefined();
  });

  it.skipIf(!hasManifest)('assets include JS and CSS files', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
    const jsFiles = manifest.assets.filter((f: string) => f.endsWith('.js'));
    const cssFiles = manifest.assets.filter((f: string) => f.endsWith('.css'));
    expect(jsFiles.length).toBeGreaterThan(0);
    expect(cssFiles.length).toBeGreaterThan(0);
  });

  it.skipIf(!hasManifest)('does not include app-shell in pages', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
    const allPages = Object.values(manifest.pages).flat() as string[];
    expect(allPages.some((p: string) => p.includes('app-shell'))).toBe(false);
  });

  it.skipIf(!hasManifest)('does not include react-island index pages in pages', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
    const ruPages = manifest.pages.ru as string[];
    // Periodic table index should NOT be in pages (it's a react island)
    expect(ruPages.some((p: string) => p === '/ru/periodic-table/')).toBe(false);
    // But element detail pages SHOULD be
    expect(ruPages.some((p: string) => p.includes('/periodic-table/H/'))).toBe(true);
  });

  it.skipIf(!hasManifest)('includes shared pages', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
    expect(manifest.pages._shared).toBeDefined();
    expect(manifest.pages._shared.length).toBeGreaterThan(0);
    expect(manifest.pages._shared).toContain('/');
  });
});
