import { beforeAll, describe, it, expect } from 'vitest';
import { runSolver } from '../solvers';
import {
  getElectronConfig,
  setConfigOverrides,
  toSuperscript,
} from '../../electron-config';
import { determineBondType } from '../../bond-calculator';
import type { OntologyData } from '../types';
import type { Element } from '../../../types/element';

// ── Shared test elements ──────────────────────────────────────────

const TEST_ELEMENTS: Element[] = [
  { Z: 1, symbol: 'H', name: 'Водород', name_latin: 'Hydrogenium', group: 1, period: 1, metal_type: 'nonmetal', element_group: 'nonmetal', atomic_mass: 1.008, typical_oxidation_states: [1, -1], electronegativity: 2.2 },
  { Z: 8, symbol: 'O', name: 'Кислород', name_latin: 'Oxygenium', group: 16, period: 2, metal_type: 'nonmetal', element_group: 'nonmetal', atomic_mass: 16.0, typical_oxidation_states: [-2], electronegativity: 3.44 },
  { Z: 11, symbol: 'Na', name: 'Натрий', name_latin: 'Natrium', group: 1, period: 3, metal_type: 'metal', element_group: 'alkali_metal', atomic_mass: 22.99, typical_oxidation_states: [1], electronegativity: 0.93 },
  { Z: 17, symbol: 'Cl', name: 'Хлор', name_latin: 'Chlorum', group: 17, period: 3, metal_type: 'nonmetal', element_group: 'halogen', atomic_mass: 35.45, typical_oxidation_states: [-1, 1, 3, 5, 7], electronegativity: 3.16 },
  { Z: 24, symbol: 'Cr', name: 'Хром', name_latin: 'Chromium', group: 6, period: 4, metal_type: 'metal', element_group: 'transition_metal', atomic_mass: 52.0, typical_oxidation_states: [2, 3, 6], electronegativity: 1.66, electron_exception: { config_override: [[4, 's', 1], [3, 'd', 5]], expected_formula: '1s²2s²2p⁶3s²3p⁶4s²3d⁴', actual_formula: '1s²2s²2p⁶3s²3p⁶4s¹3d⁵', rule: 'half-filled d', reason: 'Провал электрона: полузаполненная 3d-оболочка' } },
  { Z: 26, symbol: 'Fe', name: 'Железо', name_latin: 'Ferrum', group: 8, period: 4, metal_type: 'metal', element_group: 'transition_metal', atomic_mass: 55.845, typical_oxidation_states: [2, 3], electronegativity: 1.83 },
  { Z: 29, symbol: 'Cu', name: 'Медь', name_latin: 'Cuprum', group: 11, period: 4, metal_type: 'metal', element_group: 'transition_metal', atomic_mass: 63.546, typical_oxidation_states: [1, 2], electronegativity: 1.90, electron_exception: { config_override: [[4, 's', 1], [3, 'd', 10]], expected_formula: '1s²2s²2p⁶3s²3p⁶4s²3d⁹', actual_formula: '1s²2s²2p⁶3s²3p⁶4s¹3d¹⁰', rule: 'filled d', reason: 'Провал электрона: полностью заполненная 3d-оболочка' } },
];

function buildMinimalOntology(elements: Element[]): OntologyData {
  return {
    core: { elements, ions: [], properties: [] },
    rules: {
      solubilityPairs: [], oxidationExamples: [],
    },
    data: {},
    i18n: { morphology: null, promptTemplates: {} },
  } as unknown as OntologyData;
}

// ── Electron Config Parity ───────────────────────────────────────

describe('Parity: electron_config solver vs canonical lib', () => {
  const ontology = buildMinimalOntology(TEST_ELEMENTS);

  beforeAll(() => { setConfigOverrides(TEST_ELEMENTS); });

  const cases: Array<{ Z: number; symbol: string }> = [
    { Z: 1, symbol: 'H' },
    { Z: 8, symbol: 'O' },
    { Z: 11, symbol: 'Na' },
    { Z: 17, symbol: 'Cl' },
    { Z: 24, symbol: 'Cr' },
    { Z: 26, symbol: 'Fe' },
    { Z: 29, symbol: 'Cu' },
  ];

  for (const { Z, symbol } of cases) {
    it(`Z=${Z} (${symbol}): solver matches canonical`, () => {
      const config = getElectronConfig(Z);
      const canonical = config
        .map(e => `${e.n}${e.l}${toSuperscript(e.electrons)}`)
        .join(' ');

      const result = runSolver(
        'solver.electron_config',
        {},
        { Z: String(Z) },
        ontology,
      );

      expect(result.answer).toBe(canonical);
    });
  }
});

// ── Bond Type Parity ─────────────────────────────────────────────

