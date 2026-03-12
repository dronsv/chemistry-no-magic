import type { ComputableFormula } from '../types/formula';
import type { EvalTrace } from '../types/eval-trace';
import type { TrendTrace } from '../types/trend-trace';
import type { Explanation, ExplanationStep } from '../types/explanation';

/**
 * Format a number for display: up to `digits` decimal places, trailing zeros stripped.
 */
function fmt(n: number, digits = 4): string {
  return parseFloat(n.toFixed(digits)).toString();
}

/**
 * Render an explanation from a formula EvalTrace.
 *
 * Produces steps: formula expression → substitution → result.
 */
export function renderFormulaExplanation(
  trace: EvalTrace,
  formula: ComputableFormula,
): Explanation {
  const steps: ExplanationStep[] = [];

  // Step 1: formula expression
  const resultVar = trace.solvedFor;
  const exprStr = trace.steps[0]?.expr ?? '?';
  steps.push({
    type: 'formula',
    key: formula.id,
    text: `${resultVar} = ${exprStr}`,
  });

  // Step 2: substitution (if bindings were recorded)
  const subs = trace.steps[0]?.substitutions;
  if (subs && Object.keys(subs).length > 0) {
    const parts = Object.entries(subs).map(([k, v]) => `${k} = ${fmt(v)}`);
    steps.push({
      type: 'substitution',
      key: 'substitution',
      text: parts.join(', '),
    });
  }

  // Step 3: result (use ≈ for approximate formulas)
  const eq = trace.is_approximate ? '≈' : '=';
  steps.push({
    type: 'result',
    key: 'result',
    text: `${resultVar} ${eq} ${fmt(trace.result)}`,
  });

  // Step 4: approximation note (if proxy formula)
  if (trace.is_approximate && formula.approximation) {
    steps.push({
      type: 'approximation_note',
      key: 'approximation',
      text: formula.approximation.usage_note
        ?? `Approximate: proxy for ${formula.approximation.proxy_for ?? 'unknown'}`,
    });
  }

  return { source_id: formula.id, steps };
}

/**
 * Render an explanation from a TrendTrace.
 *
 * Produces steps: context → trend direction → reasoning chain → exception (if any).
 */
export function renderTrendExplanation(trace: TrendTrace): Explanation {
  const steps: ExplanationStep[] = [];
  const { elementA, elementB } = trace;

  if (!trace.context || !trace.trend_id) {
    steps.push({
      type: 'trend',
      key: 'no_trend',
      text: `${elementA}, ${elementB}: no applicable periodic trend`,
    });
    return { source_id: trace.property, steps };
  }

  // Step 1: context
  const contextLabel = trace.context === 'across_period' ? 'same period' : 'same group';
  steps.push({
    type: 'trend',
    key: 'context',
    text: `${elementA}, ${elementB}: ${contextLabel}`,
  });

  // Step 2: reasoning chain
  for (const rs of trace.reasoning_chain) {
    steps.push({
      type: 'trend',
      key: rs.relation,
      text: rs.conclusion,
    });
  }

  // Step 3: prediction result
  const dir = trace.trend_direction === 'increases' ? '↑' : '↓';
  steps.push({
    type: 'result',
    key: trace.trend_id,
    text: `${trace.property} ${dir} → ${trace.predicted_higher} higher`,
  });

  // Step 4: exception (if any)
  if (trace.exception) {
    steps.push({
      type: 'exception',
      key: trace.exception.id,
      text: `Exception: ${trace.exception.reason}`,
    });
  }

  return { source_id: trace.trend_id, steps };
}
