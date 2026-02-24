import { describe, it, expect } from 'vitest';
import { runSolver } from '../solvers';
import type { OntologyData, PropertyDef } from '../types';
import type { Element } from '../../../types/element';
import type { Ion } from '../../../types/ion';

// ── Mock data ────────────────────────────────────────────────────

const MOCK_ELEMENTS: Element[] = [
  {
    Z: 11, symbol: 'Na', name_ru: 'Натрий', name_en: 'Sodium', name_latin: 'Natrium',
    group: 1, period: 3, metal_type: 'metal', element_group: 'alkali_metal',
    atomic_mass: 22.99, typical_oxidation_states: [1], electronegativity: 0.93,
  },
  {
    Z: 12, symbol: 'Mg', name_ru: 'Магний', name_en: 'Magnesium', name_latin: 'Magnesium',
    group: 2, period: 3, metal_type: 'metal', element_group: 'alkaline_earth',
    atomic_mass: 24.305, typical_oxidation_states: [2], electronegativity: 1.31,
  },
  {
    Z: 17, symbol: 'Cl', name_ru: 'Хлор', name_en: 'Chlorine', name_latin: 'Chlorum',
    group: 17, period: 3, metal_type: 'nonmetal', element_group: 'halogen',
    atomic_mass: 35.45, typical_oxidation_states: [-1, 1, 3, 5, 7], electronegativity: 3.16,
  },
];

const MOCK_PROPERTIES: PropertyDef[] = [
  {
    id: 'electronegativity', value_field: 'electronegativity', object: 'element',
    unit: null, trend_hint: { period: 'increases', group: 'decreases' },
    filter: null,
    i18n: { ru: { nom: 'электроотрицательность', gen: 'электроотрицательности' } },
  },
];

const MOCK_IONS: Ion[] = [
  { id: 'Na_plus', formula: 'Na\u207a', charge: 1, type: 'cation', name_ru: 'Ион натрия', tags: ['alkali'] },
  { id: 'Ca_2plus', formula: 'Ca\u00b2\u207a', charge: 2, type: 'cation', name_ru: 'Ион кальция', tags: ['alkaline_earth'] },
  { id: 'Al_3plus', formula: 'Al\u00b3\u207a', charge: 3, type: 'cation', name_ru: 'Ион алюминия', tags: ['amphoteric'] },
  { id: 'Cl_minus', formula: 'Cl\u207b', charge: -1, type: 'anion', name_ru: 'Хлорид-ион', tags: ['chloride'] },
  { id: 'SO4_2minus', formula: 'SO\u2084\u00b2\u207b', charge: -2, type: 'anion', name_ru: 'Сульфат-ион', tags: ['sulfate'] },
  { id: 'PO4_3minus', formula: 'PO\u2084\u00b3\u207b', charge: -3, type: 'anion', name_ru: 'Фосфат-ион', tags: ['phosphate'] },
];

const MOCK_SOLUBILITY_PAIRS = [
  { cation: 'Na_plus', anion: 'Cl_minus', solubility: 'soluble' },
  { cation: 'Na_plus', anion: 'SO4_2minus', solubility: 'soluble' },
  { cation: 'Ca_2plus', anion: 'SO4_2minus', solubility: 'slightly_soluble' },
  { cation: 'Ca_2plus', anion: 'PO4_3minus', solubility: 'insoluble' },
];

const MOCK_DATA: OntologyData = {
  elements: MOCK_ELEMENTS,
  ions: MOCK_IONS,
  properties: MOCK_PROPERTIES,
  solubilityPairs: MOCK_SOLUBILITY_PAIRS,
  oxidationExamples: [],
  morphology: null,
  promptTemplates: {},
};

// ── Tests ────────────────────────────────────────────────────────

describe('solver.compare_property', () => {
  it('Na vs Cl by electronegativity: Cl wins', () => {
    const result = runSolver(
      'solver.compare_property', {},
      { elementA: 'Na', elementB: 'Cl', property: 'electronegativity' },
      MOCK_DATA,
    );
    expect(result.answer).toBe('Cl');
    expect(result.explanation_slots).toBeDefined();
    expect(result.explanation_slots!.winner).toBe('Cl');
    expect(result.explanation_slots!.loser).toBe('Na');
    expect(result.explanation_slots!.valA).toBe('3.16');
    expect(result.explanation_slots!.valB).toBe('0.93');
  });
});

