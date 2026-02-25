import { describe, it, expect } from 'vitest';
import { runSolver } from '../solvers';
import type { OntologyData, PropertyDef } from '../types';
import type { Element } from '../../../types/element';
import type { Ion } from '../../../types/ion';

// ── Mock data ────────────────────────────────────────────────────

const MOCK_ELEMENTS: Element[] = [
  {
    Z: 1, symbol: 'H', name_ru: 'Водород', name_en: 'Hydrogen', name_latin: 'Hydrogenium',
    group: 1, period: 1, metal_type: 'nonmetal', element_group: 'nonmetal',
    atomic_mass: 1.008, typical_oxidation_states: [-1, 1], electronegativity: 2.2,
  },
  {
    Z: 6, symbol: 'C', name_ru: 'Углерод', name_en: 'Carbon', name_latin: 'Carboneum',
    group: 14, period: 2, metal_type: 'nonmetal', element_group: 'nonmetal',
    atomic_mass: 12.011, typical_oxidation_states: [-4, 2, 4], electronegativity: 2.55,
  },
  {
    Z: 8, symbol: 'O', name_ru: 'Кислород', name_en: 'Oxygen', name_latin: 'Oxygenium',
    group: 16, period: 2, metal_type: 'nonmetal', element_group: 'nonmetal',
    atomic_mass: 16.0, typical_oxidation_states: [-2], electronegativity: 3.44,
  },
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
  {
    Z: 26, symbol: 'Fe', name_ru: 'Железо', name_en: 'Iron', name_latin: 'Ferrum',
    group: 8, period: 4, metal_type: 'metal', element_group: 'transition_metal',
    atomic_mass: 55.845, typical_oxidation_states: [2, 3], electronegativity: 1.83,
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
  core: { elements: MOCK_ELEMENTS, ions: MOCK_IONS, properties: MOCK_PROPERTIES },
  rules: { solubilityPairs: MOCK_SOLUBILITY_PAIRS, oxidationExamples: [] },
  data: {},
  i18n: { morphology: null, promptTemplates: {} },
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

// ── solver.slot_lookup ────────────────────────────────────────────

describe('solver.slot_lookup', () => {
  it('returns a string slot value', () => {
    const result = runSolver(
      'solver.slot_lookup',
      { answer_field: 'bond_type' },
      { formula: 'NaCl', bond_type: 'ionic', crystal_type: 'ionic' },
      MOCK_DATA,
    );
    expect(result.answer).toBe('ionic');
  });

  it('returns a number slot value as number', () => {
    const result = runSolver(
      'solver.slot_lookup',
      { answer_field: 'period' },
      { element: 'Na', period: 3, group: 1 },
      MOCK_DATA,
    );
    expect(result.answer).toBe(3);
  });

  it('throws when the field does not exist in slots', () => {
    expect(() =>
      runSolver(
        'solver.slot_lookup',
        { answer_field: 'missing_field' },
        { formula: 'NaCl' },
        MOCK_DATA,
      ),
    ).toThrow('Slot "missing_field" not found in slots');
  });
});

// ── solver.compare_crystal_melting ───────────────────────────────

const MOCK_DATA_WITH_BONDS: OntologyData = {
  ...MOCK_DATA,
  rules: {
    ...MOCK_DATA.rules,
    bondExamples: {
      examples: [],
      crystal_melting_rank: { molecular: 1, metallic: 2, ionic: 3, atomic: 4 },
    },
  },
};

describe('solver.compare_crystal_melting', () => {
  it('returns higher-ranked formula as winner', () => {
    const result = runSolver(
      'solver.compare_crystal_melting', {},
      { formulaA: 'NaCl', formulaB: 'H2O', crystal_typeA: 'ionic', crystal_typeB: 'molecular' },
      MOCK_DATA_WITH_BONDS,
    );
    expect(result.answer).toBe('NaCl');
    expect(result.explanation_slots).toBeDefined();
    expect(result.explanation_slots!.winner).toBe('NaCl');
    expect(result.explanation_slots!.loser).toBe('H2O');
    expect(result.explanation_slots!.crystal_winner).toBe('ionic');
    expect(result.explanation_slots!.crystal_loser).toBe('molecular');
  });

  it('returns B when B has higher rank', () => {
    const result = runSolver(
      'solver.compare_crystal_melting', {},
      { formulaA: 'Fe', formulaB: 'SiO2', crystal_typeA: 'metallic', crystal_typeB: 'atomic' },
      MOCK_DATA_WITH_BONDS,
    );
    expect(result.answer).toBe('SiO2');
    expect(result.explanation_slots!.winner).toBe('SiO2');
    expect(result.explanation_slots!.loser).toBe('Fe');
  });

  it('returns A when ranks are equal', () => {
    const result = runSolver(
      'solver.compare_crystal_melting', {},
      { formulaA: 'NaCl', formulaB: 'KBr', crystal_typeA: 'ionic', crystal_typeB: 'ionic' },
      MOCK_DATA_WITH_BONDS,
    );
    expect(result.answer).toBe('NaCl');
  });

  it('throws when crystal_melting_rank is not available', () => {
    expect(() =>
      runSolver(
        'solver.compare_crystal_melting', {},
        { formulaA: 'NaCl', formulaB: 'H2O', crystal_typeA: 'ionic', crystal_typeB: 'molecular' },
        MOCK_DATA,
      ),
    ).toThrow('crystal_melting_rank not available');
  });
});

// ── solver.electron_config ───────────────────────────────────────

describe('solver.electron_config', () => {
  it('Na (Z=11): 1s\u00b2 2s\u00b2 2p\u2076 3s\u00b9', () => {
    const result = runSolver('solver.electron_config', {}, { Z: 11 }, MOCK_DATA);
    expect(result.answer).toBe('1s\u00b2 2s\u00b2 2p\u2076 3s\u00b9');
  });

  it('H (Z=1): 1s\u00b9', () => {
    const result = runSolver('solver.electron_config', {}, { Z: 1 }, MOCK_DATA);
    expect(result.answer).toBe('1s\u00b9');
  });

  it('He (Z=2): 1s\u00b2', () => {
    const result = runSolver('solver.electron_config', {}, { Z: 2 }, MOCK_DATA);
    expect(result.answer).toBe('1s\u00b2');
  });

  it('Cl (Z=17): 1s\u00b2 2s\u00b2 2p\u2076 3s\u00b2 3p\u2075', () => {
    const result = runSolver('solver.electron_config', {}, { Z: 17 }, MOCK_DATA);
    expect(result.answer).toBe('1s\u00b2 2s\u00b2 2p\u2076 3s\u00b2 3p\u2075');
  });

  it('Fe (Z=26): includes 3d\u2076', () => {
    const result = runSolver('solver.electron_config', {}, { Z: 26 }, MOCK_DATA);
    expect(result.answer).toBe('1s\u00b2 2s\u00b2 2p\u2076 3s\u00b2 3p\u2076 4s\u00b2 3d\u2076');
  });

  it('throws for invalid Z', () => {
    expect(() => runSolver('solver.electron_config', {}, { Z: 0 }, MOCK_DATA)).toThrow('Invalid Z');
  });
});

// ── solver.count_valence ────────────────────────────────────────

describe('solver.count_valence', () => {
  it('group 1 → 1 valence electron', () => {
    const result = runSolver('solver.count_valence', {}, { group: 1 }, MOCK_DATA);
    expect(result.answer).toBe(1);
  });

  it('group 2 → 2 valence electrons', () => {
    const result = runSolver('solver.count_valence', {}, { group: 2 }, MOCK_DATA);
    expect(result.answer).toBe(2);
  });

  it('group 17 → 7 valence electrons', () => {
    const result = runSolver('solver.count_valence', {}, { group: 17 }, MOCK_DATA);
    expect(result.answer).toBe(7);
  });

  it('group 14 → 4 valence electrons', () => {
    const result = runSolver('solver.count_valence', {}, { group: 14 }, MOCK_DATA);
    expect(result.answer).toBe(4);
  });

  it('group 18 → 8 valence electrons', () => {
    const result = runSolver('solver.count_valence', {}, { group: 18 }, MOCK_DATA);
    expect(result.answer).toBe(8);
  });

  it('transition metal group 8 → 8 (approx)', () => {
    const result = runSolver('solver.count_valence', {}, { group: 8 }, MOCK_DATA);
    expect(result.answer).toBe(8);
  });
});

// ── solver.delta_chi ────────────────────────────────────────────

describe('solver.delta_chi', () => {
  it('Na-Cl: \u0394\u03c7 = 2.23 → ionic', () => {
    const result = runSolver('solver.delta_chi', {}, { elementA: 'Na', elementB: 'Cl' }, MOCK_DATA);
    expect(result.answer).toBe('ionic');
    expect(result.explanation_slots).toBeDefined();
    expect(result.explanation_slots!.delta).toBe('2.23');
    expect(result.explanation_slots!.chiA).toBe('0.93');
    expect(result.explanation_slots!.chiB).toBe('3.16');
  });

  it('C-Cl: \u0394\u03c7 = 0.61 → covalent_polar', () => {
    const result = runSolver('solver.delta_chi', {}, { elementA: 'C', elementB: 'Cl' }, MOCK_DATA);
    expect(result.answer).toBe('covalent_polar');
    expect(result.explanation_slots!.delta).toBe('0.61');
  });

  it('H-H (same element): \u0394\u03c7 = 0 → covalent_nonpolar', () => {
    const result = runSolver('solver.delta_chi', {}, { elementA: 'H', elementB: 'H' }, MOCK_DATA);
    expect(result.answer).toBe('covalent_nonpolar');
    expect(result.explanation_slots!.delta).toBe('0');
  });
});

// ── solver.driving_force ────────────────────────────────────────

describe('solver.driving_force', () => {
  it('precipitate takes priority', () => {
    const result = runSolver('solver.driving_force', {}, {
      has_precipitate: true, has_gas: true, has_water: false, has_weak_electrolyte: false,
    }, MOCK_DATA);
    expect(result.answer).toBe('precipitate');
  });

  it('gas when no precipitate', () => {
    const result = runSolver('solver.driving_force', {}, {
      has_precipitate: false, has_gas: true, has_water: false, has_weak_electrolyte: false,
    }, MOCK_DATA);
    expect(result.answer).toBe('gas');
  });

  it('water as driving force', () => {
    const result = runSolver('solver.driving_force', {}, {
      has_precipitate: false, has_gas: false, has_water: 'true', has_weak_electrolyte: false,
    }, MOCK_DATA);
    expect(result.answer).toBe('water');
  });

  it('weak_electrolyte as driving force', () => {
    const result = runSolver('solver.driving_force', {}, {
      has_precipitate: false, has_gas: false, has_water: false, has_weak_electrolyte: 1,
    }, MOCK_DATA);
    expect(result.answer).toBe('weak_electrolyte');
  });

  it('none when no driving force', () => {
    const result = runSolver('solver.driving_force', {}, {
      has_precipitate: false, has_gas: false, has_water: false, has_weak_electrolyte: false,
    }, MOCK_DATA);
    expect(result.answer).toBe('none');
  });
});

// ── solver.activity_compare ─────────────────────────────────────

describe('solver.activity_compare', () => {
  it('lower position is more active: posA=3, posB=10 → yes', () => {
    const result = runSolver('solver.activity_compare', {}, { positionA: 3, positionB: 10 }, MOCK_DATA);
    expect(result.answer).toBe('yes');
  });

  it('higher position is less active: posA=10, posB=3 → no', () => {
    const result = runSolver('solver.activity_compare', {}, { positionA: 10, positionB: 3 }, MOCK_DATA);
    expect(result.answer).toBe('no');
  });

  it('equal position: posA=5, posB=5 → no', () => {
    const result = runSolver('solver.activity_compare', {}, { positionA: 5, positionB: 5 }, MOCK_DATA);
    expect(result.answer).toBe('no');
  });
});

// ── solver.predict_observation ──────────────────────────────────

describe('solver.predict_observation', () => {
  it('returns observation string directly', () => {
    const result = runSolver('solver.predict_observation', {}, {
      observation: 'white precipitate forms',
    }, MOCK_DATA);
    expect(result.answer).toBe('white precipitate forms');
  });

  it('throws when observation slot is missing', () => {
    expect(() =>
      runSolver('solver.predict_observation', {}, {}, MOCK_DATA),
    ).toThrow('observation slot not found');
  });
});

// ── solver.molar_mass ───────────────────────────────────────────

describe('solver.molar_mass', () => {
  it('H\u2082O: 2\u00d71.008 + 1\u00d716.0 = 18.016', () => {
    const result = runSolver('solver.molar_mass', {},
      { composition: JSON.stringify({ H: 2, O: 1 }) },
      MOCK_DATA,
    );
    expect(result.answer).toBe(18.02);
  });

  it('NaCl: 22.99 + 35.45 = 58.44', () => {
    const result = runSolver('solver.molar_mass', {},
      { composition: JSON.stringify({ Na: 1, Cl: 1 }) },
      MOCK_DATA,
    );
    expect(result.answer).toBe(58.44);
  });

  it('CO\u2082: 12.011 + 2\u00d716.0 = 44.011', () => {
    const result = runSolver('solver.molar_mass', {},
      { composition: JSON.stringify({ C: 1, O: 2 }) },
      MOCK_DATA,
    );
    expect(result.answer).toBe(44.01);
  });
});

// ── solver.mass_fraction ────────────────────────────────────────

describe('solver.mass_fraction', () => {
  it('O in H\u2082O: (16.0 \u00d7 1 / 18.016) \u00d7 100 \u2248 88.8%', () => {
    const result = runSolver('solver.mass_fraction',
      { target_element: 'O' },
      { M: 18.016, composition: JSON.stringify({ H: 2, O: 1 }) },
      MOCK_DATA,
    );
    expect(result.answer).toBe(88.8);
  });

  it('H in H\u2082O: (1.008 \u00d7 2 / 18.016) \u00d7 100 \u2248 11.2%', () => {
    const result = runSolver('solver.mass_fraction',
      { target_element: 'H' },
      { M: 18.016, composition: JSON.stringify({ H: 2, O: 1 }) },
      MOCK_DATA,
    );
    expect(result.answer).toBe(11.2);
  });

  it('throws when target element not in composition', () => {
    expect(() =>
      runSolver('solver.mass_fraction',
        { target_element: 'Fe' },
        { M: 18.016, composition: JSON.stringify({ H: 2, O: 1 }) },
        MOCK_DATA,
      ),
    ).toThrow('Element Fe not in composition');
  });
});

// ── solver.amount_calc ──────────────────────────────────────────

describe('solver.amount_calc', () => {
  it('mode n: n = 36 / 18 = 2.000', () => {
    const result = runSolver('solver.amount_calc', { mode: 'n' }, { mass: 36, M: 18 }, MOCK_DATA);
    expect(result.answer).toBe(2);
  });

  it('mode m: m = 0.5 \u00d7 58.44 = 29.22', () => {
    const result = runSolver('solver.amount_calc', { mode: 'm' }, { amount: 0.5, M: 58.44 }, MOCK_DATA);
    expect(result.answer).toBe(29.22);
  });

  it('mode n with decimal: n = 10 / 44 \u2248 0.227', () => {
    const result = runSolver('solver.amount_calc', { mode: 'n' }, { mass: 10, M: 44 }, MOCK_DATA);
    expect(result.answer).toBe(0.227);
  });

  it('throws on unknown mode', () => {
    expect(() =>
      runSolver('solver.amount_calc', { mode: 'x' }, { mass: 10, M: 18 }, MOCK_DATA),
    ).toThrow('Unknown amount_calc mode: x');
  });
});

// ── solver.concentration ────────────────────────────────────────

describe('solver.concentration', () => {
  it('default (omega): \u03c9 = (10 / 200) \u00d7 100 = 5.0', () => {
    const result = runSolver('solver.concentration', {},
      { m_solute: 10, m_solution: 200 },
      MOCK_DATA,
    );
    expect(result.answer).toBe(5);
  });

  it('inverse: m_solute = 5 \u00d7 200 / 100 = 10.0', () => {
    const result = runSolver('solver.concentration', { mode: 'inverse' },
      { omega: 5, m_solution: 200 },
      MOCK_DATA,
    );
    expect(result.answer).toBe(10);
  });

  it('dilution: m\u2082 = 20 \u00d7 100 / 5 = 400.0', () => {
    const result = runSolver('solver.concentration', { mode: 'dilution' },
      { omega1: 20, m1: 100, omega2: 5 },
      MOCK_DATA,
    );
    expect(result.answer).toBe(400);
  });

  it('throws on unknown mode', () => {
    expect(() =>
      runSolver('solver.concentration', { mode: 'molar' }, {}, MOCK_DATA),
    ).toThrow('Unknown concentration mode: molar');
  });
});

// ── solver.stoichiometry ────────────────────────────────────────

describe('solver.stoichiometry', () => {
  it('2H\u2082 + O\u2082 \u2192 2H\u2082O: given 4g H\u2082 (M=2, coeff=2), find H\u2082O (coeff=2, M=18) \u2192 36', () => {
    const result = runSolver('solver.stoichiometry', {}, {
      given_mass: 4, given_coeff: 2, given_M: 2,
      find_coeff: 2, find_M: 18,
    }, MOCK_DATA);
    expect(result.answer).toBe(36);
  });

  it('given 11.2g Fe (M=56, coeff=1), find product (coeff=1, M=160) \u2192 32', () => {
    const result = runSolver('solver.stoichiometry', {}, {
      given_mass: 11.2, given_coeff: 1, given_M: 56,
      find_coeff: 1, find_M: 160,
    }, MOCK_DATA);
    expect(result.answer).toBe(32);
  });

  it('given 10g CaCO3 (M=100, coeff=1), find CO2 (coeff=1, M=44) \u2192 4.4', () => {
    const result = runSolver('solver.stoichiometry', {}, {
      given_mass: 10, given_coeff: 1, given_M: 100,
      find_coeff: 1, find_M: 44,
    }, MOCK_DATA);
    expect(result.answer).toBe(4.4);
  });
});

// ── solver.reaction_yield ───────────────────────────────────────

describe('solver.reaction_yield', () => {
  it('theoretical 36g with 80% yield \u2192 28.8', () => {
    const result = runSolver('solver.reaction_yield', {}, {
      given_mass: 4, given_coeff: 2, given_M: 2,
      find_coeff: 2, find_M: 18,
      yield_percent: 80,
    }, MOCK_DATA);
    expect(result.answer).toBe(28.8);
  });

  it('100% yield equals stoichiometry result', () => {
    const result = runSolver('solver.reaction_yield', {}, {
      given_mass: 10, given_coeff: 1, given_M: 100,
      find_coeff: 1, find_M: 44,
      yield_percent: 100,
    }, MOCK_DATA);
    expect(result.answer).toBe(4.4);
  });

  it('50% yield halves the theoretical mass', () => {
    const result = runSolver('solver.reaction_yield', {}, {
      given_mass: 10, given_coeff: 1, given_M: 100,
      find_coeff: 1, find_M: 44,
      yield_percent: 50,
    }, MOCK_DATA);
    expect(result.answer).toBe(2.2);
  });
});

// ── Registry tests ───────────────────────────────────────────────

describe('runSolver', () => {
  it('throws on unknown solver ID', () => {
    expect(() => runSolver('solver.nonexistent', {}, {}, MOCK_DATA)).toThrow('Unknown solver');
  });
});
