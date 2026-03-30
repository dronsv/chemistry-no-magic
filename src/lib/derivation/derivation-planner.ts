import type { SemanticRole } from '../../types/formula';
import type {
  QRef, DerivationRule, DerivationOperator, FormulaOperator,
  StoichiometricBridgeOperator,
  DerivationPlan, PlanStep, OperatorHandler,
} from '../../types/derivation';
import { qrefKey, qrefInSet } from './qref';

export interface PlannerOptions {
  maxDepth?: number;               // default 6
  availableIndexSets?: string[];   // e.g., ['composition_elements']
  handlers?: Map<string, OperatorHandler>;   // kind -> handler (operator-aware mode)
  ontology?: unknown;              // passed through for handler matching context
}

/**
 * AND/OR backward search planner with memoization.
 *
 * Finds the best derivation path from knowns to target,
 * or returns null if no path exists.
 *
 * Supports two modes:
 * - Legacy (formula-only): pass DerivationRule[] — uses hardcoded formula logic
 * - Operator-aware: pass DerivationOperator[] + handlers — dispatches via OperatorHandler protocol
 *
 * Both signatures are backward-compatible: DerivationRule is an alias for FormulaOperator.
 */
export function planDerivation(
  target: QRef,
  knowns: QRef[],
  rules: DerivationOperator[],
  quantityIndex: Map<string, DerivationOperator[]>,
  options?: PlannerOptions,
): DerivationPlan | null {
  const maxDepth = options?.maxDepth ?? 6;
  const availableIndexSets = new Set(options?.availableIndexSets ?? []);
  const handlers = options?.handlers;
  const knownKeys = new Set(knowns.map(qrefKey));
  const memo = new Map<string, DerivationPlan | null>();

  const result = search(target, 0, new Set<string>());
  return result;

  function search(
    tgt: QRef,
    depth: number,
    visited: Set<string>,
  ): DerivationPlan | null {
    const key = qrefKey(tgt);

    // Memoized result
    if (memo.has(key)) return memo.get(key)!;

    // Base case: already known
    // Check both full contextual key and bare key (quantity + role only)
    // so context-free knowns can satisfy context-bearing sub-goals.
    const bareKey = tgt.role ? `${tgt.quantity}|${tgt.role}` : tgt.quantity;
    if (knownKeys.has(key) || (tgt.context && knownKeys.has(bareKey))) {
      const plan: DerivationPlan = { target: tgt, steps: [], score: 0 };
      memo.set(key, plan);
      return plan;
    }

    // Depth limit
    if (depth > maxDepth) return null;

    // Cycle detection
    if (visited.has(key)) return null;

    visited.add(key);

    // Get candidate operators for this quantity
    let candidates = quantityIndex.get(tgt.quantity) ?? [];

    if (handlers) {
      // Operator-aware mode: use handler.matches() for filtering
      candidates = candidates.filter(op => {
        const handler = handlers.get(op.kind);
        if (!handler) return false;
        if (!handler.matches(op, tgt)) return false;
        // For formula operators, also check indexed-binding availability
        if (op.kind === 'formula') {
          const fop = op as FormulaOperator;
          if (fop.needsIndexedBindings && !indexSetsAvailable(fop, availableIndexSets)) return false;
        }
        return true;
      });
    } else {
      // Legacy mode: formula-only filtering
      candidates = candidates.filter(op => {
        if (op.kind !== 'formula') return false;
        const fop = op as FormulaOperator;
        return roleCompatible(fop.targetRole, tgt.role) &&
          (!fop.needsIndexedBindings || indexSetsAvailable(fop, availableIndexSets));
      });
    }

    // 2. Exact dominance: if any exact formula candidate, prune all approximate formulas
    const hasExact = candidates.some(op =>
      op.kind !== 'formula' || !(op as FormulaOperator).isApproximate,
    );
    if (hasExact) {
      candidates = candidates.filter(op =>
        op.kind !== 'formula' || !(op as FormulaOperator).isApproximate,
      );
    }

    // 3. Pre-rank: fewer unresolved inputs first, then inversions, then baseCost
    candidates = [...candidates].sort((a, b) => {
      const unresolvedA = countUnresolved(a, knownKeys, tgt.context, handlers);
      const unresolvedB = countUnresolved(b, knownKeys, tgt.context, handlers);
      if (unresolvedA !== unresolvedB) return unresolvedA - unresolvedB;
      const invA = a.kind === 'formula' && (a as FormulaOperator).isInversion;
      const invB = b.kind === 'formula' && (b as FormulaOperator).isInversion;
      if (invA !== invB) return invA ? 1 : -1;
      return (a.baseCost ?? 0) - (b.baseCost ?? 0);
    });

    let bestPlan: DerivationPlan | null = null;

    for (const op of candidates) {
      const subSteps: PlanStep[] = [];
      const inputRefs: Record<string, QRef> = {};
      const inputSources: Record<string, 'known' | string> = {};
      let ok = true;

      // Get sub-goals via handler or hardcoded formula logic
      const subGoals = getSubGoals(op, tgt, handlers);

      for (const { symbol, ref: inputRef } of subGoals) {
        inputRefs[symbol] = inputRef;
        const inputKey = qrefKey(inputRef);

        if (knownKeys.has(inputKey)) {
          inputSources[symbol] = 'known';
          continue;
        }

        // Also check bare key for context-free knowns
        if (inputRef.context) {
          const iBareKey = inputRef.role
            ? `${inputRef.quantity}|${inputRef.role}`
            : inputRef.quantity;
          if (knownKeys.has(iBareKey)) {
            inputSources[symbol] = 'known';
            continue;
          }
        }

        const subPlan = search(inputRef, depth + 1, visited);
        if (!subPlan) { ok = false; break; }

        subSteps.push(...subPlan.steps);
        inputSources[symbol] = subPlan.steps.length > 0
          ? subPlan.steps[subPlan.steps.length - 1].rule.id
          : 'known';
      }

      if (!ok) continue;

      const thisStep: PlanStep = { rule: op, target: tgt, inputRefs, inputSources };
      const allSteps = [...subSteps, thisStep];
      const score = scorePlan(allSteps, tgt.role);

      if (!bestPlan || score < bestPlan.score) {
        bestPlan = { target: tgt, steps: allSteps, score };
      }
    }

    visited.delete(key); // backtrack
    memo.set(key, bestPlan);
    return bestPlan;
  }
}

