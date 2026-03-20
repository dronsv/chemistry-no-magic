import { describe, it, expect, beforeAll } from 'vitest';
import { buildOntologyIndex } from '../../server/indexing/build-index.js';
import { coverageReport } from '../../server/tools/write/coverage-report.js';
import type { OntologyIndex } from '../../shared/types.js';

let index: OntologyIndex;
beforeAll(async () => { index = await buildOntologyIndex(); });

describe('coverageReport', () => {
  it('returns translation summary for substances', () => {
    const r = coverageReport(index, { kind: 'substance', check: 'translations' });
    expect(r.summary.total_entities).toBeGreaterThan(50);
    expect(r.summary.translations).toHaveProperty('ru');
    expect(r.summary.translations).toHaveProperty('en');
    expect(r.summary.translations.ru.covered).toBeGreaterThan(0);
  });

  it('returns gaps as structured objects', () => {
    const r = coverageReport(index, { kind: 'substance', check: 'translations' });
    expect(r.gaps).toBeInstanceOf(Array);
    for (const gap of r.gaps) {
      expect(gap).toHaveProperty('type');
      expect(gap).toHaveProperty('ref');
    }
  });

  it('checks relations for substances', () => {
    const r = coverageReport(index, { kind: 'substance', check: 'relations' });
    expect(r.summary.relations).toHaveProperty('with_any');
    expect(r.summary.relations).toHaveProperty('orphaned');
  });

  it('checks characteristics for substances', () => {
    const r = coverageReport(index, { kind: 'substance', check: 'characteristics' });
    expect(r.summary.characteristics).toHaveProperty('with_any');
    expect(r.summary.characteristics).toHaveProperty('without');
  });

  it('runs all checks when check="all"', () => {
    const r = coverageReport(index, { kind: 'substance', check: 'all', locales: ['ru', 'en'] });
    expect(r.summary).toHaveProperty('translations');
    expect(r.summary).toHaveProperty('characteristics');
    expect(r.summary).toHaveProperty('relations');
  });

  it('respects locales filter', () => {
    const r = coverageReport(index, { kind: 'substance', check: 'translations', locales: ['en'] });
    expect(r.summary.translations).toHaveProperty('en');
    expect(r.summary.translations).not.toHaveProperty('ru');
  });
});
