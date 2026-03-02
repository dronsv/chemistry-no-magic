import { describe, it, expect } from 'vitest';
import { validateConceptsGraph } from '../../../scripts/lib/validate-ontology.mjs';

/** Helper: builds a minimal valid concept entry */
function concept(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'substance_class',
    parent_id: null,
    order: 1,
    filters: {},
    examples: [],
    ...overrides,
  };
}

describe('validateConceptsGraph', () => {
  it('returns empty errors for a valid graph', () => {
    const concepts = {
      'cls:oxide': concept({
        children_order: ['cls:oxide_basic'],
      }),
      'cls:oxide_basic': concept({
        parent_id: 'cls:oxide',
        order: 1,
      }),
    };
    expect(validateConceptsGraph(concepts)).toEqual([]);
  });

  it('returns empty errors for valid concepts without children_order', () => {
    const concepts = {
      'grp:halogens': concept({ kind: 'element_group', order: 2 }),
      'prop:solubility': concept({ kind: 'property', order: 3 }),
    };
    expect(validateConceptsGraph(concepts)).toEqual([]);
  });

  it('accepts all valid kinds', () => {
    const validKinds = [
      'substance_class',
      'element_group',
      'reaction_type',
      'reaction_facet',
      'property',
      'process',
    ];
    const concepts: Record<string, unknown> = {};
    validKinds.forEach((kind, i) => {
      concepts[`test:${kind}`] = concept({ kind, order: i + 1 });
    });
    expect(validateConceptsGraph(concepts as Record<string, object>)).toEqual([]);
  });

  it('reports invalid kind', () => {
    const concepts = {
      'cls:bad': concept({ kind: 'unknown_kind' }),
    };
    const errors = validateConceptsGraph(concepts);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('invalid kind');
    expect(errors[0]).toContain('cls:bad');
  });

  it('reports dangling parent_id', () => {
    const concepts = {
      'cls:child': concept({ parent_id: 'cls:nonexistent' }),
    };
    const errors = validateConceptsGraph(concepts);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('parent_id');
    expect(errors[0]).toContain('cls:nonexistent');
  });

  it('reports nonexistent children_order item', () => {
    const concepts = {
      'cls:parent': concept({
        children_order: ['cls:ghost'],
      }),
    };
    const errors = validateConceptsGraph(concepts);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some(e => e.includes('children_order') && e.includes('cls:ghost'))).toBe(true);
  });

  it('reports children_order item whose parent_id does not match', () => {
    const concepts = {
      'cls:parent': concept({
        children_order: ['cls:child'],
      }),
      'cls:child': concept({
        parent_id: 'cls:other', // wrong parent
      }),
      'cls:other': concept(),
    };
    const errors = validateConceptsGraph(concepts);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some(e => e.includes('children_order') && e.includes('parent'))).toBe(true);
  });

  it('reports parent cycle (A -> B -> A)', () => {
    const concepts = {
      'cls:a': concept({ parent_id: 'cls:b' }),
      'cls:b': concept({ parent_id: 'cls:a' }),
    };
    const errors = validateConceptsGraph(concepts);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some(e => e.includes('cycle'))).toBe(true);
  });

  it('reports self-referencing parent_id as a cycle', () => {
    const concepts = {
      'cls:self': concept({ parent_id: 'cls:self' }),
    };
    const errors = validateConceptsGraph(concepts);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some(e => e.includes('cycle'))).toBe(true);
  });

  it('reports non-numeric order', () => {
    const concepts = {
      'cls:bad': concept({ order: 'first' }),
    };
    const errors = validateConceptsGraph(concepts);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('order');
    expect(errors[0]).toContain('cls:bad');
  });

  it('reports missing order', () => {
    const concepts = {
      'cls:bad': {
        kind: 'substance_class',
        parent_id: null,
        filters: {},
        examples: [],
      },
    };
    const errors = validateConceptsGraph(concepts);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('order');
  });

  it('reports multiple errors at once', () => {
    const concepts = {
      'cls:bad_kind': concept({ kind: 'nope' }),
      'cls:dangling': concept({ parent_id: 'cls:missing' }),
    };
    const errors = validateConceptsGraph(concepts);
    expect(errors.length).toBe(2);
  });

  it('detects longer cycle (A -> B -> C -> A)', () => {
    const concepts = {
      'cls:a': concept({ parent_id: 'cls:c' }),
      'cls:b': concept({ parent_id: 'cls:a' }),
      'cls:c': concept({ parent_id: 'cls:b' }),
    };
    const errors = validateConceptsGraph(concepts);
    expect(errors.some(e => e.includes('cycle'))).toBe(true);
  });
});
