import { describe, it, expect } from 'vitest';
import {
  quantityToPredicate,
  serializeExpr,
  isDenominator,
  generateResolutionsFromFormulas,
  mergeResolutions,
  buildResolutionIndex,
} from '../../../../scripts/lib/generate-resolutions.mjs';

// ── Fixture: formula:amount_from_mass ────────────────────────────────────────

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
  inversions: {
    m: { op: 'multiply', operands: ['n', 'M'] },
    M: { op: 'divide', operands: ['m', 'n'] },
  },
};

// ── quantityToPredicate ───────────────────────────────────────────────────────

describe('quantityToPredicate', () => {
  it('converts q:mass to quantity.mass', () => {
    expect(quantityToPredicate('q:mass')).toBe('quantity.mass');
  });

  it('converts q:molar_mass to quantity.molar_mass', () => {
    expect(quantityToPredicate('q:molar_mass')).toBe('quantity.molar_mass');
  });

  it('converts q:amount to quantity.amount', () => {
    expect(quantityToPredicate('q:amount')).toBe('quantity.amount');
  });

  it('converts q:molar_concentration to quantity.molar_concentration', () => {
    expect(quantityToPredicate('q:molar_concentration')).toBe('quantity.molar_concentration');
  });

  it('returns empty string for falsy input', () => {
    expect(quantityToPredicate('')).toBe('');
  });

  it('passes through non-q: prefixed strings unchanged', () => {
    expect(quantityToPredicate('quantity.mass')).toBe('quantity.mass');
  });
});

// ── serializeExpr ─────────────────────────────────────────────────────────────

describe('serializeExpr', () => {
  const varMap = new Map([
    ['m', 'quantity.mass($entity)'],
    ['M', 'quantity.molar_mass($entity)'],
    ['n', 'quantity.amount($entity)'],
  ]);

  it('serializes a simple divide node', () => {
    const expr = { op: 'divide', operands: ['m', 'M'] };
    expect(serializeExpr(expr, varMap)).toBe(
      'divide(quantity.mass($entity), quantity.molar_mass($entity))'
    );
  });

  it('serializes a simple multiply node', () => {
    const expr = { op: 'multiply', operands: ['n', 'M'] };
    expect(serializeExpr(expr, varMap)).toBe(
      'multiply(quantity.amount($entity), quantity.molar_mass($entity))'
    );
  });

  it('serializes a literal node', () => {
    const expr = { op: 'literal', value: 100 };
    expect(serializeExpr(expr, varMap)).toBe('100');
  });

  it('serializes a const node', () => {
    const expr = { op: 'const', ref: 'const:N_A' };
    expect(serializeExpr(expr, varMap)).toBe('const:N_A');
  });

  it('serializes a nested subtract node', () => {
    const expr = { op: 'subtract', operands: ['m', 'n'] };
    expect(serializeExpr(expr, varMap)).toBe(
      'subtract(quantity.mass($entity), quantity.amount($entity))'
    );
  });

  it('serializes a power node', () => {
    const expr = { op: 'power', operands: ['n', 2] };
    expect(serializeExpr(expr, varMap)).toBe('power(quantity.amount($entity), 2)');
  });

  it('serializes a log10 node', () => {
    const expr = { op: 'log10', operand: 'm' };
    expect(serializeExpr(expr, varMap)).toBe('log10(quantity.mass($entity))');
  });

  it('serializes a sum node', () => {
    const expr = {
      op: 'sum',
      over: 'i',
      index_set: 'composition_elements',
      term: { op: 'multiply', operands: ['m', 'n'] },
    };
    expect(serializeExpr(expr, varMap)).toBe(
      'sum(over=i, index_set=composition_elements, term=multiply(quantity.mass($entity), quantity.amount($entity)))'
    );
  });

  it('falls back to symbol name for unknown variable', () => {
    const expr = 'unknown_sym';
    expect(serializeExpr(expr, varMap)).toBe('unknown_sym');
  });

  it('returns numeric string for number input', () => {
    expect(serializeExpr(2, varMap)).toBe('2');
  });
});

