import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { evaluateExpr, evaluateFormula, solveFor, toConstantsDict } from '../formula-evaluator';
import type { ComputableFormula, PhysicalConstant, ExprNode } from '../../types/formula';
import type { Bindings, ConstantsDict } from '../../types/eval-trace';

const DATA_DIR = join(import.meta.dirname, '../../../data-src/foundations');
const formulas: ComputableFormula[] = JSON.parse(readFileSync(join(DATA_DIR, 'formulas.json'), 'utf8'));
const constants: PhysicalConstant[] = JSON.parse(readFileSync(join(DATA_DIR, 'constants.json'), 'utf8'));
const CONSTS = toConstantsDict(constants);

function findFormula(id: string): ComputableFormula {
  const f = formulas.find(fm => fm.id === id);
  if (!f) throw new Error(`Formula not found: ${id}`);
  return f;
}

// ── evaluateExpr ────────────────────────────────────────────────────

describe('evaluateExpr', () => {
  const B: Bindings = { x: 5, y: 3 };
  const C: ConstantsDict = { 'const:pi': 3.14159 };

  describe('primitives', () => {
    it('resolves string binding', () => {
      expect(evaluateExpr('x', B, C)).toBe(5);
    });

    it('passes through number', () => {
      expect(evaluateExpr(42, B, C)).toBe(42);
    });

    it('throws on missing binding', () => {
      expect(() => evaluateExpr('z', B, C)).toThrow('Missing binding for symbol: z');
    });
  });

  describe('literal', () => {
    it('returns literal value', () => {
      const node: ExprNode = { op: 'literal', value: 100 };
      expect(evaluateExpr(node, B, C)).toBe(100);
    });
  });

  describe('const', () => {
    it('resolves constant ref', () => {
      const node: ExprNode = { op: 'const', ref: 'const:pi' };
      expect(evaluateExpr(node, B, C)).toBeCloseTo(3.14159);
    });

    it('throws on missing constant', () => {
      const node: ExprNode = { op: 'const', ref: 'const:missing' };
      expect(() => evaluateExpr(node, B, C)).toThrow('Missing constant: const:missing');
    });
  });

  describe('add', () => {
    it('adds two operands', () => {
      const node: ExprNode = { op: 'add', operands: ['x', 'y'] };
      expect(evaluateExpr(node, B, C)).toBe(8);
    });

    it('adds three operands', () => {
      const node: ExprNode = { op: 'add', operands: ['x', 'y', 10] };
      expect(evaluateExpr(node, B, C)).toBe(18);
    });
  });

  describe('subtract', () => {
    it('subtracts two operands', () => {
      const node: ExprNode = { op: 'subtract', operands: ['x', 'y'] };
      expect(evaluateExpr(node, B, C)).toBe(2);
    });
  });

  describe('multiply', () => {
    it('multiplies two operands', () => {
      const node: ExprNode = { op: 'multiply', operands: ['x', 'y'] };
      expect(evaluateExpr(node, B, C)).toBe(15);
    });

    it('multiplies three operands', () => {
      const node: ExprNode = { op: 'multiply', operands: ['x', 'y', 2] };
      expect(evaluateExpr(node, B, C)).toBe(30);
    });
  });

  describe('divide', () => {
    it('divides two operands', () => {
      const node: ExprNode = { op: 'divide', operands: [15, 'y'] };
      expect(evaluateExpr(node, B, C)).toBe(5);
    });

    it('throws on division by zero', () => {
      const node: ExprNode = { op: 'divide', operands: ['x', 0] };
      expect(() => evaluateExpr(node, B, C)).toThrow('Division by zero');
    });
  });

  describe('power', () => {
    it('computes base^exp', () => {
      const node: ExprNode = { op: 'power', operands: ['x', 3] };
      expect(evaluateExpr(node, B, C)).toBe(125);
    });
  });

  describe('sum', () => {
    it('sums over indexed bindings', () => {
      const node: ExprNode = {
        op: 'sum', over: 'i', index_set: 'items',
        term: { op: 'multiply', operands: ['a_i', 'b_i'] },
      };
      const indexed = {
        items: [
          { a_i: 2, b_i: 3 },
          { a_i: 4, b_i: 5 },
        ],
      };
      expect(evaluateExpr(node, {}, C, indexed)).toBe(26); // 6 + 20
    });

    it('throws on missing index_set', () => {
      const node: ExprNode = {
        op: 'sum', over: 'i', index_set: 'missing',
        term: { op: 'literal', value: 1 },
      };
      expect(() => evaluateExpr(node, {}, C)).toThrow('Missing indexed bindings for index_set: missing');
    });
  });

  describe('nested', () => {
    it('evaluates (Ar × count) / M × 100', () => {
      // mass_fraction_element formula structure
      const node: ExprNode = {
        op: 'multiply',
        operands: [
          { op: 'divide', operands: [{ op: 'multiply', operands: ['Ar', 'n_atom'] }, 'M'] },
          { op: 'literal', value: 100 },
        ],
      };
      // H in H₂O: Ar=1.008, n_atom=2, M=18.015
      expect(evaluateExpr(node, { Ar: 1.008, n_atom: 2, M: 18.015 }, C)).toBeCloseTo(11.19, 1);
    });
  });
});

