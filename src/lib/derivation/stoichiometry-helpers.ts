import type { ComputableFormula, SemanticRole } from '../../types/formula';
import type { ConstantsDict } from '../../types/eval-trace';
import type { QRef, ReasonStep } from '../../types/derivation';
import type { OntologyAccess } from './resolvers';
import { evaluateFormula, solveFor } from '../formula-evaluator';
import { deriveMolarMass } from './molar-mass-resolver';

// ── Types ────────────────────────────────────────────────────────

export interface QRefValue {
  qref: QRef;
  value: number;
}

function findFormula(formulas: ComputableFormula[], id: string): ComputableFormula {
  const f = formulas.find(f => f.id === id);
  if (!f) throw new Error(`Formula not found: ${id}`);
  return f;
}

// ── deriveAmountForRole ──────────────────────────────────────────

export function deriveAmountForRole(opts: {
  role: SemanticRole;
  mass: number;
  M?: number;
  entityRef?: string;
  formulas: ComputableFormula[];
  constants: ConstantsDict;
  ontology: OntologyAccess;
  trace: ReasonStep[];
}): QRefValue {
  const { role, mass, formulas, constants, ontology, trace } = opts;

  // Resolve M: explicit or auto-derived from substance composition
  let M = opts.M;
  if (M == null) {
    if (!opts.entityRef) {
      throw new Error(`deriveAmountForRole: M not provided and no entityRef for auto-derivation`);
    }
    M = deriveMolarMass(opts.entityRef, formulas, constants, ontology, trace);
  }

  const formula = findFormula(formulas, 'formula:amount_from_mass');
  const bindings = { m: mass, M };

  trace.push({ type: 'formula_select', formulaId: formula.id, target: { quantity: 'q:amount', role } });
  trace.push({ type: 'substitution', formulaId: formula.id, bindings });

  const result = evaluateFormula(formula, bindings, constants).result;
  trace.push({ type: 'compute', formulaId: formula.id, result });

  return { qref: { quantity: 'q:amount', role }, value: result };
}

// ── deriveStoichiometricAmount ───────────────────────────────────

export function deriveStoichiometricAmount(opts: {
  n_from: number;
  nu_from: number;
  nu_to: number;
  fromRole: SemanticRole;
  toRole: SemanticRole;
  formulas: ComputableFormula[];
  constants: ConstantsDict;
  trace: ReasonStep[];
}): QRefValue {
  const { n_from, nu_from, nu_to, fromRole, toRole, formulas, constants, trace } = opts;
  const formula = findFormula(formulas, 'formula:stoichiometry_ratio');

  let result: number;

  if (fromRole === 'reactant') {
    // Forward: n_1 (reactant) → n_2 (product)
    const bindings = { n_1: n_from, nu_1: nu_from, nu_2: nu_to };
    trace.push({ type: 'formula_select', formulaId: formula.id, target: { quantity: 'q:amount', role: toRole } });
    trace.push({ type: 'substitution', formulaId: formula.id, bindings });
    result = evaluateFormula(formula, bindings, constants).result;
  } else {
    // Reverse: n_2 (product) → n_1 (reactant) via inversion
    const bindings = { n_2: n_from, nu_2: nu_from, nu_1: nu_to };
    trace.push({ type: 'formula_select', formulaId: formula.id, target: { quantity: 'q:amount', role: toRole } });
    trace.push({ type: 'substitution', formulaId: formula.id, bindings });
    result = solveFor(formula, 'n_1', bindings, constants).result;
  }

  trace.push({ type: 'compute', formulaId: formula.id, result });
  return { qref: { quantity: 'q:amount', role: toRole }, value: result };
}

// ── deriveMassForRole ────────────────────────────────────────────

export function deriveMassForRole(opts: {
  role: SemanticRole;
  n: number;
  M?: number;
  entityRef?: string;
  formulas: ComputableFormula[];
  constants: ConstantsDict;
  ontology: OntologyAccess;
  trace: ReasonStep[];
}): QRefValue {
  const { role, n, formulas, constants, ontology, trace } = opts;

  // Resolve M: explicit or auto-derived
  let M = opts.M;
  if (M == null) {
    if (!opts.entityRef) {
      throw new Error(`deriveMassForRole: M not provided and no entityRef for auto-derivation`);
    }
    M = deriveMolarMass(opts.entityRef, formulas, constants, ontology, trace);
  }

  const formula = findFormula(formulas, 'formula:amount_from_mass');
  const bindings = { n, M };

  trace.push({ type: 'formula_select', formulaId: formula.id, target: { quantity: 'q:mass', role } });
  trace.push({ type: 'substitution', formulaId: formula.id, bindings });

  const result = solveFor(formula, 'm', bindings, constants).result;
  trace.push({ type: 'compute', formulaId: formula.id, result });

  return { qref: { quantity: 'q:mass', role }, value: result };
}

// ── applyYield ───────────────────────────────────────────────────

export function applyYield(opts: {
  m_theoretical: number;
  eta: number;
  formulas: ComputableFormula[];
  constants: ConstantsDict;
  trace: ReasonStep[];
}): QRefValue {
  const { m_theoretical, eta, formulas, constants, trace } = opts;
  const formula = findFormula(formulas, 'formula:yield');
  const bindings = { eta, m_theoretical };

  trace.push({ type: 'formula_select', formulaId: formula.id, target: { quantity: 'q:mass', role: 'product' } });
  trace.push({ type: 'substitution', formulaId: formula.id, bindings });

  const result = solveFor(formula, 'm_actual', bindings, constants).result;
  trace.push({ type: 'compute', formulaId: formula.id, result });

  return { qref: { quantity: 'q:mass', role: 'product' }, value: result };
}

// ── deriveYield ──────────────────────────────────────────────────

export function deriveYield(opts: {
  m_actual: number;
  m_theoretical: number;
  formulas: ComputableFormula[];
  constants: ConstantsDict;
  trace: ReasonStep[];
}): QRefValue {
  const { m_actual, m_theoretical, formulas, constants, trace } = opts;
  const formula = findFormula(formulas, 'formula:yield');
  const bindings = { m_actual, m_theoretical };

  trace.push({ type: 'formula_select', formulaId: formula.id, target: { quantity: 'q:yield' } });
  trace.push({ type: 'substitution', formulaId: formula.id, bindings });

  const result = evaluateFormula(formula, bindings, constants).result;
  trace.push({ type: 'compute', formulaId: formula.id, result });

  return { qref: { quantity: 'q:yield' }, value: result };
}
