import { describe, it, expect } from 'vitest';
import { generateParticipatesIn } from '../../../scripts/lib/generate-participates-in.mjs';
import { generateReactsWithClass } from '../../../scripts/lib/generate-reacts-with-class.mjs';
import { generateDetectedBy } from '../../../scripts/lib/generate-detected-by.mjs';
import { generateCausesEffect } from '../../../scripts/lib/generate-causes-effect.mjs';

// --- generateParticipatesIn ---

describe('generateParticipatesIn', () => {
  const substances = [
    { id: 'hcl', formula: 'HCl' },
    { id: 'naoh', formula: 'NaOH' },
    { id: 'nacl', formula: 'NaCl' },
    { id: 'h2o', formula: 'H2O', formula_display: 'H₂O' },
  ];

  it('generates reactant_in and product_of triples', () => {
    const reactions = [{
      reaction_id: 'neutralization_hcl_naoh',
      molecular: {
        reactants: [{ formula: 'HCl' }, { formula: 'NaOH' }],
        products: [{ formula: 'NaCl' }, { formula: 'H2O' }],
      },
    }];
    const triples = generateParticipatesIn(reactions, substances);
    expect(triples).toContainEqual({
      subject: 'sub:hcl', predicate: 'reactant_in', object: 'rx:neutralization_hcl_naoh', source_kind: 'derived',
    });
    expect(triples).toContainEqual({
      subject: 'sub:nacl', predicate: 'product_of', object: 'rx:neutralization_hcl_naoh', source_kind: 'derived',
    });
  });

  it('generates catalyst_in triples', () => {
    const reactions = [{
      reaction_id: 'rx1',
      molecular: { reactants: [], products: [] },
      conditions: { catalyst: 'MnO2' },
    }];
    const triples = generateParticipatesIn(reactions, []);
    expect(triples).toContainEqual({
      subject: 'mol:MnO2', predicate: 'catalyst_in', object: 'rx:rx1', source_kind: 'derived',
    });
  });

  it('generates oxidizing_agent_in and reducing_agent_in', () => {
    const reactions = [{
      reaction_id: 'rx_redox',
      molecular: { reactants: [], products: [] },
      redox: {
        oxidizer: { formula: 'HCl' },
        reducer: { formula: 'NaOH' },
      },
    }];
    const triples = generateParticipatesIn(reactions, substances);
    expect(triples).toContainEqual({
      subject: 'sub:hcl', predicate: 'oxidizing_agent_in', object: 'rx:rx_redox', source_kind: 'derived',
    });
    expect(triples).toContainEqual({
      subject: 'sub:naoh', predicate: 'reducing_agent_in', object: 'rx:rx_redox', source_kind: 'derived',
    });
  });

  it('deduplicates same formula appearing in multiple roles', () => {
    const reactions = [{
      reaction_id: 'rx_dup',
      molecular: {
        reactants: [{ formula: 'HCl' }, { formula: 'HCl' }],
        products: [],
      },
    }];
    const triples = generateParticipatesIn(reactions, substances);
    const hclTriples = triples.filter(t => t.subject === 'sub:hcl' && t.predicate === 'reactant_in');
    expect(hclTriples).toHaveLength(1);
  });

  it('falls back to mol: prefix for unknown formulas', () => {
    const reactions = [{
      reaction_id: 'rx_unknown',
      molecular: { reactants: [{ formula: 'XYZ' }], products: [] },
    }];
    const triples = generateParticipatesIn(reactions, substances);
    expect(triples[0].subject).toBe('mol:XYZ');
  });

  it('matches formula_display for lookup', () => {
    const reactions = [{
      reaction_id: 'rx_display',
      molecular: { reactants: [], products: [{ formula: 'H₂O' }] },
    }];
    const triples = generateParticipatesIn(reactions, substances);
    expect(triples[0].subject).toBe('sub:h2o');
  });

  it('returns empty for reactions with no molecular data', () => {
    expect(generateParticipatesIn([{ reaction_id: 'rx_empty' }], substances)).toEqual([]);
  });
});

// --- generateReactsWithClass ---

describe('generateReactsWithClass', () => {
  it('generates reacts_with_class for amphoteric_reaction', () => {
    const rules = [{
      rule_kind: 'amphoteric_reaction',
      subject_class: 'amphoteric_oxide',
      reacts_with: ['acid', 'base'],
    }];
    const triples = generateReactsWithClass(rules);
    expect(triples).toContainEqual({
      subject: 'class:amphoteric_oxide', predicate: 'reacts_with_class', object: 'class:acid',
      knowledge_level: 'school_convention', source_kind: 'derived',
    });
    expect(triples).toContainEqual({
      subject: 'class:amphoteric_oxide', predicate: 'reacts_with_class', object: 'class:base',
      knowledge_level: 'school_convention', source_kind: 'derived',
    });
  });

  it('generates passivates_in with condition', () => {
    const rules = [{
      rule_kind: 'passivation',
      metals: ['Al', 'Cr'],
      acids: ['H2SO4_conc', 'HNO3_conc'],
      condition: 'cold',
    }];
    const triples = generateReactsWithClass(rules);
    expect(triples).toHaveLength(4);
    expect(triples[0]).toMatchObject({
      subject: 'el:Al', predicate: 'passivates_in', object: 'sub:h2so4',
      condition: 'cold', knowledge_level: 'school_convention',
    });
  });

  it('generates decomposes_to triples for thermal_decomposition (one per product)', () => {
    const rules = [{
      rule_kind: 'thermal_decomposition',
      reactant_class: 'carbonate',
      product_classes: ['oxide', 'gas'],
      conditions: ['heating'],
    }];
    const triples = generateReactsWithClass(rules);
    expect(triples).toHaveLength(2);
    expect(triples[0]).toMatchObject({
      subject: 'class:carbonate', predicate: 'decomposes_to',
      object: 'class:oxide', condition: 'heating',
    });
    expect(triples[1]).toMatchObject({
      subject: 'class:carbonate', predicate: 'decomposes_to',
      object: 'class:gas', condition: 'heating',
    });
  });

  it('generates reacts_with_class for gas_evolution', () => {
    const rules = [{
      rule_kind: 'gas_evolution',
      reactant_class: 'sulfide',
      reagent_class: 'acid',
    }];
    const triples = generateReactsWithClass(rules);
    expect(triples).toContainEqual({
      subject: 'class:sulfide', predicate: 'reacts_with_class', object: 'class:acid',
      knowledge_level: 'school_convention', source_kind: 'derived',
    });
  });

  it('returns empty for unknown rule_kind', () => {
    expect(generateReactsWithClass([{ rule_kind: 'unknown' }])).toEqual([]);
  });
});