// ── toConstantsDict ─────────────────────────────────────────────────

describe('toConstantsDict', () => {
  it('builds dict from PhysicalConstant[]', () => {
    const dict = toConstantsDict(constants);
    expect(dict['const:N_A']).toBe(6.022e23);
    expect(dict['const:V_m_stp']).toBe(22.4);
    expect(dict['const:h_planck']).toBe(6.626e-34);
    expect(dict['const:R']).toBe(8.314);
    expect(dict['const:k_coulomb']).toBe(8.988e9);
  });

  it('handles empty array', () => {
    expect(toConstantsDict([])).toEqual({});
  });
});

// ── evaluateFormula — all 14 formulas ───────────────────────────────

describe('evaluateFormula — all 14 formulas', () => {
  it('formula:molar_mass_from_composition — NaCl → 58.44', () => {
    const f = findFormula('formula:molar_mass_from_composition');
    const trace = evaluateFormula(f, {}, CONSTS, {
      composition_elements: [
        { Ar_i: 22.99, count_i: 1 },
        { Ar_i: 35.45, count_i: 1 },
      ],
    });
    expect(trace.result).toBeCloseTo(58.44, 2);
    expect(trace.formulaId).toBe('formula:molar_mass_from_composition');
    expect(trace.solvedFor).toBe('M');
  });

  it('formula:amount_from_mass — 58.44g NaCl → 1 mol', () => {
    const f = findFormula('formula:amount_from_mass');
    const trace = evaluateFormula(f, { m: 58.44, M: 58.44 }, CONSTS);
    expect(trace.result).toBeCloseTo(1, 4);
  });

  it('formula:particle_count — 2 mol → 1.2044e24', () => {
    const f = findFormula('formula:particle_count');
    const trace = evaluateFormula(f, { n: 2 }, CONSTS);
    expect(trace.result).toBeCloseTo(1.2044e24, -20);
  });

  it('formula:gas_volume_stp — 1 mol → 22.4 L', () => {
    const f = findFormula('formula:gas_volume_stp');
    const trace = evaluateFormula(f, { n: 1 }, CONSTS);
    expect(trace.result).toBeCloseTo(22.4, 2);
  });

  it('formula:mass_fraction_element — H in H₂O → 11.19%', () => {
    const f = findFormula('formula:mass_fraction_element');
    const trace = evaluateFormula(f, { Ar: 1.008, n_atom: 2, M: 18.015 }, CONSTS);
    expect(trace.result).toBeCloseTo(11.19, 1);
  });

  it('formula:density — 100g / 50mL = 2 g/mL', () => {
    const f = findFormula('formula:density');
    const trace = evaluateFormula(f, { m: 100, V: 50 }, CONSTS);
    expect(trace.result).toBe(2);
  });

  it('formula:yield — 90g / 100g × 100 = 90%', () => {
    const f = findFormula('formula:yield');
    const trace = evaluateFormula(f, { m_actual: 90, m_theoretical: 100 }, CONSTS);
    expect(trace.result).toBe(90);
  });

  it('formula:stoichiometry_ratio — cross-multiplication', () => {
    const f = findFormula('formula:stoichiometry_ratio');
    // 2 mol of substance with coeff 1, find amount for coeff 3
    const trace = evaluateFormula(f, { n_1: 2, nu_1: 1, nu_2: 3 }, CONSTS);
    expect(trace.result).toBe(6);
  });

  it('formula:mass_fraction_solution — 10g / 100g = 0.1', () => {
    const f = findFormula('formula:mass_fraction_solution');
    const trace = evaluateFormula(f, { m_solute: 10, m_solution: 100 }, CONSTS);
    expect(trace.result).toBeCloseTo(0.1, 4);
  });

  it('formula:molar_concentration — 0.5 mol / 1 L = 0.5 M', () => {
    const f = findFormula('formula:molar_concentration');
    const trace = evaluateFormula(f, { n: 0.5, V: 1 }, CONSTS);
    expect(trace.result).toBe(0.5);
  });

  it('formula:hess_law — ΔH products − ΔH reactants', () => {
    const f = findFormula('formula:hess_law');
    // 2A + B → C, ΔHf: C=-400, A=-200, B=-100
    // ΔH = (1×-400) - (2×-200 + 1×-100) = -400 - (-500) = 100
    const trace = evaluateFormula(f, {}, CONSTS, {
      products: [{ nu_j: 1, deltaHf_j: -400 }],
      reactants: [{ nu_i: 2, deltaHf_i: -200 }, { nu_i: 1, deltaHf_i: -100 }],
    });
    expect(trace.result).toBe(100);
  });

  it('formula:effective_nuclear_charge — Z - σ', () => {
    const f = findFormula('formula:effective_nuclear_charge');
    const trace = evaluateFormula(f, { Z: 11, sigma: 8.8 }, CONSTS);
    expect(trace.result).toBeCloseTo(2.2, 2);
  });

  it('formula:photon_energy — h × ν', () => {
    const f = findFormula('formula:photon_energy');
    const trace = evaluateFormula(f, { nu: 5e14 }, CONSTS);
    // 6.626e-34 × 5e14 = 3.313e-19
    expect(trace.result).toBeCloseTo(3.313e-19, 22);
  });

  it('formula:calorimetry_delta_t — Q / Σ(m×c)', () => {
    const f = findFormula('formula:calorimetry_delta_t');
    // Q=4180 J, one component: 100g water, c=4.18 J/(g·K)
    // ΔT = 4180 / (100 × 4.18) = 10 K
    const trace = evaluateFormula(f, { Q_total: 4180 }, CONSTS, {
      system_components: [{ m_i: 100, c_i: 4.18 }],
    });
    expect(trace.result).toBeCloseTo(10, 2);
  });
});