describe('solver.periodic_trend_order', () => {
  it('ascending by EN: [Na, Mg, Cl] -> [Na, Mg, Cl]', () => {
    const result = runSolver(
      'solver.periodic_trend_order', {},
      { element_symbols: ['Cl', 'Na', 'Mg'], property: 'electronegativity', order: 'ascending' },
      MOCK_DATA,
    );
    expect(result.answer).toEqual(['Na', 'Mg', 'Cl']);
  });

  it('descending by EN: [Cl, Na, Mg] -> [Cl, Mg, Na]', () => {
    const result = runSolver(
      'solver.periodic_trend_order', {},
      { element_symbols: ['Cl', 'Na', 'Mg'], property: 'electronegativity', order: 'descending' },
      MOCK_DATA,
    );
    expect(result.answer).toEqual(['Cl', 'Mg', 'Na']);
  });

  it('works with comma-separated elements string', () => {
    const result = runSolver(
      'solver.periodic_trend_order', {},
      { elements: 'Cl, Na, Mg', property: 'electronegativity', order: 'ascending' },
      MOCK_DATA,
    );
    expect(result.answer).toEqual(['Na', 'Mg', 'Cl']);
  });
});

describe('solver.oxidation_states', () => {
  it('H2SO4, S -> 6', () => {
    const result = runSolver(
      'solver.oxidation_states', {},
      { formula: 'H\u2082SO\u2084', element: 'S', expected_state: 6 },
      MOCK_DATA,
    );
    expect(result.answer).toBe(6);
  });
});

describe('solver.compose_salt_formula', () => {
  it('Na+ + Cl- -> NaCl', () => {
    const result = runSolver(
      'solver.compose_salt_formula', {},
      { cation_id: 'Na_plus', anion_id: 'Cl_minus' },
      MOCK_DATA,
    );
    expect(result.answer).toBe('NaCl');
  });

  it('Ca2+ + Cl- -> CaCl\u2082', () => {
    const result = runSolver(
      'solver.compose_salt_formula', {},
      { cation_id: 'Ca_2plus', anion_id: 'Cl_minus' },
      MOCK_DATA,
    );
    expect(result.answer).toBe('CaCl\u2082');
  });

  it('Na+ + SO4 2- -> Na\u2082SO\u2084', () => {
    const result = runSolver(
      'solver.compose_salt_formula', {},
      { cation_id: 'Na_plus', anion_id: 'SO4_2minus' },
      MOCK_DATA,
    );
    expect(result.answer).toBe('Na\u2082SO\u2084');
  });

  it('Al3+ + PO4 3- -> AlPO\u2084 (charges cancel 1:1)', () => {
    const result = runSolver(
      'solver.compose_salt_formula', {},
      { cation_id: 'Al_3plus', anion_id: 'PO4_3minus' },
      MOCK_DATA,
    );
    expect(result.answer).toBe('AlPO\u2084');
  });

  it('Ca2+ + PO4 3- -> Ca\u2083(PO\u2084)\u2082', () => {
    const result = runSolver(
      'solver.compose_salt_formula', {},
      { cation_id: 'Ca_2plus', anion_id: 'PO4_3minus' },
      MOCK_DATA,
    );
    expect(result.answer).toBe('Ca\u2083(PO\u2084)\u2082');
  });
});

describe('solver.solubility_check', () => {
  it('Na+ + Cl- -> soluble', () => {
    const result = runSolver(
      'solver.solubility_check', {},
      { cation_id: 'Na_plus', anion_id: 'Cl_minus' },
      MOCK_DATA,
    );
    expect(result.answer).toBe('soluble');
  });

  it('Ca2+ + SO4 2- -> insoluble (slightly_soluble maps to insoluble)', () => {
    const result = runSolver(
      'solver.solubility_check', {},
      { cation_id: 'Ca_2plus', anion_id: 'SO4_2minus' },
      MOCK_DATA,
    );
    expect(result.answer).toBe('insoluble');
  });
});

describe('runSolver', () => {
  it('throws on unknown solver ID', () => {
    expect(() => runSolver('solver.nonexistent', {}, {}, MOCK_DATA)).toThrow('Unknown solver');
  });
});
