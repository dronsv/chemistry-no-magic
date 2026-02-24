import { describe, it, expect } from 'vitest';
import type { PromptTemplateMap, PropertyDef, MorphologyData } from '../types';

describe('engine data types', () => {
  it('PromptTemplateMap accepts valid prompt data', () => {
    const data: PromptTemplateMap = {
      'prompt.compare_property': {
        question: 'Which element has a higher {property}: {elementA} or {elementB}?',
        slots: { property: 'lookup:properties.{property}.i18n.en.name' },
      },
    };
    expect(data['prompt.compare_property'].question).toContain('{property}');
  });

  it('PropertyDef accepts valid property data', () => {
    const prop: PropertyDef = {
      id: 'electronegativity',
      value_field: 'electronegativity',
      object: 'element',
      unit: null,
      trend_hint: { period: 'increases', group: 'decreases' },
      filter: { min_Z: 1, max_Z: 86, exclude_groups: [18] },
      i18n: {
        ru: { nom: 'электроотрицательность', gen: 'электроотрицательности' },
        en: { name: 'electronegativity' },
      },
    };
    expect(prop.value_field).toBe('electronegativity');
  });

  it('MorphologyData accepts valid morphology', () => {
    const morph: MorphologyData = {
      elements: { H: { nom: 'водород', gen: 'водорода', gender: 'm' } },
      properties: { electronegativity: { nom: 'электроотрицательность', gen: 'электроотрицательности', gender: 'f' } },
      directions: { ascending: { nom: 'возрастание', gen: 'возрастания' } },
    };
    expect(morph.elements['H'].gen).toBe('водорода');
  });
});
