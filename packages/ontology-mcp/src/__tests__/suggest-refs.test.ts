import { describe, it, expect, beforeAll } from 'vitest';
import { buildOntologyIndex } from '../server/indexing/build-index.js';
import { suggestRefsForText } from '../server/tools/suggest-refs-for-text.js';
import type { OntologyIndex } from '../shared/types.js';

let index: OntologyIndex;
beforeAll(async () => { index = await buildOntologyIndex(); });

describe('suggestRefsForText', () => {
  it('detects element symbols in text', () => {
    const r = suggestRefsForText(index, {
      text: 'Натрий Na — мягкий металл',
      material_language: 'ru',
      mode: 'didactic',
    });
    expect(r.mentions.some(m => m.candidates.some(c => c.ref === 'el:Na'))).toBe(true);
  });

  it('detects chemical formulas', () => {
    const r = suggestRefsForText(index, {
      text: 'Реакция HCl с NaOH',
      material_language: 'ru',
      mode: 'didactic',
    });
    const refs = r.mentions.flatMap(m => m.candidates.map(c => c.ref));
    expect(refs).toContain('sub:hcl');
  });

  it('detects Russian concept names', () => {
    const r = suggestRefsForText(index, {
      text: 'Кислота диссоциирует в воде',
      material_language: 'ru',
      mode: 'didactic',
    });
    expect(r.mentions.some(m => m.candidates.some(c => c.ref === 'cls:acid'))).toBe(true);
  });

  it('returns mentions sorted by position', () => {
    const r = suggestRefsForText(index, {
      text: 'Na и Cl образуют NaCl',
      material_language: 'ru',
      mode: 'didactic',
    });
    for (let i = 1; i < r.mentions.length; i++) {
      expect(r.mentions[i].start).toBeGreaterThanOrEqual(r.mentions[i - 1].start);
    }
  });
});
