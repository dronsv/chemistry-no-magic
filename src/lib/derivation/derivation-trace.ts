import type { ComputableFormula } from '../../types/formula';
import type { DerivationPlan, ReasonTrace, ReasonStep, QRef } from '../../types/derivation';
import type { ExecutionResult } from './derivation-executor';
import { qrefKey } from './qref';

/**
 * Build a structured ReasonTrace from an executed plan.
 *
 * All steps are structured data — no baked text.
 * Text rendering is delegated to the explanation renderer layer.
 */
export function buildReasonTrace(
  plan: DerivationPlan,
  execution: ExecutionResult,
  formulas: ComputableFormula[],
  knownValues: Record<string, number>,
): ReasonTrace {
  const steps: ReasonStep[] = [];
  let isApproximate = false;

  // 1. Given steps for all known values
  for (const [key, value] of Object.entries(knownValues)) {
    const qref = parseQRefKey(key);
    steps.push({ type: 'given', qref, value });
  }

  // 2. Formula steps from plan
  for (let i = 0; i < plan.steps.length; i++) {
    const planStep = plan.steps[i];
    const trace = execution.traces[i];
    const formula = formulas.find(f => f.id === planStep.rule.formulaId);

    // formula_select
    steps.push({
      type: 'formula_select',
      formulaId: planStep.rule.formulaId,
      target: planStep.target,
    });

    // substitution — collect concrete values for inputs
    const bindings: Record<string, number> = {};
    for (const input of planStep.rule.inputs) {
      const ref = planStep.inputRefs[input.symbol];
      if (ref) {
        const key = qrefKey(ref);
        const val = execution.computedValues[key];
        if (val !== undefined) bindings[input.symbol] = val;
      }
    }
    if (Object.keys(bindings).length > 0) {
      steps.push({
        type: 'substitution',
        formulaId: planStep.rule.formulaId,
        bindings,
      });
    }

    // compute
    const approximate = formula?.approximation?.kind === 'approximate';
    if (approximate) isApproximate = true;
    steps.push({
      type: 'compute',
      formulaId: planStep.rule.formulaId,
      result: trace.result,
      approximate: approximate || undefined,
    });
  }

  // 3. Conclusion
  steps.push({
    type: 'conclusion',
    target: plan.target,
    value: execution.result,
  });

  return {
    target: plan.target,
    steps,
    result: execution.result,
    isApproximate,
  };
}

/** Parse a qrefKey back into a QRef. Inverse of qrefKey(). */
function parseQRefKey(key: string): QRef {
  const parts = key.split('|');
  const qref: QRef = { quantity: parts[0] };
  if (parts[1]) {
    // SemanticRole values are the valid set; cast is safe since keys are produced by qrefKey
    qref.role = parts[1] as QRef['role'];
  }
  return qref;
}
