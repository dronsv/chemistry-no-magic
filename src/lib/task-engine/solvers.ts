import type { Element } from '../../types/element';
import type { OntologyData, PropertyDef, SlotValues, SolverResult } from './types';

// ── Unicode helpers ──────────────────────────────────────────────

/** Unicode superscript digits and charge markers. */
const SUPERSCRIPT_CHARS = '\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079\u207a\u207b';

/** Unicode subscript digits. */
const SUBSCRIPT_MAP: Record<number, string> = {
  2: '\u2082', 3: '\u2083', 4: '\u2084', 5: '\u2085',
  6: '\u2086', 7: '\u2087', 8: '\u2088', 9: '\u2089',
};

/**
 * Strip trailing Unicode superscript charge markers from an ion formula.
 * E.g. "Na\u207a" -> "Na", "SO\u2084\u00b2\u207b" -> "SO\u2084", "PO\u2084\u00b3\u207b" -> "PO\u2084"
 */
function ionBase(formula: string): string {
  // Strip trailing chars that are superscript digits or +/- markers
  let end = formula.length;
  while (end > 0 && SUPERSCRIPT_CHARS.includes(formula[end - 1])) {
    end--;
  }
  return formula.slice(0, end);
}

/** Check if an ion base is polyatomic (more than just a single element symbol). */
function isPolyatomic(base: string): boolean {
  // A single element has pattern: uppercase letter + optional lowercase letters + optional subscript
  // Polyatomic ions have multiple uppercase letters or contain subscript digits between letters
  // Simple heuristic: count uppercase letters
  let uppercaseCount = 0;
  for (const ch of base) {
    if (ch >= 'A' && ch <= 'Z') uppercaseCount++;
  }
  return uppercaseCount > 1;
}

/** Compute GCD of two positive integers. */
function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

/** Compute LCM of two positive integers. */
function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b);
}

/** Get the value of a property field from an element. */
function getElementValue(el: Element, valueField: string): number | null {
  const val = (el as unknown as Record<string, unknown>)[valueField];
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') return val;
  return null;
}

/** Find a property definition by ID. */
function findProperty(propertyId: string, data: OntologyData): PropertyDef {
  const prop = data.properties.find(p => p.id === propertyId);
  if (!prop) throw new Error(`Unknown property: ${propertyId}`);
  return prop;
}

/** Find an element by symbol. */
function findElement(symbol: string, data: OntologyData): Element {
  const el = data.elements.find(e => e.symbol === symbol);
  if (!el) throw new Error(`Unknown element: ${symbol}`);
  return el;
}

// ── Solver implementations ───────────────────────────────────────

function solveCompareProperty(
  params: Record<string, unknown>,
  slots: SlotValues,
  data: OntologyData,
): SolverResult {
  void params;
  const symbolA = String(slots.elementA);
  const symbolB = String(slots.elementB);
  const propertyId = String(slots.property);

  const prop = findProperty(propertyId, data);
  const elA = findElement(symbolA, data);
  const elB = findElement(symbolB, data);

  const valA = getElementValue(elA, prop.value_field);
  const valB = getElementValue(elB, prop.value_field);

  if (valA === null || valB === null) {
    throw new Error(`Cannot compare: missing property value for ${symbolA} or ${symbolB}`);
  }

  const winner = valA >= valB ? symbolA : symbolB;
  const loser = winner === symbolA ? symbolB : symbolA;
  const winVal = winner === symbolA ? valA : valB;
  const loseVal = winner === symbolA ? valB : valA;

  return {
    answer: winner,
    explanation_slots: {
      winner,
      loser,
      valA: String(winVal),
      valB: String(loseVal),
    },
  };
}

function solvePeriodicTrendOrder(
  params: Record<string, unknown>,
  slots: SlotValues,
  data: OntologyData,
): SolverResult {
  void params;
  // Get element symbols from slots — could be array or comma-separated string
  let symbols: string[];
  if (Array.isArray(slots.element_symbols)) {
    symbols = slots.element_symbols.map(String);
  } else if (typeof slots.elements === 'string') {
    symbols = slots.elements.split(',').map(s => s.trim());
  } else {
    throw new Error('No element_symbols or elements in slots');
  }

  const propertyId = String(slots.property);
  const order = String(slots.order);
  const prop = findProperty(propertyId, data);

  // Look up values
  const withValues = symbols.map(sym => {
    const el = findElement(sym, data);
    const val = getElementValue(el, prop.value_field);
    if (val === null) throw new Error(`Missing property value for ${sym}`);
    return { symbol: sym, value: val };
  });

  // Sort
  withValues.sort((a, b) =>
    order === 'descending' ? b.value - a.value : a.value - b.value,
  );

  return {
    answer: withValues.map(w => w.symbol),
  };
}

