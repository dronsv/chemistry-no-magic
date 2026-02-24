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

// ── Mock data for new generators ─────────────────────────────────

const MOCK_BOND_EXAMPLES = {
  examples: [
    { formula: 'NaCl', bond_type: 'ionic', crystal_type: 'ionic' },
    { formula: 'H2O', bond_type: 'covalent_polar', crystal_type: 'molecular' },
    { formula: 'H2', bond_type: 'covalent_nonpolar', crystal_type: 'molecular' },
    { formula: 'Fe', bond_type: 'metallic', crystal_type: 'metallic' },
    { formula: 'SiO2', bond_type: 'covalent_polar', crystal_type: 'atomic' },
  ],
  crystal_melting_rank: { molecular: 1, metallic: 2, ionic: 3, atomic: 4 },
};

const MOCK_SUBSTANCE_INDEX = [
  { id: 'nacl', formula: 'NaCl', class: 'salt', subclass: 'middle_salt' },
  { id: 'hcl', formula: 'HCl', class: 'acid', subclass: 'oxygen_free_acid' },
  { id: 'naoh', formula: 'NaOH', class: 'base', subclass: 'soluble_base' },
  { id: 'cao', formula: 'CaO', class: 'oxide', subclass: 'basic_oxide' },
  { id: 'h2so4', formula: 'H2SO4', class: 'acid', subclass: 'oxygen_acid' },
];

const MOCK_REACTIONS = [
  { reaction_id: 'rx1', equation: 'NaOH + HCl → NaCl + H2O', type_tags: ['exchange', 'neutralization'], title: '', phase: { medium: 'aq' as const }, conditions: {}, driving_forces: [], molecular: { reactants: [], products: [] }, ionic: {}, observations: {}, rate_tips: { how_to_speed_up: [] }, heat_effect: 'exo' as const, safety_notes: [], competencies: {} },
  { reaction_id: 'rx2', equation: 'Zn + CuSO4 → ZnSO4 + Cu', type_tags: ['substitution', 'redox'], title: '', phase: { medium: 'aq' as const }, conditions: {}, driving_forces: [], molecular: { reactants: [], products: [] }, ionic: {}, observations: {}, rate_tips: { how_to_speed_up: [] }, heat_effect: 'exo' as const, safety_notes: [], competencies: {} },
  { reaction_id: 'rx3', equation: 'CaCO3 → CaO + CO2', type_tags: ['decomposition'], title: '', phase: { medium: 's' as const }, conditions: {}, driving_forces: [], molecular: { reactants: [], products: [] }, ionic: {}, observations: {}, rate_tips: { how_to_speed_up: [] }, heat_effect: 'endo' as const, safety_notes: [], competencies: {} },
];

const dataWithBonds: OntologyData = { ...MOCK_DATA, bondExamples: MOCK_BOND_EXAMPLES };
const dataWithSubstances: OntologyData = { ...MOCK_DATA, substanceIndex: MOCK_SUBSTANCE_INDEX };
const dataWithReactions: OntologyData = { ...MOCK_DATA, reactions: MOCK_REACTIONS };

// ── Bond generator tests ─────────────────────────────────────────

describe('gen.pick_bond_example', () => {
  it('returns formula, bond_type, and crystal_type', () => {
    const result = runGenerator('gen.pick_bond_example', {}, dataWithBonds);
    expect(result).toHaveProperty('formula');
    expect(result).toHaveProperty('bond_type');
    expect(result).toHaveProperty('crystal_type');
    expect(typeof result.formula).toBe('string');
    expect(typeof result.bond_type).toBe('string');
    expect(typeof result.crystal_type).toBe('string');
  });

  it('filters by specific bond_type', () => {
    const result = runGenerator('gen.pick_bond_example', { bond_type: 'ionic' }, dataWithBonds);
    expect(result.formula).toBe('NaCl');
    expect(result.bond_type).toBe('ionic');
  });

  it('resolves placeholder bond_type to a valid type', () => {
    const validTypes = ['ionic', 'covalent_polar', 'covalent_nonpolar', 'metallic'];
    const result = runGenerator('gen.pick_bond_example', { bond_type: '{bond_type}' }, dataWithBonds);
    expect(validTypes).toContain(result.bond_type);
  });

  it('throws when bondExamples is missing', () => {
    expect(() => runGenerator('gen.pick_bond_example', {}, MOCK_DATA)).toThrow('bondExamples not available');
  });
});

describe('gen.pick_bond_pair', () => {
  it('returns two formulas with different crystal types', () => {
    const result = runGenerator('gen.pick_bond_pair', {}, dataWithBonds);
    expect(result).toHaveProperty('formulaA');
    expect(result).toHaveProperty('formulaB');
    expect(result).toHaveProperty('crystal_typeA');
    expect(result).toHaveProperty('crystal_typeB');
    expect(result.crystal_typeA).not.toBe(result.crystal_typeB);
  });

  it('throws when bondExamples is missing', () => {
    expect(() => runGenerator('gen.pick_bond_pair', {}, MOCK_DATA)).toThrow('bondExamples not available');
  });
});

