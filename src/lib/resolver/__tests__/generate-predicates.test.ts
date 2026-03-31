import { describe, it, expect } from 'vitest';
import {
  predicatesFromProperties,
  predicatesFromFormulas,
  predicatesFromConcepts,
  constructorPredicates,
  mergePredicates,
  buildPredicateIndex,
} from '../../../../scripts/lib/generate-predicates.mjs';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROPERTY_ELECTRONEGATIVITY = {
  id: 'electronegativity',
  value_field: 'electronegativity',
  object: 'element',
  unit: null,
  concept_ref: 'concept:electronegativity',
};

const PROPERTY_PKA = {
  id: 'pKa',
  value_field: null,
  object: 'substance',
  unit: null,
  concept_ref: 'concept:pKa',
};

const FORMULA_AMOUNT_FROM_MASS = {
  id: 'formula:amount_from_mass',
  kind: 'definition',
  domain: 'stoichiometry',
  variables: [
    { symbol: 'n', quantity: 'q:amount', unit: 'unit:mol', role: 'result' },
    { symbol: 'm', quantity: 'q:mass', unit: 'unit:g', role: 'input' },
    { symbol: 'M', quantity: 'q:molar_mass', unit: 'unit:g_per_mol', role: 'input' },
  ],
  expression: { op: 'divide', operands: ['m', 'M'] },
  result_variable: 'n',
  invertible_for: ['m', 'M'],
};

const FORMULA_MOLAR_MASS_FROM_COMPOSITION = {
  id: 'formula:molar_mass_from_composition',
  kind: 'definition',
  domain: 'stoichiometry',
  variables: [
    { symbol: 'M', quantity: 'q:molar_mass', unit: 'unit:g_per_mol', role: 'result' },
    { symbol: 'Ar_i', quantity: 'q:relative_atomic_mass', unit: 'unit:dimensionless', role: 'input' },
    { symbol: 'count_i', quantity: 'q:atom_count', unit: 'unit:dimensionless', role: 'index' },
  ],
  result_variable: 'M',
  invertible_for: [],
};

const CONCEPTS_FIXTURE = {
  'cls:oxide': { kind: 'substance_class', parent_id: null, order: 1 },
  'cls:acid': { kind: 'substance_class', parent_id: null, order: 2 },
  'rxtype:combination': { kind: 'reaction_type', order: 1 },
  'rxtype:decomposition': { kind: 'reaction_type', order: 2 },
  'rxfacet:by_count': { kind: 'reaction_facet', order: 1 },
  'concept:electronegativity': { kind: 'domain_concept' },
};

// ── predicatesFromProperties ──────────────────────────────────────────────────

describe('predicatesFromProperties', () => {
  it('generates element.electronegativity from property with object="element"', () => {
    const result = predicatesFromProperties([PROPERTY_ELECTRONEGATIVITY]);
    expect(result).toHaveLength(1);
    const pred = result[0];
    expect(pred.id).toBe('element.electronegativity');
    expect(pred.namespace).toBe('element');
    expect(pred.role).toBe('goal');
    expect(pred.positional_args).toHaveLength(1);
    expect(pred.positional_args[0].type).toBe('ElementRef');
    expect(pred.source).toEqual({ kind: 'property', property_id: 'electronegativity' });
  });

  it('generates substance.pKa from property with object="substance"', () => {
    const result = predicatesFromProperties([PROPERTY_PKA]);
    expect(result).toHaveLength(1);
    const pred = result[0];
    expect(pred.id).toBe('substance.pKa');
    expect(pred.namespace).toBe('substance');
    expect(pred.positional_args[0].type).toBe('SubstanceRef');
    expect(pred.source).toEqual({ kind: 'property', property_id: 'pKa' });
  });

  it('generates ion.ion_charge from property with object="ion"', () => {
    const ionProp = { id: 'ion_charge', object: 'ion', unit: 'e' };
    const result = predicatesFromProperties([ionProp]);
    expect(result[0].id).toBe('ion.ion_charge');
    expect(result[0].positional_args[0].type).toBe('IonRef');
  });

  it('skips entries missing id or object', () => {
    const bad = [
      { id: 'foo' },        // missing object
      { object: 'element' }, // missing id
      { id: 'bar', object: 'element' }, // valid
    ];
    const result = predicatesFromProperties(bad);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('element.bar');
  });

  it('sets temporal_kind to static', () => {
    const result = predicatesFromProperties([PROPERTY_ELECTRONEGATIVITY]);
    expect(result[0].temporal_kind).toBe('static');
  });
});