/**
 * Get sub-goals for an operator. Returns symbol-keyed QRef array.
 * For formula operators: expands inputs with context propagation.
 * For bridge operators: expands 3 sub-goals (n_from, nu_from, nu_to).
 * For lookup/aggregate operators: returns empty (leaf nodes).
 */
function getSubGoals(
  op: DerivationOperator,
  target: QRef,
  handlers?: Map<string, OperatorHandler>,
): Array<{ symbol: string; ref: QRef }> {
  if (handlers) {
    const handler = handlers.get(op.kind);
    if (handler) {
      const expanded = handler.expand(op, target);
      if (op.kind === 'formula') {
        const fop = op as FormulaOperator;
        return fop.inputs.map((input, i) => ({
          symbol: input.symbol,
          ref: expanded[i],
        }));
      }
      if (op.kind === 'stoichiometric_bridge') {
        // Bridge has 3 sub-goals: n_from, nu_from, nu_to
        const symbols = ['n_from', 'nu_from', 'nu_to'];
        return expanded.map((ref, i) => ({ symbol: symbols[i], ref }));
      }
      // Leaf operators (lookup, aggregate): no sub-goals
      return [];
    }
  }

  // Legacy fallback: formula-only
  if (op.kind !== 'formula') return [];
  const fop = op as FormulaOperator;
  return fop.inputs.map(input => {
    const ref: QRef = { quantity: input.quantity, role: input.role };
    if (target.context && !ref.context) {
      ref.context = target.context;
    }
    return { symbol: input.symbol, ref };
  });
}

