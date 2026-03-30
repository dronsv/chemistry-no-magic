import type { ComputableFormula } from '../../../types/formula';
import type { IndexedBindings } from '../../../types/eval-trace';
import type {
  DerivationOperator, IndexedAggregateOperator, QRef, ReasonStep,
  PlanStep, ExecutionEnv, OperatorResult, OperatorHandler,
} from '../../../types/derivation';
import { resolveLookup, resolveDecompose } from '../resolvers';
import type { OntologyAccess } from '../resolvers';
import { evaluateFormula } from '../../formula-evaluator';
import { qrefKey } from '../qref';

export const aggregateHandler: OperatorHandler = {
  matches(op: DerivationOperator, target: QRef): boolean {
    if (op.kind !== 'indexed_aggregate') return false;
    const aop = op as IndexedAggregateOperator;
    return target.quantity === aop.targetQuantity
      && target.context?.system_type === aop.sourceSystemType
      && !!target.context?.entity_ref;
  },

  expand(): QRef[] {
    return [];  // leaf at planning time; internal work at execution time
  },

  execute(op: DerivationOperator, step: PlanStep, env: ExecutionEnv): OperatorResult {
    if (!env.ontology) throw new Error('Ontology required for aggregate operator');
    const ontology = env.ontology as OntologyAccess;
    const aop = op as IndexedAggregateOperator;
    const entityRef = step.target.context!.entity_ref!;
    const internalSteps: ReasonStep[] = [];

    // 1. Decompose entity into elemental components
    const decomp = resolveDecompose(entityRef, ontology);
    if (!decomp) throw new Error(`Cannot decompose ${entityRef}`);
    internalSteps.push(decomp.step);

    // 2. Lookup Ar for each component
    const arValues: Array<{ Ar: number; count: number }> = [];
    for (const item of decomp.items) {
      const lr = resolveLookup(item.arQRef, ontology);
      if (!lr) throw new Error(`Lookup failed for Ar of ${item.element}`);
      internalSteps.push(lr.step);
      arValues.push({ Ar: lr.value, count: item.count });
    }

    // 3. Build indexed bindings and evaluate formula
    const indexed: IndexedBindings = {
      [aop.indexSet]: arValues.map(item => ({
        Ar_i: item.Ar,
        count_i: item.count,
      })),
    };

    const formula = env.formulas.find((f: ComputableFormula) => f.id === aop.formulaId);
    if (!formula) throw new Error(`Formula not found: ${aop.formulaId}`);

    internalSteps.push({
      type: 'formula_select',
      formulaId: aop.formulaId,
      target: step.target,
    });

    const trace = evaluateFormula(formula, {}, env.constants, indexed);

    internalSteps.push({
      type: 'compute',
      formulaId: aop.formulaId,
      result: trace.result,
    });

    return { value: trace.result, trace, internalSteps };
  },
};