// ── predicatesFromFormulas ────────────────────────────────────────────────────

describe('predicatesFromFormulas', () => {
  it('deduplicates by quantity ref — q:mass appears in multiple formulas → one predicate', () => {
    // Both formulas have q:mass as variable — result should have only one quantity.mass
    const formulaB = {
      id: 'formula:density_from_mass_volume',
      domain: 'general',
      variables: [
        { symbol: 'rho', quantity: 'q:density', role: 'result' },
        { symbol: 'm', quantity: 'q:mass', unit: 'unit:g', role: 'input' }, // duplicate q:mass
        { symbol: 'V', quantity: 'q:volume', unit: 'unit:L', role: 'input' },
      ],
      result_variable: 'rho',
      invertible_for: [],
    };

    const result = predicatesFromFormulas([FORMULA_AMOUNT_FROM_MASS, formulaB]);
    const massPreds = result.filter((p) => p.id === 'quantity.mass');
    expect(massPreds).toHaveLength(1);
  });

  it('generates quantity.mass from formula variable with q:mass', () => {
    const result = predicatesFromFormulas([FORMULA_AMOUNT_FROM_MASS]);
    const massPred = result.find((p) => p.id === 'quantity.mass');
    expect(massPred).toBeDefined();
    expect(massPred!.namespace).toBe('quantity');
    expect(massPred!.role).toBe('goal');
    expect(massPred!.source.kind).toBe('formula_variable');
    expect(massPred!.source.formula_id).toBe('formula:amount_from_mass');
  });

  it('generates quantity.amount and quantity.molar_mass from formula', () => {
    const result = predicatesFromFormulas([FORMULA_AMOUNT_FROM_MASS]);
    const ids = result.map((p) => p.id);
    expect(ids).toContain('quantity.amount');
    expect(ids).toContain('quantity.molar_mass');
  });

  it('skips index role variables (q:atom_count not emitted as standalone predicate)', () => {
    const result = predicatesFromFormulas([FORMULA_MOLAR_MASS_FROM_COMPOSITION]);
    const atomCountPred = result.find((p) => p.id === 'quantity.atom_count');
    expect(atomCountPred).toBeUndefined();
  });

  it('skips variables without q: prefix', () => {
    const formula = {
      id: 'formula:test',
      variables: [
        { symbol: 'x', quantity: 'custom_quantity', role: 'input' },
      ],
    };
    const result = predicatesFromFormulas([formula]);
    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty formulas', () => {
    expect(predicatesFromFormulas([])).toEqual([]);
  });
});

// ── predicatesFromConcepts ────────────────────────────────────────────────────

