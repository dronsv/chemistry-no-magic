import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { toConstantsDict, evaluateFormula, solveFor as formulaSolveFor } from '../formula-evaluator';
import { parseFormula } from '../formula-parser';
import type { ComputableFormula, PhysicalConstant } from '../../types/formula';
import type { Element } from '../../types/element';
import type { QRef, ReasonStep } from '../../types/derivation';
import type { OntologyAccess } from '../derivation/resolvers';
import { deriveQuantity } from '../derivation/derive-quantity';

// ── Data setup (same pattern as derive-quantity.test.ts) ─────────

const DATA_DIR = join(import.meta.dirname, '../../../data-src');
const formulas: ComputableFormula[] = JSON.parse(
  readFileSync(join(DATA_DIR, 'foundations/formulas.json'), 'utf8'),
);
const constants = toConstantsDict(
  JSON.parse(readFileSync(join(DATA_DIR, 'foundations/constants.json'), 'utf8')) as PhysicalConstant[],
);
const elements: Element[] = JSON.parse(
  readFileSync(join(DATA_DIR, 'elements.json'), 'utf8'),
);

const entityFormulas = new Map<string, string>([
  ['substance:H2SO4', 'H2SO4'],
  ['substance:H2O', 'H2O'],
  ['substance:NaCl', 'NaCl'],
  ['substance:BaSO4', 'BaSO4'],
  ['substance:BaCl2', 'BaCl2'],
  ['substance:HCl', 'HCl'],
]);

const ontology: OntologyAccess = { elements, parseFormula, entityFormulas };

function traceStepsOfType<T extends ReasonStep['type']>(
  trace: ReasonStep[],
  type: T,
): Array<Extract<ReasonStep, { type: T }>> {
  return trace.filter((s): s is Extract<ReasonStep, { type: T }> => s.type === type);
}

// ── Helper unit tests ────────────────────────────────────────────

import {
  deriveAmountForRole,
  deriveStoichiometricAmount,
  deriveMassForRole,
  applyYield,
  deriveYield,
} from '../derivation/stoichiometry-helpers';

