import { describe, it, expect } from 'vitest';
import { resolveSlots } from '../slot-resolver';
import type { PropertyDef, MorphologyData, PromptTemplate } from '../types';

const MOCK_PROPERTIES: PropertyDef[] = [
  {
    id: 'electronegativity', value_field: 'electronegativity', object: 'element',
    unit: null, trend_hint: { period: 'increases', group: 'decreases' }, filter: null,
    i18n: {
      ru: { nom: 'электроотрицательность', gen: 'электроотрицательности' },
      en: { name: 'electronegativity' },
    },
  },
];

const MOCK_MORPHOLOGY: MorphologyData = {
  elements: {
    Na: { nom: 'натрий', gen: 'натрия', gender: 'm' },
    Cl: { nom: 'хлор', gen: 'хлора', gender: 'm' },
  },
  properties: {
    electronegativity: { nom: 'электроотрицательность', gen: 'электроотрицательности', gender: 'f' },
  },
  directions: {
    ascending: { nom: 'возрастание', gen: 'возрастания' },
    descending: { nom: 'убывание', gen: 'убывания' },
  },
};

describe('resolveSlots', () => {
  it('resolves lookup: directive against properties', () => {
    const promptSlots: PromptTemplate['slots'] = {
      property_gen: 'lookup:properties.{property}.i18n.ru.gen',
    };
    const values = { property: 'electronegativity', elementA: 'Na', elementB: 'Cl' };
    const resolved = resolveSlots(promptSlots, values, { properties: MOCK_PROPERTIES, morphology: MOCK_MORPHOLOGY });
    expect(resolved['property_gen']).toBe('электроотрицательности');
  });

  it('resolves morph: directive', () => {
    const promptSlots: PromptTemplate['slots'] = {
      element_gen: 'morph:elements.{element}.gen',
    };
    const values = { element: 'Na', formula: 'NaCl' };
    const resolved = resolveSlots(promptSlots, values, { properties: MOCK_PROPERTIES, morphology: MOCK_MORPHOLOGY });
    expect(resolved['element_gen']).toBe('натрия');
  });

  it('resolves static map slots', () => {
    const promptSlots: PromptTemplate['slots'] = {
      order: { ascending: 'возрастания', descending: 'убывания' },
    };
    const values = { order: 'ascending' };
    const resolved = resolveSlots(promptSlots, values, { properties: MOCK_PROPERTIES, morphology: MOCK_MORPHOLOGY });
    expect(resolved['order']).toBe('возрастания');
  });

  it('passes through values without directives', () => {
    const promptSlots: PromptTemplate['slots'] = {};
    const values = { elementA: 'Na', elementB: 'Cl' };
    const resolved = resolveSlots(promptSlots, values, { properties: MOCK_PROPERTIES, morphology: MOCK_MORPHOLOGY });
    expect(resolved['elementA']).toBe('Na');
    expect(resolved['elementB']).toBe('Cl');
  });

  it('resolves lookup: for English locale', () => {
    const promptSlots: PromptTemplate['slots'] = {
      property: 'lookup:properties.{property}.i18n.en.name',
    };
    const values = { property: 'electronegativity', elementA: 'Na', elementB: 'Cl' };
    const resolved = resolveSlots(promptSlots, values, { properties: MOCK_PROPERTIES, morphology: null });
    expect(resolved['property']).toBe('electronegativity');
  });
});

describe('resolveSlots — PL morphology (7 cases)', () => {
  const PL_MORPHOLOGY: MorphologyData = {
    elements: {
      Na: { nom: 'sód', gen: 'sodu', dat: 'sodowi', acc: 'sód', inst: 'sodem', loc: 'sodzie', gender: 'm' },
    },
    properties: {
      electronegativity: { nom: 'elektroujemność', gen: 'elektroujemności', inst: 'elektroujemnością', gender: 'f' },
    },
    directions: {
      ascending: { nom: 'rosnący', gen: 'rosnącego' },
      descending: { nom: 'malejący', gen: 'malejącego' },
    },
    substance_classes: {
      acid: { nom: 'kwas', gen: 'kwasu', inst: 'kwasem', gender: 'm' },
    },
  };

  it('resolves PL genitive for element', () => {
    const slots: PromptTemplate['slots'] = { element_gen: 'morph:elements.{element}.gen' };
    const result = resolveSlots(slots, { element: 'Na' }, { properties: [], morphology: PL_MORPHOLOGY });
    expect(result['element_gen']).toBe('sodu');
  });

  it('resolves PL instrumental for element', () => {
    const slots: PromptTemplate['slots'] = { element_inst: 'morph:elements.{element}.inst' };
    const result = resolveSlots(slots, { element: 'Na' }, { properties: [], morphology: PL_MORPHOLOGY });
    expect(result['element_inst']).toBe('sodem');
  });

  it('resolves PL genitive from substance_classes domain', () => {
    const slots: PromptTemplate['slots'] = { class_gen: 'morph:substance_classes.acid.gen' };
    const result = resolveSlots(slots, {}, { properties: [], morphology: PL_MORPHOLOGY });
    expect(result['class_gen']).toBe('kwasu');
  });

  it('falls back gracefully when case field is absent', () => {
    const slots: PromptTemplate['slots'] = { element_voc: 'morph:elements.{element}.voc' };
    const result = resolveSlots(slots, { element: 'Na' }, { properties: [], morphology: PL_MORPHOLOGY });
    // voc not present → falls back to nom form
    expect(result['element_voc']).toBe('sód');
  });

  it('falls back to element symbol when entry is absent from morphology', () => {
    const slots: PromptTemplate['slots'] = { element_gen: 'morph:elements.{element}.gen' };
    const result = resolveSlots(slots, { element: 'Fe' }, { properties: [], morphology: PL_MORPHOLOGY });
    // Fe is not in PL_MORPHOLOGY.elements → resolveMorph should return the key 'Fe'
    expect(result['element_gen']).toBe('Fe');
  });
});

describe('resolveSlots — ES morphology (gender/article)', () => {
  const ES_MORPHOLOGY: MorphologyData = {
    elements: {
      Na: { nom: 'sodio', gen: 'sodio', gender: 'm', article_sg: 'el' },
    },
    properties: {
      electronegativity: { nom: 'electronegatividad', gen: 'electronegatividad', gender: 'f', article_sg: 'la' },
    },
    directions: {
      ascending: { nom: 'creciente', gen: 'creciente' },
      descending: { nom: 'decreciente', gen: 'decreciente' },
    },
    substance_classes: {
      acid: { nom: 'ácido', gen: 'ácido', gender: 'm', article_sg: 'el' },
    },
  };

  it('resolves ES nom for element', () => {
    const slots: PromptTemplate['slots'] = { element_name: 'morph:elements.{element}.nom' };
    const result = resolveSlots(slots, { element: 'Na' }, { properties: [], morphology: ES_MORPHOLOGY });
    expect(result['element_name']).toBe('sodio');
  });

  it('resolves ES article_sg for element', () => {
    const slots: PromptTemplate['slots'] = { article: 'morph:elements.{element}.article_sg' };
    const result = resolveSlots(slots, { element: 'Na' }, { properties: [], morphology: ES_MORPHOLOGY });
    expect(result['article']).toBe('el');
  });
});
