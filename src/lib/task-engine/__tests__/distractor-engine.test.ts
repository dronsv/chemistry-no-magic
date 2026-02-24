import { describe, it, expect } from 'vitest';
import { generateDistractors } from '../distractor-engine';
import type { OntologyData, PropertyDef } from '../types';
import type { Element } from '../../../types/element';
import type { BondExamplesData } from '../../../types/bond';
import type { SubstanceIndexEntry } from '../../../types/classification';
import type { Ion } from '../../../types/ion';

// ── Minimal mock ontology ────────────────────────────────────────

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
  { id: 'Cl_minus', formula: 'Cl\u207b', charge: -1, type: 'anion', name_ru: 'Хлорид-ион', tags: ['chloride'] },
  { id: 'SO4_2minus', formula: 'SO\u2084\u00b2\u207b', charge: -2, type: 'anion', name_ru: 'Сульфат-ион', tags: ['sulfate'] },
  { id: 'PO4_3minus', formula: 'PO\u2084\u00b3\u207b', charge: -3, type: 'anion', name_ru: 'Фосфат-ион', tags: ['phosphate'] },
];

const MOCK_BOND_EXAMPLES: BondExamplesData = {
  examples: [
    { formula: 'NaCl', bond_type: 'ionic', crystal_type: 'ionic' },
    { formula: 'H\u2082O', bond_type: 'covalent_polar', crystal_type: 'molecular' },
    { formula: 'O\u2082', bond_type: 'covalent_nonpolar', crystal_type: 'molecular' },
    { formula: 'Fe', bond_type: 'metallic', crystal_type: 'metallic' },
    { formula: 'SiO\u2082', bond_type: 'covalent_polar', crystal_type: 'atomic' },
  ],
  crystal_melting_rank: { ionic: 3, molecular: 1, atomic: 4, metallic: 2 },
};

const MOCK_SUBSTANCE_INDEX: SubstanceIndexEntry[] = [
  { id: 'CaO', formula: 'CaO', name_ru: 'Оксид кальция', class: 'oxide' },
  { id: 'HCl', formula: 'HCl', name_ru: 'Соляная кислота', class: 'acid' },
  { id: 'NaOH', formula: 'NaOH', name_ru: 'Гидроксид натрия', class: 'base' },
  { id: 'NaCl', formula: 'NaCl', name_ru: 'Хлорид натрия', class: 'salt' },
];

const MOCK_DATA: OntologyData = {
  elements: MOCK_ELEMENTS,
  ions: MOCK_IONS,
  properties: MOCK_PROPERTIES,
  solubilityPairs: [],
  oxidationExamples: [],
  morphology: null,
  promptTemplates: {},
  bondExamples: MOCK_BOND_EXAMPLES,
  substanceIndex: MOCK_SUBSTANCE_INDEX,
};

// ── Tests ────────────────────────────────────────────────────────

