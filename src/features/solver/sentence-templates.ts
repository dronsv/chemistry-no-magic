import type { ReasoningQuery } from '../../types/derivation';
import type { AutocompleteOption } from './SlotAutocomplete';

// ── Slot definitions ───────────────────────────────────────

export interface SlotDef {
  id: string;
  kind: 'substance' | 'indicator' | 'number' | 'element' | 'quantity';
  filter?: string;               // e.g., 'acid', 'base', 'all'
  unit?: string;                 // e.g., 'г', '%', 'моль'
  defaultValue?: string | number;
  placeholder?: string;
}

export interface SentenceTemplate {
  id: string;
  label: string;
  sentence: Array<string | SlotDef>;
  buildQuery: (values: Record<string, string | number>) => ReasoningQuery;
}

export interface SlotDataSources {
  substances: (AutocompleteOption & { substanceClass?: string })[];
  indicators: AutocompleteOption[];
  elements: AutocompleteOption[];
}

// ── Default slot values → initial slot values map ──────────

export function getDefaults(tpl: SentenceTemplate): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const part of tpl.sentence) {
    if (typeof part !== 'string' && part.defaultValue !== undefined) {
      result[part.id] = part.defaultValue;
    }
  }
  return result;
}

// ── Template definitions (Russian) ─────────────────────────

export const SENTENCE_TEMPLATES: SentenceTemplate[] = [
  // Template 1: Indicator color on mixing acid + base
  {
    id: 'mixing_indicator',
    label: 'Цвет индикатора при смешении растворов',
    sentence: [
      'Как окрасится ',
      { id: 'indicator', kind: 'indicator', defaultValue: 'ind:litmus', placeholder: 'индикатор' },
      ' при смешении ',
      { id: 'mass_acid', kind: 'number', unit: 'г', defaultValue: 100 },
      ' г ',
      { id: 'frac_acid', kind: 'number', unit: '%', defaultValue: 10 },
      '% раствора ',
      { id: 'acid', kind: 'substance', filter: 'acid', defaultValue: 'sub:hcl', placeholder: 'кислота' },
      ' и ',
      { id: 'mass_base', kind: 'number', unit: 'г', defaultValue: 200 },
      ' г ',
      { id: 'frac_base', kind: 'number', unit: '%', defaultValue: 5 },
      '% раствора ',
      { id: 'base', kind: 'substance', filter: 'base', defaultValue: 'sub:naoh', placeholder: 'основание' },
      '?',
    ],
    buildQuery: (v) => ({
      system: {
        type: 'mixing',
        participants: [
          {
            role: 'acid',
            entity: String(v.acid ?? 'sub:hcl'),
            given: [
              { quantity: 'q:mass_fraction', value: Number(v.frac_acid ?? 10) / 100 },
              { quantity: 'q:mass', role: 'solution', value: Number(v.mass_acid ?? 100) },
            ],
          },
          {
            role: 'base',
            entity: String(v.base ?? 'sub:naoh'),
            given: [
              { quantity: 'q:mass_fraction', value: Number(v.frac_base ?? 5) / 100 },
              { quantity: 'q:mass', role: 'solution', value: Number(v.mass_base ?? 200) },
            ],
          },
        ],
      },
      find: { fact: 'indicator_color', params: { indicator: String(v.indicator ?? 'ind:litmus') } },
    }),
  },

  // Template 2: Medium on mixing acid + base
  {
    id: 'mixing_medium',
    label: 'Среда при смешении кислоты и основания',
    sentence: [
      'Определите среду раствора при смешении ',
      { id: 'mass_acid', kind: 'number', unit: 'г', defaultValue: 100 },
      ' г ',
      { id: 'frac_acid', kind: 'number', unit: '%', defaultValue: 4.9 },
      '% раствора ',
      { id: 'acid', kind: 'substance', filter: 'acid', defaultValue: 'sub:h2so4', placeholder: 'кислота' },
      ' и ',
      { id: 'mass_base', kind: 'number', unit: 'г', defaultValue: 100 },
      ' г ',
      { id: 'frac_base', kind: 'number', unit: '%', defaultValue: 5.6 },
      '% раствора ',
      { id: 'base', kind: 'substance', filter: 'base', defaultValue: 'sub:koh', placeholder: 'основание' },
      '.',
    ],
    buildQuery: (v) => ({
      system: {
        type: 'mixing',
        participants: [
          {
            role: 'acid',
            entity: String(v.acid ?? 'sub:h2so4'),
            given: [
              { quantity: 'q:mass_fraction', value: Number(v.frac_acid ?? 4.9) / 100 },
              { quantity: 'q:mass', role: 'solution', value: Number(v.mass_acid ?? 100) },
            ],
          },
          {
            role: 'base',
            entity: String(v.base ?? 'sub:koh'),
            given: [
              { quantity: 'q:mass_fraction', value: Number(v.frac_base ?? 5.6) / 100 },
              { quantity: 'q:mass', role: 'solution', value: Number(v.mass_base ?? 100) },
            ],
          },
        ],
      },
      find: { fact: 'medium' },
    }),
  },

  // Template 3: Molar mass
  {
    id: 'molar_mass',
    label: 'Молярная масса вещества',
    sentence: [
      'Вычислите молярную массу ',
      { id: 'substance', kind: 'substance', filter: 'all', defaultValue: 'sub:h2so4', placeholder: 'вещество' },
      '.',
    ],
    buildQuery: (v) => ({
      system: {
        type: 'single_substance',
        participants: [
          { role: 'substance', entity: String(v.substance ?? 'sub:h2so4'), given: [] },
        ],
      },
      find: { quantity: 'q:molar_mass', entity: String(v.substance ?? 'sub:h2so4') },
    }),
  },

  // Template 4: Mass fraction of element in substance
  {
    id: 'mass_fraction_element',
    label: 'Массовая доля элемента в веществе',
    sentence: [
      'Вычислите массовую долю ',
      { id: 'element', kind: 'element', placeholder: 'элемент' },
      ' в ',
      { id: 'substance', kind: 'substance', filter: 'all', defaultValue: 'sub:h2so4', placeholder: 'вещество' },
      '.',
    ],
    buildQuery: (v) => ({
      system: {
        type: 'single_substance',
        participants: [
          { role: 'substance', entity: String(v.substance ?? 'sub:h2so4'), given: [] },
        ],
      },
      find: {
        quantity: 'q:mass_fraction',
        entity: String(v.substance ?? 'sub:h2so4'),
        role: 'element',
      },
    }),
  },

  // Template 5: Amount from mass
  {
    id: 'amount_from_mass',
    label: 'Количество вещества по массе',
    sentence: [
      'Вычислите количество вещества для ',
      { id: 'mass', kind: 'number', unit: 'г', defaultValue: 49 },
      ' г ',
      { id: 'substance', kind: 'substance', filter: 'all', defaultValue: 'sub:h2so4', placeholder: 'вещество' },
      '.',
    ],
    buildQuery: (v) => ({
      system: {
        type: 'single_substance',
        participants: [
          {
            role: 'substance',
            entity: String(v.substance ?? 'sub:h2so4'),
            given: [{ quantity: 'q:mass', value: Number(v.mass ?? 49) }],
          },
        ],
      },
      find: { quantity: 'q:amount', entity: String(v.substance ?? 'sub:h2so4') },
    }),
  },
];
