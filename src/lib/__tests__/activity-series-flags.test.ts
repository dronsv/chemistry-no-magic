import { describe, it, expect } from 'vitest';
import activitySeriesData from '../../../data-src/rules/activity_series.json';
import qualitativeReactionsData from '../../../data-src/rules/qualitative_reactions.json';
import templatesData from '../../../data-src/templates/rule_summary_templates.json';
import ruVocab from '../../../data-src/translations/ru/rule_terms.json';
import enVocab from '../../../data-src/translations/en/rule_terms.json';
import plVocab from '../../../data-src/translations/pl/rule_terms.json';
import esVocab from '../../../data-src/translations/es/rule_terms.json';
import { generateActivityTexts, generateQualitativeTexts } from '../../../scripts/lib/generate-rule-texts.mjs';
import type { ActivitySeriesEntry } from '../../types/rules';

const series = activitySeriesData as unknown as ActivitySeriesEntry[];
const templates = templatesData as Record<string, Record<string, string>>;

// Merge locale packs into vocab format expected by generator
const vocab: Record<string, Record<string, string>> = {};
for (const [key, text] of Object.entries(ruVocab)) { if (!vocab[key]) vocab[key] = {}; vocab[key].ru = text; }
for (const [key, text] of Object.entries(enVocab)) { if (!vocab[key]) vocab[key] = {}; vocab[key].en = text; }
for (const [key, text] of Object.entries(plVocab)) { if (!vocab[key]) vocab[key] = {}; vocab[key].pl = text; }
for (const [key, text] of Object.entries(esVocab)) { if (!vocab[key]) vocab[key] = {}; vocab[key].es = text; }

describe('activity_series.json — machine flags', () => {
  it('Li, K, Ba, Ca, Na have reduces_H_from_water: true', () => {
    const waterMetals = ['Li', 'K', 'Ba', 'Ca', 'Na'];
    for (const sym of waterMetals) {
      const entry = series.find(e => e.symbol === sym);
      expect(entry?.reduces_H_from_water, `${sym}.reduces_H_from_water`).toBe(true);
    }
  });

  it('Mg, Al, Zn, Fe, Ni, Sn, Pb have reduces_H_from_water: false', () => {
    const acidOnlyMetals = ['Mg', 'Al', 'Zn', 'Fe', 'Ni', 'Sn', 'Pb'];
    for (const sym of acidOnlyMetals) {
      const entry = series.find(e => e.symbol === sym);
      expect(entry?.reduces_H_from_water, `${sym}.reduces_H_from_water`).toBe(false);
    }
  });

  it('Mg, Al, Zn, Fe, Ni, Sn, Pb have displacement_below: true', () => {
    const displacers = ['Mg', 'Al', 'Zn', 'Fe', 'Ni', 'Sn', 'Pb'];
    for (const sym of displacers) {
      const entry = series.find(e => e.symbol === sym);
      expect(entry?.displacement_below, `${sym}.displacement_below`).toBe(true);
    }
  });

  it('Li, K, Ba, Ca, Na, Cu, Hg, Ag, Pt, Au have displacement_below: false', () => {
    const nonDisplacers = ['Li', 'K', 'Ba', 'Ca', 'Na', 'Cu', 'Hg', 'Ag', 'Pt', 'Au'];
    for (const sym of nonDisplacers) {
      const entry = series.find(e => e.symbol === sym);
      expect(entry?.displacement_below, `${sym}.displacement_below`).toBe(false);
    }
  });
});

describe('generateActivityTexts', () => {
  const texts = generateActivityTexts(series, templates);

  it('excludes H (reference point)', () => {
    expect(texts.find(t => t.metal_symbol === 'H')).toBeUndefined();
  });

  it('returns 17 entries (18 metals minus H)', () => {
    expect(texts).toHaveLength(17);
  });

  it('K → reacts_water_and_acids template', () => {
    const entry = texts.find(t => t.metal_symbol === 'K');
    expect(entry?.template_id).toBe('activity_summary:reacts_water_and_acids');
  });

  it('Fe → reacts_acids_only template', () => {
    const entry = texts.find(t => t.metal_symbol === 'Fe');
    expect(entry?.template_id).toBe('activity_summary:reacts_acids_only');
  });

  it('Cu → noble_metal template', () => {
    const entry = texts.find(t => t.metal_symbol === 'Cu');
    expect(entry?.template_id).toBe('activity_summary:noble_metal');
  });

  it('all entries have text_origin generated and activity_summary slot in 4 locales', () => {
    for (const entry of texts) {
      expect(entry.text_origin).toBe('generated');
      expect(entry.generation_kind).toBe('activity_summary');
      expect(entry.slots.activity_summary?.ru, `${entry.metal_symbol} ru`).toBeTruthy();
      expect(entry.slots.activity_summary?.en, `${entry.metal_symbol} en`).toBeTruthy();
      expect(entry.slots.activity_summary?.pl, `${entry.metal_symbol} pl`).toBeTruthy();
      expect(entry.slots.activity_summary?.es, `${entry.metal_symbol} es`).toBeTruthy();
    }
  });
});

describe('generateQualitativeTexts', () => {
  const qualReactions = qualitativeReactionsData as Array<{ target_id: string; reagent_formula: string; reaction_id?: string; observation_facets?: string[] }>;
  const texts = generateQualitativeTexts(qualReactions, vocab, templates);

  it('generates one entry per qualitative reaction with observation_facets', () => {
    const withFacets = qualReactions.filter(r => r.observation_facets?.length);
    expect(texts).toHaveLength(withFacets.length);
  });

  it('Cl- → precipitate:AgCl template', () => {
    const entry = texts.find(t => t.target_id === 'Cl-');
    expect(entry?.template_id).toBe('observation_summary:qualitative.precipitate');
    expect(entry?.primary_facet).toBe('precipitate:AgCl');
  });

  it('CO3^2- → gas_evolution:CO2 template', () => {
    const entry = texts.find(t => t.target_id === 'CO3^2-');
    expect(entry?.template_id).toBe('observation_summary:qualitative.gas_evolution');
    expect(entry?.primary_facet).toBe('gas_evolution:CO2');
  });

  it('NH3 → indicator:litmus_blue template', () => {
    const entry = texts.find(t => t.target_id === 'NH3');
    expect(entry?.template_id).toBe('observation_summary:qualitative.indicator');
    expect(entry?.primary_facet).toBe('indicator:litmus_blue');
  });

  it('all entries have observation_summary in 4 locales', () => {
    for (const entry of texts) {
      expect(entry.text_origin).toBe('generated');
      expect(entry.generation_kind).toBe('observation_summary');
      expect(entry.slots.observation_summary?.ru, `${entry.target_id} ru`).toBeTruthy();
      expect(entry.slots.observation_summary?.en, `${entry.target_id} en`).toBeTruthy();
      expect(entry.slots.observation_summary?.pl, `${entry.target_id} pl`).toBeTruthy();
      expect(entry.slots.observation_summary?.es, `${entry.target_id} es`).toBeTruthy();
    }
  });

  it('Cl- ru text mentions белый and AgCl', () => {
    const entry = texts.find(t => t.target_id === 'Cl-');
    const ru = entry?.slots.observation_summary?.ru ?? '';
    expect(ru).toContain('белый');
    expect(ru).toContain('AgCl');
  });
});