describe('generateDistractors', () => {
  describe('element compare context', () => {
    it('returns other element, "одинаково", and "нельзя определить"', () => {
      const distractors = generateDistractors(
        'Cl',
        { elementA: 'Na', elementB: 'Cl', property: 'electronegativity' },
        'choice_single',
        MOCK_DATA,
        3,
      );
      expect(distractors).toHaveLength(3);
      expect(distractors).toContain('Na');
      expect(distractors).toContain('одинаково');
      expect(distractors).toContain('нельзя определить');
    });

    it('never includes the correct answer', () => {
      const distractors = generateDistractors(
        'Na',
        { elementA: 'Na', elementB: 'Cl', property: 'electronegativity' },
        'choice_single',
        MOCK_DATA,
        3,
      );
      expect(distractors).not.toContain('Na');
      expect(distractors).toContain('Cl');
    });

    it('respects count limit', () => {
      const distractors = generateDistractors(
        'Cl',
        { elementA: 'Na', elementB: 'Cl', property: 'electronegativity' },
        'choice_single',
        MOCK_DATA,
        2,
      );
      expect(distractors).toHaveLength(2);
    });
  });

  describe('numeric context', () => {
    it('generates integer distractors that do not include correct answer', () => {
      const distractors = generateDistractors(
        6,
        { formula: 'H\u2082SO\u2084', element: 'S', expected_state: 6 },
        'numeric_input',
        MOCK_DATA,
        4,
      );
      expect(distractors.length).toBe(4);
      expect(distractors).not.toContain('6');
      // Should include nearby integers like 5, 7, 4, 8, -6, 0
      for (const d of distractors) {
        expect(Number.isFinite(Number(d))).toBe(true);
      }
    });

    it('includes sign flip for nonzero values', () => {
      const distractors = generateDistractors(
        3,
        {},
        'numeric_input',
        MOCK_DATA,
        6,
      );
      expect(distractors).toContain('-3');
    });

    it('generates float distractors', () => {
      const distractors = generateDistractors(
        2.5,
        {},
        'numeric_input',
        MOCK_DATA,
        4,
      );
      expect(distractors.length).toBe(4);
      expect(distractors).not.toContain('2.5');
    });
  });

  describe('solubility context', () => {
    it('returns other solubility options for "soluble"', () => {
      const distractors = generateDistractors(
        'soluble',
        { expected_solubility: 'soluble' },
        'choice_single',
        MOCK_DATA,
        2,
      );
      expect(distractors).not.toContain('soluble');
      expect(distractors).toContain('insoluble');
      expect(distractors).toContain('slightly_soluble');
    });

    it('returns other solubility options for "insoluble"', () => {
      const distractors = generateDistractors(
        'insoluble',
        { expected_solubility: 'insoluble' },
        'choice_single',
        MOCK_DATA,
        2,
      );
      expect(distractors).not.toContain('insoluble');
      expect(distractors).toContain('soluble');
      expect(distractors).toContain('slightly_soluble');
    });

    it('detects solubility answer even without expected_solubility slot', () => {
      const distractors = generateDistractors(
        'soluble',
        {},
        'choice_single',
        MOCK_DATA,
        2,
      );
      expect(distractors).toContain('insoluble');
    });
  });

  describe('formula / ion context', () => {
    it('generates formula distractors using other anions', () => {
      const distractors = generateDistractors(
        'NaCl',
        { cation_id: 'Na_plus', anion_id: 'Cl_minus' },
        'choice_single',
        MOCK_DATA,
        3,
      );
      expect(distractors.length).toBeGreaterThanOrEqual(2);
      expect(distractors).not.toContain('NaCl');
    });

    it('includes formula with swapped subscripts', () => {
      const distractors = generateDistractors(
        'Na\u2082SO\u2084',
        { cation_id: 'Na_plus', anion_id: 'SO4_2minus' },
        'choice_single',
        MOCK_DATA,
        5,
      );
      expect(distractors).not.toContain('Na\u2082SO\u2084');
      // Should have a variant with subscript 3 instead of 2
      expect(distractors.some(d => d.includes('\u2083'))).toBe(true);
    });
  });

  describe('melting compare context', () => {
    it('returns other formula, "одинаково", and "нельзя определить"', () => {
      const distractors = generateDistractors(
        'NaCl',
        { formulaA: 'NaCl', formulaB: 'SiO\u2082', crystal_typeA: 'ionic', crystal_typeB: 'atomic' },
        'choice_single',
        MOCK_DATA,
        3,
      );
      expect(distractors).toHaveLength(3);
      expect(distractors).toContain('SiO\u2082');
      expect(distractors).toContain('одинаково');
      expect(distractors).toContain('нельзя определить');
    });

    it('never includes the correct answer', () => {
      const distractors = generateDistractors(
        'SiO\u2082',
        { formulaA: 'NaCl', formulaB: 'SiO\u2082', crystal_typeA: 'ionic', crystal_typeB: 'atomic' },
        'choice_single',
        MOCK_DATA,
        3,
      );
      expect(distractors).not.toContain('SiO\u2082');
      expect(distractors).toContain('NaCl');
    });
  });

  describe('domain enum context', () => {
    it('generates other bond types for a bond type answer', () => {
      const distractors = generateDistractors(
        'covalent_polar',
        { formula: 'H\u2082O' },
        'choice_single',
        MOCK_DATA,
        3,
      );
      expect(distractors).toHaveLength(3);
      expect(distractors).toContain('ionic');
      expect(distractors).toContain('covalent_nonpolar');
      expect(distractors).toContain('metallic');
      expect(distractors).not.toContain('covalent_polar');
    });

    it('generates other crystal types for a crystal type answer', () => {
      const distractors = generateDistractors(
        'molecular',
        { formula: 'H\u2082O' },
        'choice_single',
        MOCK_DATA,
        3,
      );
      expect(distractors).toHaveLength(3);
      expect(distractors).not.toContain('molecular');
      expect(distractors).toContain('atomic');
    });

    it('generates other substance classes for a substance class answer', () => {
      const distractors = generateDistractors(
        'acid',
        { formula: 'HCl' },
        'choice_single',
        MOCK_DATA,
        3,
      );
      expect(distractors).toHaveLength(3);
      expect(distractors).toContain('oxide');
      expect(distractors).toContain('base');
      expect(distractors).toContain('salt');
      expect(distractors).not.toContain('acid');
    });

    it('generates other reaction types for a reaction type answer', () => {
      const distractors = generateDistractors(
        'exchange',
        { reaction_id: 'r1' },
        'choice_single',
        MOCK_DATA,
        3,
      );
      expect(distractors).toHaveLength(3);
      expect(distractors).toContain('substitution');
      expect(distractors).toContain('decomposition');
      expect(distractors).toContain('redox');
      expect(distractors).not.toContain('exchange');
    });

    it('"ionic" answer without element slots uses domain enum, not element compare', () => {
      const distractors = generateDistractors(
        'ionic',
        { formula: 'NaCl' },
        'choice_single',
        MOCK_DATA,
        3,
      );
      expect(distractors).toHaveLength(3);
      expect(distractors).toContain('covalent_polar');
      expect(distractors).toContain('covalent_nonpolar');
      expect(distractors).toContain('metallic');
      // Should NOT contain element symbols (that would be fallback behavior)
      expect(distractors).not.toContain('Na');
      expect(distractors).not.toContain('Cl');
    });
  });

  describe('substance formula context', () => {
    it('generates other formulas from bond examples when bond_type slot is set', () => {
      const distractors = generateDistractors(
        'H\u2082O',
        { bond_type: 'covalent_polar', formula: 'H\u2082O' },
        'choice_single',
        MOCK_DATA,
        3,
      );
      expect(distractors.length).toBeGreaterThanOrEqual(3);
      expect(distractors).not.toContain('H\u2082O');
      // Should contain formulas from bond examples
      for (const d of distractors) {
        expect(MOCK_BOND_EXAMPLES.examples.some(ex => ex.formula === d)).toBe(true);
      }
    });

    it('generates formulas from substance index when substance_class slot is set', () => {
      const distractors = generateDistractors(
        'CaO',
        { substance_class: 'oxide', formula: 'CaO' },
        'choice_single',
        MOCK_DATA,
        3,
      );
      expect(distractors.length).toBeGreaterThanOrEqual(2);
      expect(distractors).not.toContain('CaO');
      // Should contain formulas from other substance classes
      for (const d of distractors) {
        expect(MOCK_SUBSTANCE_INDEX.some(s => s.formula === d)).toBe(true);
      }
    });
  });

  describe('fallback context', () => {
    it('returns element symbols when no context matches', () => {
      const distractors = generateDistractors(
        'something',
        {},
        'choice_single',
        MOCK_DATA,
        3,
      );
      expect(distractors.length).toBe(3);
      expect(distractors).not.toContain('something');
      for (const d of distractors) {
        expect(MOCK_ELEMENTS.some(el => el.symbol === d)).toBe(true);
      }
    });
  });

  describe('deduplication', () => {
    it('returns unique distractors', () => {
      const distractors = generateDistractors(
        'Cl',
        { elementA: 'Na', elementB: 'Cl', property: 'electronegativity' },
        'choice_single',
        MOCK_DATA,
        3,
      );
      const unique = new Set(distractors);
      expect(unique.size).toBe(distractors.length);
    });
  });
});