describe('stoichiometry helper units', () => {
  describe('deriveAmountForRole', () => {
    it('n = m/M for reactant', () => {
      const trace: ReasonStep[] = [];
      const result = deriveAmountForRole({
        role: 'reactant',
        mass: 9.8,
        M: 98,
        formulas,
        constants,
        ontology,
        trace,
      });
      expect(result.value).toBeCloseTo(0.1, 5);
      expect(result.qref.quantity).toBe('q:amount');
      expect(result.qref.role).toBe('reactant');
    });

    it('n = m/M for product', () => {
      const trace: ReasonStep[] = [];
      const result = deriveAmountForRole({
        role: 'product',
        mass: 233,
        M: 233,
        formulas,
        constants,
        ontology,
        trace,
      });
      expect(result.value).toBeCloseTo(1.0, 5);
      expect(result.qref.role).toBe('product');
    });

    it('auto-derives M from entity_ref when M not provided', () => {
      const trace: ReasonStep[] = [];
      const result = deriveAmountForRole({
        role: 'reactant',
        mass: 98.08,
        entityRef: 'substance:H2SO4',
        formulas,
        constants,
        ontology,
        trace,
      });
      expect(result.value).toBeCloseTo(1.0, 1);
      // Trace should contain decompose + lookup steps from M derivation
      expect(trace.some(s => s.type === 'decompose')).toBe(true);
      expect(trace.some(s => s.type === 'lookup')).toBe(true);
    });
  });

  describe('deriveStoichiometricAmount', () => {
    it('forward: reactant → product (n₂ = n₁ × ν₂/ν₁)', () => {
      const trace: ReasonStep[] = [];
      const result = deriveStoichiometricAmount({
        n_from: 0.1,
        nu_from: 1,
        nu_to: 2,
        fromRole: 'reactant',
        toRole: 'product',
        formulas,
        constants,
        trace,
      });
      expect(result.value).toBeCloseTo(0.2, 5);
      expect(result.qref.quantity).toBe('q:amount');
      expect(result.qref.role).toBe('product');
    });

    it('reverse: product → reactant (n₁ via inversion)', () => {
      const trace: ReasonStep[] = [];
      const result = deriveStoichiometricAmount({
        n_from: 0.2,
        nu_from: 2,
        nu_to: 1,
        fromRole: 'product',
        toRole: 'reactant',
        formulas,
        constants,
        trace,
      });
      expect(result.value).toBeCloseTo(0.1, 5);
      expect(result.qref.role).toBe('reactant');
    });
  });

  describe('deriveMassForRole', () => {
    it('m = n × M for product', () => {
      const trace: ReasonStep[] = [];
      const result = deriveMassForRole({
        role: 'product',
        n: 0.05,
        M: 233.39,
        formulas,
        constants,
        ontology,
        trace,
      });
      expect(result.value).toBeCloseTo(11.67, 1);
      expect(result.qref.quantity).toBe('q:mass');
      expect(result.qref.role).toBe('product');
    });

    it('auto-derives M from entity_ref when M not provided', () => {
      const trace: ReasonStep[] = [];
      const result = deriveMassForRole({
        role: 'product',
        n: 1.0,
        entityRef: 'substance:H2O',
        formulas,
        constants,
        ontology,
        trace,
      });
      expect(result.value).toBeCloseTo(18.015, 0);
    });
  });

  describe('applyYield', () => {
    it('m_actual = (η/100) × m_theoretical', () => {
      const trace: ReasonStep[] = [];
      const result = applyYield({
        m_theoretical: 46.6,
        eta: 85,
        formulas,
        constants,
        trace,
      });
      expect(result.value).toBeCloseTo(39.61, 1);
      expect(result.qref.quantity).toBe('q:mass');
      expect(result.qref.role).toBe('product');
    });

    it('appends formula_select + substitution + compute to trace', () => {
      const trace: ReasonStep[] = [];
      applyYield({
        m_theoretical: 100,
        eta: 80,
        formulas,
        constants,
        trace,
      });
      expect(trace.some(s => s.type === 'formula_select')).toBe(true);
      expect(trace.some(s => s.type === 'compute')).toBe(true);
    });
  });

  describe('deriveYield', () => {
    it('η = (m_actual / m_theoretical) × 100', () => {
      const trace: ReasonStep[] = [];
      const result = deriveYield({
        m_actual: 39.61,
        m_theoretical: 46.6,
        formulas,
        constants,
        trace,
      });
      expect(result.value).toBeCloseTo(85, 0);
      expect(result.qref.quantity).toBe('q:yield');
      expect(result.qref.role).toBeUndefined();
    });
  });
});

// ── Integration tests via deriveQuantity() ───────────────────────

