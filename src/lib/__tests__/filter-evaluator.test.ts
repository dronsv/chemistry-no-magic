import { describe, it, expect } from 'vitest';
import { evaluateFilter, filterEntities } from '../filter-evaluator';
import type { ConceptFilter } from '../../types/filter-dsl';

const noResolve = () => undefined;

describe('evaluateFilter', () => {
  describe('pred', () => {
    it('eq matches exact value', () => {
      const filter: ConceptFilter = { pred: { field: 'class', eq: 'oxide' } };
      expect(evaluateFilter(filter, { class: 'oxide' }, noResolve)).toBe(true);
      expect(evaluateFilter(filter, { class: 'acid' }, noResolve)).toBe(false);
    });

    it('in matches value from list', () => {
      const filter: ConceptFilter = { pred: { field: 'oxidation_state_max', in: [1, 2] } };
      expect(evaluateFilter(filter, { oxidation_state_max: 2 }, noResolve)).toBe(true);
      expect(evaluateFilter(filter, { oxidation_state_max: 3 }, noResolve)).toBe(false);
    });

    it('in matches if entity field is array with any overlap', () => {
      const filter: ConceptFilter = { pred: { field: 'tags', in: ['metal', 'noble'] } };
      expect(evaluateFilter(filter, { tags: ['metal', 'solid'] }, noResolve)).toBe(true);
      expect(evaluateFilter(filter, { tags: ['gas'] }, noResolve)).toBe(false);
    });

    it('has checks array contains', () => {
      const filter: ConceptFilter = { pred: { field: 'properties', has: 'amphoteric' } };
      expect(evaluateFilter(filter, { properties: ['amphoteric', 'basic'] }, noResolve)).toBe(true);
      expect(evaluateFilter(filter, { properties: ['basic'] }, noResolve)).toBe(false);
      expect(evaluateFilter(filter, { properties: 'not-array' }, noResolve)).toBe(false);
    });

    it('gt / lt for numeric comparisons', () => {
      const gt: ConceptFilter = { pred: { field: 'atomic_number', gt: 10 } };
      expect(evaluateFilter(gt, { atomic_number: 15 }, noResolve)).toBe(true);
      expect(evaluateFilter(gt, { atomic_number: 5 }, noResolve)).toBe(false);

      const lt: ConceptFilter = { pred: { field: 'mass', lt: 40 } };
      expect(evaluateFilter(lt, { mass: 30 }, noResolve)).toBe(true);
      expect(evaluateFilter(lt, { mass: 50 }, noResolve)).toBe(false);
    });

    it('returns false for missing field', () => {
      const filter: ConceptFilter = { pred: { field: 'class', eq: 'oxide' } };
      expect(evaluateFilter(filter, {}, noResolve)).toBe(false);
    });
  });

  describe('all', () => {
    it('requires all sub-expressions to match', () => {
      const filter: ConceptFilter = {
        all: [
          { pred: { field: 'class', eq: 'oxide' } },
          { pred: { field: 'element_kind', eq: 'metal' } },
        ],
      };
      expect(evaluateFilter(filter, { class: 'oxide', element_kind: 'metal' }, noResolve)).toBe(true);
      expect(evaluateFilter(filter, { class: 'oxide', element_kind: 'nonmetal' }, noResolve)).toBe(false);
    });

    it('empty all matches everything', () => {
      const filter: ConceptFilter = { all: [] };
      expect(evaluateFilter(filter, { class: 'oxide' }, noResolve)).toBe(true);
    });
  });

  describe('any', () => {
    it('requires at least one sub-expression to match', () => {
      const filter: ConceptFilter = {
        any: [
          { pred: { field: 'class', eq: 'acid' } },
          { pred: { field: 'class', eq: 'base' } },
        ],
      };
      expect(evaluateFilter(filter, { class: 'acid' }, noResolve)).toBe(true);
      expect(evaluateFilter(filter, { class: 'base' }, noResolve)).toBe(true);
      expect(evaluateFilter(filter, { class: 'salt' }, noResolve)).toBe(false);
    });

    it('empty any matches nothing', () => {
      const filter: ConceptFilter = { any: [] };
      expect(evaluateFilter(filter, { class: 'oxide' }, noResolve)).toBe(false);
    });
  });

  describe('not', () => {
    it('negates inner expression', () => {
      const filter: ConceptFilter = {
        not: { pred: { field: 'class', eq: 'acid' } },
      };
      expect(evaluateFilter(filter, { class: 'oxide' }, noResolve)).toBe(true);
      expect(evaluateFilter(filter, { class: 'acid' }, noResolve)).toBe(false);
    });
  });

  describe('concept', () => {
    it('resolves and evaluates referenced concept filter', () => {
      const amphotericFilter: ConceptFilter = {
        pred: { field: 'properties', has: 'amphoteric' },
      };
      const resolve = (id: string) =>
        id === 'cls:oxide_amphoteric' ? amphotericFilter : undefined;

      const filter: ConceptFilter = { concept: 'cls:oxide_amphoteric' };
      expect(evaluateFilter(filter, { properties: ['amphoteric'] }, resolve)).toBe(true);
      expect(evaluateFilter(filter, { properties: ['basic'] }, resolve)).toBe(false);
    });

    it('returns false for unresolvable concept', () => {
      const filter: ConceptFilter = { concept: 'cls:nonexistent' };
      expect(evaluateFilter(filter, {}, noResolve)).toBe(false);
    });
  });

  describe('nested boolean', () => {
    it('handles complex nested expression (basic oxide = oxide + metal + low ox.state - amphoteric)', () => {
      const amphotericFilter: ConceptFilter = {
        pred: { field: 'properties', has: 'amphoteric' },
      };
      const resolve = (id: string) =>
        id === 'cls:oxide_amphoteric' ? amphotericFilter : undefined;

      const filter: ConceptFilter = {
        all: [
          { pred: { field: 'class', eq: 'oxide' } },
          { pred: { field: 'element_kind', eq: 'metal' } },
          { pred: { field: 'oxidation_state_max', in: [1, 2] } },
          { not: { concept: 'cls:oxide_amphoteric' } },
        ],
      };

      // Na2O: oxide, metal, ox_state=1, not amphoteric → match
      expect(evaluateFilter(filter, {
        class: 'oxide', element_kind: 'metal', oxidation_state_max: 1, properties: [],
      }, resolve)).toBe(true);

      // Al2O3: oxide, metal, ox_state=3, amphoteric → no match (ox_state)
      expect(evaluateFilter(filter, {
        class: 'oxide', element_kind: 'metal', oxidation_state_max: 3, properties: ['amphoteric'],
      }, resolve)).toBe(false);

      // ZnO: oxide, metal, ox_state=2, amphoteric → no match (amphoteric)
      expect(evaluateFilter(filter, {
        class: 'oxide', element_kind: 'metal', oxidation_state_max: 2, properties: ['amphoteric'],
      }, resolve)).toBe(false);
    });
  });

  describe('recursion guard', () => {
    it('stops at depth 10', () => {
      const resolve = (id: string): ConceptFilter | undefined => {
        if (id === 'cls:loop') return { concept: 'cls:loop' };
        return undefined;
      };
      const filter: ConceptFilter = { concept: 'cls:loop' };
      expect(evaluateFilter(filter, {}, resolve)).toBe(false);
    });
  });
});

describe('filterEntities', () => {
  it('returns matching entities', () => {
    const filter: ConceptFilter = { pred: { field: 'class', eq: 'oxide' } };
    const entities = [
      { id: 'na2o', class: 'oxide' },
      { id: 'hcl', class: 'acid' },
      { id: 'co2', class: 'oxide' },
    ];
    const result = filterEntities(filter, entities, noResolve);
    expect(result).toHaveLength(2);
    expect(result.map(e => e.id)).toEqual(['na2o', 'co2']);
  });
});