// ── solveFor — inversions ───────────────────────────────────────────

describe('solveFor — inversions', () => {
  it('amount_from_mass: solve for m → n × M', () => {
    const f = findFormula('formula:amount_from_mass');
    const trace = solveFor(f, 'm', { n: 2, M: 58.44 }, CONSTS);
    expect(trace.result).toBeCloseTo(116.88, 2);
    expect(trace.solvedFor).toBe('m');
  });

  it('amount_from_mass: solve for M → m / n', () => {
    const f = findFormula('formula:amount_from_mass');
    const trace = solveFor(f, 'M', { m: 58.44, n: 1 }, CONSTS);
    expect(trace.result).toBeCloseTo(58.44, 2);
  });

  it('particle_count: solve for n → N / N_A', () => {
    const f = findFormula('formula:particle_count');
    const trace = solveFor(f, 'n', { N: 6.022e23 }, CONSTS);
    expect(trace.result).toBeCloseTo(1, 4);
  });

  it('gas_volume_stp: solve for n → V / V_m', () => {
    const f = findFormula('formula:gas_volume_stp');
    const trace = solveFor(f, 'n', { V: 44.8 }, CONSTS);
    expect(trace.result).toBeCloseTo(2, 4);
  });

  it('mass_fraction_element: solve for Ar', () => {
    const f = findFormula('formula:mass_fraction_element');
    // omega=11.19, M=18.015, n_atom=2 → Ar ≈ 1.008
    const trace = solveFor(f, 'Ar', { omega: 11.19, M: 18.015, n_atom: 2 }, CONSTS);
    expect(trace.result).toBeCloseTo(1.008, 2);
  });

  it('mass_fraction_element: solve for n_atom', () => {
    const f = findFormula('formula:mass_fraction_element');
    // omega=11.19, M=18.015, Ar=1.008 → n_atom ≈ 2
    const trace = solveFor(f, 'n_atom', { omega: 11.19, M: 18.015, Ar: 1.008 }, CONSTS);
    expect(trace.result).toBeCloseTo(2, 0);
  });

  it('mass_fraction_element: solve for M', () => {
    const f = findFormula('formula:mass_fraction_element');
    // omega=11.19, Ar=1.008, n_atom=2 → M ≈ 18.015
    const trace = solveFor(f, 'M', { omega: 11.19, Ar: 1.008, n_atom: 2 }, CONSTS);
    expect(trace.result).toBeCloseTo(18.02, 0);
  });

  it('density: solve for m → ρ × V', () => {
    const f = findFormula('formula:density');
    const trace = solveFor(f, 'm', { rho: 2, V: 50 }, CONSTS);
    expect(trace.result).toBe(100);
  });

  it('density: solve for V → m / ρ', () => {
    const f = findFormula('formula:density');
    const trace = solveFor(f, 'V', { m: 100, rho: 2 }, CONSTS);
    expect(trace.result).toBe(50);
  });

  it('yield: solve for m_actual', () => {
    const f = findFormula('formula:yield');
    // eta=90, m_theoretical=100 → m_actual = 90/100 × 100 = 90
    const trace = solveFor(f, 'm_actual', { eta: 90, m_theoretical: 100 }, CONSTS);
    expect(trace.result).toBe(90);
  });

  it('yield: solve for m_theoretical', () => {
    const f = findFormula('formula:yield');
    // m_actual=90, eta=90 → m_theoretical = 90 × 100 / 90 = 100
    const trace = solveFor(f, 'm_theoretical', { m_actual: 90, eta: 90 }, CONSTS);
    expect(trace.result).toBe(100);
  });

  it('stoichiometry_ratio: solve for n_1', () => {
    const f = findFormula('formula:stoichiometry_ratio');
    const trace = solveFor(f, 'n_1', { n_2: 6, nu_2: 3, nu_1: 1 }, CONSTS);
    expect(trace.result).toBe(2);
  });

  it('mass_fraction_solution: solve for m_solute', () => {
    const f = findFormula('formula:mass_fraction_solution');
    const trace = solveFor(f, 'm_solute', { w: 0.1, m_solution: 100 }, CONSTS);
    expect(trace.result).toBe(10);
  });

  it('mass_fraction_solution: solve for m_solution', () => {
    const f = findFormula('formula:mass_fraction_solution');
    const trace = solveFor(f, 'm_solution', { m_solute: 10, w: 0.1 }, CONSTS);
    expect(trace.result).toBe(100);
  });

  it('molar_concentration: solve for n', () => {
    const f = findFormula('formula:molar_concentration');
    const trace = solveFor(f, 'n', { C: 0.5, V: 1 }, CONSTS);
    expect(trace.result).toBe(0.5);
  });

  it('molar_concentration: solve for V', () => {
    const f = findFormula('formula:molar_concentration');
    const trace = solveFor(f, 'V', { n: 0.5, C: 0.5 }, CONSTS);
    expect(trace.result).toBe(1);
  });

  it('effective_nuclear_charge: solve for Z', () => {
    const f = findFormula('formula:effective_nuclear_charge');
    const trace = solveFor(f, 'Z', { Z_eff: 2.2, sigma: 8.8 }, CONSTS);
    expect(trace.result).toBeCloseTo(11, 2);
  });

  it('effective_nuclear_charge: solve for sigma', () => {
    const f = findFormula('formula:effective_nuclear_charge');
    const trace = solveFor(f, 'sigma', { Z: 11, Z_eff: 2.2 }, CONSTS);
    expect(trace.result).toBeCloseTo(8.8, 2);
  });

  it('photon_energy: solve for nu', () => {
    const f = findFormula('formula:photon_energy');
    const trace = solveFor(f, 'nu', { E: 3.313e-19 }, CONSTS);
    expect(trace.result).toBeCloseTo(5e14, -2);
  });

  it('calorimetry_delta_t: solve for Q_total', () => {
    const f = findFormula('formula:calorimetry_delta_t');
    const trace = solveFor(f, 'Q_total', { delta_T: 10 }, CONSTS, {
      system_components: [{ m_i: 100, c_i: 4.18 }],
    });
    expect(trace.result).toBeCloseTo(4180, 0);
  });

  it('throws on non-invertible variable', () => {
    const f = findFormula('formula:molar_mass_from_composition');
    expect(() => solveFor(f, 'Ar_i', {}, CONSTS)).toThrow('Cannot solve');
  });

  it('forward via solveFor (target = result_variable)', () => {
    const f = findFormula('formula:amount_from_mass');
    const trace = solveFor(f, 'n', { m: 58.44, M: 58.44 }, CONSTS);
    expect(trace.result).toBeCloseTo(1, 4);
    expect(trace.solvedFor).toBe('n');
  });
});