describe('deriveQuantity stoichiometry', () => {
  // H₂SO₄ + BaCl₂ → BaSO₄ + 2HCl  (coefficients: 1,1,1,2)
  // M(H2SO4) ≈ 98.08, M(BaSO4) ≈ 233.39

  function stoichKnowns(overrides?: Record<string, unknown>) {
    const givenEntityRef = 'substance:H2SO4';
    const findEntityRef = 'substance:BaSO4';
    const defaults: Array<{ qref: QRef; value: number }> = [
      { qref: { quantity: 'q:mass', role: 'reactant' }, value: 9.8 },
      { qref: { quantity: 'q:stoich_coeff', role: 'reactant' }, value: 1 },
      { qref: { quantity: 'q:molar_mass', role: 'reactant', context: { system_type: 'substance', entity_ref: givenEntityRef } }, value: 98.08 },
      { qref: { quantity: 'q:stoich_coeff', role: 'product' }, value: 1 },
      { qref: { quantity: 'q:molar_mass', role: 'product', context: { system_type: 'substance', entity_ref: findEntityRef } }, value: 233.39 },
    ];
    return defaults;
  }

  it('S1: mass→mass (reactant → product)', () => {
    const result = deriveQuantity({
      target: { quantity: 'q:mass', role: 'product' },
      knowns: stoichKnowns(),
      formulas, constants, ontology,
    });
    // n = 9.8/98.08 ≈ 0.0999, m = 0.0999 * 233.39 ≈ 23.32
    expect(result.value).toBeCloseTo(23.32, 0);
  });

  it('S1 reverse: mass→mass (product → reactant)', () => {
    const findEntityRef = 'substance:BaSO4';
    const givenEntityRef = 'substance:H2SO4';
    const result = deriveQuantity({
      target: { quantity: 'q:mass', role: 'reactant' },
      knowns: [
        { qref: { quantity: 'q:mass', role: 'product' }, value: 23.34 },
        { qref: { quantity: 'q:stoich_coeff', role: 'product' }, value: 1 },
        { qref: { quantity: 'q:molar_mass', role: 'product', context: { system_type: 'substance', entity_ref: findEntityRef } }, value: 233.39 },
        { qref: { quantity: 'q:stoich_coeff', role: 'reactant' }, value: 1 },
        { qref: { quantity: 'q:molar_mass', role: 'reactant', context: { system_type: 'substance', entity_ref: givenEntityRef } }, value: 98.08 },
      ],
      formulas, constants, ontology,
    });
    // n_product = 23.34/233.39 ≈ 0.1, n_reactant = 0.1, m = 0.1 * 98.08 ≈ 9.8
    expect(result.value).toBeCloseTo(9.8, 0);
  });

  it('S2: amount→mass', () => {
    const findEntityRef = 'substance:BaSO4';
    const result = deriveQuantity({
      target: { quantity: 'q:mass', role: 'product' },
      knowns: [
        { qref: { quantity: 'q:amount', role: 'reactant' }, value: 0.1 },
        { qref: { quantity: 'q:stoich_coeff', role: 'reactant' }, value: 1 },
        { qref: { quantity: 'q:stoich_coeff', role: 'product' }, value: 1 },
        { qref: { quantity: 'q:molar_mass', role: 'product', context: { system_type: 'substance', entity_ref: findEntityRef } }, value: 233.39 },
      ],
      formulas, constants, ontology,
    });
    expect(result.value).toBeCloseTo(23.34, 0);
  });

  it('S2r: mass→amount', () => {
    const givenEntityRef = 'substance:H2SO4';
    const result = deriveQuantity({
      target: { quantity: 'q:amount', role: 'product' },
      knowns: [
        { qref: { quantity: 'q:mass', role: 'reactant' }, value: 9.8 },
        { qref: { quantity: 'q:stoich_coeff', role: 'reactant' }, value: 1 },
        { qref: { quantity: 'q:molar_mass', role: 'reactant', context: { system_type: 'substance', entity_ref: givenEntityRef } }, value: 98.08 },
        { qref: { quantity: 'q:stoich_coeff', role: 'product' }, value: 1 },
      ],
      formulas, constants, ontology,
    });
    // n = 9.8/98.08 * 1/1 ≈ 0.0999
    expect(result.value).toBeCloseTo(0.1, 1);
  });

  it('S3: mass→mass with yield', () => {
    const result = deriveQuantity({
      target: { quantity: 'q:mass', role: 'product' },
      knowns: [
        ...stoichKnowns(),
        { qref: { quantity: 'q:yield' }, value: 85 },
      ],
      formulas, constants, ontology,
    });
    // theoretical ≈ 23.32, actual = 23.32 * 85/100 ≈ 19.82
    expect(result.value).toBeCloseTo(19.82, 0);
  });

  it('S3r: find yield (uses generic planner, not stoichiometry chain)', () => {
    // S3r has no stoich coefficients — hasStoichiometricKnowns returns false.
    // It falls through to the generic planner fallback, which handles formula:yield
    // via semantic_role: 'actual'/'theoretical' on the formula variables.
    // The 'actual'/'theoretical' roles here are formula-derived, not participant roles.
    const result = deriveQuantity({
      target: { quantity: 'q:yield' },
      knowns: [
        { qref: { quantity: 'q:mass', role: 'actual' }, value: 19.82 },
        { qref: { quantity: 'q:mass', role: 'theoretical' }, value: 23.32 },
      ],
      formulas, constants, ontology,
    });
    expect(result.value).toBeCloseTo(85, 0);
  });

  it('trace for S1 contains expected step types', () => {
    const result = deriveQuantity({
      target: { quantity: 'q:mass', role: 'product' },
      knowns: stoichKnowns(),
      formulas, constants, ontology,
    });
    const types = result.trace.map(s => s.type);
    // given steps first, then formula chains, then conclusion
    expect(types).toContain('given');
    expect(types).toContain('formula_select');
    expect(types).toContain('substitution');
    expect(types).toContain('compute');
    expect(types).toContain('conclusion');
    // Should reference both amount_from_mass and stoichiometry_ratio
    const selects = traceStepsOfType(result.trace, 'formula_select');
    const formulaIds = selects.map(s => s.formulaId);
    expect(formulaIds).toContain('formula:amount_from_mass');
    expect(formulaIds).toContain('formula:stoichiometry_ratio');
  });

  it('throws on incomplete stoichiometric signature', () => {
    expect(() =>
      deriveQuantity({
        target: { quantity: 'q:mass', role: 'product' },
        knowns: [
          // Only one coefficient — not enough
          { qref: { quantity: 'q:stoich_coeff', role: 'reactant' }, value: 1 },
          { qref: { quantity: 'q:mass', role: 'reactant' }, value: 9.8 },
        ],
        formulas, constants, ontology,
      }),
    ).toThrow();
  });
});

