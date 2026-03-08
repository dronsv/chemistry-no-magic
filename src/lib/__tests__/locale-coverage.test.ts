/**
 * Locale Pack Coverage Tests
 *
 * Verifies that all core entity IDs have a `name` field in each locale overlay.
 * Elements and ions: strict (0 missing allowed).
 * Substances: threshold-based (coverage gap is too large to fix at once, tracked via MISSING_SUBSTANCE_NAMES_MAX).
 */
import { describe, it, expect } from 'vitest';
import elementsData from '../../../data-src/elements.json';
import ionsData from '../../../data-src/ions.json';
import ruElements from '../../../data-src/translations/ru/elements.json';
import enElements from '../../../data-src/translations/en/elements.json';
import plElements from '../../../data-src/translations/pl/elements.json';
import esElements from '../../../data-src/translations/es/elements.json';
import ruIons from '../../../data-src/translations/ru/ions.json';
import enIons from '../../../data-src/translations/en/ions.json';
import plIons from '../../../data-src/translations/pl/ions.json';
import esIons from '../../../data-src/translations/es/ions.json';
import ruSubstances from '../../../data-src/translations/ru/substances.json';
import enSubstances from '../../../data-src/translations/en/substances.json';
import plSubstances from '../../../data-src/translations/pl/substances.json';
import esSubstances from '../../../data-src/translations/es/substances.json';
import { readdirSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const LOCALES = ['ru', 'en', 'pl', 'es'] as const;
type Locale = typeof LOCALES[number];

function missingNames(ids: string[], overlay: Record<string, Record<string, unknown>>): string[] {
  return ids.filter(id => !overlay[id] || !('name' in overlay[id]));
}

const elementIds = (elementsData as Array<{ symbol: string }>).map(e => e.symbol);
const ionIds = (ionsData as Array<{ id: string }>).map(i => i.id);

const substancesDir = join(import.meta.dirname, '../../../data-src/substances');
// Filter out meta-files (arrays like substance_properties.json) — keep only files with a top-level `id`
import { readFileSync } from 'node:fs';
const substanceIds = readdirSync(substancesDir)
  .filter(f => extname(f) === '.json')
  .map(f => basename(f, '.json'))
  .filter(id => {
    const data = JSON.parse(readFileSync(join(substancesDir, `${id}.json`), 'utf-8'));
    return !Array.isArray(data) && typeof data.id === 'string';
  });

const elementOverlays: Record<Locale, Record<string, Record<string, unknown>>> = {
  ru: ruElements as Record<string, Record<string, unknown>>,
  en: enElements as Record<string, Record<string, unknown>>,
  pl: plElements as Record<string, Record<string, unknown>>,
  es: esElements as Record<string, Record<string, unknown>>,
};

const ionOverlays: Record<Locale, Record<string, Record<string, unknown>>> = {
  ru: ruIons as Record<string, Record<string, unknown>>,
  en: enIons as Record<string, Record<string, unknown>>,
  pl: plIons as Record<string, Record<string, unknown>>,
  es: esIons as Record<string, Record<string, unknown>>,
};

const substanceOverlays: Record<Locale, Record<string, Record<string, unknown>>> = {
  ru: ruSubstances as Record<string, Record<string, unknown>>,
  en: enSubstances as Record<string, Record<string, unknown>>,
  pl: plSubstances as Record<string, Record<string, unknown>>,
  es: esSubstances as Record<string, Record<string, unknown>>,
};

// All substances now have names in all locales
const MISSING_SUBSTANCE_NAMES_MAX: Record<Locale, number> = {
  ru: 0,
  en: 0,
  pl: 0,
  es: 0,
};

describe('Locale coverage — elements', () => {
  for (const locale of LOCALES) {
    it(`all ${elementIds.length} elements have name in ${locale}`, () => {
      const missing = missingNames(elementIds, elementOverlays[locale]);
      expect(missing, `Missing in ${locale}: ${missing.join(', ')}`).toHaveLength(0);
    });
  }
});

describe('Locale coverage — ions', () => {
  for (const locale of LOCALES) {
    it(`all ${ionIds.length} ions have name in ${locale}`, () => {
      const missing = missingNames(ionIds, ionOverlays[locale]);
      expect(missing, `Missing in ${locale}: ${missing.join(', ')}`).toHaveLength(0);
    });
  }
});

describe('Locale coverage — substances (threshold)', () => {
  for (const locale of LOCALES) {
    it(`${locale} substance names gap does not exceed threshold (${MISSING_SUBSTANCE_NAMES_MAX[locale]})`, () => {
      const missing = missingNames(substanceIds, substanceOverlays[locale]);
      const max = MISSING_SUBSTANCE_NAMES_MAX[locale];
      expect(
        missing.length,
        `${locale} has ${missing.length} missing substance names (max allowed: ${max}). Missing: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '...' : ''}`,
      ).toBeLessThanOrEqual(max);
    });
  }
});