// ── isDenominator ─────────────────────────────────────────────────────────────

describe('isDenominator', () => {
  it('detects direct variable in denominator position', () => {
    const expr = { op: 'divide', operands: ['m', 'M'] };
    expect(isDenominator(expr, 'M')).toBe(true);
  });

  it('returns false for variable in numerator position', () => {
    const expr = { op: 'divide', operands: ['m', 'M'] };
    expect(isDenominator(expr, 'm')).toBe(false);
  });

  it('detects variable in nested denominator', () => {
    // divide(a, divide(b, c)) — c is in denominator of inner divide
    const expr = {
      op: 'divide',
      operands: ['a', { op: 'divide', operands: ['b', 'c'] }],
    };
    expect(isDenominator(expr, 'c')).toBe(true);
  });

  it('returns false for multiply (no denominator)', () => {
    const expr = { op: 'multiply', operands: ['m', 'M'] };
    expect(isDenominator(expr, 'M')).toBe(false);
  });

  it('returns false for non-object node', () => {
    expect(isDenominator('m', 'm')).toBe(false);
    expect(isDenominator(null, 'm')).toBe(false);
  });

  it('detects denominator in inverse expression divide(m, n)', () => {
    // M inversion: divide(m, n) — n is denominator
    const expr = { op: 'divide', operands: ['m', 'n'] };
    expect(isDenominator(expr, 'n')).toBe(true);
    expect(isDenominator(expr, 'm')).toBe(false);
  });
});

// ── generateResolutionsFromFormulas ───────────────────────────────────────────

describe('generateResolutionsFromFormulas — formula:amount_from_mass', () => {
  const resolutions = generateResolutionsFromFormulas([FORMULA_AMOUNT_FROM_MASS]);

  it('generates 3 resolutions (1 forward + 2 inverse)', () => {
    expect(resolutions).toHaveLength(3);
  });

  describe('forward resolution', () => {
    const fwd = resolutions.find((r) => r.solve_for === 'n');

    it('exists', () => {
      expect(fwd).toBeDefined();
    });

    it('has correct id', () => {
      expect(fwd!.id).toBe('res:formula.amount_from_mass');
    });

    it('has target = quantity.amount', () => {
      expect(fwd!.target).toBe('quantity.amount');
    });

    it('has target_pattern = quantity.amount($entity)', () => {
      expect(fwd!.target_pattern).toBe('quantity.amount($entity)');
    });

    it('has prerequisites: mass and molar_mass', () => {
      expect(fwd!.prerequisites).toEqual([
        'quantity.mass($entity)',
        'quantity.molar_mass($entity)',
      ]);
    });

    it('has formula_id = formula:amount_from_mass', () => {
      expect(fwd!.formula_id).toBe('formula:amount_from_mass');
    });

    it('has family = stoichiometry', () => {
      expect(fwd!.family).toBe('stoichiometry');
    });

    it('has solve_for = n', () => {
      expect(fwd!.solve_for).toBe('n');
    });

    it('has origin = generated_from_formula', () => {
      expect(fwd!.origin).toBe('generated_from_formula');
    });

    it('has origin_ref = formula:amount_from_mass', () => {
      expect(fwd!.origin_ref).toBe('formula:amount_from_mass');
    });

    it('has cost = 100', () => {
      expect(fwd!.cost).toBe(100);
    });

    it('has uncertainty_mode = propagate (no approximation)', () => {
      expect(fwd!.uncertainty_mode).toBe('propagate');
    });

    it('has kind = equation', () => {
      expect(fwd!.kind).toBe('equation');
    });

    it('has compute_expr_serialized with divide', () => {
      expect(fwd!.compute_expr_serialized).toBe(
        'divide(quantity.mass($entity), quantity.molar_mass($entity))'
      );
    });

    it('has precondition: M != 0 (M is denominator)', () => {
      expect(fwd!.preconditions).toContain('quantity.molar_mass($entity) != 0');
    });
  });

  describe('inverse resolution for m (mass)', () => {
    const inv = resolutions.find((r) => r.solve_for === 'm');

    it('exists', () => {
      expect(inv).toBeDefined();
    });

    it('has correct id', () => {
      expect(inv!.id).toBe('res:formula.amount_from_mass.inv.m');
    });

    it('has target = quantity.mass', () => {
      expect(inv!.target).toBe('quantity.mass');
    });

    it('has target_pattern = quantity.mass($entity)', () => {
      expect(inv!.target_pattern).toBe('quantity.mass($entity)');
    });

    it('includes result variable (amount) as prerequisite', () => {
      expect(inv!.prerequisites).toContain('quantity.amount($entity)');
    });

    it('includes molar_mass as prerequisite', () => {
      expect(inv!.prerequisites).toContain('quantity.molar_mass($entity)');
    });

    it('has cost = 110', () => {
      expect(inv!.cost).toBe(110);
    });

    it('has compute_expr_serialized: multiply(n, M)', () => {
      expect(inv!.compute_expr_serialized).toBe(
        'multiply(quantity.amount($entity), quantity.molar_mass($entity))'
      );
    });

    it('has no preconditions (multiply has no denominator)', () => {
      expect(inv!.preconditions ?? []).toHaveLength(0);
    });
  });

  describe('inverse resolution for M (molar_mass)', () => {
    const inv = resolutions.find((r) => r.solve_for === 'M');

    it('exists', () => {
      expect(inv).toBeDefined();
    });

    it('has correct id', () => {
      expect(inv!.id).toBe('res:formula.amount_from_mass.inv.M');
    });

    it('has target = quantity.molar_mass', () => {
      expect(inv!.target).toBe('quantity.molar_mass');
    });

    it('includes amount and mass as prerequisites', () => {
      expect(inv!.prerequisites).toContain('quantity.amount($entity)');
      expect(inv!.prerequisites).toContain('quantity.mass($entity)');
    });

    it('has precondition: n != 0 (n is denominator in divide(m, n))', () => {
      expect(inv!.preconditions).toContain('quantity.amount($entity) != 0');
    });

    it('has compute_expr_serialized: divide(m, n)', () => {
      expect(inv!.compute_expr_serialized).toBe(
        'divide(quantity.mass($entity), quantity.amount($entity))'
      );
    });
  });
});

