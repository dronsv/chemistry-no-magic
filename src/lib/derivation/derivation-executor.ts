import type { ComputableFormula } from '../../types/formula';
import type { Bindings, ConstantsDict, IndexedBindings, EvalTrace } from '../../types/eval-trace';
import type { DerivationPlan } from '../../types/derivation';
import { evaluateFormula, solveFor } from '../formula-evaluator';
import { qrefKey } from './qref';

export interface ExecutionContext {
  formulas: ComputableFormula[];
  constants: ConstantsDict;
  values: Record<string, number>;       // qrefKey → value (initial knowns)
  indexed?: IndexedBindings;
}

export interface ExecutionResult {
  traces: EvalTrace[];                   // one per plan step
  result: number;
  computedValues: Record<string, number>; // all intermediate + final values
}

/**
 * Execute a derivation plan step by step.
 *
 * For each PlanStep:
 * 1. Find formula by step.rule.formulaId
 * 2. Build Bindings from ctx.values (keyed by qrefKey)
 * 3. Call evaluateFormula or solveFor
 * 4. Store result under qrefKey(step.target)
 */
export function executePlan(plan: DerivationPlan, ctx: ExecutionContext): ExecutionResult {
  const computedValues = { ...ctx.values };
  const traces: EvalTrace[] = [];

  for (const step of plan.steps) {
    const formula = ctx.formulas.find(f => f.id === step.rule.formulaId);
    if (!formula) throw new Error(`Formula not found: ${step.rule.formulaId}`);

    // Build bindings from input refs
    const bindings: Bindings = {};
    for (const input of step.rule.inputs) {
      const ref = step.inputRefs[input.symbol];
      if (!ref) throw new Error(`No inputRef for symbol: ${input.symbol}`);
      const key = qrefKey(ref);
      const val = computedValues[key];
      if (val === undefined) {
        throw new Error(`Value not found for ${key} (symbol ${input.symbol})`);
      }
      bindings[input.symbol] = val;
    }

    let trace: EvalTrace;
    if (step.rule.isInversion) {
      trace = solveFor(formula, step.rule.targetSymbol, bindings, ctx.constants, ctx.indexed);
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

  return { traces, result, computedValues };
}
