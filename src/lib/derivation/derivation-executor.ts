import type { ComputableFormula } from '../../types/formula';
import type { Bindings, ConstantsDict, IndexedBindings, EvalTrace } from '../../types/eval-trace';
import type {
  DerivationPlan, FormulaOperator, ReasonStep,
  OperatorHandler, OntologyAccessForHandler,
} from '../../types/derivation';
import { evaluateFormula, solveFor } from '../formula-evaluator';
import { qrefKey } from './qref';

export interface ExecutionContext {
  formulas: ComputableFormula[];
  constants: ConstantsDict;
  values: Record<string, number>;       // qrefKey -> value (initial knowns)
  indexed?: IndexedBindings;
  ontology?: OntologyAccessForHandler;  // needed for lookup/aggregate handlers
}

export interface ExecutionResult {
  traces: EvalTrace[];                   // one per plan step
  result: number;
  computedValues: Record<string, number>; // all intermediate + final values
  internalSteps?: ReasonStep[];          // collected from handler results
}

/**
 * Execute a derivation plan step by step.
 *
 * Supports two modes:
 * - Legacy (no handlers): each step is a formula operator, executed via evaluateFormula/solveFor
 * - Operator-aware (handlers provided): dispatches via OperatorHandler.execute()
 */
export function executePlan(
  plan: DerivationPlan,
  ctx: ExecutionContext,
  handlers?: Map<string, OperatorHandler>,
): ExecutionResult {
  const computedValues = { ...ctx.values };
  const traces: EvalTrace[] = [];
  const allInternalSteps: ReasonStep[] = [];

  for (const step of plan.steps) {
    const op = step.rule;

    if (handlers) {
      const handler = handlers.get(op.kind);
      if (handler) {
        const result = handler.execute(op, step, {
          formulas: ctx.formulas,
          constants: ctx.constants,
          values: computedValues,
          indexed: ctx.indexed,
          ontology: ctx.ontology,
        });

        const targetKey = qrefKey(step.target);
        computedValues[targetKey] = result.value;
        traces.push(result.trace);

        if (result.internalSteps) {
          allInternalSteps.push(...result.internalSteps);
        }
        continue;
      }
    }

    // Legacy path: formula operators only
    if (op.kind !== 'formula') {
      throw new Error(`No handler for operator kind: ${op.kind}`);
    }
    const fop = op as FormulaOperator;

    const formula = ctx.formulas.find(f => f.id === fop.formulaId);
    if (!formula) throw new Error(`Formula not found: ${fop.formulaId}`);

    // Build bindings from input refs
    const bindings: Bindings = {};
    for (const input of fop.inputs) {
      const ref = step.inputRefs[input.symbol];
      if (!ref) throw new Error(`No inputRef for symbol: ${input.symbol}`);
      const key = qrefKey(ref);
      let val = computedValues[key];
      // Fallback: try bare key (no context) for backward compat with
      // context-free knowns satisfying context-bearing sub-goals.
      if (val === undefined && ref.context) {
        const bareKey = ref.role ? `${ref.quantity}|${ref.role}` : ref.quantity;
        val = computedValues[bareKey];
      }
      if (val === undefined) {
        throw new Error(`Value not found for ${key} (symbol ${input.symbol})`);
      }
      bindings[input.symbol] = val;
    }

    let trace: EvalTrace;
    if (fop.isInversion) {
      trace = solveFor(formula, fop.targetSymbol, bindings, ctx.constants, ctx.indexed);
    } else {
      trace = evaluateFormula(formula, bindings, ctx.constants, ctx.indexed);
    }

    // Store result under semantic key
    const targetKey = qrefKey(step.target);
    computedValues[targetKey] = trace.result;
    traces.push(trace);
  }

  const finalKey = qrefKey(plan.target);
  const result = computedValues[finalKey];
  if (result === undefined) {
    throw new Error(`Final result not found for ${finalKey}`);
  }

  return {
    traces,
    result,
    computedValues,
    internalSteps: allInternalSteps.length > 0 ? allInternalSteps : undefined,
  };
}
