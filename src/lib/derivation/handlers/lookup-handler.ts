import type {
  DerivationOperator, LookupOperator, QRef,
  PlanStep, ExecutionEnv, OperatorResult, OperatorHandler,
} from '../../../types/derivation';
import { resolveLookup } from '../resolvers';
import type { OntologyAccess } from '../resolvers';
import { qrefKey } from '../qref';

export const lookupHandler: OperatorHandler = {
  matches(op: DerivationOperator, target: QRef): boolean {
    if (op.kind !== 'lookup') return false;
    const lop = op as LookupOperator;
    return target.quantity === lop.lookupQuantity
      && target.context?.system_type === lop.systemType
      && !!target.context?.entity_ref;
  },

  expand(): QRef[] {
    return [];  // leaf node — no sub-goals
  },

  execute(op: DerivationOperator, step: PlanStep, env: ExecutionEnv): OperatorResult {
    if (!env.ontology) throw new Error('Ontology required for lookup operator');
    const lr = resolveLookup(step.target, env.ontology as OntologyAccess);
    if (!lr) throw new Error(`Lookup failed for ${qrefKey(step.target)}`);
    return {
      value: lr.value,
      trace: { formulaId: 'lookup', solvedFor: '', steps: [], result: lr.value },
      internalSteps: [lr.step],
    };
  },
};