// ── generateResolutionsFromFormulas — approximation formulas ─────────────────

describe('generateResolutionsFromFormulas — formula with approximation', () => {
  const formula = {
    id: 'formula:radius_proxy',
    domain: 'atomic_structure',
    variables: [
      { symbol: 'r_proxy', quantity: 'q:atomic_radius_proxy', role: 'result' },
      { symbol: 'n', quantity: 'q:principal_quantum_number', role: 'input' },
      { symbol: 'Z_eff', quantity: 'q:effective_nuclear_charge', role: 'input' },
    ],
    expression: {
      op: 'divide',
      operands: [{ op: 'power', operands: ['n', 2] }, 'Z_eff'],
    },
    result_variable: 'r_proxy',
    invertible_for: [],
    inversions: {},
    approximation: { kind: 'approximate', proxy_for: 'q:atomic_radius' },
  };

  const resolutions = generateResolutionsFromFormulas([formula]);

  it('generates 1 resolution (forward only)', () => {
    expect(resolutions).toHaveLength(1);
  });

  it('has uncertainty_mode = model_limited', () => {
    expect(resolutions[0].uncertainty_mode).toBe('model_limited');
  });

  it('has approximation_kind = approximate', () => {
    expect(resolutions[0].approximation_kind).toBe('approximate');
  });
});

// ── generateResolutionsFromFormulas — index variables excluded ────────────────

