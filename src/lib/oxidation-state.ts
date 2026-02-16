/**
 * Oxidation state calculator for chemical formulas.
 * Covers standard OGE cases: fixed-state elements, H/O special cases,
 * algebraic solve for one unknown.
 */

import type { MetalType } from '../types/element';

export interface OxidationAssignment {
  symbol: string;
  state: number;
}

export interface OxidationResult {
  assignments: OxidationAssignment[];
  error?: string;
}

export type StepRuleId =
  | 'fluorine'
  | 'group1'
  | 'group2'
  | 'aluminum'
  | 'oxygen'
  | 'oxygen_peroxide'
  | 'hydrogen'
  | 'hydrogen_hydride'
  | 'algebraic'
  | 'simple_substance';

export interface SolveStep {
  symbol: string;
  state: number;
  rule_id: StepRuleId;
  equation?: string;
}

export interface ExplainedResult extends OxidationResult {
  steps: SolveStep[];
}

interface ElementInfo {
  group: number;
  metal_type: MetalType;
}

// --- Fixed oxidation state rules (OGE standard) ---

const ALWAYS_PLUS_1 = new Set(['Li', 'Na', 'K', 'Rb', 'Cs', 'Fr']);
const ALWAYS_PLUS_2 = new Set(['Be', 'Mg', 'Ca', 'Sr', 'Ba', 'Ra']);
const ALWAYS_PLUS_3 = new Set(['Al']);

/** Known peroxide formulas where O = −1 */
const PEROXIDES = new Set(['H2O2', 'Na2O2', 'BaO2', 'K2O2', 'Li2O2']);

/**
 * Compute oxidation states for a parsed formula.
 *
 * @param parsed - element→count map from parseFormula()
 * @param elementMap - symbol→{group, metal_type} lookup from loaded elements
 * @param rawFormula - original formula string (for peroxide detection)
 */
export function calcOxidationStates(
  parsed: Record<string, number>,
  elementMap: Map<string, ElementInfo>,
  rawFormula?: string,
): OxidationResult {
  const symbols = Object.keys(parsed);

  // Simple substance (one element) → state = 0
  if (symbols.length === 1) {
    return { assignments: [{ symbol: symbols[0], state: 0 }] };
  }

  const known = new Map<string, number>();
  const isPeroxide = rawFormula ? PEROXIDES.has(rawFormula) : false;

  // Apply fixed-state rules
  for (const sym of symbols) {
    if (sym === 'F') {
      known.set('F', -1);
    } else if (ALWAYS_PLUS_1.has(sym)) {
      known.set(sym, 1);
    } else if (ALWAYS_PLUS_2.has(sym)) {
      known.set(sym, 2);
    } else if (ALWAYS_PLUS_3.has(sym)) {
      known.set(sym, 3);
    } else if (sym === 'O') {
      known.set('O', isPeroxide ? -1 : -2);
    } else if (sym === 'H') {
      // H = −1 in metal hydrides (only H + one fixed-state metal)
      // Default to +1, override below if hydride detected
      known.set('H', 1);
    }
  }

  // Detect metal hydrides: formula has H + exactly one other element that is a metal
  if (symbols.includes('H') && symbols.length === 2) {
    const other = symbols.find(s => s !== 'H')!;
    const info = elementMap.get(other);
    if (info && info.metal_type === 'metal' && (ALWAYS_PLUS_1.has(other) || ALWAYS_PLUS_2.has(other))) {
      known.set('H', -1);
    }
  }

  // Find unknowns
  const unknowns = symbols.filter(s => !known.has(s));

  if (unknowns.length === 0) {
    // All known — just return
    return {
      assignments: symbols.map(s => ({ symbol: s, state: known.get(s)! })),
    };
  }

  if (unknowns.length === 1) {
    // Solve algebraically: sum of (state × count) = 0
    const unknown = unknowns[0];
    let knownSum = 0;
    for (const [sym, state] of known) {
      knownSum += state * parsed[sym];
    }
    const unknownState = -knownSum / parsed[unknown];

    // Check for integer result
    if (!Number.isInteger(unknownState)) {
      return {
        assignments: symbols.map(s => ({
          symbol: s,
          state: known.get(s) ?? 0,
        })),
        error: 'non_integer',
      };
    }

    return {
      assignments: symbols.map(s => ({
        symbol: s,
        state: s === unknown ? unknownState : known.get(s)!,
      })),
    };
  }

  // Multiple unknowns — ambiguous
  return {
    assignments: symbols.map(s => ({
      symbol: s,
      state: known.get(s) ?? 0,
    })),
    error: 'ambiguous',
  };
}

