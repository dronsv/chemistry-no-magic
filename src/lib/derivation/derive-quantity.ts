import type { ComputableFormula } from '../../types/formula';
import type { ConstantsDict, IndexedBindings } from '../../types/eval-trace';
import type { QRef, ReasonStep } from '../../types/derivation';
import type { OntologyAccess } from './resolvers';
import { resolveLookup, resolveDecompose } from './resolvers';
import { buildDerivationRules, buildQuantityIndex } from './derivation-graph';
import { planDerivation } from './derivation-planner';
import { executePlan } from './derivation-executor';
import { qrefKey } from './qref';
import { evaluateFormula } from '../formula-evaluator';

export interface DeriveQuantityArgs {
  target: QRef;
  knowns: Array<{ qref: QRef; value: number }>;
  formulas: ComputableFormula[];
  constants: ConstantsDict;
  ontology: OntologyAccess;
}

export interface DeriveQuantityResult {
  value: number;
  trace: ReasonStep[];
  isApproximate: boolean;
}

/**
 * High-level quantity derivation that resolves ontology context (decompose, lookup)
 * then delegates to the existing formula planner for algebraic chains.
 *
 * This is an MVP orchestration layer for the first vertical slice,
 * not the final generalized mixed-rule executor.
 */
export function deriveQuantity(args: DeriveQuantityArgs): DeriveQuantityResult {
  const { target, knowns, formulas, constants, ontology } = args;
  const trace: ReasonStep[] = [];

  // Record given steps
  for (const k of knowns) {
    trace.push({ type: 'given', qref: k.qref, value: k.value });
  }

  // Direct lookup (e.g., Ar of element)
  if (target.quantity === 'q:relative_atomic_mass' && target.context?.system_type === 'element') {
    const lr = resolveLookup(target, ontology);
    if (!lr) throw new Error(`Lookup failed for ${qrefKey(target)}`);
    trace.push(lr.step);
    trace.push({ type: 'conclusion', target, value: lr.value });
    return { value: lr.value, trace, isApproximate: false };
  }

  // Molar mass of substance: decompose → lookup Ar's → evaluate indexed formula
  if (target.quantity === 'q:molar_mass' && target.context?.system_type === 'substance') {
    const M = deriveMolarMass(target.context.entity_ref!, formulas, constants, ontology, trace);
    trace.push({ type: 'conclusion', target, value: M });
    return { value: M, trace, isApproximate: false };
  }

  // Component molar mass contribution: decompose → select component → lookup Ar → formula
  if (target.quantity === 'q:component_molar_mass_contribution'
      && target.context?.system_type === 'substance_component') {
    const entityRef = target.context.entity_ref!;
    const parentRef = target.context.parent_ref!;
    const value = deriveComponentContribution(entityRef, parentRef, formulas, constants, ontology, trace);
    trace.push({ type: 'conclusion', target, value });
    return { value, trace, isApproximate: false };
  }

  // Component mass fraction: M_part + M → omega
  if (target.quantity === 'q:component_mass_fraction'
      && target.context?.system_type === 'substance_component') {
    const entityRef = target.context.entity_ref!;
    const parentRef = target.context.parent_ref!;
    const value = deriveMassFractionOfComponent(entityRef, parentRef, formulas, constants, ontology, trace);
    trace.push({ type: 'conclusion', target, value });
    return { value, trace, isApproximate: false };
  }

  // Mass/amount of substance: derive M first, then formula chain
  if ((target.quantity === 'q:mass' || target.quantity === 'q:amount')
      && target.context?.system_type === 'substance') {
    const entityRef = target.context.entity_ref!;

    // Step 1: derive M via ontology
    const M = deriveMolarMass(entityRef, formulas, constants, ontology, trace);

    // Step 2: formula chain for m ↔ n ↔ M
    // MVP transitional: context-aware q:molar_mass(substance:X) is collapsed into
    // context-free q:molar_mass because only single-substance derivations are
    // supported in this slice. Multi-substance systems will need context propagation.
    const molarMassQRef: QRef = { quantity: 'q:molar_mass' };
    const allKnowns: QRef[] = [molarMassQRef, ...knowns.map(k => k.qref)];
    const values: Record<string, number> = { [qrefKey(molarMassQRef)]: M };
    for (const k of knowns) values[qrefKey(k.qref)] = k.value;

    const rules = buildDerivationRules(formulas);
    const index = buildQuantityIndex(rules);
    const formulaTarget: QRef = { quantity: target.quantity };
    const plan = planDerivation(formulaTarget, allKnowns, rules, index);
    if (!plan) throw new Error(`No derivation path for ${target.quantity}`);

    const result = executePlan(plan, { formulas, constants, values });

    // Append formula trace steps
    for (const step of plan.steps) {
      const formula = formulas.find(f => f.id === step.rule.formulaId);
      trace.push({ type: 'formula_select', formulaId: step.rule.formulaId, target: step.target });
      const bindings: Record<string, number> = {};
      for (const input of step.rule.inputs) {
        const ref = step.inputRefs[input.symbol];
        if (ref) {
          const val = result.computedValues[qrefKey(ref)];
          if (val !== undefined) bindings[input.symbol] = val;
        }
      }
      trace.push({ type: 'substitution', formulaId: step.rule.formulaId, bindings });
      trace.push({
        type: 'compute',
        formulaId: step.rule.formulaId,
        result: result.computedValues[qrefKey(step.target)],
        approximate: formula?.approximation?.kind === 'approximate' || undefined,
      });
    }

    trace.push({ type: 'conclusion', target, value: result.result });
    return { value: result.result, trace, isApproximate: false };
  }

  // Fallback: pure formula chain (no context needed — backward-compatible path)
  const rules = buildDerivationRules(formulas);
  const index = buildQuantityIndex(rules);
  const values: Record<string, number> = {};
  for (const k of knowns) values[qrefKey(k.qref)] = k.value;

  const plan = planDerivation(target, knowns.map(k => k.qref), rules, index);
  if (!plan) throw new Error(`No derivation path for ${qrefKey(target)}`);

  const result = executePlan(plan, { formulas, constants, values });
  trace.push({ type: 'conclusion', target, value: result.result });
  return { value: result.result, trace, isApproximate: false };
}

