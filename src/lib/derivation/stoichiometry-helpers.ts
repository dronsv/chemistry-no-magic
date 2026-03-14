import type { ComputableFormula, SemanticRole } from '../../types/formula';
import type { ConstantsDict } from '../../types/eval-trace';
import type { QRef, ReasonStep } from '../../types/derivation';
import type { OntologyAccess } from './resolvers';
import { evaluateFormula, solveFor } from '../formula-evaluator';
import { deriveMolarMass } from './molar-mass-resolver';
import type { DeriveQuantityResult } from './derive-quantity';

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

// ── Signature detection ──────────────────────────────────────────

function findKnown(
  knowns: Array<{ qref: QRef; value: number }>,
  quantity: string,
  role?: SemanticRole,
): { qref: QRef; value: number } | undefined {
  return knowns.find(k =>
    k.qref.quantity === quantity && (role == null || k.qref.role === role),
  );
}

export function hasStoichiometricKnowns(
  knowns: Array<{ qref: QRef; value: number }>,
): boolean {
  // Condition 1: Two stoichiometric coefficients with different roles
  const nuReactant = findKnown(knowns, 'q:stoich_coeff', 'reactant');
  const nuProduct = findKnown(knowns, 'q:stoich_coeff', 'product');
  if (!nuReactant || !nuProduct) return false;

  // Condition 2: At least one source-side quantity (mass or amount with a role)
  const hasSourceAmount = knowns.some(k => k.qref.quantity === 'q:amount' && k.qref.role != null);
  const hasSourceMass = knowns.some(k => k.qref.quantity === 'q:mass' && k.qref.role != null);
  if (!hasSourceMass && !hasSourceAmount) return false;

  // Condition 3: If source is mass (not amount), need at least one M for conversion
  if (hasSourceMass && !hasSourceAmount) {
    const hasM = knowns.some(k => k.qref.quantity === 'q:molar_mass');
    if (!hasM) return false;
  }

  return true;
}

// ── Chain orchestrator ───────────────────────────────────────────

export function deriveStoichiometryChain(
  target: QRef,
  knowns: Array<{ qref: QRef; value: number }>,
  formulas: ComputableFormula[],
  constants: ConstantsDict,
  ontology: OntologyAccess,
  trace: ReasonStep[],
): DeriveQuantityResult {
  // Detect yield: if q:yield is in knowns, apply after stoichiometric chain.
  // Note: S3r (find yield from actual + theoretical masses) does NOT pass through here —
  // it has no stoich coefficients, so hasStoichiometricKnowns returns false,
  // and it falls through to the generic planner in deriveQuantity().
  const yieldKnown = findKnown(knowns, 'q:yield');

  // Determine direction: which role has mass/amount known?
  const nuReactant = findKnown(knowns, 'q:stoich_coeff', 'reactant')!;
  const nuProduct = findKnown(knowns, 'q:stoich_coeff', 'product')!;

  const massReactant = findKnown(knowns, 'q:mass', 'reactant');
  const amountReactant = findKnown(knowns, 'q:amount', 'reactant');
  const massProduct = findKnown(knowns, 'q:mass', 'product');
  const amountProduct = findKnown(knowns, 'q:amount', 'product');

  let fromRole: SemanticRole;
  let toRole: SemanticRole;

  if (massReactant || amountReactant) {
    fromRole = 'reactant';
    toRole = 'product';
  } else if (massProduct || amountProduct) {
    fromRole = 'product';
    toRole = 'reactant';
  } else {
    throw new Error('deriveStoichiometryChain: no source mass or amount found');
  }

  const nu_from = fromRole === 'reactant' ? nuReactant.value : nuProduct.value;
  const nu_to = fromRole === 'reactant' ? nuProduct.value : nuReactant.value;

  // Find M by role — M knowns carry role in stoichiometry context
  function findMByRole(role: SemanticRole): number | undefined {
    const mk = knowns.find(k => k.qref.quantity === 'q:molar_mass' && k.qref.role === role);
    return mk?.value;
  }

  // Step 1: Get source amount (n_from)
  let n_from: number;
  const sourceMass = fromRole === 'reactant' ? massReactant : massProduct;
  const sourceAmount = fromRole === 'reactant' ? amountReactant : amountProduct;

  if (sourceAmount) {
    n_from = sourceAmount.value;
  } else if (sourceMass) {
    // Need M for source side — match by role, or auto-derive from entity_ref
    const sourceM = findMByRole(fromRole);
    const sourceMKnown = knowns.find(k => k.qref.quantity === 'q:molar_mass' && k.qref.role === fromRole);
    const sourceEntityRef = sourceMKnown?.qref.context?.entity_ref;

    const amountResult = deriveAmountForRole({
      role: fromRole,
      mass: sourceMass.value,
      M: sourceM,
      entityRef: sourceM == null ? sourceEntityRef : undefined,
      formulas, constants, ontology, trace,
    });
    n_from = amountResult.value;
  } else {
    throw new Error(`deriveStoichiometryChain: no mass or amount for ${fromRole}`);
  }

  // Step 2: Cross-role stoichiometric ratio
  const n_to_result = deriveStoichiometricAmount({
    n_from, nu_from, nu_to, fromRole, toRole, formulas, constants, trace,
  });

  // Step 3: Determine what the target wants
  if (target.quantity === 'q:amount') {
    // S2r: mass→amount — we already have n_to
    trace.push({ type: 'conclusion', target, value: n_to_result.value });
    return { value: n_to_result.value, trace, isApproximate: false };
  }

  // Step 4: Convert amount to mass for target side
  // Find M for target side — match by role
  const targetM = findMByRole(toRole);
  const targetMKnown = knowns.find(k => k.qref.quantity === 'q:molar_mass' && k.qref.role === toRole);
  const targetEntityRef = targetMKnown?.qref.context?.entity_ref;

  const massResult = deriveMassForRole({
    role: toRole,
    n: n_to_result.value,
    M: targetM,
    entityRef: targetM == null ? targetEntityRef : undefined,
    formulas, constants, ontology, trace,
  });

  // Step 5: If yield is present, apply it
  if (yieldKnown) {
    const yieldResult = applyYield({
      m_theoretical: massResult.value,
      eta: yieldKnown.value,
      formulas, constants, trace,
    });
    trace.push({ type: 'conclusion', target, value: yieldResult.value });
    return { value: yieldResult.value, trace, isApproximate: false };
  }

  trace.push({ type: 'conclusion', target, value: massResult.value });
  return { value: massResult.value, trace, isApproximate: false };
}