// --- Step-by-step solver ---

/** Format a signed number for equation display: +1 → "+1", −2 → "−2" */
function formatSigned(n: number): string {
  return n >= 0 ? `+${n}` : `\u2212${Math.abs(n)}`;
}

/**
 * Compute oxidation states with a step-by-step explanation.
 * Follows the same logic as calcOxidationStates() but records
 * each rule application as a SolveStep.
 */
export function explainOxidationSteps(
  parsed: Record<string, number>,
  elementMap: Map<string, ElementInfo>,
  rawFormula?: string,
): ExplainedResult {
  const symbols = Object.keys(parsed);
  const steps: SolveStep[] = [];

  // Simple substance (one element) -> state = 0
  if (symbols.length === 1) {
    const sym = symbols[0];
    steps.push({ symbol: sym, state: 0, rule_id: 'simple_substance' });
    return { assignments: [{ symbol: sym, state: 0 }], steps };
  }

  const known = new Map<string, number>();
  const isPeroxide = rawFormula ? PEROXIDES.has(rawFormula) : false;

  // Apply fixed-state rules and record steps
  for (const sym of symbols) {
    if (sym === 'F') {
      known.set('F', -1);
      steps.push({ symbol: 'F', state: -1, rule_id: 'fluorine' });
    } else if (ALWAYS_PLUS_1.has(sym)) {
      known.set(sym, 1);
      steps.push({ symbol: sym, state: 1, rule_id: 'group1' });
    } else if (ALWAYS_PLUS_2.has(sym)) {
      known.set(sym, 2);
      steps.push({ symbol: sym, state: 2, rule_id: 'group2' });
    } else if (ALWAYS_PLUS_3.has(sym)) {
      known.set(sym, 3);
      steps.push({ symbol: sym, state: 3, rule_id: 'aluminum' });
    } else if (sym === 'O') {
      const state = isPeroxide ? -1 : -2;
      const ruleId = isPeroxide ? 'oxygen_peroxide' : 'oxygen';
      known.set('O', state);
      steps.push({ symbol: 'O', state, rule_id: ruleId });
    } else if (sym === 'H') {
      known.set('H', 1);
      steps.push({ symbol: 'H', state: 1, rule_id: 'hydrogen' });
    }
  }

  // Detect metal hydrides: override H step if needed
  if (symbols.includes('H') && symbols.length === 2) {
    const other = symbols.find(s => s !== 'H')!;
    const info = elementMap.get(other);
    if (info && info.metal_type === 'metal' && (ALWAYS_PLUS_1.has(other) || ALWAYS_PLUS_2.has(other))) {
      known.set('H', -1);
      // Replace the hydrogen step with the hydride step
      const hStepIdx = steps.findIndex(s => s.symbol === 'H');
      if (hStepIdx !== -1) {
        steps[hStepIdx] = { symbol: 'H', state: -1, rule_id: 'hydrogen_hydride' };
      }
    }
  }

  const unknowns = symbols.filter(s => !known.has(s));

  if (unknowns.length === 0) {
    return {
      assignments: symbols.map(s => ({ symbol: s, state: known.get(s)! })),
      steps,
    };
  }

  if (unknowns.length === 1) {
    const unknown = unknowns[0];
    let knownSum = 0;
    for (const [sym, state] of known) {
      knownSum += state * parsed[sym];
    }
    const unknownState = -knownSum / parsed[unknown];

    if (!Number.isInteger(unknownState)) {
      return {
        assignments: symbols.map(s => ({
          symbol: s,
          state: known.get(s) ?? 0,
        })),
        steps,
        error: 'non_integer',
      };
    }

    // Build the equation string
    const terms: string[] = [];
    for (const sym of symbols) {
      const count = parsed[sym];
      if (sym === unknown) {
        terms.push(count === 1 ? 'x' : `${count}\u00d7x`);
      } else {
        const state = known.get(sym)!;
        terms.push(`${count}\u00d7(${formatSigned(state)})`);
      }
    }
    const equation = `${terms.join(' + ')} = 0 \u2192 x = ${formatSigned(unknownState)}`;

    steps.push({ symbol: unknown, state: unknownState, rule_id: 'algebraic', equation });

    return {
      assignments: symbols.map(s => ({
        symbol: s,
        state: s === unknown ? unknownState : known.get(s)!,
      })),
      steps,
    };
  }

  // Multiple unknowns — ambiguous
  return {
    assignments: symbols.map(s => ({
      symbol: s,
      state: known.get(s) ?? 0,
    })),
    steps,
    error: 'ambiguous',
  };
}
