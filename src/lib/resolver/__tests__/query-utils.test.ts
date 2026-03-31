import { describe, it, expect } from 'vitest';
import {
  computeFingerprint,
  unifyTarget,
  instantiatePattern,
  renderCanonical,
  suggestGivens,
} from '../query-utils.js';
import type {
  QueryExpr,
  CallExpr,
  SymbolExpr,
  ValueExpr,
  EqualityExpr,
} from '../../../types/query-ast.js';
import type { ResolutionDef } from '../../../types/resolution.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const naclSymbol: SymbolExpr = {
  kind: 'symbol',
  ref: { kind: 'substance', id: 'sub:nacl' },
};

const h2so4Symbol: SymbolExpr = {
  kind: 'symbol',
  ref: { kind: 'substance', id: 'sub:h2so4' },
};

const feSymbol: SymbolExpr = {
  kind: 'symbol',
  ref: { kind: 'element', id: 'fe' },
};

const cuSymbol: SymbolExpr = {
  kind: 'symbol',
  ref: { kind: 'element', id: 'cu' },
};

const massCallNacl: CallExpr = {
  kind: 'call',
  predicate: 'quantity.mass',
  args: [naclSymbol],
};

const amountCallNacl: CallExpr = {
  kind: 'call',
  predicate: 'quantity.amount',
  args: [naclSymbol],
};

const twoMolValue: ValueExpr = {
  kind: 'value',
  value: 2,
  unit: 'mol',
};

const amountGiven: EqualityExpr = {
  kind: 'equality',
  left: amountCallNacl,
  right: twoMolValue,
};

const deriveMassQuery: QueryExpr = {
  kind: 'query',
  id: 'q1',
  intent: 'derive',
  target: massCallNacl,
  givens: [amountGiven],
};

const findClassQuery: QueryExpr = {
  kind: 'query',
  id: 'q2',
  intent: 'find',
  target: {
    kind: 'call',
    predicate: 'substance.class',
    args: [h2so4Symbol],
  },
};

// ── computeFingerprint ────────────────────────────────────────────────────────

describe('computeFingerprint', () => {
  it('returns a string starting with fp_', () => {
    const fp = computeFingerprint(deriveMassQuery);
    expect(fp).toMatch(/^fp_[0-9a-f]{8}$/);
  });

  it('same query with different id → same fingerprint', () => {
    const q1: QueryExpr = { ...deriveMassQuery, id: 'query-aaa' };
    const q2: QueryExpr = { ...deriveMassQuery, id: 'query-zzz' };
    expect(computeFingerprint(q1)).toBe(computeFingerprint(q2));
  });

  it('same query with different meta → same fingerprint', () => {
    const q1: QueryExpr = {
      ...deriveMassQuery,
      id: 'x',
      meta: { origin: 'user' },
    };
    const q2: QueryExpr = {
      ...deriveMassQuery,
      id: 'x',
      meta: { origin: 'system', locale: 'en' },
    };
    expect(computeFingerprint(q1)).toBe(computeFingerprint(q2));
  });

  it('different targets → different fingerprints', () => {
    const fpDerive = computeFingerprint(deriveMassQuery);
    const fpFind = computeFingerprint(findClassQuery);
    expect(fpDerive).not.toBe(fpFind);
  });

  it('different givens → different fingerprints', () => {
    const noGivens: QueryExpr = { ...deriveMassQuery, givens: [] };
    const withGivens: QueryExpr = { ...deriveMassQuery, givens: [amountGiven] };
    expect(computeFingerprint(noGivens)).not.toBe(computeFingerprint(withGivens));
  });
});

// ── unifyTarget ───────────────────────────────────────────────────────────────

