import type { ComputableFormula } from '../../types/formula';
import type {
  DerivationPlan, ReasonTrace, ReasonStep, QRef, FormulaOperator,
  ProofNode, ProofTree, PlanStep,
} from '../../types/derivation';
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

  // 2. Steps from plan (formula steps get full trace; non-formula get internal steps)

  // Insert any internal steps collected from handlers (decompose, lookup, etc.)
  if (execution.internalSteps) {
    steps.push(...execution.internalSteps);
  }

  for (let i = 0; i < plan.steps.length; i++) {
    const planStep = plan.steps[i];
    const trace = execution.traces[i];
    const op = planStep.rule;

    if (op.kind === 'formula') {
      const fop = op as FormulaOperator;
      const formula = formulas.find(f => f.id === fop.formulaId);

      // formula_select
      steps.push({
        type: 'formula_select',
        formulaId: fop.formulaId,
        target: planStep.target,
      });

      // substitution — collect concrete values for inputs
      const bindings: Record<string, number> = {};
      for (const input of fop.inputs) {
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
          formulaId: fop.formulaId,
          bindings,
        });
      }

      // compute
      const approximate = formula?.approximation?.kind === 'approximate';
      if (approximate) isApproximate = true;
      steps.push({
        type: 'compute',
        formulaId: fop.formulaId,
        result: trace.result,
        approximate: approximate || undefined,
      });
    }
    // Non-formula operators: internal steps already emitted above
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

/**
 * Build a proof tree from an executed plan.
 *
 * The tree mirrors the AND/OR planner structure:
 * - Each plan step becomes a node with its inputs as children
 * - Given values are leaf nodes (operator = null)
 * - Aggregate/lookup operators include internal sub-steps
 */
export function buildProofTree(
  plan: DerivationPlan,
  execution: ExecutionResult,
  knownValues: Record<string, number>,
): ProofTree {
  // Build step index: target qrefKey → PlanStep + trace index
  const stepByTarget = new Map<string, { step: PlanStep; traceIdx: number }>();
  for (let i = 0; i < plan.steps.length; i++) {
    stepByTarget.set(qrefKey(plan.steps[i].target), { step: plan.steps[i], traceIdx: i });
  }

  // Known value keys for leaf detection
  const knownKeys = new Set(Object.keys(knownValues));

  function buildNode(target: QRef): ProofNode {
    const key = qrefKey(target);
    const bareKey = target.role ? `${target.quantity}|${target.role}` : target.quantity;
    const entry = stepByTarget.get(key);

    // Leaf: given value (no plan step produces this)
    if (!entry) {
      const value = knownValues[key] ?? knownValues[bareKey];
      return { operator: null, target, value, children: [] };
    }

    const { step, traceIdx } = entry;
    const children: ProofNode[] = [];

    // Build children from inputRefs
    if (step.rule.kind === 'formula') {
      const fop = step.rule as FormulaOperator;
      for (const input of fop.inputs) {
        const inputRef = step.inputRefs[input.symbol];
        if (inputRef) children.push(buildNode(inputRef));
      }
    }
    // Lookup and aggregate have no planner-level children (internal steps instead)

    const value = execution.computedValues[key];

    // Collect internal steps from handler execution (aggregate: decompose + lookups)
    let internalSteps: ReasonStep[] | undefined;
    if (step.rule.kind !== 'formula' && execution.internalSteps?.length) {
      // Internal steps belong to this operator if they were emitted during its execution
      // For now, associate all internal steps with the first non-formula step
      // (Phase 4 can refine per-step tracking)
      internalSteps = execution.internalSteps;
    }

    return { operator: step.rule, target, value, children, internalSteps };
  }

  const root = buildNode(plan.target);
  const isApprox = plan.steps.some(s =>
    s.rule.kind === 'formula' && (s.rule as FormulaOperator).isApproximate,
  );

  return { root, result: execution.result, isApproximate: isApprox };
}

/**
 * Flatten a proof tree into a linear ReasonStep[] sequence (DFS pre-order).
 * Produces the same output as buildReasonTrace for backward compatibility.
 */
export function flattenProofTree(
  tree: ProofTree,
  formulas: ComputableFormula[],
): ReasonStep[] {
  const steps: ReasonStep[] = [];

  function visit(node: ProofNode): void {
    // Visit children first (inputs before the step that uses them)
    for (const child of node.children) {
      visit(child);
    }

    if (!node.operator) {
      // Leaf: given value
      if (node.value !== undefined) {
        steps.push({ type: 'given', qref: node.target, value: node.value });
      }
      return;
    }

    // Internal steps (decompose, lookups from aggregate/lookup handlers)
    if (node.internalSteps) {
      steps.push(...node.internalSteps);
    }

    if (node.operator.kind === 'formula') {
      const fop = node.operator as FormulaOperator;
      const formula = formulas.find(f => f.id === fop.formulaId);
      steps.push({ type: 'formula_select', formulaId: fop.formulaId, target: node.target });
      // Substitution: collect child values as bindings
      const bindings: Record<string, number> = {};
      for (const input of fop.inputs) {
        const child = node.children.find(c => c.target.quantity === input.quantity);
        if (child?.value !== undefined) bindings[input.symbol] = child.value;
      }
      if (Object.keys(bindings).length > 0) {
        steps.push({ type: 'substitution', formulaId: fop.formulaId, bindings });
      }
      const approximate = formula?.approximation?.kind === 'approximate';
      steps.push({
        type: 'compute',
        formulaId: fop.formulaId,
        result: node.value!,
        approximate: approximate || undefined,
      });
    }
  }

  visit(tree.root);
  steps.push({ type: 'conclusion', target: tree.root.target, value: tree.result });
  return steps;
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
