import { describe, it, expect } from 'vitest';
import {
  validateConceptsGraph,
  validateTheoryModuleRefs,
  validateCourseRefs,
  validateFilterStructure,
  checkZeroMatchConcepts,
} from '../../../scripts/lib/validate-ontology.mjs';

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

  it('reports parent cycle (A -> B -> A) exactly once', () => {
    const concepts = {
      'cls:a': concept({ parent_id: 'cls:b' }),
      'cls:b': concept({ parent_id: 'cls:a' }),
    };
    const errors = validateConceptsGraph(concepts);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('cycle');
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

  it('detects longer cycle (A -> B -> C -> A) exactly once', () => {
    const concepts = {
      'cls:a': concept({ parent_id: 'cls:c' }),
      'cls:b': concept({ parent_id: 'cls:a' }),
      'cls:c': concept({ parent_id: 'cls:b' }),
    };
    const errors = validateConceptsGraph(concepts);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('cycle');
  });

  it('returns error for null or undefined input', () => {
    expect(validateConceptsGraph(null)).toEqual([
      'concepts.json must be an object keyed by concept ID',
    ]);
    expect(validateConceptsGraph(undefined)).toEqual([
      'concepts.json must be an object keyed by concept ID',
    ]);
    expect(validateConceptsGraph([1, 2])).toEqual([
      'concepts.json must be an object keyed by concept ID',
    ]);
  });

  it('reports duplicate in children_order', () => {
    const concepts = {
      'cls:parent': concept({
        children_order: ['cls:child', 'cls:child'],
      }),
      'cls:child': concept({
        parent_id: 'cls:parent',
        order: 2,
      }),
    };
    const errors = validateConceptsGraph(concepts);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('duplicate in children_order');
    expect(errors[0]).toContain('cls:child');
  });
});