// --- generateDetectedBy ---

describe('generateDetectedBy', () => {
  const substances = [
    { id: 'agno3', formula: 'AgNO3' },
    { id: 'bacl2', formula: 'BaCl2' },
  ];

  it('maps known target_id to canonical ion ID', () => {
    const reactions = [{ target_id: 'Cl-', reagent_formula: 'AgNO3' }];
    const triples = generateDetectedBy(reactions, substances);
    expect(triples).toHaveLength(1);
    expect(triples[0]).toMatchObject({
      subject: 'ion:Cl_minus', predicate: 'detected_by', object: 'sub:agno3',
      source_kind: 'derived',
    });
  });

  it('falls back to mol: when reagent not in substances', () => {
    const reactions = [{ target_id: 'SO4^2-', reagent_formula: 'UnknownReagent' }];
    const triples = generateDetectedBy(reactions, substances);
    expect(triples[0].object).toBe('mol:UnknownReagent');
  });

  it('skips unmapped target_id', () => {
    const reactions = [{ target_id: 'UNKNOWN_ION', reagent_formula: 'AgNO3' }];
    const triples = generateDetectedBy(reactions, substances);
    expect(triples).toHaveLength(0);
  });

  it('maps gas targets to sub: prefix', () => {
    const reactions = [{ target_id: 'CO2', reagent_formula: 'Ca(OH)2' }];
    const triples = generateDetectedBy(reactions, []);
    expect(triples[0].subject).toBe('sub:co2');
  });

  it('skips entries with missing reagent_formula', () => {
    const reactions = [{ target_id: 'Cl-' }];
    const triples = generateDetectedBy(reactions, []);
    expect(triples).toHaveLength(0);
  });
});

// --- generateCausesEffect ---

describe('generateCausesEffect', () => {
  it('generates triples for string effects', () => {
    const vocab = [{ id: 'heating', effects: ['increase_rate', 'shift_equil'] }];
    const triples = generateCausesEffect(vocab);
    expect(triples).toHaveLength(2);
    expect(triples[0]).toMatchObject({
      subject: 'proc:heating', predicate: 'causes_effect', object: 'eff:increase_rate',
      source_kind: 'derived',
    });
  });

  it('generates triples with condition for guarded effects', () => {
    const vocab = [{ id: 'pressure_increase', effects: [{ id: 'shift_equil', when: 'gas_phase' }] }];
    const triples = generateCausesEffect(vocab);
    expect(triples).toHaveLength(1);
    expect(triples[0]).toMatchObject({
      subject: 'proc:pressure_increase', predicate: 'causes_effect', object: 'eff:shift_equil',
      condition: 'when:gas_phase', source_kind: 'derived',
    });
  });

  it('skips entries without effects array', () => {
    const vocab = [{ id: 'no_effects' }, { id: 'null_effects', effects: null }];
    expect(generateCausesEffect(vocab)).toEqual([]);
  });

  it('handles mixed string and object effects', () => {
    const vocab = [{
      id: 'catalyst',
      effects: ['increase_rate', { id: 'no_equil_change', when: 'always' }],
    }];
    const triples = generateCausesEffect(vocab);
    expect(triples).toHaveLength(2);
    expect(triples[0].condition).toBeUndefined();
    expect(triples[1].condition).toBe('when:always');
  });
});

// --- Integration: real data build output ---

describe('relation generators (live data)', () => {
  it('participates_in produces >100 triples from real reactions', async () => {
    const { readFileSync, readdirSync } = await import('fs');
    const { join } = await import('path');
    const hashes = readdirSync('public/data').filter(d => d !== 'latest');
    if (hashes.length === 0) return; // skip if not built
    const filePath = join('public/data', hashes[0], 'relations', 'participates_in.json');
    let data;
    try { data = JSON.parse(readFileSync(filePath, 'utf-8')); } catch { return; }
    expect(data.length).toBeGreaterThan(100);
    expect(data[0]).toHaveProperty('subject');
    expect(data[0]).toHaveProperty('predicate');
    expect(data[0]).toHaveProperty('object');
    expect(data[0].source_kind).toBe('derived');
  });
});
