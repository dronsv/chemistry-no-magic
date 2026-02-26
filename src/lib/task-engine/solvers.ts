import type { Element } from '../../types/element';
import type { OntologyData, PropertyDef, SlotValues, SolverResult } from './types';
import { getElectronConfig, setConfigOverrides, toSuperscript } from '../electron-config';
import { determineBondType } from '../bond-calculator';

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
  const prop = data.core.properties.find(p => p.id === propertyId);
  if (!prop) throw new Error(`Unknown property: ${propertyId}`);
  return prop;
}

/** Find an element by symbol. */
function findElement(symbol: string, data: OntologyData): Element {
  const el = data.core.elements.find(e => e.symbol === symbol);
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

  const catIon = data.core.ions.find(i => i.id === cationId);
  const anIon = data.core.ions.find(i => i.id === anionId);

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

  const pair = data.rules.solubilityPairs.find(
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
  return { answer: Array.isArray(val) ? val : (typeof val === 'number' ? val : String(val)) };
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

  const rank = data.rules.bondExamples?.crystal_melting_rank;
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

// ── Periodic Table solvers ────────────────────────────────────────

function solveElectronConfig(
  params: Record<string, unknown>,
  slots: SlotValues,
  data: OntologyData,
): SolverResult {
  void params;
  const Z = Number(slots.Z);
  if (!Number.isInteger(Z) || Z < 1) {
    throw new Error(`Invalid Z: ${slots.Z}`);
  }

  // Ensure exception overrides (Cr, Cu, etc.) are initialized from element data
  setConfigOverrides(data.core.elements);

  const config = getElectronConfig(Z);
  const answer = config
    .map(e => `${e.n}${e.l}${toSuperscript(e.electrons)}`)
    .join(' ');

  return { answer };
}

function solveCountValence(
  params: Record<string, unknown>,
  slots: SlotValues,
): SolverResult {
  void params;
  const group = Number(slots.group);

  let valence: number;
  if (group >= 1 && group <= 2) {
    valence = group;
  } else if (group >= 13 && group <= 18) {
    valence = group - 10;
  } else {
    // Transition metals (3-12): approximate as group number
    valence = group;
  }

  return { answer: valence };
}

function solveDeltaChi(
  params: Record<string, unknown>,
  slots: SlotValues,
  data: OntologyData,
): SolverResult {
  void params;
  const symbolA = String(slots.elementA);
  const symbolB = String(slots.elementB);

  const elA = findElement(symbolA, data);
  const elB = findElement(symbolB, data);

  // Delegate bond classification to canonical implementation
  const bondType = determineBondType(elA, elB);

  const chiA = elA.electronegativity;
  const chiB = elB.electronegativity;
  const delta = (chiA != null && chiB != null) ? Math.abs(chiA - chiB) : null;
  const rounded = delta != null ? Math.round(delta * 100) / 100 : 0;

  return {
    answer: bondType,
    explanation_slots: {
      delta: String(rounded),
      chiA: String(chiA ?? 0),
      chiB: String(chiB ?? 0),
    },
  };
}

// ── Reaction solvers ─────────────────────────────────────────────

function solveDrivingForce(
  params: Record<string, unknown>,
  slots: SlotValues,
): SolverResult {
  void params;

  const checks: [string, string][] = [
    ['has_precipitate', 'precipitate'],
    ['has_gas', 'gas'],
    ['has_water', 'water'],
    ['has_weak_electrolyte', 'weak_electrolyte'],
  ];

  for (const [slotKey, label] of checks) {
    const val = slots[slotKey];
    if (val === true || val === 'true' || val === 1) {
      return { answer: label };
    }
  }

  return { answer: 'none' };
}

function solveActivityCompare(
  params: Record<string, unknown>,
  slots: SlotValues,
): SolverResult {
  void params;
  const posA = Number(slots.positionA);
  const posB = Number(slots.positionB);

  return { answer: posA < posB ? 'yes' : 'no' };
}

function solvePredictObservation(
  params: Record<string, unknown>,
  slots: SlotValues,
): SolverResult {
  void params;
  const observation = slots.observation;
  if (observation === undefined || observation === null) {
    throw new Error('observation slot not found');
  }
  return { answer: String(observation) };
}

// ── Calculation solvers ──────────────────────────────────────────

function solveMolarMass(
  params: Record<string, unknown>,
  slots: SlotValues,
  data: OntologyData,
): SolverResult {
  void params;
  const compositionRaw = slots.composition;
  let composition: Record<string, number>;

  if (typeof compositionRaw === 'string') {
    composition = JSON.parse(compositionRaw) as Record<string, number>;
  } else {
    throw new Error('composition slot must be a JSON string');
  }

  let totalMass = 0;
  for (const [symbol, count] of Object.entries(composition)) {
    const el = findElement(symbol, data);
    totalMass += el.atomic_mass * count;
  }

  const rounded = Math.round(totalMass * 100) / 100;
  return { answer: rounded };
}

function solveMassFraction(
  params: Record<string, unknown>,
  slots: SlotValues,
  data: OntologyData,
): SolverResult {
  // Read target_element from params or fall back to slots.element
  const rawTarget = params.target_element ?? slots.element;
  const targetElement = String(rawTarget);
  const M = Number(slots.M);
  const compositionRaw = slots.composition;
  let composition: Record<string, number>;

  if (typeof compositionRaw === 'string') {
    composition = JSON.parse(compositionRaw) as Record<string, number>;
  } else {
    throw new Error('composition slot must be a JSON string');
  }

  const count = composition[targetElement];
  if (count === undefined) {
    throw new Error(`Element ${targetElement} not in composition`);
  }

  const el = findElement(targetElement, data);
  const fraction = (el.atomic_mass * count / M) * 100;
  const rounded = Math.round(fraction * 10) / 10;

  return { answer: rounded };
}

function solveAmountCalc(
  params: Record<string, unknown>,
  slots: SlotValues,
): SolverResult {
  const mode = String(params.mode ?? 'n');

  if (mode === 'n') {
    const mass = Number(slots.mass);
    const M = Number(slots.M);
    const n = mass / M;
    return { answer: Math.round(n * 1000) / 1000 };
  } else if (mode === 'm') {
    const amount = Number(slots.amount);
    const M = Number(slots.M);
    const m = amount * M;
    return { answer: Math.round(m * 100) / 100 };
  }

  throw new Error(`Unknown amount_calc mode: ${mode}`);
}

function solveConcentration(
  params: Record<string, unknown>,
  slots: SlotValues,
): SolverResult {
  const mode = String(params.mode ?? 'omega');

  if (mode === 'omega') {
    const mSolute = Number(slots.m_solute);
    const mSolution = Number(slots.m_solution);
    const omega = (mSolute / mSolution) * 100;
    return { answer: Math.round(omega * 10) / 10 };
  } else if (mode === 'inverse') {
    const omega = Number(slots.omega);
    const mSolution = Number(slots.m_solution);
    const mSolute = omega * mSolution / 100;
    return { answer: Math.round(mSolute * 10) / 10 };
  } else if (mode === 'dilution') {
    const omega1 = Number(slots.omega1);
    const m1 = Number(slots.m1);
    const omega2 = Number(slots.omega2);
    const m2 = omega1 * m1 / omega2;
    return { answer: Math.round(m2 * 10) / 10 };
  }

  throw new Error(`Unknown concentration mode: ${mode}`);
}

function solveStoichiometry(
  params: Record<string, unknown>,
  slots: SlotValues,
): SolverResult {
  void params;
  const givenMass = Number(slots.given_mass);
  const givenCoeff = Number(slots.given_coeff);
  const givenM = Number(slots.given_M);
  const findCoeff = Number(slots.find_coeff);
  const findM = Number(slots.find_M);

  const nGiven = givenMass / givenM;
  const nFind = nGiven * (findCoeff / givenCoeff);
  const mFind = nFind * findM;

  return { answer: Math.round(mFind * 100) / 100 };
}

function solveReactionYield(
  params: Record<string, unknown>,
  slots: SlotValues,
): SolverResult {
  void params;
  const givenMass = Number(slots.given_mass);
  const givenCoeff = Number(slots.given_coeff);
  const givenM = Number(slots.given_M);
  const findCoeff = Number(slots.find_coeff);
  const findM = Number(slots.find_M);
  const yieldPercent = Number(slots.yield_percent);

  const nGiven = givenMass / givenM;
  const nFind = nGiven * (findCoeff / givenCoeff);
  const mTheoretical = nFind * findM;
  const mPractical = mTheoretical * yieldPercent / 100;

  return { answer: Math.round(mPractical * 100) / 100 };
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
  // Phase 3: Periodic Table
  'solver.electron_config': solveElectronConfig,
  'solver.count_valence': (params, slots) => solveCountValence(params, slots),
  'solver.delta_chi': solveDeltaChi,
  // Phase 3: Reactions
  'solver.driving_force': (params, slots) => solveDrivingForce(params, slots),
  'solver.activity_compare': (params, slots) => solveActivityCompare(params, slots),
  'solver.predict_observation': (params, slots) => solvePredictObservation(params, slots),
  // Phase 3: Calculations
  'solver.molar_mass': solveMolarMass,
  'solver.mass_fraction': solveMassFraction,
  'solver.amount_calc': (params, slots) => solveAmountCalc(params, slots),
  'solver.concentration': (params, slots) => solveConcentration(params, slots),
  'solver.stoichiometry': (params, slots) => solveStoichiometry(params, slots),
  'solver.reaction_yield': (params, slots) => solveReactionYield(params, slots),
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
