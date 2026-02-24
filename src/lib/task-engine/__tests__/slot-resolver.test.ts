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
