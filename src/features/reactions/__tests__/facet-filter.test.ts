import { describe, it, expect } from 'vitest';
import type { Reaction, FacetState } from '../../../types/reaction';
import type { SubstanceIndexEntry } from '../../../types/classification';
import {
  createEmptyFacetState,
  isFacetEmpty,
  getReactionSubstanceClasses,
  matchesFacets,
  countForOption,
  applyPreset,
} from '../facet-filter';

/** Minimal mock reaction factory */
function mockReaction(overrides: Partial<Reaction> = {}): Reaction {
  return {
    reaction_id: 'r1',
    equation: 'A + B → C',
    phase: { medium: 'aq' },
    type_tags: ['exchange'],
    driving_forces: ['precipitation'],
    molecular: {
      reactants: [{ formula: 'HCl', coeff: 1 }],
      products: [{ formula: 'NaCl', coeff: 1 }],
    },
    ionic: {},
    observations: {},
    rate_tips: { how_to_speed_up: [] },
    heat_effect: 'unknown',
    safety_notes: [],
    competencies: { reactions_exchange: 'P' },
    schema_version: 2,
    ...overrides,
  };
}

function makeSubstanceMap(entries: SubstanceIndexEntry[]): Map<string, SubstanceIndexEntry> {
  const map = new Map<string, SubstanceIndexEntry>();
  for (const e of entries) map.set(e.formula, e);
  return map;
}

const EMPTY_MAP = new Map<string, SubstanceIndexEntry>();

// ──────────────────────────────────────────────
// Mock reactions for multi-test scenarios
// ──────────────────────────────────────────────

const rxExchange = mockReaction({
  reaction_id: 'rx_exch',
  type_tags: ['exchange', 'precipitation'],
  driving_forces: ['precipitation'],
  competencies: { reactions_exchange: 'P', gas_precipitate_logic: 'S' },
  molecular: {
    reactants: [{ formula: 'NaOH', coeff: 1 }, { formula: 'HCl', coeff: 1 }],
    products: [{ formula: 'NaCl', coeff: 1 }, { formula: 'H₂O', coeff: 1 }],
  },
});

const rxNeutralization = mockReaction({
  reaction_id: 'rx_neut',
  type_tags: ['exchange', 'neutralization'],
  driving_forces: ['water_formation'],
  competencies: { reactions_exchange: 'P' },
  molecular: {
    reactants: [{ formula: 'NaOH', coeff: 1 }, { formula: 'HCl', coeff: 1 }],
    products: [{ formula: 'NaCl', coeff: 1 }, { formula: 'H₂O', coeff: 1 }],
  },
});

const rxSubstitution = mockReaction({
  reaction_id: 'rx_sub',
  type_tags: ['substitution'],
  driving_forces: [],
  redox: { oxidizer: { formula: 'CuSO₄', element: 'Cu', from: 2, to: 0 }, reducer: { formula: 'Fe', element: 'Fe', from: 0, to: 2 } },
  competencies: { reactions_redox: 'P' },
  molecular: {
    reactants: [{ formula: 'Fe', coeff: 1 }, { formula: 'CuSO₄', coeff: 1 }],
    products: [{ formula: 'FeSO₄', coeff: 1 }, { formula: 'Cu', coeff: 1 }],
  },
});

const rxDecomposition = mockReaction({
  reaction_id: 'rx_dec',
  type_tags: ['decomposition'],
  driving_forces: ['gas_evolution'],
  competencies: { reaction_energy_profile: 'P' },
});

const rxQualitative = mockReaction({
  reaction_id: 'rx_qual',
  type_tags: ['exchange', 'qualitative_test'],
  driving_forces: ['precipitation'],
  competencies: { qualitative_analysis_logic: 'P' },
});

const allReactions = [rxExchange, rxNeutralization, rxSubstitution, rxDecomposition, rxQualitative];

const substanceMap = makeSubstanceMap([
  { id: 'naoh', formula: 'NaOH', name: 'Гидроксид натрия', class: 'base' },
  { id: 'hcl', formula: 'HCl', name: 'Хлороводородная кислота', class: 'acid' },
  { id: 'nacl', formula: 'NaCl', name: 'Хлорид натрия', class: 'salt' },
  { id: 'h2o', formula: 'H₂O', name: 'Вода', class: 'oxide' },
  { id: 'fe', formula: 'Fe', name: 'Железо', class: 'simple' },
  { id: 'cu', formula: 'Cu', name: 'Медь', class: 'simple' },
]);

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('createEmptyFacetState', () => {
  it('returns all defaults', () => {
    const s = createEmptyFacetState();
    expect(s.mechanism).toBe('all');
    expect(s.redox).toBe('all');
    expect(s.drivingForces.size).toBe(0);
    expect(s.substanceClasses.size).toBe(0);
    expect(s.educationalGoals.size).toBe(0);
  });
});