describe('Parity: delta_chi solver vs canonical determineBondType', () => {
  const ontology = buildMinimalOntology(TEST_ELEMENTS);

  const bondCases: Array<{ symA: string; symB: string }> = [
    { symA: 'Na', symB: 'Cl' },
    { symA: 'H', symB: 'O' },
    { symA: 'H', symB: 'Cl' },
    { symA: 'O', symB: 'Cl' },
    { symA: 'Fe', symB: 'Cu' },
  ];

  for (const { symA, symB } of bondCases) {
    it(`${symA}-${symB}: solver matches canonical`, () => {
      const elA = TEST_ELEMENTS.find(e => e.symbol === symA)!;
      const elB = TEST_ELEMENTS.find(e => e.symbol === symB)!;

      const canonicalType = determineBondType(elA, elB);

      const result = runSolver(
        'solver.delta_chi',
        {},
        { elementA: symA, elementB: symB },
        ontology,
      );

      expect(result.answer).toBe(canonicalType);
    });
  }
});

// ── Legacy bonds generator parity ────────────────────────────────

describe('Parity: bonds legacy generator uses canonical bond classification', () => {
  // Verify that for known element pairs, the bond type from
  // determineBondType matches what the legacy thresholds would produce.
  // This test will still pass after we swap the implementation.
  const thresholdCases: Array<{ symA: string; symB: string; chiA: number; chiB: number; expected: string }> = [
    { symA: 'Na', symB: 'Cl', chiA: 0.93, chiB: 3.16, expected: 'ionic' },         // Δχ=2.23 ≥ 1.7
    { symA: 'H', symB: 'Cl', chiA: 2.2, chiB: 3.16, expected: 'covalent_polar' },   // Δχ=0.96
    { symA: 'H', symB: 'O', chiA: 2.2, chiB: 3.44, expected: 'covalent_polar' },    // Δχ=1.24
    { symA: 'O', symB: 'Cl', chiA: 3.44, chiB: 3.16, expected: 'covalent_nonpolar' }, // Δχ=0.28 ≤ 0.4
  ];

  for (const { symA, symB, expected } of thresholdCases) {
    it(`${symA}-${symB}: canonical determineBondType matches legacy threshold`, () => {
      const elA = TEST_ELEMENTS.find(e => e.symbol === symA)!;
      const elB = TEST_ELEMENTS.find(e => e.symbol === symB)!;
      const result = determineBondType(elA, elB);
      expect(result).toBe(expected);
    });
  }
});

// ── Calculation Parity ───────────────────────────────────────────

describe('Parity: calculation solvers produce correct results', () => {
  const ontology = buildMinimalOntology(TEST_ELEMENTS);

  describe('molar_mass', () => {
    const cases = [
      { formula: 'H\u2082O', composition: { H: 2, O: 1 }, expected: 18.02 },
      { formula: 'NaCl', composition: { Na: 1, Cl: 1 }, expected: 58.44 },
      { formula: 'Fe\u2082O\u2083', composition: { Fe: 2, O: 3 }, expected: 159.69 },
    ];

    for (const { formula, composition, expected } of cases) {
      it(`M(${formula}) = ${expected}`, () => {
        const result = runSolver(
          'solver.molar_mass',
          {},
          { composition: JSON.stringify(composition) },
          ontology,
        );
        expect(result.answer).toBeCloseTo(expected, 1);
      });
    }
  });

  describe('mass_fraction', () => {
    it('w%(O in H\u2082O) \u2248 88.8%', () => {
      const result = runSolver(
        'solver.mass_fraction',
        { target_element: 'O' },
        { M: '18.016', composition: JSON.stringify({ H: 2, O: 1 }) },
        ontology,
      );
      expect(result.answer).toBeCloseTo(88.8, 0);
    });

    it('w%(Na in NaCl) \u2248 39.3%', () => {
      const result = runSolver(
        'solver.mass_fraction',
        { target_element: 'Na' },
        { M: '58.44', composition: JSON.stringify({ Na: 1, Cl: 1 }) },
        ontology,
      );
      expect(result.answer).toBeCloseTo(39.3, 0);
    });
  });

  describe('stoichiometry', () => {
    it('10g Zn \u2192 ? g ZnCl\u2082 (Zn + 2HCl \u2192 ZnCl\u2082 + H\u2082)', () => {
      const result = runSolver(
        'solver.stoichiometry',
        {},
        {
          given_mass: '10',
          given_coeff: '1',
          given_M: '65.38',
          find_coeff: '1',
          find_M: '136.28',
        },
        ontology,
      );
      expect(result.answer).toBeCloseTo(20.85, 1);
    });
  });

  describe('amount_calc', () => {
    it('n = m/M: 36g H\u2082O \u2192 2 mol', () => {
      const result = runSolver(
        'solver.amount_calc',
        { mode: 'n' },
        { mass: '36.032', M: '18.016' },
        ontology,
      );
      expect(result.answer).toBeCloseTo(2.0, 2);
    });
  });

  describe('concentration', () => {
    it('\u03c9 = (m_solute / m_solution) \u00d7 100', () => {
      const result = runSolver(
        'solver.concentration',
        { mode: 'omega' },
        { m_solute: '10', m_solution: '200' },
        ontology,
      );
      expect(result.answer).toBe(5.0);
    });
  });
});