describe('generateResolutionsFromFormulas — index and constant variable roles', () => {
  const formula = {
    id: 'formula:molar_mass_from_composition',
    domain: 'stoichiometry',
    variables: [
      { symbol: 'M', quantity: 'q:molar_mass', role: 'result' },
      { symbol: 'Ar_i', quantity: 'q:relative_atomic_mass', role: 'input' },
      { symbol: 'count_i', quantity: 'q:atom_count', role: 'index' },
    ],
    expression: {
      op: 'sum',
      over: 'i',
      index_set: 'composition_elements',
      term: { op: 'multiply', operands: ['Ar_i', 'count_i'] },
    },
    result_variable: 'M',
    invertible_for: [],
    inversions: {},
  };

  const resolutions = generateResolutionsFromFormulas([formula]);

  it('generates 1 forward resolution', () => {
    expect(resolutions).toHaveLength(1);
  });

  it('prerequisites include only input variables (not index)', () => {
    expect(resolutions[0].prerequisites).toContain('quantity.relative_atomic_mass($entity)');
    // index variable should NOT appear as standalone prerequisite
    expect(resolutions[0].prerequisites).not.toContain('quantity.atom_count($entity)');
  });
});

// ── mergeResolutions ──────────────────────────────────────────────────────────

describe('mergeResolutions', () => {
  const gen1 = {
    id: 'res:formula.amount_from_mass',
    target: 'quantity.amount',
    cost: 100,
    origin: 'generated_from_formula' as const,
  };
  const gen2 = {
    id: 'res:formula.density',
    target: 'quantity.density',
    cost: 100,
    origin: 'generated_from_formula' as const,
  };
  const manual1 = {
    id: 'res:formula.amount_from_mass', // duplicate id
    target: 'quantity.amount',
    cost: 50,
    origin: 'manual' as const,
  };
  const manual2 = {
    id: 'res:substance.class',
    target: 'substance.class',
    cost: 50,
    origin: 'manual' as const,
  };

  it('deduplicates by id — first entry wins (generated)', () => {
    const merged = mergeResolutions([gen1, gen2], [manual1, manual2]);
    const amountRes = merged.filter((r) => r.id === 'res:formula.amount_from_mass');
    expect(amountRes).toHaveLength(1);
    expect(amountRes[0].origin).toBe('generated_from_formula');
    expect(amountRes[0].cost).toBe(100);
  });

  it('includes unique manual entries', () => {
    const merged = mergeResolutions([gen1, gen2], [manual1, manual2]);
    expect(merged.some((r) => r.id === 'res:substance.class')).toBe(true);
  });

  it('sorts by target ASC then cost ASC', () => {
    const a = { id: 'a', target: 'z.foo', cost: 200, origin: 'manual' as const };
    const b = { id: 'b', target: 'a.bar', cost: 100, origin: 'manual' as const };
    const c = { id: 'c', target: 'a.bar', cost: 50, origin: 'manual' as const };
    const merged = mergeResolutions([a, b], [c]);
    expect(merged[0].id).toBe('c'); // a.bar cost=50
    expect(merged[1].id).toBe('b'); // a.bar cost=100
    expect(merged[2].id).toBe('a'); // z.foo cost=200
  });

  it('returns empty array for two empty inputs', () => {
    expect(mergeResolutions([], [])).toEqual([]);
  });

  it('handles empty generated with non-empty manual', () => {
    const merged = mergeResolutions([], [manual2]);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('res:substance.class');
  });
});

// ── buildResolutionIndex ──────────────────────────────────────────────────────

describe('buildResolutionIndex', () => {
  it('groups resolutions by target', () => {
    const resolutions = [
      { id: 'a', target: 'quantity.mass', cost: 100 },
      { id: 'b', target: 'quantity.mass', cost: 110 },
      { id: 'c', target: 'quantity.amount', cost: 100 },
    ];
    const index = buildResolutionIndex(resolutions);
    expect(Object.keys(index)).toHaveLength(2);
    expect(index['quantity.mass']).toHaveLength(2);
    expect(index['quantity.amount']).toHaveLength(1);
  });

  it('returns empty object for empty input', () => {
    expect(buildResolutionIndex([])).toEqual({});
  });

  it('groups correctly for single entry', () => {
    const res = [{ id: 'x', target: 'substance.class', cost: 50 }];
    const index = buildResolutionIndex(res);
    expect(index['substance.class']).toHaveLength(1);
    expect(index['substance.class'][0].id).toBe('x');
  });
});
