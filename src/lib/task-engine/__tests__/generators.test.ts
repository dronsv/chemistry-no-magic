import { describe, it, expect } from 'vitest';
import { runGenerator } from '../generators';
import type { OntologyData, PropertyDef } from '../types';
import type { Element } from '../../../types/element';
import type { Ion } from '../../../types/ion';
import type { OxidationExample } from '../../../types/oxidation';

// ── Mock data ────────────────────────────────────────────────────

const MOCK_ELEMENTS: Element[] = [
  {
    Z: 11, symbol: 'Na', name_ru: 'Натрий', name_en: 'Sodium', name_latin: 'Natrium',
    group: 1, period: 3, metal_type: 'metal', element_group: 'alkali_metal',
    atomic_mass: 22.99, typical_oxidation_states: [1], electronegativity: 0.93,
    melting_point_C: 97.8, boiling_point_C: 883, density_g_cm3: 0.97,
  },
  {
    Z: 12, symbol: 'Mg', name_ru: 'Магний', name_en: 'Magnesium', name_latin: 'Magnesium',
    group: 2, period: 3, metal_type: 'metal', element_group: 'alkaline_earth',
    atomic_mass: 24.305, typical_oxidation_states: [2], electronegativity: 1.31,
    melting_point_C: 650, boiling_point_C: 1091, density_g_cm3: 1.74,
  },
  {
    Z: 13, symbol: 'Al', name_ru: 'Алюминий', name_en: 'Aluminium', name_latin: 'Aluminium',
    group: 13, period: 3, metal_type: 'metal', element_group: 'post_transition_metal',
    atomic_mass: 26.982, typical_oxidation_states: [3], electronegativity: 1.61,
    melting_point_C: 660.3, boiling_point_C: 2519, density_g_cm3: 2.7,
  },
  {
    Z: 14, symbol: 'Si', name_ru: 'Кремний', name_en: 'Silicon', name_latin: 'Silicium',
    group: 14, period: 3, metal_type: 'metalloid', element_group: 'metalloid',
    atomic_mass: 28.086, typical_oxidation_states: [-4, 4], electronegativity: 1.9,
    melting_point_C: 1414, boiling_point_C: 3265, density_g_cm3: 2.33,
  },
  {
    Z: 15, symbol: 'P', name_ru: 'Фосфор', name_en: 'Phosphorus', name_latin: 'Phosphorus',
    group: 15, period: 3, metal_type: 'nonmetal', element_group: 'nonmetal',
    atomic_mass: 30.974, typical_oxidation_states: [-3, 3, 5], electronegativity: 2.19,
    melting_point_C: 44.15, boiling_point_C: 280.5, density_g_cm3: 1.82,
  },
];