describe('predicatesFromConcepts', () => {
  it('generates substance.class from substance_class concepts', () => {
    const result = predicatesFromConcepts(CONCEPTS_FIXTURE);
    const classPred = result.find((p) => p.id === 'substance.class');
    expect(classPred).toBeDefined();
    expect(classPred!.namespace).toBe('substance');
    expect(classPred!.returns).toBe('categorical:substance_class');
    expect(classPred!.positional_args[0].type).toBe('SubstanceRef');
    expect(classPred!.source).toEqual({ kind: 'concept', concept_id: 'substance_class' });
  });

  it('generates reaction.type from reaction_type concepts', () => {
    const result = predicatesFromConcepts(CONCEPTS_FIXTURE);
    const typePred = result.find((p) => p.id === 'reaction.type');
    expect(typePred).toBeDefined();
    expect(typePred!.namespace).toBe('reaction');
    expect(typePred!.returns).toBe('categorical:reaction_type');
    expect(typePred!.positional_args[0].type).toBe('ReactionRef');
    expect(typePred!.source).toEqual({ kind: 'concept', concept_id: 'reaction_type' });
  });

  it('emits only one predicate per kind even if multiple entries share that kind', () => {
    // CONCEPTS_FIXTURE has 2 substance_class entries and 2 reaction_type entries
    const result = predicatesFromConcepts(CONCEPTS_FIXTURE);
    const classPreds = result.filter((p) => p.id === 'substance.class');
    const typePreds = result.filter((p) => p.id === 'reaction.type');
    expect(classPreds).toHaveLength(1);
    expect(typePreds).toHaveLength(1);
  });

  it('generates reaction.observation from reaction_facet concepts', () => {
    const result = predicatesFromConcepts(CONCEPTS_FIXTURE);
    const obsPred = result.find((p) => p.id === 'reaction.observation');
    expect(obsPred).toBeDefined();
    expect(obsPred!.returns).toBe('categorical:observation');
    expect(obsPred!.temporal_kind).toBe('observable');
  });

  it('ignores unmapped concept kinds (domain_concept, element_group, property)', () => {
    const result = predicatesFromConcepts(CONCEPTS_FIXTURE);
    // domain_concept should not produce a predicate
    const domainPreds = result.filter((p) => p.source?.concept_id === 'domain_concept');
    expect(domainPreds).toHaveLength(0);
  });

  it('returns empty array for empty concepts object', () => {
    expect(predicatesFromConcepts({})).toEqual([]);
  });
});

// ── constructorPredicates ─────────────────────────────────────────────────────

describe('constructorPredicates', () => {
  it('returns exactly 3 entries', () => {
    const ctors = constructorPredicates();
    expect(ctors).toHaveLength(3);
  });

  it('all 3 have role="context"', () => {
    const ctors = constructorPredicates();
    for (const ctor of ctors) {
      expect(ctor.role).toBe('context');
    }
  });

  it('includes ctor.solution with positional substance arg', () => {
    const ctors = constructorPredicates();
    const solution = ctors.find((c) => c.id === 'ctor.solution');
    expect(solution).toBeDefined();
    expect(solution!.positional_args).toHaveLength(1);
    expect(solution!.positional_args[0].name).toBe('substance');
    expect(solution!.positional_args[0].type).toBe('SubstanceRef');
  });

  it('ctor.solution has mass_fraction, concentration, mass as optional named args', () => {
    const solution = constructorPredicates().find((c) => c.id === 'ctor.solution');
    const namedNames = solution!.named_args.map((a: { name: string }) => a.name);
    expect(namedNames).toContain('mass_fraction');
    expect(namedNames).toContain('concentration');
    expect(namedNames).toContain('mass');
    for (const arg of solution!.named_args) {
      expect(arg.optional).toBe(true);
    }
  });

  it('includes ctor.mixture with components named arg (required)', () => {
    const mixture = constructorPredicates().find((c) => c.id === 'ctor.mixture');
    expect(mixture).toBeDefined();
    expect(mixture!.positional_args).toHaveLength(0);
    const components = mixture!.named_args.find((a: { name: string }) => a.name === 'components');
    expect(components).toBeDefined();
    expect(components!.optional).toBe(false);
    expect(components!.type).toBe('Expr[]');
  });

  it('includes ctor.env with optional t and p named args', () => {
    const env = constructorPredicates().find((c) => c.id === 'ctor.env');
    expect(env).toBeDefined();
    const t = env!.named_args.find((a: { name: string }) => a.name === 't');
    const p = env!.named_args.find((a: { name: string }) => a.name === 'p');
    expect(t?.optional).toBe(true);
    expect(p?.optional).toBe(true);
  });

  it('all 3 have localized aliases for ru/en/pl/es', () => {
    const ctors = constructorPredicates();
    for (const ctor of ctors) {
      expect(ctor.aliases).toHaveProperty('ru');
      expect(ctor.aliases).toHaveProperty('en');
      expect(ctor.aliases).toHaveProperty('pl');
      expect(ctor.aliases).toHaveProperty('es');
    }
  });

  it('has namespace "ctor" for all 3', () => {
    for (const ctor of constructorPredicates()) {
      expect(ctor.namespace).toBe('ctor');
    }
  });
});

