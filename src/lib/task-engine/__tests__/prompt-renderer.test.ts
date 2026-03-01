import { describe, it, expect } from 'vitest';
import { renderPrompt, renderToRichText } from '../prompt-renderer';
import type { PromptTemplateMap, PropertyDef, MorphologyData } from '../types';

const MOCK_PROMPTS_RU: PromptTemplateMap = {
  'prompt.compare_property': {
    question: 'Какой из элементов имеет большее значение {property_gen}: {elementA} или {elementB}?',
    slots: { property_gen: 'lookup:properties.{property}.i18n.ru.gen' },
  },
  'prompt.order_by_property': {
    question: 'Расположите элементы {elements} в порядке {order} {property_gen}.',
    slots: {
      order: { ascending: 'возрастания', descending: 'убывания' },
      property_gen: 'lookup:properties.{property}.i18n.ru.gen',
    },
  },
  'prompt.determine_oxidation_state': {
    question: 'Определите степень окисления {element_gen} в {formula}.',
    slots: { element_gen: 'morph:elements.{element}.gen' },
  },
};

const MOCK_PROMPTS_EN: PromptTemplateMap = {
  'prompt.compare_property': {
    question: 'Which element has a higher {property}: {elementA} or {elementB}?',
    slots: { property: 'lookup:properties.{property}.i18n.en.name' },
  },
};

const MOCK_PROPERTIES: PropertyDef[] = [
  {
    id: 'electronegativity', value_field: 'electronegativity', object: 'element',
    unit: null, trend_hint: null, filter: null,
    i18n: { ru: { nom: 'электроотрицательность', gen: 'электроотрицательности' }, en: { name: 'electronegativity' } },
  },
];

const MOCK_MORPH: MorphologyData = {
  elements: { Mn: { nom: 'марганец', gen: 'марганца', gender: 'm' } },
  properties: {},
  directions: { ascending: { nom: 'возрастание', gen: 'возрастания' }, descending: { nom: 'убывание', gen: 'убывания' } },
};

describe('renderPrompt', () => {
  it('renders Russian compare_property prompt', () => {
    const text = renderPrompt('prompt.compare_property', { property: 'electronegativity', elementA: 'Na', elementB: 'Cl' }, {
      promptTemplates: MOCK_PROMPTS_RU, properties: MOCK_PROPERTIES, morphology: MOCK_MORPH,
    });
    expect(text).toBe('Какой из элементов имеет большее значение электроотрицательности: Na или Cl?');
  });

  it('renders English compare_property prompt', () => {
    const text = renderPrompt('prompt.compare_property', { property: 'electronegativity', elementA: 'Na', elementB: 'Cl' }, {
      promptTemplates: MOCK_PROMPTS_EN, properties: MOCK_PROPERTIES, morphology: null,
    });
    expect(text).toBe('Which element has a higher electronegativity: Na or Cl?');
  });

  it('renders Russian order_by_property prompt', () => {
    const text = renderPrompt('prompt.order_by_property', {
      property: 'electronegativity', elements: 'Na, Mg, Al, Si', order: 'ascending',
    }, { promptTemplates: MOCK_PROMPTS_RU, properties: MOCK_PROPERTIES, morphology: MOCK_MORPH });
    expect(text).toBe('Расположите элементы Na, Mg, Al, Si в порядке возрастания электроотрицательности.');
  });

  it('renders Russian oxidation state prompt with morphology', () => {
    const text = renderPrompt('prompt.determine_oxidation_state', {
      element: 'Mn', formula: 'KMnO₄',
    }, { promptTemplates: MOCK_PROMPTS_RU, properties: MOCK_PROPERTIES, morphology: MOCK_MORPH });
    expect(text).toBe('Определите степень окисления марганца в KMnO₄.');
  });

  it('throws on unknown prompt template ID', () => {
    expect(() =>
      renderPrompt('nonexistent', {}, { promptTemplates: MOCK_PROMPTS_RU, properties: MOCK_PROPERTIES, morphology: null })
    ).toThrow();
  });
});

describe('renderToRichText', () => {
  it('returns text-only segments for templates without refs', () => {
    const ctx = {
      promptTemplates: {
        'test.v1': { question: 'Какой тип связи в {formula}?', slots: { formula: 'direct' } },
      },
      properties: [] as PropertyDef[],
      morphology: null,
    };
    const result = renderToRichText('test.v1', { formula: 'NaCl' }, ctx);
    expect(result).toEqual([{ t: 'text', v: 'Какой тип связи в NaCl?' }]);
  });

  it('parses {ref:id|form} tokens into ref segments', () => {
    const ctx = {
      promptTemplates: {
        'test.v2': {
          question: 'Реакция {ref:grp:alkali_metals|gen_pl} с водой',
          slots: {},
        },
      },
      properties: [] as PropertyDef[],
      morphology: null,
    };
    const result = renderToRichText('test.v2', {}, ctx);
    expect(result).toEqual([
      { t: 'text', v: 'Реакция ' },
      { t: 'ref', id: 'grp:alkali_metals', form: 'gen_pl' },
      { t: 'text', v: ' с водой' },
    ]);
  });

  it('handles mixed slots and refs', () => {
    const ctx = {
      promptTemplates: {
        'test.v3': {
          question: '{substance_name} относится к {ref:cls:base|dat_pl}',
          slots: { substance_name: 'direct' },
        },
      },
      properties: [] as PropertyDef[],
      morphology: null,
    };
    const result = renderToRichText('test.v3', { substance_name: 'NaOH' }, ctx);
    expect(result).toEqual([
      { t: 'text', v: 'NaOH относится к ' },
      { t: 'ref', id: 'cls:base', form: 'dat_pl' },
    ]);
  });

  it('handles ref without form', () => {
    const ctx = {
      promptTemplates: {
        'test.v4': {
          question: 'Элемент из {ref:grp:halogens}',
          slots: {},
        },
      },
      properties: [] as PropertyDef[],
      morphology: null,
    };
    const result = renderToRichText('test.v4', {}, ctx);
    expect(result).toEqual([
      { t: 'text', v: 'Элемент из ' },
      { t: 'ref', id: 'grp:halogens' },
    ]);
  });
});