const MOCK_PROPERTIES: PropertyDef[] = [
  {
    id: 'electronegativity', value_field: 'electronegativity', object: 'element',
    unit: null, trend_hint: { period: 'increases', group: 'decreases' },
    filter: { min_Z: 1, max_Z: 86, exclude_groups: [18] },
    i18n: { ru: { nom: 'электроотрицательность', gen: 'электроотрицательности' } },
  },
  {
    id: 'atomic_mass', value_field: 'atomic_mass', object: 'element',
    unit: 'u', trend_hint: null, filter: null,
    i18n: { ru: { nom: 'атомная масса', gen: 'атомной массы' } },
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

const MOCK_OXIDATION_EXAMPLES: OxidationExample[] = [
  { formula: 'H\u2082SO\u2084', target_element: 'S', oxidation_state: 6, difficulty: 'medium' },
  { formula: 'NaCl', target_element: 'Na', oxidation_state: 1, difficulty: 'easy' },
];

const MOCK_DATA: OntologyData = {
  elements: MOCK_ELEMENTS,
  ions: MOCK_IONS,
  properties: MOCK_PROPERTIES,
  solubilityPairs: MOCK_SOLUBILITY_PAIRS,
  oxidationExamples: MOCK_OXIDATION_EXAMPLES,
  morphology: null,
  promptTemplates: {},
};

// ── Tests ────────────────────────────────────────────────────────

describe('gen.pick_element_pair', () => {
  it('returns two distinct element symbols and a property', () => {
    const result = runGenerator('gen.pick_element_pair', { require_field: '{property}' }, MOCK_DATA);
    expect(result).toHaveProperty('elementA');
    expect(result).toHaveProperty('elementB');
    expect(result).toHaveProperty('property');
    expect(typeof result.elementA).toBe('string');
    expect(typeof result.elementB).toBe('string');
    expect(result.elementA).not.toBe(result.elementB);
    expect(MOCK_ELEMENTS.some(e => e.symbol === result.elementA)).toBe(true);
    expect(MOCK_ELEMENTS.some(e => e.symbol === result.elementB)).toBe(true);
    expect(MOCK_PROPERTIES.some(p => p.id === result.property)).toBe(true);
  });

  it('uses specific property when given explicitly', () => {
    const result = runGenerator('gen.pick_element_pair', { require_field: 'electronegativity' }, MOCK_DATA);
    expect(result.property).toBe('electronegativity');
  });

  it('picks from filtered elements with main_group filter', () => {
    const result = runGenerator('gen.pick_element_pair', { filter: 'main_group', require_field: 'electronegativity' }, MOCK_DATA);
    // All our mock elements are Z<=86 and none are noble_gas, so both should be valid
    expect(result.elementA).not.toBe(result.elementB);
  });
});

describe('gen.pick_elements_same_period', () => {
  it('returns elements from the same period with correct shape', () => {
    const result = runGenerator('gen.pick_elements_same_period', { k: 3, require_field: '{property}' }, MOCK_DATA);
    expect(result).toHaveProperty('elements');
    expect(result).toHaveProperty('element_symbols');
    expect(result).toHaveProperty('property');
    expect(result).toHaveProperty('order');
    expect(Array.isArray(result.element_symbols)).toBe(true);
    expect((result.element_symbols as string[]).length).toBe(3);
    expect(typeof result.elements).toBe('string');
    expect(['ascending', 'descending']).toContain(result.order);
  });

  it('returns unique symbols in element_symbols', () => {
    const result = runGenerator('gen.pick_elements_same_period', { k: 4, require_field: 'electronegativity' }, MOCK_DATA);
    const symbols = result.element_symbols as string[];
    const unique = new Set(symbols);
    expect(unique.size).toBe(symbols.length);
  });

  it('all returned elements are from the same period', () => {
    const result = runGenerator('gen.pick_elements_same_period', { k: 3, require_field: 'electronegativity' }, MOCK_DATA);
    const symbols = result.element_symbols as string[];
    const periods = symbols.map(s => MOCK_ELEMENTS.find(e => e.symbol === s)!.period);
    expect(new Set(periods).size).toBe(1);
  });

  it('uses explicit order when provided', () => {
    const result = runGenerator('gen.pick_elements_same_period', { k: 3, require_field: 'electronegativity', order: 'ascending' }, MOCK_DATA);
    expect(result.order).toBe('ascending');
  });

  it('resolves placeholder order to ascending or descending', () => {
    const result = runGenerator('gen.pick_elements_same_period', { k: 3, require_field: 'electronegativity', order: '{order}' }, MOCK_DATA);
    expect(['ascending', 'descending']).toContain(result.order);
  });
});

describe('gen.pick_oxidation_example', () => {
  it('returns formula, element, and expected_state', () => {
    const result = runGenerator('gen.pick_oxidation_example', {}, MOCK_DATA);
    expect(result).toHaveProperty('formula');
    expect(result).toHaveProperty('element');
    expect(result).toHaveProperty('expected_state');
    expect(typeof result.formula).toBe('string');
    expect(typeof result.element).toBe('string');
    expect(typeof result.expected_state).toBe('number');
  });

  it('filters by difficulty when given', () => {
    const result = runGenerator('gen.pick_oxidation_example', { difficulty: 'easy' }, MOCK_DATA);
    expect(result.formula).toBe('NaCl');
    expect(result.expected_state).toBe(1);
  });

  it('ignores placeholder difficulty', () => {
    const result = runGenerator('gen.pick_oxidation_example', { difficulty: '{level}' }, MOCK_DATA);
    // Should pick from all examples (placeholder is ignored)
    expect(MOCK_OXIDATION_EXAMPLES.some(ex => ex.formula === result.formula)).toBe(true);
  });
});

describe('gen.pick_ion_pair', () => {
  it('returns cation and anion with correct shape', () => {
    const result = runGenerator('gen.pick_ion_pair', {}, MOCK_DATA);
    expect(result).toHaveProperty('cation');
    expect(result).toHaveProperty('anion');
    expect(result).toHaveProperty('cation_id');
    expect(result).toHaveProperty('anion_id');
    expect(result).toHaveProperty('cation_charge');
    expect(result).toHaveProperty('anion_charge');
    expect(typeof result.cation).toBe('string');
    expect(typeof result.anion).toBe('string');
    expect(typeof result.cation_charge).toBe('number');
    expect(typeof result.anion_charge).toBe('number');
  });

  it('returns a cation and an anion (not two of the same type)', () => {
    const result = runGenerator('gen.pick_ion_pair', {}, MOCK_DATA);
    const catIon = MOCK_IONS.find(i => i.id === result.cation_id);
    const anIon = MOCK_IONS.find(i => i.id === result.anion_id);
    expect(catIon?.type).toBe('cation');
    expect(anIon?.type).toBe('anion');
  });

  it('cation_charge is positive and anion_charge is negative', () => {
    const result = runGenerator('gen.pick_ion_pair', {}, MOCK_DATA);
    expect(result.cation_charge as number).toBeGreaterThan(0);
    expect(result.anion_charge as number).toBeLessThan(0);
  });
});

describe('gen.pick_salt_pair', () => {
  it('returns salt pair with correct shape', () => {
    const result = runGenerator('gen.pick_salt_pair', {}, MOCK_DATA);
    expect(result).toHaveProperty('salt_formula');
    expect(result).toHaveProperty('cation_id');
    expect(result).toHaveProperty('anion_id');
    expect(result).toHaveProperty('cation_formula');
    expect(result).toHaveProperty('anion_formula');
    expect(result).toHaveProperty('expected_solubility');
    expect(typeof result.salt_formula).toBe('string');
    expect(typeof result.expected_solubility).toBe('string');
  });

  it('returns a pair that exists in solubilityPairs', () => {
    const result = runGenerator('gen.pick_salt_pair', {}, MOCK_DATA);
    const match = MOCK_SOLUBILITY_PAIRS.find(
      p => p.cation === result.cation_id && p.anion === result.anion_id,
    );
    expect(match).toBeDefined();
    expect(match!.solubility).toBe(result.expected_solubility);
  });

  it('cation_formula and anion_formula match ions data', () => {
    const result = runGenerator('gen.pick_salt_pair', {}, MOCK_DATA);
    const catIon = MOCK_IONS.find(i => i.id === result.cation_id);
    const anIon = MOCK_IONS.find(i => i.id === result.anion_id);
    if (catIon) expect(result.cation_formula).toBe(catIon.formula);
    if (anIon) expect(result.anion_formula).toBe(anIon.formula);
  });
});

describe('runGenerator', () => {
  it('throws on unknown generator ID', () => {
    expect(() => runGenerator('gen.nonexistent', {}, MOCK_DATA)).toThrow('Unknown generator');
  });
});