function solveOxidationStates(
  params: Record<string, unknown>,
  slots: SlotValues,
): SolverResult {
  void params;
  const state = slots.expected_state;
  if (state === undefined || state === null) {
    throw new Error('expected_state not found in slots');
  }
  return {
    answer: Number(state),
  };
}

function solveComposeSaltFormula(
  params: Record<string, unknown>,
  slots: SlotValues,
  data: OntologyData,
): SolverResult {
  void params;
  const cationId = String(slots.cation_id);
  const anionId = String(slots.anion_id);

  const catIon = data.ions.find(i => i.id === cationId);
  const anIon = data.ions.find(i => i.id === anionId);

  if (!catIon || !anIon) {
    throw new Error(`Cannot find ions: ${cationId}, ${anionId}`);
  }

  const catCharge = Math.abs(catIon.charge);
  const anCharge = Math.abs(anIon.charge);

  // Use LCM to find subscripts
  const l = lcm(catCharge, anCharge);
  const catCount = l / catCharge;
  const anCount = l / anCharge;

  const catBase = ionBase(catIon.formula);
  const anBase = ionBase(anIon.formula);

  // Build formula
  let formula = '';

  // Cation part
  if (catCount === 1) {
    formula += catBase;
  } else {
    if (isPolyatomic(catBase)) {
      formula += `(${catBase})${SUBSCRIPT_MAP[catCount] ?? String(catCount)}`;
    } else {
      formula += catBase + (SUBSCRIPT_MAP[catCount] ?? String(catCount));
    }
  }

  // Anion part
  if (anCount === 1) {
    formula += anBase;
  } else {
    if (isPolyatomic(anBase)) {
      formula += `(${anBase})${SUBSCRIPT_MAP[anCount] ?? String(anCount)}`;
    } else {
      formula += anBase + (SUBSCRIPT_MAP[anCount] ?? String(anCount));
    }
  }

  return { answer: formula };
}

function solveSolubilityCheck(
  params: Record<string, unknown>,
  slots: SlotValues,
  data: OntologyData,
): SolverResult {
  void params;
  const cationId = String(slots.cation_id);
  const anionId = String(slots.anion_id);

  const pair = data.solubilityPairs.find(
    p => p.cation === cationId && p.anion === anionId,
  );

  if (!pair) {
    throw new Error(`No solubility data for ${cationId} + ${anionId}`);
  }

  // Map slightly_soluble and decomposes to insoluble for simplified answer
  const answer = pair.solubility === 'soluble' ? 'soluble' : 'insoluble';

  return { answer };
}

function solveSlotLookup(
  params: Record<string, unknown>,
  slots: SlotValues,
): SolverResult {
  const field = String(params.answer_field);
  const val = slots[field];
  if (val === undefined || val === null) {
    throw new Error(`Slot "${field}" not found in slots`);
  }
  return { answer: typeof val === 'number' ? val : String(val) };
}

function solveCompareCrystalMelting(
  params: Record<string, unknown>,
  slots: SlotValues,
  data: OntologyData,
): SolverResult {
  void params;
  const crystalA = String(slots.crystal_typeA);
  const crystalB = String(slots.crystal_typeB);
  const formulaA = String(slots.formulaA);
  const formulaB = String(slots.formulaB);

  const rank = data.bondExamples?.crystal_melting_rank;
  if (!rank) throw new Error('crystal_melting_rank not available');

  const rankA = rank[crystalA] ?? 0;
  const rankB = rank[crystalB] ?? 0;

  const winner = rankA >= rankB ? formulaA : formulaB;
  const loser = winner === formulaA ? formulaB : formulaA;

  return {
    answer: winner,
    explanation_slots: {
      winner,
      loser,
      crystal_winner: winner === formulaA ? crystalA : crystalB,
      crystal_loser: winner === formulaA ? crystalB : crystalA,
    },
  };
}

// ── Registry ─────────────────────────────────────────────────────

type SolverFn = (
  params: Record<string, unknown>,
  slots: SlotValues,
  data: OntologyData,
) => SolverResult;

const SOLVERS: Record<string, SolverFn> = {
  'solver.compare_property': solveCompareProperty,
  'solver.periodic_trend_order': solvePeriodicTrendOrder,
  'solver.oxidation_states': (params, slots) => solveOxidationStates(params, slots),
  'solver.compose_salt_formula': solveComposeSaltFormula,
  'solver.solubility_check': solveSolubilityCheck,
  'solver.slot_lookup': (params, slots) => solveSlotLookup(params, slots),
  'solver.compare_crystal_melting': solveCompareCrystalMelting,
};

export function runSolver(
  solverId: string,
  params: Record<string, unknown>,
  slots: SlotValues,
  data: OntologyData,
): SolverResult {
  const fn = SOLVERS[solverId];
  if (!fn) throw new Error(`Unknown solver: ${solverId}`);
  return fn(params, slots, data);
}