describe('isFacetEmpty', () => {
  it('returns true for empty state', () => {
    expect(isFacetEmpty(createEmptyFacetState())).toBe(true);
  });

  it('returns false when mechanism is set', () => {
    const s = createEmptyFacetState();
    s.mechanism = 'exchange';
    expect(isFacetEmpty(s)).toBe(false);
  });

  it('returns false when redox is set', () => {
    const s = createEmptyFacetState();
    s.redox = 'redox';
    expect(isFacetEmpty(s)).toBe(false);
  });

  it('returns false when drivingForces is non-empty', () => {
    const s = createEmptyFacetState();
    s.drivingForces.add('precipitation');
    expect(isFacetEmpty(s)).toBe(false);
  });

  it('returns false when substanceClasses is non-empty', () => {
    const s = createEmptyFacetState();
    s.substanceClasses.add('acid');
    expect(isFacetEmpty(s)).toBe(false);
  });

  it('returns false when educationalGoals is non-empty', () => {
    const s = createEmptyFacetState();
    s.educationalGoals.add('reactions_exchange');
    expect(isFacetEmpty(s)).toBe(false);
  });
});

describe('getReactionSubstanceClasses', () => {
  it('derives classes from reactants and products', () => {
    const classes = getReactionSubstanceClasses(rxNeutralization, substanceMap);
    expect(classes.has('base')).toBe(true);
    expect(classes.has('acid')).toBe(true);
    expect(classes.has('salt')).toBe(true);
    expect(classes.has('oxide')).toBe(true);
  });

  it('returns empty set when no formulas match substance map', () => {
    const classes = getReactionSubstanceClasses(rxNeutralization, EMPTY_MAP);
    expect(classes.size).toBe(0);
  });
});

