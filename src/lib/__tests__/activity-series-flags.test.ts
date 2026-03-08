import { describe, it, expect } from 'vitest';
import activitySeriesData from '../../../data-src/rules/activity_series.json';
import qualitativeReactionsData from '../../../data-src/rules/qualitative_reactions.json';
import reactionObservationsData from '../../../data-src/rules/reaction_observations.json';
import substancePropertiesData from '../../../data-src/substances/substance_properties.json';
import templatesData from '../../../data-src/templates/rule_summary_templates.json';
import ruColorTerms from '../../../data-src/translations/ru/color_terms.json';
import enColorTerms from '../../../data-src/translations/en/color_terms.json';
import plColorTerms from '../../../data-src/translations/pl/color_terms.json';
import esColorTerms from '../../../data-src/translations/es/color_terms.json';
import ruIndicator from '../../../data-src/translations/ru/indicator_response_rules.json';
import enIndicator from '../../../data-src/translations/en/indicator_response_rules.json';
import plIndicator from '../../../data-src/translations/pl/indicator_response_rules.json';
import esIndicator from '../../../data-src/translations/es/indicator_response_rules.json';
import { generateActivityTexts, generateQualitativeTexts } from '../../../scripts/lib/generate-rule-texts.mjs';
import type { ActivitySeriesEntry } from '../../types/rules';

const series = activitySeriesData as unknown as ActivitySeriesEntry[];
const templates = templatesData as Record<string, Record<string, string>>;

// Merge color_terms locale packs
const colorTerms: Record<string, Record<string, string>> = {};
for (const [k, v] of Object.entries(ruColorTerms)) { if (!colorTerms[k]) colorTerms[k] = {}; colorTerms[k].ru = v; }
for (const [k, v] of Object.entries(enColorTerms)) { if (!colorTerms[k]) colorTerms[k] = {}; colorTerms[k].en = v; }
for (const [k, v] of Object.entries(plColorTerms)) { if (!colorTerms[k]) colorTerms[k] = {}; colorTerms[k].pl = v; }
for (const [k, v] of Object.entries(esColorTerms)) { if (!colorTerms[k]) colorTerms[k] = {}; colorTerms[k].es = v; }

const indicatorResponseLocale = { ru: ruIndicator, en: enIndicator, pl: plIndicator, es: esIndicator };

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

describe('generateQualitativeTexts (observation ontology)', () => {
  type QualReaction = { target_id: string; reagent_formula: string; reaction_id?: string; observation_facets?: string[] };
  const qualReactions = qualitativeReactionsData as QualReaction[];
  const reactionObs = reactionObservationsData as object[];
  const substanceProps = substancePropertiesData as object[];

  const texts = generateQualitativeTexts(
    qualReactions, reactionObs, substanceProps, colorTerms, indicatorResponseLocale, templates,
  );

  it('generates one entry per qualitative reaction with observation_facets', () => {
    const withFacets = qualReactions.filter(r => r.observation_facets?.length);
    expect(texts).toHaveLength(withFacets.length);
  });

  it('Cl- → observation_summary:qualitative.precipitate template', () => {
    const entry = texts.find((t: { target_id: string }) => t.target_id === 'Cl-');
    expect((entry as { template_id: string })?.template_id).toBe('observation_summary:qualitative.precipitate');
    expect((entry as { observation_id: string })?.observation_id).toBe('obs:precipitate_agcl');
  });

  it('CO3^2- → observation_summary:qualitative.gas_evolution template', () => {
    const entry = texts.find((t: { target_id: string }) => t.target_id === 'CO3^2-');
    expect((entry as { template_id: string })?.template_id).toBe('observation_summary:qualitative.gas_evolution');
    expect((entry as { observation_id: string })?.observation_id).toBe('obs:gas_co2');
  });

  it('NH3 → indicator_change template from rule-based model', () => {
    const entry = texts.find((t: { target_id: string }) => t.target_id === 'NH3');
    expect((entry as { template_id: string })?.template_id).toBe('observation_summary:qualitative.indicator_change');
    expect((entry as { observation_id: string })?.observation_id).toBe('obs:indicator_change:ind:litmus:medium:alkaline');
  });

  it('all entries have observation_summary in 4 locales', () => {
    for (const entry of texts) {
      const e = entry as { target_id: string; text_origin: string; generation_kind: string; slots: { observation_summary?: Record<string, string> } };
      expect(e.text_origin).toBe('generated');
      expect(e.generation_kind).toBe('observation_summary');
      expect(e.slots.observation_summary?.ru, `${e.target_id} ru`).toBeTruthy();
      expect(e.slots.observation_summary?.en, `${e.target_id} en`).toBeTruthy();
      expect(e.slots.observation_summary?.pl, `${e.target_id} pl`).toBeTruthy();
      expect(e.slots.observation_summary?.es, `${e.target_id} es`).toBeTruthy();
    }
  });

  it('Cl- (AgCl) ru: белый творожистый осадок AgCl derived from ontology', () => {
    const entry = texts.find((t: { target_id: string }) => t.target_id === 'Cl-') as { slots: { observation_summary?: Record<string, string> } };
    const ru = entry?.slots.observation_summary?.ru ?? '';
    expect(ru).toContain('белый');
    expect(ru).toContain('творожистый');
    expect(ru).toContain('AgCl');
  });

  it('Fe^3+ (Fe(OH)₃) ru: бурый осадок — chemistry-specific color term', () => {
    const entry = texts.find((t: { target_id: string }) => t.target_id === 'Fe^3+') as { slots: { observation_summary?: Record<string, string> } };
    expect(entry?.slots.observation_summary?.ru).toContain('бурый');
  });

  it('NH3 ru: посинение лакмуса — idiom from short_statement_override', () => {
    const entry = texts.find((t: { target_id: string }) => t.target_id === 'NH3') as { slots: { observation_summary?: Record<string, string> } };
    expect(entry?.slots.observation_summary?.ru).toBe('посинение лакмуса');
    expect(entry?.slots.observation_summary?.en).toBe('litmus turns blue');
  });

  it('CO3^2- gas: CO₂ formula in text', () => {
    const entry = texts.find((t: { target_id: string }) => t.target_id === 'CO3^2-') as { slots: { observation_summary?: Record<string, string> } };
    expect(entry?.slots.observation_summary?.ru).toContain('CO₂');
  });
});