// ── mergePredicates ───────────────────────────────────────────────────────────

describe('mergePredicates', () => {
  const gen1 = {
    id: 'quantity.mass',
    namespace: 'quantity',
    role: 'goal',
    source: { kind: 'formula_variable' },
  };
  const gen2 = {
    id: 'element.electronegativity',
    namespace: 'element',
    role: 'goal',
    source: { kind: 'property' },
  };
  const override1 = {
    id: 'quantity.mass',   // same id as gen1 — override should win
    namespace: 'quantity',
    role: 'fact',          // different role — override value
    source: { kind: 'manual' },
  };
  const override2 = {
    id: 'substance.class',
    namespace: 'substance',
    role: 'goal',
    source: { kind: 'manual' },
  };

  it('overrides win on id collision', () => {
    const merged = mergePredicates([gen1, gen2], [override1, override2]);
    const massPred = merged.filter((p) => p.id === 'quantity.mass');
    expect(massPred).toHaveLength(1);
    expect(massPred[0].role).toBe('fact');       // override value, not generated
    expect(massPred[0].source.kind).toBe('manual');
  });

  it('unique generated entries survive when no override conflicts', () => {
    const merged = mergePredicates([gen1, gen2], [override1, override2]);
    expect(merged.some((p) => p.id === 'element.electronegativity')).toBe(true);
  });

  it('unique override entries are included', () => {
    const merged = mergePredicates([gen1, gen2], [override1, override2]);
    expect(merged.some((p) => p.id === 'substance.class')).toBe(true);
  });

  it('returns 3 entries (gen2 + override1 replacing gen1 + override2)', () => {
    const merged = mergePredicates([gen1, gen2], [override1, override2]);
    expect(merged).toHaveLength(3);
  });

  it('returns empty array for two empty inputs', () => {
    expect(mergePredicates([], [])).toEqual([]);
  });

  it('handles empty generated with non-empty overrides', () => {
    const merged = mergePredicates([], [override2]);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('substance.class');
  });

  it('handles non-empty generated with empty overrides', () => {
    const merged = mergePredicates([gen1, gen2], []);
    expect(merged).toHaveLength(2);
  });
});

// ── buildPredicateIndex ───────────────────────────────────────────────────────

describe('buildPredicateIndex', () => {
  it('groups predicates by namespace', () => {
    const predicates = [
      { id: 'quantity.mass', namespace: 'quantity' },
      { id: 'quantity.amount', namespace: 'quantity' },
      { id: 'element.electronegativity', namespace: 'element' },
    ];
    const index = buildPredicateIndex(predicates);
    expect(Object.keys(index)).toHaveLength(2);
    expect(index['quantity']).toHaveLength(2);
    expect(index['element']).toHaveLength(1);
  });

  it('returns empty object for empty input', () => {
    expect(buildPredicateIndex([])).toEqual({});
  });

  it('handles single entry', () => {
    const predicates = [{ id: 'substance.class', namespace: 'substance' }];
    const index = buildPredicateIndex(predicates);
    expect(index['substance']).toHaveLength(1);
    expect(index['substance'][0].id).toBe('substance.class');
  });

  it('handles predicates with no namespace (grouped under empty string)', () => {
    const predicates = [{ id: 'foo' }];
    const index = buildPredicateIndex(predicates);
    expect(index['']).toHaveLength(1);
  });
});