describe('matchesFacets', () => {
  it('empty state matches all reactions', () => {
    const state = createEmptyFacetState();
    for (const r of allReactions) {
      expect(matchesFacets(r, state, EMPTY_MAP)).toBe(true);
    }
  });

  it('mechanism=exchange matches exchange/neutralization/precipitation tags', () => {
    const state = createEmptyFacetState();
    state.mechanism = 'exchange';
    expect(matchesFacets(rxExchange, state, EMPTY_MAP)).toBe(true);
    expect(matchesFacets(rxNeutralization, state, EMPTY_MAP)).toBe(true);
    expect(matchesFacets(rxQualitative, state, EMPTY_MAP)).toBe(true);
    expect(matchesFacets(rxSubstitution, state, EMPTY_MAP)).toBe(false);
    expect(matchesFacets(rxDecomposition, state, EMPTY_MAP)).toBe(false);
  });

  it('mechanism=substitution matches only substitution', () => {
    const state = createEmptyFacetState();
    state.mechanism = 'substitution';
    expect(matchesFacets(rxSubstitution, state, EMPTY_MAP)).toBe(true);
    expect(matchesFacets(rxExchange, state, EMPTY_MAP)).toBe(false);
  });

  it('mechanism=decomposition matches only decomposition', () => {
    const state = createEmptyFacetState();
    state.mechanism = 'decomposition';
    expect(matchesFacets(rxDecomposition, state, EMPTY_MAP)).toBe(true);
    expect(matchesFacets(rxExchange, state, EMPTY_MAP)).toBe(false);
  });

  it('redox=redox matches only reactions with redox field', () => {
    const state = createEmptyFacetState();
    state.redox = 'redox';
    expect(matchesFacets(rxSubstitution, state, EMPTY_MAP)).toBe(true);
    expect(matchesFacets(rxExchange, state, EMPTY_MAP)).toBe(false);
  });

  it('redox=non_redox excludes reactions with redox field', () => {
    const state = createEmptyFacetState();
    state.redox = 'non_redox';
    expect(matchesFacets(rxSubstitution, state, EMPTY_MAP)).toBe(false);
    expect(matchesFacets(rxExchange, state, EMPTY_MAP)).toBe(true);
  });

  it('drivingForces OR logic — precipitation|gas matches reactions with either', () => {
    const state = createEmptyFacetState();
    state.drivingForces.add('precipitation');
    state.drivingForces.add('gas_evolution');
    expect(matchesFacets(rxExchange, state, EMPTY_MAP)).toBe(true); // has precipitation
    expect(matchesFacets(rxDecomposition, state, EMPTY_MAP)).toBe(true); // has gas_evolution
    expect(matchesFacets(rxNeutralization, state, EMPTY_MAP)).toBe(false); // has water_formation
  });

  it('substanceClasses OR logic — acid matches reactions containing any acid', () => {
    const state = createEmptyFacetState();
    state.substanceClasses.add('acid');
    expect(matchesFacets(rxNeutralization, state, substanceMap)).toBe(true);
    expect(matchesFacets(rxSubstitution, state, substanceMap)).toBe(false);
  });

  it('educationalGoals OR logic — competency match', () => {
    const state = createEmptyFacetState();
    state.educationalGoals.add('qualitative_analysis_logic');
    expect(matchesFacets(rxQualitative, state, EMPTY_MAP)).toBe(true);
    expect(matchesFacets(rxExchange, state, EMPTY_MAP)).toBe(false);
  });

  it('AND across axes: mechanism=exchange + redox=non_redox', () => {
    const state = createEmptyFacetState();
    state.mechanism = 'exchange';
    state.redox = 'non_redox';
    const matches = allReactions.filter(r => matchesFacets(r, state, EMPTY_MAP));
    // Only exchange-type non-redox reactions
    expect(matches).toContain(rxExchange);
    expect(matches).toContain(rxNeutralization);
    expect(matches).toContain(rxQualitative);
    expect(matches).not.toContain(rxSubstitution);
    expect(matches).not.toContain(rxDecomposition);
  });

  it('AND across three axes narrows further', () => {
    const state = createEmptyFacetState();
    state.mechanism = 'exchange';
    state.redox = 'non_redox';
    state.drivingForces.add('water_formation');
    const matches = allReactions.filter(r => matchesFacets(r, state, EMPTY_MAP));
    expect(matches).toEqual([rxNeutralization]);
  });
});

describe('countForOption', () => {
  it('counts correctly for mechanism options', () => {
    const state = createEmptyFacetState();
    const exchangeCount = countForOption(allReactions, 'mechanism', 'exchange', state, EMPTY_MAP);
    expect(exchangeCount).toBe(3); // rxExchange, rxNeutralization, rxQualitative
    const subCount = countForOption(allReactions, 'mechanism', 'substitution', state, EMPTY_MAP);
    expect(subCount).toBe(1);
    const decCount = countForOption(allReactions, 'mechanism', 'decomposition', state, EMPTY_MAP);
    expect(decCount).toBe(1);
  });

  it('counts correctly for driving force options', () => {
    const state = createEmptyFacetState();
    const precipCount = countForOption(allReactions, 'drivingForces', 'precipitation', state, EMPTY_MAP);
    expect(precipCount).toBe(2); // rxExchange, rxQualitative
    const gasCount = countForOption(allReactions, 'drivingForces', 'gas_evolution', state, EMPTY_MAP);
    expect(gasCount).toBe(1); // rxDecomposition
  });
});

describe('applyPreset', () => {
  it('neutralization preset sets exchange + water_formation', () => {
    const s = applyPreset('neutralization');
    expect(s.mechanism).toBe('exchange');
    expect(s.drivingForces.has('water_formation')).toBe(true);
    expect(s.drivingForces.size).toBe(1);
  });

  it('precipitation_gas preset sets two driving forces', () => {
    const s = applyPreset('precipitation_gas');
    expect(s.mechanism).toBe('all');
    expect(s.drivingForces.has('precipitation')).toBe(true);
    expect(s.drivingForces.has('gas_evolution')).toBe(true);
    expect(s.drivingForces.size).toBe(2);
  });

  it('redox_only preset sets redox filter', () => {
    const s = applyPreset('redox_only');
    expect(s.redox).toBe('redox');
    expect(s.mechanism).toBe('all');
  });

  it('qualitative preset sets educational goal', () => {
    const s = applyPreset('qualitative');
    expect(s.educationalGoals.has('qualitative_analysis_logic')).toBe(true);
    expect(s.educationalGoals.size).toBe(1);
  });
});