/**
 * Role compatibility check.
 * Unscoped match is allowed but penalized in scoring.
 */
function roleCompatible(
  ruleRole: SemanticRole | undefined,
  targetRole: SemanticRole | undefined,
): boolean {
  if (!targetRole) return true;    // unscoped target: any rule ok
  if (!ruleRole) return true;      // unscoped rule: can match, penalized in score
  return ruleRole === targetRole;  // both scoped: must match exactly
}

/** Check if all required index sets are available. */
function indexSetsAvailable(rule: FormulaOperator, available: Set<string>): boolean {
  if (!rule.indexSets) return true;
  return rule.indexSets.every(s => available.has(s));
}

/**
 * Count inputs not directly in the known set (cheap heuristic).
 * For leaf operators (lookup, aggregate): returns 0.
 * For formula and bridge operators: counts unresolved sub-goals.
 */
function countUnresolved(
  op: DerivationOperator,
  knownKeys: Set<string>,
  targetContext?: QRef['context'],
  handlers?: Map<string, OperatorHandler>,
): number {
  if (op.kind === 'stoichiometric_bridge') {
    const bop = op as StoichiometricBridgeOperator;
    // Bridge has 3 sub-goals: n@fromRole, nu@fromRole, nu@toRole
    const subGoals: QRef[] = [
      { quantity: 'q:amount', role: bop.fromRole },
      { quantity: 'q:stoich_coeff', role: bop.fromRole },
      { quantity: 'q:stoich_coeff', role: bop.toRole },
    ];
    let count = 0;
    for (const ref of subGoals) {
      const fullKey = qrefKey(ref);
      const bareKey = ref.role ? `${ref.quantity}|${ref.role}` : ref.quantity;
      if (!knownKeys.has(fullKey) && !knownKeys.has(bareKey)) count++;
    }
    return count;
  }

  if (op.kind !== 'formula') return 0;
  const fop = op as FormulaOperator;

  let count = 0;
  for (const input of fop.inputs) {
    // Build the full input QRef with inherited context
    const inputRef: QRef = { quantity: input.quantity, role: input.role };
    if (targetContext) inputRef.context = targetContext;
    const fullKey = qrefKey(inputRef);
    // Also check bare key (no context) for backward compat
    const bareKey = input.role ? `${input.quantity}|${input.role}` : input.quantity;
    if (!knownKeys.has(fullKey) && !knownKeys.has(bareKey)) count++;
  }
  return count;
}

/**
 * Score a candidate plan. Lower = better.
 *
 * Cost model:
 * - AND-node cost: sum of all step costs (each operator contributes independently)
 * - OR-node cost: planner picks the minimum-cost alternative
 * - Operator-local cost: each operator declares baseCost; formula operators add
 *   structural penalties (approximate, inversion, indexed, role mismatch)
 * - Step count penalty: small bonus per step to prefer shorter plans at equal cost
 */
function scorePlan(steps: PlanStep[], targetRole?: SemanticRole): number {
  let score = 0;

  // AND-node: sum costs of all steps
  for (const s of steps) {
    const op = s.rule;

    // Operator-local base cost (declared by handler/registry)
    score += op.baseCost ?? 100; // default 100 per step if no baseCost

    // Formula-specific structural penalties
    if (op.kind === 'formula') {
      const fop = op as FormulaOperator;
      if (fop.isApproximate) score += 50;
      if (fop.needsIndexedBindings) score += 30;
      if (fop.isInversion) score += 10;
      // Generic role match penalty: unscoped rule matching scoped target
      if (targetRole && !fop.targetRole) score += 20;
    }
  }

  // Small step-count tiebreaker (prefer shorter at equal cost)
  score += steps.length;

  return score;
}
