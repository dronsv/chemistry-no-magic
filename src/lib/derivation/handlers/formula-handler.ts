import type { ComputableFormula } from '../../../types/formula';
import type {
  DerivationOperator, FormulaOperator, QRef,
  PlanStep, ExecutionEnv, OperatorResult, OperatorHandler,
} from '../../../types/derivation';
import { evaluateFormula, solveFor } from '../../formula-evaluator';
import { qrefKey } from '../qref';

/** Role compatibility check (same as planner logic). */
function roleCompatible(
  ruleRole: QRef['role'],
  targetRole: QRef['role'],
): boolean {
  if (!targetRole) return true;
  if (!ruleRole) return true;
  return ruleRole === targetRole;
}

export const formulaHandler: OperatorHandler = {
  matches(op: DerivationOperator, target: QRef): boolean {
    if (op.kind !== 'formula') return false;
    return op.targetQuantity === target.quantity && roleCompatible(op.targetRole, target.role);
  },

  expand(op: DerivationOperator, target: QRef): QRef[] {
    const fop = op as FormulaOperator;
    return fop.inputs.map(input => {
      const ref: QRef = { quantity: input.quantity, role: input.role };
      if (target.context) ref.context = target.context;
      return ref;
    });
  },

  execute(op: DerivationOperator, step: PlanStep, env: ExecutionEnv): OperatorResult {
    const fop = op as FormulaOperator;
    const formula = env.formulas.find((f: ComputableFormula) => f.id === fop.formulaId);
    if (!formula) throw new Error(`Formula not found: ${fop.formulaId}`);

    // Build bindings from values using inputRefs
    const bindings: Record<string, number> = {};
    for (const input of fop.inputs) {
      const ref = step.inputRefs[input.symbol];
      if (!ref) throw new Error(`No inputRef for symbol: ${input.symbol}`);
      const key = qrefKey(ref);
      let val = env.values[key];
      if (val === undefined && ref.context) {
        const bareKey = ref.role ? `${ref.quantity}|${ref.role}` : ref.quantity;
        val = env.values[bareKey];
      }
      if (val === undefined) {
        throw new Error(`Value not found for ${key} (symbol ${input.symbol})`);
      }
      bindings[input.symbol] = val;
    }

    const trace = fop.isInversion
      ? solveFor(formula, fop.targetSymbol, bindings, env.constants, env.indexed)
      : evaluateFormula(formula, bindings, env.constants, env.indexed);

    return { value: trace.result, trace };
  },
};
