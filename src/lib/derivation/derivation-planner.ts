import type { SemanticRole } from '../../types/formula';
import type { QRef, DerivationRule, DerivationPlan, PlanStep } from '../../types/derivation';
import { qrefKey, qrefInSet } from './qref';

export interface PlannerOptions {
  maxDepth?: number;               // default 6
  availableIndexSets?: string[];   // e.g., ['composition_elements']
}

/**
 * AND/OR backward search planner with memoization.
 *
 * Finds the best derivation path from knowns to target,
 * or returns null if no path exists.
 */
export function planDerivation(
  target: QRef,
  knowns: QRef[],
  rules: DerivationRule[],
  quantityIndex: Map<string, DerivationRule[]>,
  options?: PlannerOptions,
): DerivationPlan | null {
  const maxDepth = options?.maxDepth ?? 6;
  const availableIndexSets = new Set(options?.availableIndexSets ?? []);
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
    if (knownKeys.has(key)) {
      const plan: DerivationPlan = { target: tgt, steps: [], score: 0 };
      memo.set(key, plan);
      return plan;
    }

    // Depth limit
    if (depth > maxDepth) return null;

    // Cycle detection
    if (visited.has(key)) return null;

    visited.add(key);

    // Get candidate rules for this quantity
    let candidates = quantityIndex.get(tgt.quantity) ?? [];

    // 1. Pre-filter: role compatibility + indexed-binding availability
    candidates = candidates.filter(rule =>
      roleCompatible(rule.targetRole, tgt.role) &&
      (!rule.needsIndexedBindings || indexSetsAvailable(rule, availableIndexSets)),
    );

    // 2. Exact dominance: if any exact candidate, prune all approximate
    const hasExact = candidates.some(r => !r.isApproximate);
    if (hasExact) {
      candidates = candidates.filter(r => !r.isApproximate);
    }

    // 3. Pre-rank: fewer unresolved inputs first (vs direct knowns only)
    candidates = [...candidates].sort((a, b) => {
      const unresolvedA = countUnresolved(a, knownKeys);
      const unresolvedB = countUnresolved(b, knownKeys);
      if (unresolvedA !== unresolvedB) return unresolvedA - unresolvedB;
      if (a.isInversion !== b.isInversion) return a.isInversion ? 1 : -1;
      return (a.baseCost ?? 0) - (b.baseCost ?? 0);
    });

    let bestPlan: DerivationPlan | null = null;

    for (const rule of candidates) {
      const subSteps: PlanStep[] = [];
      const inputRefs: Record<string, QRef> = {};
      const inputSources: Record<string, 'known' | string> = {};
      let ok = true;

      for (const input of rule.inputs) {
        const inputRef: QRef = { quantity: input.quantity, role: input.role };
        inputRefs[input.symbol] = inputRef;
        const inputKey = qrefKey(inputRef);

        if (knownKeys.has(inputKey)) {
          inputSources[input.symbol] = 'known';
          continue;
        }

        const subPlan = search(inputRef, depth + 1, visited);
        if (!subPlan) { ok = false; break; }

        subSteps.push(...subPlan.steps);
        inputSources[input.symbol] = subPlan.steps.length > 0
          ? subPlan.steps[subPlan.steps.length - 1].rule.id
          : 'known';
      }

      if (!ok) continue;

      const thisStep: PlanStep = { rule, target: tgt, inputRefs, inputSources };
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
function indexSetsAvailable(rule: DerivationRule, available: Set<string>): boolean {
  if (!rule.indexSets) return true;
  return rule.indexSets.every(s => available.has(s));
}

/** Count inputs not directly in the known set (cheap heuristic). */
function countUnresolved(rule: DerivationRule, knownKeys: Set<string>): number {
  let count = 0;
  for (const input of rule.inputs) {
    const key = input.role ? `${input.quantity}|${input.role}` : input.quantity;
    if (!knownKeys.has(key)) count++;
  }
  return count;
}

/**
 * Score a candidate plan. Lower = better.
 *
 * Dimensions:
 * - step count (fewer = better)
 * - approximate penalty
 * - indexed binding penalty
 * - inversion penalty
 * - per-rule baseCost
 * - generic role match penalty (unscoped rule matching scoped target)
 */
function scorePlan(steps: PlanStep[], targetRole?: SemanticRole): number {
  let score = steps.length * 100;
  for (const s of steps) {
    if (s.rule.isApproximate) score += 50;
    if (s.rule.needsIndexedBindings) score += 30;
    if (s.rule.isInversion) score += 10;
    score += s.rule.baseCost ?? 0;
    // Generic role match penalty: unscoped rule matching scoped target
    if (targetRole && !s.rule.targetRole) score += 20;
  }
  return score;
}