/**
 * Derive molar mass for a substance via decompose + lookup + indexed formula.
 *
 * MVP orchestration shortcut: manually wires decompose → lookup → evaluateFormula
 * rather than going through a generalized mixed-rule executor. This is intentional
 * for the first vertical slice — the decompose/lookup steps are not yet modeled as
 * DerivationRules in the planner graph.
 */
function deriveMolarMass(
  entityRef: string,
  formulas: ComputableFormula[],
  constants: ConstantsDict,
  ontology: OntologyAccess,
  trace: ReasonStep[],
): number {
  // 1. Decompose substance into elements + counts (structural only)
  const decomp = resolveDecompose(entityRef, ontology);
  if (!decomp) throw new Error(`Cannot decompose ${entityRef}`);
  trace.push(decomp.step);

  // 2. Lookup Ar for each element (separate provenance from decomposition)
  const arValues: Array<{ element: string; count: number; Ar: number }> = [];
  for (const item of decomp.items) {
    const lr = resolveLookup(item.arQRef, ontology);
    if (!lr) throw new Error(`Lookup failed for Ar of ${item.element}`);
    trace.push(lr.step);
    arValues.push({ element: item.element, count: item.count, Ar: lr.value });
  }

  // 3. Build indexed bindings and evaluate formula:molar_mass_from_composition
  const formula = formulas.find(f => f.id === 'formula:molar_mass_from_composition');
  if (!formula) throw new Error('formula:molar_mass_from_composition not found');

  const indexed: IndexedBindings = {
    composition_elements: arValues.map(item => ({
      Ar_i: item.Ar,
      count_i: item.count,
    })),
  };

  trace.push({
    type: 'formula_select',
    formulaId: formula.id,
    target: { quantity: 'q:molar_mass', context: { system_type: 'substance', entity_ref: entityRef } },
  });

  const evalTrace = evaluateFormula(formula, {}, constants, indexed);

  trace.push({
    type: 'compute',
    formulaId: formula.id,
    result: evalTrace.result,
  });

  return evalTrace.result;
}

/**
 * Derive the molar mass contribution of a component element in a substance.
 * M_part(e, S) = Ar(e) * count(e, S)
 */
function deriveComponentContribution(
  entityRef: string,
  parentRef: string,
  formulas: ComputableFormula[],
  constants: ConstantsDict,
  ontology: OntologyAccess,
  trace: ReasonStep[],
): number {
  // 1. Decompose parent substance
  const decomp = resolveDecompose(parentRef, ontology);
  if (!decomp) throw new Error(`Cannot decompose ${parentRef}`);
  trace.push(decomp.step);

  // 2. Find the component
  const symbol = entityRef.replace('element:', '');
  const component = decomp.items.find(i => i.element === symbol);
  if (!component) throw new Error(`Element ${symbol} not found in ${parentRef}`);

  // 3. Lookup Ar
  const lr = resolveLookup(component.arQRef, ontology);
  if (!lr) throw new Error(`Lookup failed for Ar of ${symbol}`);
  trace.push(lr.step);

  // 4. Evaluate formula:component_molar_mass_contribution
  const formula = formulas.find(f => f.id === 'formula:component_molar_mass_contribution');
  if (!formula) throw new Error('formula:component_molar_mass_contribution not found');

  const bindings: Record<string, number> = { Ar: lr.value, count: component.count };

  trace.push({
    type: 'formula_select',
    formulaId: formula.id,
    target: {
      quantity: 'q:component_molar_mass_contribution',
      context: { system_type: 'substance_component', entity_ref: entityRef, parent_ref: parentRef },
    },
  });
  trace.push({ type: 'substitution', formulaId: formula.id, bindings });

  const evalTrace = evaluateFormula(formula, bindings, constants);
  trace.push({ type: 'compute', formulaId: formula.id, result: evalTrace.result });

  return evalTrace.result;
}

/**
 * Derive mass fraction of a component element in a substance.
 * omega(e, S) = M_part(e, S) / M(S)
 */
function deriveMassFractionOfComponent(
  entityRef: string,
  parentRef: string,
  formulas: ComputableFormula[],
  constants: ConstantsDict,
  ontology: OntologyAccess,
  trace: ReasonStep[],
): number {
  // Steps 1-4: derive M_part
  const M_part = deriveComponentContribution(entityRef, parentRef, formulas, constants, ontology, trace);

  // Step 5: derive M(substance)
  const M = deriveMolarMass(parentRef, formulas, constants, ontology, trace);

  // Step 6: evaluate formula:component_mass_fraction
  const formula = formulas.find(f => f.id === 'formula:component_mass_fraction');
  if (!formula) throw new Error('formula:component_mass_fraction not found');

  const bindings: Record<string, number> = { M_part, M };

  trace.push({
    type: 'formula_select',
    formulaId: formula.id,
    target: {
      quantity: 'q:component_mass_fraction',
      context: { system_type: 'substance_component', entity_ref: entityRef, parent_ref: parentRef },
    },
  });
  trace.push({ type: 'substitution', formulaId: formula.id, bindings });

  const evalTrace = evaluateFormula(formula, bindings, constants);
  trace.push({ type: 'compute', formulaId: formula.id, result: evalTrace.result });

  return evalTrace.result;
}