describe('unifyTarget', () => {
  it('unifies single-arg pattern', () => {
    const bindings = unifyTarget(massCallNacl, 'quantity.mass($entity)');
    expect(bindings).not.toBeNull();
    expect(bindings!['$entity']).toEqual(naclSymbol);
  });

  it('fails when predicate ids differ', () => {
    const result = unifyTarget(massCallNacl, 'quantity.amount($entity)');
    expect(result).toBeNull();
  });

  it('handles multi-arg pattern', () => {
    const bondCall: CallExpr = {
      kind: 'call',
      predicate: 'element.bond_type',
      args: [feSymbol, cuSymbol],
    };
    const bindings = unifyTarget(bondCall, 'element.bond_type($elementA, $elementB)');
    expect(bindings).not.toBeNull();
    expect(bindings!['$elementA']).toEqual(feSymbol);
    expect(bindings!['$elementB']).toEqual(cuSymbol);
  });

  it('returns null when arg count does not match pattern', () => {
    // pattern expects 1 arg, call has 0
    const zeroArgCall: CallExpr = {
      kind: 'call',
      predicate: 'quantity.mass',
      args: [],
    };
    const result = unifyTarget(zeroArgCall, 'quantity.mass($entity)');
    expect(result).toBeNull();
  });

  it('returns empty bindings for zero-arg pattern matching zero-arg call', () => {
    const call: CallExpr = {
      kind: 'call',
      predicate: 'system.ping',
      args: [],
    };
    const bindings = unifyTarget(call, 'system.ping()');
    expect(bindings).not.toBeNull();
    expect(Object.keys(bindings!)).toHaveLength(0);
  });

  it('returns null for malformed pattern', () => {
    const result = unifyTarget(massCallNacl, 'not-a-valid-pattern');
    expect(result).toBeNull();
  });
});

// ── instantiatePattern ────────────────────────────────────────────────────────

describe('instantiatePattern', () => {
  it('replaces $entity with substance symbol', () => {
    const bindings = { $entity: naclSymbol };
    const result = instantiatePattern('quantity.amount($entity)', bindings);
    expect(result).toBe('quantity.amount(substance:sub:nacl)');
  });

  it('handles multiple distinct variables', () => {
    const bindings: Record<string, SymbolExpr> = {
      $elementA: feSymbol,
      $elementB: cuSymbol,
    };
    const result = instantiatePattern(
      'element.bond_type($elementA, $elementB)',
      bindings
    );
    expect(result).toBe('element.bond_type(element:fe, element:cu)');
  });

  it('replaces value expression', () => {
    const bindings = { $amount: twoMolValue };
    const result = instantiatePattern('given.amount($amount)', bindings);
    expect(result).toBe('given.amount(2 mol)');
  });

  it('leaves pattern unchanged when no variables present', () => {
    const result = instantiatePattern('quantity.mass($entity)', {});
    expect(result).toBe('quantity.mass($entity)');
  });
});

// ── renderCanonical ───────────────────────────────────────────────────────────

describe('renderCanonical', () => {
  it('renders derive query with givens', () => {
    const rendered = renderCanonical(deriveMassQuery);
    expect(rendered).toBe(
      'derive(quantity.mass(substance:sub:nacl), given=[quantity.amount(substance:sub:nacl) = 2 mol])'
    );
  });

  it('renders find query without givens', () => {
    const rendered = renderCanonical(findClassQuery);
    expect(rendered).toBe('find(substance.class(substance:sub:h2so4))');
  });

  it('renders check query', () => {
    const checkQuery: QueryExpr = {
      kind: 'query',
      id: 'q3',
      intent: 'check',
      target: {
        kind: 'call',
        predicate: 'reaction.possible',
        args: [
          {
            kind: 'list',
            items: [naclSymbol, h2so4Symbol],
          },
        ],
      },
    };
    const rendered = renderCanonical(checkQuery);
    expect(rendered).toBe(
      'check(reaction.possible([substance:sub:nacl, substance:sub:h2so4]))'
    );
  });

  it('renders query with empty givens as no-given form', () => {
    const q: QueryExpr = { ...findClassQuery, givens: [] };
    const rendered = renderCanonical(q);
    expect(rendered).toBe('find(substance.class(substance:sub:h2so4))');
  });
});

