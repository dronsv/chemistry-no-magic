import { describe, it, expect } from 'vitest';
import { generateDistractors } from '../distractor-engine';
import type { OntologyData, PropertyDef } from '../types';
import type { Element } from '../../../types/element';
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

const MOCK_DATA: OntologyData = {
  elements: MOCK_ELEMENTS,
  ions: MOCK_IONS,
  properties: MOCK_PROPERTIES,
  solubilityPairs: [],
  oxidationExamples: [],
  morphology: null,
  promptTemplates: {},
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
