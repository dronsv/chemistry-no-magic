import type { Reaction, FacetState, MechanismFilter, RedoxFilter } from '../../types/reaction';
import type { SubstanceIndexEntry } from '../../types/classification';

export function createEmptyFacetState(): FacetState {
  return {
    mechanism: 'all',
    redox: 'all',
    drivingForces: new Set(),
    substanceClasses: new Set(),
    educationalGoals: new Set(),
  };
}

export function isFacetEmpty(state: FacetState): boolean {
  return state.mechanism === 'all'
    && state.redox === 'all'
    && state.drivingForces.size === 0
    && state.substanceClasses.size === 0
    && state.educationalGoals.size === 0;
}

/** Derive substance classes participating in a reaction */
export function getReactionSubstanceClasses(
  reaction: Reaction,
  substanceMap: Map<string, SubstanceIndexEntry>,
): Set<string> {
  const classes = new Set<string>();
  for (const side of [reaction.molecular.reactants, reaction.molecular.products]) {
    for (const item of side) {
      const sub = substanceMap.get(item.formula);
      if (sub?.class) classes.add(sub.class);
    }
  }
  return classes;
}

/** Mechanism filter → which type_tags it matches */
const MECHANISM_TAGS: Record<Exclude<MechanismFilter, 'all'>, string[]> = {
  exchange: [
    'exchange', 'neutralization', 'precipitation', 'gas_evolution',
    'gas_absorption', 'amphoteric', 'acidic_oxide', 'complexation',
  ],
  substitution: ['substitution'],
  decomposition: ['decomposition'],
};

/** Does this reaction match the current facet state? */
export function matchesFacets(
  reaction: Reaction,
  state: FacetState,
  substanceMap: Map<string, SubstanceIndexEntry>,
): boolean {
  // Mechanism axis (radio — single selection)
  if (state.mechanism !== 'all') {
    const validTags = MECHANISM_TAGS[state.mechanism];
    if (!reaction.type_tags.some(t => validTags.includes(t))) return false;
  }

  // Redox axis (radio)
  if (state.redox === 'redox' && !reaction.redox) return false;
  if (state.redox === 'non_redox' && reaction.redox) return false;

  // Driving force axis (multi-checkbox, OR within)
  if (state.drivingForces.size > 0) {
    if (!reaction.driving_forces.some(f => state.drivingForces.has(f))) return false;
  }

  // Substance class axis (multi-checkbox, OR within)
  if (state.substanceClasses.size > 0) {
    const rxClasses = getReactionSubstanceClasses(reaction, substanceMap);
    let hasMatch = false;
    for (const c of state.substanceClasses) {
      if (rxClasses.has(c)) { hasMatch = true; break; }
    }
    if (!hasMatch) return false;
  }

  // Educational goal axis (multi-checkbox, OR within)
  if (state.educationalGoals.size > 0) {
    const rxComps = Object.keys(reaction.competencies);
    if (!rxComps.some(c => state.educationalGoals.has(c))) return false;
  }

  return true;
}

/** Count matching reactions for a specific option value on a given axis */
export function countForOption(
  reactions: Reaction[],
  axis: 'mechanism' | 'redox' | 'drivingForces' | 'substanceClasses' | 'educationalGoals',
  value: string,
  currentState: FacetState,
  substanceMap: Map<string, SubstanceIndexEntry>,
): number {
  // Build a temporary state with this option active
  const temp: FacetState = {
    mechanism: currentState.mechanism,
    redox: currentState.redox,
    drivingForces: new Set(currentState.drivingForces),
    substanceClasses: new Set(currentState.substanceClasses),
    educationalGoals: new Set(currentState.educationalGoals),
  };

  if (axis === 'mechanism') {
    temp.mechanism = value as MechanismFilter;
  } else if (axis === 'redox') {
    temp.redox = value as RedoxFilter;
  } else if (axis === 'drivingForces') {
    temp.drivingForces = new Set([value]);
  } else if (axis === 'substanceClasses') {
    temp.substanceClasses = new Set([value]);
  } else if (axis === 'educationalGoals') {
    temp.educationalGoals = new Set([value]);
  }

  // For checkbox axes, we want to show counts as if only this axis has that single value
  // but other axes remain as-is — so count matches with all other axes applied
  return reactions.filter(r => matchesFacets(r, temp, substanceMap)).length;
}

// Quick presets
export type PresetId = 'neutralization' | 'precipitation_gas' | 'redox_only' | 'qualitative';

export function applyPreset(presetId: PresetId): FacetState {
  const base = createEmptyFacetState();
  switch (presetId) {
    case 'neutralization':
      base.mechanism = 'exchange';
      base.drivingForces.add('water_formation');
      return base;
    case 'precipitation_gas':
      base.drivingForces.add('precipitation');
      base.drivingForces.add('gas_evolution');
      return base;
    case 'redox_only':
      base.redox = 'redox';
      return base;
    case 'qualitative':
      base.educationalGoals.add('qualitative_analysis_logic');
      return base;
    default:
      return base;
  }
}
