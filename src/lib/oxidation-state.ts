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