// ── Parity tests: old solver output vs deriveQuantity ────────────

describe('solver migration parity', () => {
  // Reproduce exact old solver logic for comparison
  function oldSolveStoichiometry(
    givenMass: number, givenCoeff: number, givenM: number,
    findCoeff: number, findM: number,
  ): number {
    const fAmount = formulas.find(f => f.id === 'formula:amount_from_mass')!;
    const fStoich = formulas.find(f => f.id === 'formula:stoichiometry_ratio')!;
    const nGiven = evaluateFormula(fAmount, { m: givenMass, M: givenM }, constants).result;
    const nFind = evaluateFormula(fStoich, { n_1: nGiven, nu_1: givenCoeff, nu_2: findCoeff }, constants).result;
    const mFind = formulaSolveFor(fAmount, 'm', { n: nFind, M: findM }, constants).result;
    return Math.round(mFind * 100) / 100;
  }

  function oldSolveReactionYield(
    givenMass: number, givenCoeff: number, givenM: number,
    findCoeff: number, findM: number, yieldPercent: number,
  ): number {
    const fAmount = formulas.find(f => f.id === 'formula:amount_from_mass')!;
    const fStoich = formulas.find(f => f.id === 'formula:stoichiometry_ratio')!;
    const fYield = formulas.find(f => f.id === 'formula:yield')!;
    const nGiven = evaluateFormula(fAmount, { m: givenMass, M: givenM }, constants).result;
    const nFind = evaluateFormula(fStoich, { n_1: nGiven, nu_1: givenCoeff, nu_2: findCoeff }, constants).result;
    const mTheoretical = formulaSolveFor(fAmount, 'm', { n: nFind, M: findM }, constants).result;
    const mActual = formulaSolveFor(fYield, 'm_actual', { eta: yieldPercent, m_theoretical: mTheoretical }, constants).result;
    return Math.round(mActual * 100) / 100;
  }

  function newSolveStoichiometry(
    givenMass: number, givenCoeff: number, givenM: number,
    findCoeff: number, findM: number,
    givenFormula: string, findFormula: string,
  ): number {
    const givenEntityRef = 'substance:' + givenFormula;
    const findEntityRef = 'substance:' + findFormula;
    const result = deriveQuantity({
      target: { quantity: 'q:mass', role: 'product' },
      knowns: [
        { qref: { quantity: 'q:mass', role: 'reactant' }, value: givenMass },
        { qref: { quantity: 'q:stoich_coeff', role: 'reactant' }, value: givenCoeff },
        { qref: { quantity: 'q:molar_mass', role: 'reactant', context: { system_type: 'substance', entity_ref: givenEntityRef } }, value: givenM },
        { qref: { quantity: 'q:stoich_coeff', role: 'product' }, value: findCoeff },
        { qref: { quantity: 'q:molar_mass', role: 'product', context: { system_type: 'substance', entity_ref: findEntityRef } }, value: findM },
      ],
      formulas, constants, ontology,
    });
    return Math.round(result.value * 100) / 100;
  }

  function newSolveReactionYield(
    givenMass: number, givenCoeff: number, givenM: number,
    findCoeff: number, findM: number, yieldPercent: number,
    givenFormula: string, findFormula: string,
  ): number {
    const givenEntityRef = 'substance:' + givenFormula;
    const findEntityRef = 'substance:' + findFormula;
    const result = deriveQuantity({
      target: { quantity: 'q:mass', role: 'product' },
      knowns: [
        { qref: { quantity: 'q:mass', role: 'reactant' }, value: givenMass },
        { qref: { quantity: 'q:stoich_coeff', role: 'reactant' }, value: givenCoeff },
        { qref: { quantity: 'q:molar_mass', role: 'reactant', context: { system_type: 'substance', entity_ref: givenEntityRef } }, value: givenM },
        { qref: { quantity: 'q:stoich_coeff', role: 'product' }, value: findCoeff },
        { qref: { quantity: 'q:molar_mass', role: 'product', context: { system_type: 'substance', entity_ref: findEntityRef } }, value: findM },
        { qref: { quantity: 'q:yield' }, value: yieldPercent },
      ],
      formulas, constants, ontology,
    });
    return Math.round(result.value * 100) / 100;
  }

  // Test cases from representative reactions in calc_reactions
  // H₂SO₄ + BaCl₂ → BaSO₄↓ + 2HCl: coeffs 1,1; M(H2SO4)=98.08, M(BaSO4)=233.39

  it('stoichiometry parity: H2SO4→BaSO4 with 49g', () => {
    const old = oldSolveStoichiometry(49, 1, 98.08, 1, 233.39);
    const now = newSolveStoichiometry(49, 1, 98.08, 1, 233.39, 'H2SO4', 'BaSO4');
    expect(now).toBeCloseTo(old, 2);
  });

  it('stoichiometry parity: H2SO4→BaSO4 with 19.6g', () => {
    const old = oldSolveStoichiometry(19.6, 1, 98.08, 1, 233.39);
    const now = newSolveStoichiometry(19.6, 1, 98.08, 1, 233.39, 'H2SO4', 'BaSO4');
    expect(now).toBeCloseTo(old, 2);
  });

  it('stoichiometry parity: 2:1 coefficient ratio', () => {
    // 2HCl + ... → ... (using arbitrary M values)
    const old = oldSolveStoichiometry(36.5, 2, 36.46, 1, 233.39);
    const now = newSolveStoichiometry(36.5, 2, 36.46, 1, 233.39, 'HCl', 'BaSO4');
    expect(now).toBeCloseTo(old, 2);
  });

  it('yield parity: H2SO4→BaSO4 with 80% yield', () => {
    const old = oldSolveReactionYield(49, 1, 98.08, 1, 233.39, 80);
    const now = newSolveReactionYield(49, 1, 98.08, 1, 233.39, 80, 'H2SO4', 'BaSO4');
    expect(now).toBeCloseTo(old, 2);
  });

  it('yield parity: H2SO4→BaSO4 with 65% yield', () => {
    const old = oldSolveReactionYield(49, 1, 98.08, 1, 233.39, 65);
    const now = newSolveReactionYield(49, 1, 98.08, 1, 233.39, 65, 'H2SO4', 'BaSO4');
    expect(now).toBeCloseTo(old, 2);
  });

  it('yield parity: 2:1 coefficient ratio with 90% yield', () => {
    const old = oldSolveReactionYield(36.5, 2, 36.46, 1, 233.39, 90);
    const now = newSolveReactionYield(36.5, 2, 36.46, 1, 233.39, 90, 'HCl', 'BaSO4');
    expect(now).toBeCloseTo(old, 2);
  });
});
