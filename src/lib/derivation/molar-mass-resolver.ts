import type { ComputableFormula } from '../../types/formula';
import type { ConstantsDict, IndexedBindings } from '../../types/eval-trace';
import type { ReasonStep } from '../../types/derivation';
import type { OntologyAccess } from './resolvers';
import { resolveLookup, resolveDecompose } from './resolvers';
import { evaluateFormula } from '../formula-evaluator';

/**
 * Derive molar mass for a substance via decompose + lookup + indexed formula.
 *
 * MVP orchestration shortcut: manually wires decompose → lookup → evaluateFormula
 * rather than going through a generalized mixed-rule executor. This is intentional
 * for the first vertical slice — the decompose/lookup steps are not yet modeled as
 * DerivationRules in the planner graph.
 */
export function deriveMolarMass(
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
  trace.push({ type: 'compute', formulaId: formula.id, result: evalTrace.result });

  return evalTrace.result;
}
