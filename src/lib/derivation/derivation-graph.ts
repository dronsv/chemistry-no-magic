import type { ComputableFormula } from '../../types/formula';
import type { DerivationRule, DerivationRuleInput } from '../../types/derivation';

/**
 * Build DerivationRule[] from ComputableFormula[].
 *
 * Each formula produces:
 * - 1 forward rule: target = result_variable
 * - N inversion rules: one per entry in invertible_for
 *
 * Role is read from variable.semantic_role (explicit metadata, no suffix inference).
 */
export function buildDerivationRules(formulas: ComputableFormula[]): DerivationRule[] {
  const rules: DerivationRule[] = [];

  for (const formula of formulas) {
    const isApproximate = formula.approximation?.kind === 'approximate';
    const vars = formula.variables;
    const resultVar = vars.find(v => v.symbol === formula.result_variable)!;

    // Detect indexed bindings
    const indexSets = collectIndexSets(formula);
    const needsIndexedBindings = indexSets.length > 0;

    // Forward rule
    const forwardInputs: DerivationRuleInput[] = vars
      .filter(v => v.role === 'input')
      .map(v => ({ symbol: v.symbol, quantity: v.quantity, role: v.semantic_role }));

    rules.push({
      id: `${formula.id}/forward`,
      formulaId: formula.id,
      targetSymbol: resultVar.symbol,
      targetQuantity: resultVar.quantity,
      targetRole: resultVar.semantic_role,
      inputs: forwardInputs,
      isInversion: false,
      isApproximate,
      needsIndexedBindings,
      indexSets: needsIndexedBindings ? indexSets : undefined,
    });

    // Inversion rules
    for (const invSymbol of formula.invertible_for) {
      const invVar = vars.find(v => v.symbol === invSymbol);
      if (!invVar) continue;

      // Inputs for inversion: all non-constant, non-index variables except the target
      const invInputs: DerivationRuleInput[] = vars
        .filter(v => v.symbol !== invSymbol && (v.role === 'input' || v.role === 'result'))
        .map(v => ({ symbol: v.symbol, quantity: v.quantity, role: v.semantic_role }));

      rules.push({
        id: `${formula.id}/inv:${invSymbol}`,
        formulaId: formula.id,
        targetSymbol: invVar.symbol,
        targetQuantity: invVar.quantity,
        targetRole: invVar.semantic_role,
        inputs: invInputs,
        isInversion: true,
        isApproximate,
        needsIndexedBindings,
        indexSets: needsIndexedBindings ? indexSets : undefined,
      });
    }
  }

  return rules;
}

/**
 * Build coarse quantity index: quantity string → rules that produce it.
 * Role filtering happens at search time, not here.
 */
export function buildQuantityIndex(rules: DerivationRule[]): Map<string, DerivationRule[]> {
  const index = new Map<string, DerivationRule[]>();
  for (const rule of rules) {
    let arr = index.get(rule.targetQuantity);
    if (!arr) {
      arr = [];
      index.set(rule.targetQuantity, arr);
    }
    arr.push(rule);
  }
  return index;
}

/** Collect index_set names from a formula's expression tree. */
function collectIndexSets(formula: ComputableFormula): string[] {
  const sets: string[] = [];
  walkExpr(formula.expression, sets);
  // Also check inversions
  for (const inv of Object.values(formula.inversions)) {
    walkExpr(inv, sets);
  }
  return [...new Set(sets)];
}

function walkExpr(expr: unknown, sets: string[]): void {
  if (!expr || typeof expr !== 'object') return;
  const node = expr as Record<string, unknown>;
  if (node.op === 'sum' && typeof node.index_set === 'string') {
    sets.push(node.index_set);
  }
  if (Array.isArray(node.operands)) {
    for (const op of node.operands) walkExpr(op, sets);
  }
  if (node.term) walkExpr(node.term, sets);
  if (node.operand) walkExpr(node.operand, sets);
}