describe('validateTheoryModuleRefs', () => {
  const CONCEPTS: Record<string, object> = {
    'cls:oxide': concept(),
    'cls:acid': concept({ order: 2 }),
  };

  const validModule = {
    id: 'module:test.v1',
    kind: 'theory_module',
    applies_to: ['cls:oxide'],
    sections: [
      {
        id: 'sec1',
        title_ref: 'cls:oxide',
        blocks: [
          {
            t: 'concept_card',
            conceptId: 'cls:oxide',
            examples: { mode: 'filter' },
          },
        ],
      },
    ],
  };

  it('returns empty errors for a valid module', () => {
    expect(validateTheoryModuleRefs([validModule], CONCEPTS)).toEqual([]);
  });

  it('reports dangling applies_to reference', () => {
    const mod = {
      ...validModule,
      applies_to: ['cls:nonexistent'],
    };
    const errors = validateTheoryModuleRefs([mod], CONCEPTS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('applies_to');
    expect(errors[0]).toContain('cls:nonexistent');
  });

  it('reports dangling conceptId in concept_card block', () => {
    const mod = {
      ...validModule,
      sections: [
        {
          id: 'sec1',
          title_ref: 'cls:oxide',
          blocks: [
            {
              t: 'concept_card',
              conceptId: 'cls:missing_concept',
              examples: { mode: 'filter' },
            },
          ],
        },
      ],
    };
    const errors = validateTheoryModuleRefs([mod], CONCEPTS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('conceptId');
    expect(errors[0]).toContain('cls:missing_concept');
  });

  it('reports dangling ref in reactivity_rules RichText', () => {
    const mod = {
      ...validModule,
      sections: [
        {
          id: 'sec1',
          title_ref: 'cls:oxide',
          blocks: [
            {
              t: 'concept_card',
              conceptId: 'cls:oxide',
              reactivity_rules: [
                { t: 'text', v: 'Reacts with ' },
                { t: 'ref', id: 'cls:phantom', form: 'ins_pl' },
              ],
              examples: { mode: 'filter' },
            },
          ],
        },
      ],
    };
    const errors = validateTheoryModuleRefs([mod], CONCEPTS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('ref');
    expect(errors[0]).toContain('cls:phantom');
  });

  it('reports dangling ref in text_block content', () => {
    const mod = {
      ...validModule,
      sections: [
        {
          id: 'sec1',
          title_ref: 'cls:oxide',
          blocks: [
            {
              t: 'text_block',
              content: [
                { t: 'text', v: 'See ' },
                { t: 'ref', id: 'cls:ghost' },
              ],
            },
          ],
        },
      ],
    };
    const errors = validateTheoryModuleRefs([mod], CONCEPTS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('ref');
    expect(errors[0]).toContain('cls:ghost');
  });

  it('finds and validates nested ref in em/strong wrappers', () => {
    const mod = {
      ...validModule,
      sections: [
        {
          id: 'sec1',
          title_ref: 'cls:oxide',
          blocks: [
            {
              t: 'text_block',
              content: [
                {
                  t: 'em',
                  children: [
                    {
                      t: 'strong',
                      children: [
                        { t: 'ref', id: 'cls:not_here' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const errors = validateTheoryModuleRefs([mod], CONCEPTS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('ref');
    expect(errors[0]).toContain('cls:not_here');
  });

  it('finds valid nested ref in em/strong without errors', () => {
    const mod = {
      ...validModule,
      sections: [
        {
          id: 'sec1',
          title_ref: 'cls:oxide',
          blocks: [
            {
              t: 'text_block',
              content: [
                {
                  t: 'em',
                  children: [
                    { t: 'ref', id: 'cls:acid' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const errors = validateTheoryModuleRefs([mod], CONCEPTS);
    expect(errors).toEqual([]);
  });

  it('reports dangling title_ref in section', () => {
    const mod = {
      ...validModule,
      sections: [
        {
          id: 'sec1',
          title_ref: 'cls:nonexistent_title',
          blocks: [],
        },
      ],
    };
    const errors = validateTheoryModuleRefs([mod], CONCEPTS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('title_ref');
    expect(errors[0]).toContain('cls:nonexistent_title');
  });

  it('accepts valid title_ref in section', () => {
    const mod = {
      ...validModule,
      sections: [
        {
          id: 'sec1',
          title_ref: 'cls:oxide',
          blocks: [],
        },
      ],
    };
    const errors = validateTheoryModuleRefs([mod], CONCEPTS);
    expect(errors).toEqual([]);
  });

  it('returns empty errors for empty modules array', () => {
    expect(validateTheoryModuleRefs([], CONCEPTS)).toEqual([]);
  });
});

describe('validateCourseRefs', () => {
  const modules = [
    { id: 'module:test.v1', kind: 'theory_module', applies_to: [], sections: [] },
  ];

  it('returns empty errors for a valid course', () => {
    const courses = [{ id: 'course:c1', title_ru: 'Test', modules: ['module:test.v1'] }];
    expect(validateCourseRefs(courses, modules)).toEqual([]);
  });

  it('reports dangling module ref', () => {
    const courses = [{ id: 'course:c1', title_ru: 'Test', modules: ['module:nonexistent'] }];
    const errors = validateCourseRefs(courses, modules);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('module:nonexistent');
  });

  it('returns empty errors for empty courses array', () => {
    expect(validateCourseRefs([], modules)).toEqual([]);
  });
});

describe('validateFilterStructure', () => {
  it('accepts valid pred filter', () => {
    const concepts = {
      'cls:oxide': concept({
        filters: { pred: { field: 'class', eq: 'oxide' } },
      }),
    };
    expect(validateFilterStructure(concepts)).toEqual([]);
  });

  it('accepts valid all filter', () => {
    const concepts = {
      'cls:oxide_basic': concept({
        filters: {
          all: [
            { pred: { field: 'class', eq: 'oxide' } },
            { pred: { field: 'subclass', eq: 'basic' } },
          ],
        },
      }),
    };
    expect(validateFilterStructure(concepts)).toEqual([]);
  });

  it('accepts valid any filter', () => {
    const concepts = {
      'cls:any_test': concept({
        filters: {
          any: [
            { pred: { field: 'class', eq: 'oxide' } },
            { pred: { field: 'class', eq: 'acid' } },
          ],
        },
      }),
    };
    expect(validateFilterStructure(concepts)).toEqual([]);
  });

  it('accepts valid not filter', () => {
    const concepts = {
      'rxtype:non_redox': concept({
        kind: 'reaction_type',
        filters: { not: { pred: { field: 'type_tags', has: 'redox' } } },
      }),
    };
    expect(validateFilterStructure(concepts)).toEqual([]);
  });

  it('accepts valid concept ref in filter', () => {
    const concepts = {
      'cls:oxide': concept({
        filters: { pred: { field: 'class', eq: 'oxide' } },
      }),
      'cls:oxide_ref': concept({
        filters: { concept: 'cls:oxide' },
      }),
    };
    expect(validateFilterStructure(concepts)).toEqual([]);
  });

  it('accepts empty filter {} as valid (no constraints)', () => {
    const concepts = {
      'cls:empty': concept({
        filters: {},
      }),
    };
    expect(validateFilterStructure(concepts)).toEqual([]);
  });

  it('reports invalid filter node keys', () => {
    const concepts = {
      'cls:bad': concept({
        filters: { badKey: 'something' },
      }),
    };
    const errors = validateFilterStructure(concepts);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]).toContain('invalid filter');
    expect(errors[0]).toContain('cls:bad');
  });

  it('reports dangling concept ref in filter', () => {
    const concepts = {
      'cls:dangling': concept({
        filters: { concept: 'cls:nonexistent' },
      }),
    };
    const errors = validateFilterStructure(concepts);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some(e => e.includes('cls:nonexistent'))).toBe(true);
  });

  it('reports pred missing field', () => {
    const concepts = {
      'cls:no_field': concept({
        filters: { pred: { eq: 'oxide' } },
      }),
    };
    const errors = validateFilterStructure(concepts);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some(e => e.includes('field'))).toBe(true);
  });

  it('reports pred with unknown key', () => {
    const concepts = {
      'cls:bad_pred': concept({
        filters: { pred: { field: 'class', eq: 'oxide', fuzzy: true } },
      }),
    };
    const errors = validateFilterStructure(concepts);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some(e => e.includes('cls:bad_pred'))).toBe(true);
  });

  it('reports all/any not being array', () => {
    const concepts = {
      'cls:bad_all': concept({
        filters: { all: 'not_an_array' },
      }),
    };
    const errors = validateFilterStructure(concepts);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some(e => e.includes('cls:bad_all'))).toBe(true);
  });

  it('reports errors in nested filter nodes', () => {
    const concepts = {
      'cls:nested_bad': concept({
        filters: {
          all: [
            { pred: { field: 'class', eq: 'oxide' } },
            { pred: { badKey: 'value' } },
          ],
        },
      }),
    };
    const errors = validateFilterStructure(concepts);
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });
});

describe('checkZeroMatchConcepts', () => {
  const substances = [
    { id: 's1', class: 'oxide', subclass: 'basic' },
    { id: 's2', class: 'acid', subclass: 'oxygen_containing' },
  ];
  const elements = [
    { Z: 11, symbol: 'Na', element_group: 'alkali_metal' },
  ];
  const reactions = [
    { reaction_id: 'rx1', type_tags: ['exchange'], heat_effect: 'exo' },
  ];

  it('returns empty warnings for concept with matches', () => {
    const concepts = {
      'cls:oxide': concept({
        filters: { pred: { field: 'class', eq: 'oxide' } },
      }),
    };
    const warnings = checkZeroMatchConcepts(concepts, { substances, elements, reactions });
    expect(warnings).toEqual([]);
  });

  it('returns warning for concept with zero matches', () => {
    const concepts = {
      'cls:base': concept({
        filters: { pred: { field: 'class', eq: 'base' } },
      }),
    };
    const warnings = checkZeroMatchConcepts(concepts, { substances, elements, reactions });
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('zero matches');
    expect(warnings[0]).toContain('cls:base');
  });

  it('skips concepts without filters (empty {})', () => {
    const concepts = {
      'cls:empty': concept({
        filters: {},
      }),
    };
    const warnings = checkZeroMatchConcepts(concepts, { substances, elements, reactions });
    expect(warnings).toEqual([]);
  });

  it('skips property and reaction_facet kinds (no entity mapping)', () => {
    const concepts = {
      'prop:solubility': concept({
        kind: 'property',
        filters: { pred: { field: 'name', eq: 'solubility' } },
      }),
      'rxfacet:by_count': concept({
        kind: 'reaction_facet',
        filters: { pred: { field: 'facet', eq: 'count' } },
      }),
    };
    const warnings = checkZeroMatchConcepts(concepts, { substances, elements, reactions });
    expect(warnings).toEqual([]);
  });

  it('matches element_group concepts against elements', () => {
    const concepts = {
      'grp:alkali': concept({
        kind: 'element_group',
        filters: { pred: { field: 'element_group', eq: 'alkali_metal' } },
      }),
    };
    const warnings = checkZeroMatchConcepts(concepts, { substances, elements, reactions });
    expect(warnings).toEqual([]);
  });

  it('reports zero-match element_group concept', () => {
    const concepts = {
      'grp:lanthanides': concept({
        kind: 'element_group',
        filters: { pred: { field: 'element_group', eq: 'lanthanide' } },
      }),
    };
    const warnings = checkZeroMatchConcepts(concepts, { substances, elements, reactions });
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('zero matches');
    expect(warnings[0]).toContain('grp:lanthanides');
  });

  it('matches reaction_type concepts against reactions', () => {
    const concepts = {
      'rxtype:exchange': concept({
        kind: 'reaction_type',
        filters: { pred: { field: 'type_tags', has: 'exchange' } },
      }),
    };
    const warnings = checkZeroMatchConcepts(concepts, { substances, elements, reactions });
    expect(warnings).toEqual([]);
  });

  it('reports zero-match reaction_type concept', () => {
    const concepts = {
      'rxtype:combination': concept({
        kind: 'reaction_type',
        filters: { pred: { field: 'type_tags', has: 'combination' } },
      }),
    };
    const warnings = checkZeroMatchConcepts(concepts, { substances, elements, reactions });
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('zero matches');
    expect(warnings[0]).toContain('rxtype:combination');
  });

  it('skips process kind (no entity mapping)', () => {
    const concepts = {
      'proc:dissolution': concept({
        kind: 'process',
        filters: { pred: { field: 'type', eq: 'dissolution' } },
      }),
    };
    const warnings = checkZeroMatchConcepts(concepts, { substances, elements, reactions });
    expect(warnings).toEqual([]);
  });
});