// ── Substance generator tests ────────────────────────────────────

describe('gen.pick_substance_by_class', () => {
  it('returns formula, substance_class, and substance_subclass', () => {
    const result = runGenerator('gen.pick_substance_by_class', {}, dataWithSubstances);
    expect(result).toHaveProperty('formula');
    expect(result).toHaveProperty('substance_class');
    expect(result).toHaveProperty('substance_subclass');
    expect(typeof result.formula).toBe('string');
    expect(typeof result.substance_class).toBe('string');
  });

  it('filters by specific substance_class', () => {
    const result = runGenerator('gen.pick_substance_by_class', { substance_class: 'salt' }, dataWithSubstances);
    expect(result.substance_class).toBe('salt');
    expect(result.formula).toBe('NaCl');
  });

  it('resolves placeholder substance_class to a valid class', () => {
    const validClasses = ['oxide', 'acid', 'base', 'salt'];
    const result = runGenerator('gen.pick_substance_by_class', { substance_class: '{substance_class}' }, dataWithSubstances);
    expect(validClasses).toContain(result.substance_class);
  });

  it('throws when substanceIndex is missing', () => {
    expect(() => runGenerator('gen.pick_substance_by_class', {}, MOCK_DATA)).toThrow('substanceIndex not available');
  });
});

// ── Reaction generator tests ─────────────────────────────────────

describe('gen.pick_reaction', () => {
  it('returns equation, reaction_type, and reaction_id', () => {
    const result = runGenerator('gen.pick_reaction', {}, dataWithReactions);
    expect(result).toHaveProperty('equation');
    expect(result).toHaveProperty('reaction_type');
    expect(result).toHaveProperty('reaction_id');
    expect(typeof result.equation).toBe('string');
    expect(typeof result.reaction_type).toBe('string');
    expect(typeof result.reaction_id).toBe('string');
  });

  it('filters by specific type_tag', () => {
    const result = runGenerator('gen.pick_reaction', { type_tag: 'decomposition' }, dataWithReactions);
    expect(result.reaction_id).toBe('rx3');
    expect(result.reaction_type).toBe('decomposition');
  });

  it('resolves placeholder type_tag to a valid tag', () => {
    const validTags = ['exchange', 'substitution', 'decomposition', 'redox'];
    const result = runGenerator('gen.pick_reaction', { type_tag: '{type_tag}' }, dataWithReactions);
    expect(validTags).toContain(result.reaction_type);
  });

  it('uses first primary tag as reaction_type', () => {
    const result = runGenerator('gen.pick_reaction', { type_tag: 'substitution' }, dataWithReactions);
    expect(result.reaction_type).toBe('substitution');
  });

  it('throws when reactions is missing', () => {
    expect(() => runGenerator('gen.pick_reaction', {}, MOCK_DATA)).toThrow('reactions not available');
  });
});

// ── Element position generator tests ─────────────────────────────

describe('gen.pick_element_position', () => {
  it('returns element, period, group, and max_oxidation_state', () => {
    const result = runGenerator('gen.pick_element_position', {}, MOCK_DATA);
    expect(result).toHaveProperty('element');
    expect(result).toHaveProperty('period');
    expect(result).toHaveProperty('group');
    expect(result).toHaveProperty('max_oxidation_state');
    expect(typeof result.element).toBe('string');
    expect(typeof result.period).toBe('number');
    expect(typeof result.group).toBe('number');
    expect(typeof result.max_oxidation_state).toBe('number');
  });

  it('picks from valid elements (period 1-6, not lanthanide/actinide)', () => {
    const result = runGenerator('gen.pick_element_position', {}, MOCK_DATA);
    const el = MOCK_ELEMENTS.find(e => e.symbol === result.element);
    expect(el).toBeDefined();
    expect(el!.period).toBeGreaterThanOrEqual(1);
    expect(el!.period).toBeLessThanOrEqual(6);
    expect(el!.element_group).not.toBe('lanthanide');
    expect(el!.element_group).not.toBe('actinide');
  });

  it('computes max_oxidation_state correctly', () => {
    // P has typical_oxidation_states: [-3, 3, 5], max should be 5
    // Run several times to try hitting P
    let found = false;
    for (let i = 0; i < 50; i++) {
      const result = runGenerator('gen.pick_element_position', {}, MOCK_DATA);
      if (result.element === 'P') {
        expect(result.max_oxidation_state).toBe(5);
        found = true;
        break;
      }
    }
    // If we didn't find P in 50 tries (very unlikely), at least verify shape
    if (!found) {
      const result = runGenerator('gen.pick_element_position', {}, MOCK_DATA);
      expect(typeof result.max_oxidation_state).toBe('number');
    }
  });
});

// ── Registry tests ───────────────────────────────────────────────

describe('runGenerator', () => {
  it('throws on unknown generator ID', () => {
    expect(() => runGenerator('gen.nonexistent', {}, MOCK_DATA)).toThrow('Unknown generator');
  });
});