// ── suggestGivens ─────────────────────────────────────────────────────────────

const massResolution: ResolutionDef = {
  id: 'res:formula.amount_from_mass',
  origin: 'generated_from_formula',
  target: 'quantity.mass',
  target_pattern: 'quantity.mass($entity)',
  kind: 'equation',
  prerequisites: ['quantity.amount($entity)', 'quantity.molar_mass($entity)'],
  cost: 100,
  uncertainty_mode: 'propagate',
};

const massResolutionAlt: ResolutionDef = {
  id: 'res:formula.mass_from_density',
  origin: 'generated_from_formula',
  target: 'quantity.mass',
  target_pattern: 'quantity.mass($entity)',
  kind: 'equation',
  prerequisites: ['quantity.volume($entity)', 'quantity.density($entity)'],
  cost: 200,
  uncertainty_mode: 'propagate',
};

const resolutionIndex: Record<string, ResolutionDef[]> = {
  'quantity.mass': [massResolution, massResolutionAlt],
};

describe('suggestGivens', () => {
  it('returns prerequisites of best (lowest-cost) resolution', () => {
    const suggestions = suggestGivens('quantity.mass', resolutionIndex);
    expect(suggestions).toHaveLength(2);
    const predicates = suggestions.map((s) => s.predicate);
    expect(predicates).toContain('quantity.amount');
    expect(predicates).toContain('quantity.molar_mass');
  });

  it('marks quantity.amount as likely_given', () => {
    const suggestions = suggestGivens('quantity.mass', resolutionIndex);
    const amountSug = suggestions.find((s) => s.predicate === 'quantity.amount');
    expect(amountSug?.suggestion_kind).toBe('likely_given');
  });

  it('marks quantity.molar_mass as usually_derived', () => {
    const suggestions = suggestGivens('quantity.mass', resolutionIndex);
    const mmSug = suggestions.find((s) => s.predicate === 'quantity.molar_mass');
    expect(mmSug?.suggestion_kind).toBe('usually_derived');
  });

  it('returns empty array for unknown predicate', () => {
    const suggestions = suggestGivens('unknown.predicate', resolutionIndex);
    expect(suggestions).toEqual([]);
  });

  it('includes pattern string for each suggestion', () => {
    const suggestions = suggestGivens('quantity.mass', resolutionIndex);
    for (const s of suggestions) {
      expect(s.pattern).toBeTruthy();
      expect(s.pattern).toContain(s.predicate);
    }
  });

  it('marks quantity.volume as likely_given', () => {
    // alt resolution (cost=200 not picked, but test with dedicated index)
    const idx: Record<string, ResolutionDef[]> = {
      'quantity.density': [
        {
          id: 'res:density',
          origin: 'generated_from_formula',
          target: 'quantity.density',
          target_pattern: 'quantity.density($entity)',
          kind: 'equation',
          prerequisites: ['quantity.mass($entity)', 'quantity.volume($entity)'],
          cost: 100,
          uncertainty_mode: 'propagate',
        },
      ],
    };
    const suggestions = suggestGivens('quantity.density', idx);
    const volSug = suggestions.find((s) => s.predicate === 'quantity.volume');
    expect(volSug?.suggestion_kind).toBe('likely_given');
  });

  it('marks unknown prerequisite predicate as optional', () => {
    const idx: Record<string, ResolutionDef[]> = {
      'some.target': [
        {
          id: 'res:some',
          origin: 'manual',
          target: 'some.target',
          target_pattern: 'some.target($x)',
          kind: 'rule',
          prerequisites: ['exotic.prerequisite($x)'],
          cost: 50,
          uncertainty_mode: 'exact',
        },
      ],
    };
    const suggestions = suggestGivens('some.target', idx);
    expect(suggestions[0].suggestion_kind).toBe('optional');
  });
});