// ── EvalTrace structure ─────────────────────────────────────────────

describe('EvalTrace structure', () => {
  it('trace has formulaId, solvedFor, steps, result', () => {
    const f = findFormula('formula:density');
    const trace = evaluateFormula(f, { m: 100, V: 50 }, CONSTS);
    expect(trace.formulaId).toBe('formula:density');
    expect(trace.solvedFor).toBe('rho');
    expect(trace.steps).toHaveLength(1);
    expect(trace.result).toBe(2);
  });

  it('steps[0] has substitutions for bound variables', () => {
    const f = findFormula('formula:density');
    const trace = evaluateFormula(f, { m: 100, V: 50 }, CONSTS);
    expect(trace.steps[0].substitutions).toEqual({ m: 100, V: 50 });
  });

  it('inversion trace has readable expr string', () => {
    const f = findFormula('formula:density');
    const trace = solveFor(f, 'm', { rho: 2, V: 50 }, CONSTS);
    expect(trace.steps[0].expr).toContain('m');
    expect(trace.steps[0].expr).toContain('=');
  });
});

// ── Parity with existing solvers ────────────────────────────────────

describe('parity with existing solvers', () => {
  it('molar_mass: NaCl matches solveMolarMass output (58.44)', () => {
    const f = findFormula('formula:molar_mass_from_composition');
    const trace = evaluateFormula(f, {}, CONSTS, {
      composition_elements: [
        { Ar_i: 22.99, count_i: 1 },
        { Ar_i: 35.45, count_i: 1 },
      ],
    });
    const rounded = Math.round(trace.result * 100) / 100;
    expect(rounded).toBe(58.44);
  });

  it('mass_fraction: O in H₂O matches solveMassFraction (88.8%)', () => {
    const f = findFormula('formula:mass_fraction_element');
    // O in H₂O: Ar=16, n_atom=1, M=18.015
    const trace = evaluateFormula(f, { Ar: 16, n_atom: 1, M: 18.015 }, CONSTS);
    const rounded = Math.round(trace.result * 10) / 10;
    expect(rounded).toBe(88.8);
  });

  it('amount_calc mode=n: 100g NaCl → 1.711 mol matches solveAmountCalc', () => {
    const f = findFormula('formula:amount_from_mass');
    const trace = evaluateFormula(f, { m: 100, M: 58.44 }, CONSTS);
    const rounded = Math.round(trace.result * 1000) / 1000;
    expect(rounded).toBe(1.711);
  });

  it('amount_calc mode=m: 2 mol × 58.44 → 116.88 matches solveAmountCalc', () => {
    const f = findFormula('formula:amount_from_mass');
    const trace = solveFor(f, 'm', { n: 2, M: 58.44 }, CONSTS);
    const rounded = Math.round(trace.result * 100) / 100;
    expect(rounded).toBe(116.88);
  });

  it('concentration omega: 10/200 → 5% matches solveConcentration', () => {
    const f = findFormula('formula:mass_fraction_solution');
    const trace = evaluateFormula(f, { m_solute: 10, m_solution: 200 }, CONSTS);
    // solveConcentration returns omega*100, mass_fraction_solution returns fraction
    const omegaPercent = Math.round(trace.result * 100 * 10) / 10;
    expect(omegaPercent).toBe(5);
  });

  it('stoichiometry: standard cross-multiply matches solveStoichiometry', () => {
    // solveStoichiometry: nGiven = givenMass/givenM, nFind = nGiven*(findCoeff/givenCoeff), mFind = nFind*findM
    // Given: 100g, M=58.44, coeff=1; Find: coeff=2, M=40
    const givenMass = 100, givenM = 58.44, givenCoeff = 1, findCoeff = 2, findM = 40;

    // Replicate solver steps with formula evaluator:
    const fAmount = findFormula('formula:amount_from_mass');
    const nGivenTrace = evaluateFormula(fAmount, { m: givenMass, M: givenM }, CONSTS);
    const nGiven = nGivenTrace.result;

    const fStoich = findFormula('formula:stoichiometry_ratio');
    const nFindTrace = evaluateFormula(fStoich, { n_1: nGiven, nu_1: givenCoeff, nu_2: findCoeff }, CONSTS);
    const nFind = nFindTrace.result;

    const mFindTrace = solveFor(fAmount, 'm', { n: nFind, M: findM }, CONSTS);
    const mFind = mFindTrace.result;

    // Compare with direct solver calculation
    const expected = Math.round(((givenMass / givenM) * (findCoeff / givenCoeff) * findM) * 100) / 100;
    expect(Math.round(mFind * 100) / 100).toBe(expected);
  });
});
