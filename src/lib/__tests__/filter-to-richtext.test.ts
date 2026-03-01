import { describe, it, expect } from 'vitest';
import { filtersToRichText, isDslFilter } from '../filter-to-richtext';
import type { ConceptFilter } from '../../types/filter-dsl';

describe('filtersToRichText', () => {
  it('converts pred eq to ref segment', () => {
    const filter: ConceptFilter = { pred: { field: 'class', eq: 'oxide' } };
    const result = filtersToRichText(filter, 'ru');
    expect(result).toEqual([{ t: 'ref', id: 'cls:oxide' }]);
  });

  it('converts pred has (property) to ref segment', () => {
    const filter: ConceptFilter = { pred: { field: 'has_property', has: 'amphoteric' } };
    const result = filtersToRichText(filter, 'ru');
    expect(result).toEqual([{ t: 'ref', id: 'prop:amphoteric' }]);
  });

  it('converts pred has (type_tags) to ref segment', () => {
    const filter: ConceptFilter = { pred: { field: 'type_tags', has: 'substitution' } };
    const result = filtersToRichText(filter, 'en');
    expect(result).toEqual([{ t: 'ref', id: 'rxtype:substitution' }]);
  });

  it('converts pred in to multiple refs with or connector', () => {
    const filter: ConceptFilter = { pred: { field: 'class', in: ['oxide', 'acid'] } };
    const result = filtersToRichText(filter, 'ru');
    expect(result).toEqual([
      { t: 'ref', id: 'cls:oxide' },
      { t: 'text', v: ' или ' },
      { t: 'ref', id: 'cls:acid' },
    ]);
  });

  it('uses locale-specific connectors', () => {
    const filter: ConceptFilter = { pred: { field: 'class', in: ['oxide', 'acid'] } };
    const en = filtersToRichText(filter, 'en');
    expect(en[1]).toEqual({ t: 'text', v: ' or ' });

    const pl = filtersToRichText(filter, 'pl');
    expect(pl[1]).toEqual({ t: 'text', v: ' lub ' });
  });

  it('converts all to comma-separated list', () => {
    const filter: ConceptFilter = {
      all: [
        { pred: { field: 'class', eq: 'oxide' } },
        { pred: { field: 'element_kind', eq: 'metal' } },
      ],
    };
    const result = filtersToRichText(filter, 'ru');
    expect(result).toEqual([
      { t: 'ref', id: 'cls:oxide' },
      { t: 'text', v: ', ' },
      { t: 'ref', id: 'grp:metal' },
    ]);
  });

  it('converts not to except + inner', () => {
    const filter: ConceptFilter = {
      not: { concept: 'cls:oxide_amphoteric' },
    };
    const result = filtersToRichText(filter, 'ru');
    expect(result).toEqual([
      { t: 'text', v: 'кроме ' },
      { t: 'ref', id: 'cls:oxide_amphoteric' },
    ]);
  });

  it('converts concept ref', () => {
    const filter: ConceptFilter = { concept: 'cls:oxide' };
    const result = filtersToRichText(filter, 'en');
    expect(result).toEqual([{ t: 'ref', id: 'cls:oxide' }]);
  });

  it('handles basic oxide filter → full RichText', () => {
    const filter: ConceptFilter = {
      all: [
        { pred: { field: 'class', eq: 'oxide' } },
        { pred: { field: 'element_kind', eq: 'metal' } },
        { pred: { field: 'oxidation_state_max', in: [1, 2] } },
        { not: { concept: 'cls:oxide_amphoteric' } },
      ],
    };
    const result = filtersToRichText(filter, 'ru');
    expect(result.length).toBeGreaterThan(0);
    // Verify structure has refs and connectors
    expect(result[0]).toEqual({ t: 'ref', id: 'cls:oxide' });
    // Last segment should be concept ref from not clause
    const lastRef = result[result.length - 1];
    expect(lastRef).toEqual({ t: 'ref', id: 'cls:oxide_amphoteric' });
  });

  it('handles gt/lt as plain text', () => {
    const filter: ConceptFilter = { pred: { field: 'mass', gt: 100 } };
    const result = filtersToRichText(filter, 'en');
    expect(result).toEqual([{ t: 'text', v: 'mass > 100' }]);
  });
});

describe('isDslFilter', () => {
  it('detects DSL filters', () => {
    expect(isDslFilter({ all: [] })).toBe(true);
    expect(isDslFilter({ any: [] })).toBe(true);
    expect(isDslFilter({ not: { pred: { field: 'x', eq: 1 } } })).toBe(true);
    expect(isDslFilter({ pred: { field: 'x', eq: 1 } })).toBe(true);
    expect(isDslFilter({ concept: 'cls:oxide' })).toBe(true);
  });

  it('rejects legacy flat filters', () => {
    expect(isDslFilter({ class: 'oxide' })).toBe(false);
    expect(isDslFilter({ class: 'oxide', has_property: ['basic'] })).toBe(false);
  });
});
