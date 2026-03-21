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

  it('detects multi-word concept names (n-gram matching)', () => {
    const r = suggestRefsForText(index, {
      text: 'Ионная связь возникает при переносе электронов',
      material_language: 'ru',
      mode: 'didactic',
    });
    const refs = r.mentions.flatMap(m => m.candidates.map(c => c.ref));
    expect(refs).toContain('concept:ionic_bond');
  });

  it('prefers longer n-gram match over single word', () => {
    const r = suggestRefsForText(index, {
      text: 'Ковалентная полярная связь образуется между неметаллами',
      material_language: 'ru',
      mode: 'didactic',
    });
    // Should match "ковалентная полярная связь" as a trigram, not three separate words
    const ionicRef = r.mentions.find(m =>
      m.candidates.some(c => c.ref === 'concept:covalent_polar_bond')
    );
    expect(ionicRef).toBeDefined();
    // The matched text should be the full phrase, not a single word
    expect(ionicRef!.text.split(/\s+/).length).toBeGreaterThanOrEqual(2);
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
