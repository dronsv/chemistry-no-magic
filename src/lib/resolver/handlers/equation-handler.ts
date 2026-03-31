import type { ResolutionDef } from '../../../types/resolution.js';
import type { Expr, ResolvedInputs, ValueExpr } from '../../../types/query-ast.js';
import type { ComputableFormula } from '../../../types/formula.js';
import type { ConstantsDict } from '../../../types/eval-trace.js';
import { buildDerivationRules, buildQuantityIndex } from '../../derivation/derivation-graph.js';
import { planDerivation } from '../../derivation/derivation-planner.js';
import { executePlan } from '../../derivation/derivation-executor.js';

export type HandlerResult =
  | { answer: Expr; formula_rendered?: string }
  | { error: string };

export interface EquationHandlerEnv {
  formulas: ComputableFormula[];
  constants: ConstantsDict;
}

/**
 * Evaluate an ExprNode tree with variable substitution.
 * Returns a number on success, throws on missing variables or unknown ops.
 */
function evalNode(
  node: unknown,
  vars: Record<string, number>,
  constants: ConstantsDict,
): number {
  if (typeof node === 'number') return node;
  if (typeof node === 'string') {
    if (node in vars) return vars[node];
    throw new Error(`Missing variable: ${node}`);
  }
  const n = node as Record<string, unknown>;
  if (!n || typeof n !== 'object' || typeof n.op !== 'string') {
    throw new Error(`Unknown node: ${JSON.stringify(node)}`);
  }
  switch (n.op) {
    case 'literal':
      return n.value as number;
    case 'const': {
      const key = n.ref as string;
      if (key in constants) return constants[key];
      throw new Error(`Missing constant: ${key}`);
    }
    case 'add': {
      const ops = n.operands as unknown[];
      return ops.reduce<number>((acc, op) => acc + evalNode(op, vars, constants), 0);
    }
    case 'subtract': {
      const [first, ...rest] = n.operands as unknown[];
      return (rest as unknown[]).reduce<number>(
        (acc, op) => acc - evalNode(op, vars, constants),
        evalNode(first, vars, constants),
      );
    }
    case 'multiply': {
      const ops = n.operands as unknown[];
      return ops.reduce<number>((acc, op) => acc * evalNode(op, vars, constants), 1);
    }
    case 'divide': {
      const [num, den] = n.operands as unknown[];
      const denominator = evalNode(den, vars, constants);
      if (denominator === 0) throw new Error('Division by zero');
      return evalNode(num, vars, constants) / denominator;
    }
    case 'power': {
      const [base, exp] = n.operands as unknown[];
      return Math.pow(evalNode(base, vars, constants), evalNode(exp, vars, constants));
    }
    case 'exp':
      return Math.exp(evalNode(n.operand as unknown, vars, constants));
    case 'log10':
      return Math.log10(evalNode(n.operand as unknown, vars, constants));
    default:
      throw new Error(`Unsupported op: ${n.op}`);
  }
}

/**
 * Try to collect numeric values for all input variables of a formula from
 * prerequisite_results. Returns null if any value is missing or non-numeric.
 */
function collectInputValues(
  formula: ComputableFormula,
  prerequisiteResults: Record<string, Expr>,
): Record<string, number> | null {
  const vars: Record<string, number> = {};
  for (const variable of formula.variables) {
    if (variable.role !== 'input') continue;
    const result = prerequisiteResults[variable.quantity]
      ?? prerequisiteResults[variable.symbol];
    if (!result) return null;
    if (result.kind !== 'value') return null;
    const v = result as ValueExpr;
    if (typeof v.value !== 'number') return null;
    vars[variable.symbol] = v.value;
  }
  return vars;
}

/**
 * Wraps the derivation planner for equation-type resolutions.
 * Tries direct expression evaluation first; falls back to derivation planner.
 */
export function executeEquation(
  resolution: ResolutionDef,
  inputs: ResolvedInputs,
  env: EquationHandlerEnv,
): HandlerResult {
  const { formulas, constants } = env;

  const formulaId = resolution.formula_id;
  if (!formulaId) {
    return { error: `Resolution ${resolution.id} has no formula_id` };
  }

  const formula = formulas.find(f => f.id === formulaId);
  if (!formula) {
    return { error: `Formula not found: ${formulaId}` };
  }

  const solveFor = resolution.solve_for;

  // ── Direct evaluation ─────────────────────────────────────────────────────
  // Prefer simple AST evaluation over the full planner for basic formulas.
  try {
    const inputVars = collectInputValues(formula, inputs.prerequisite_results);
    if (inputVars !== null) {
      // Choose expression: forward (result_variable) or inversion (solve_for)
      const expr = solveFor && solveFor !== formula.result_variable
        ? formula.inversions[solveFor]
        : formula.expression;

      if (expr) {
        const result = evalNode(expr, inputVars, constants);
        const answer: ValueExpr = { kind: 'value', value: result };
        return { answer };
      }
    }
  } catch {
    // Direct evaluation failed — fall through to derivation planner
  }

  // ── Derivation planner fallback ───────────────────────────────────────────
  try {
    const rules = buildDerivationRules(formulas);
    const index = buildQuantityIndex(rules);

    // Determine target quantity from the solve_for variable or the result variable
    const targetVar = formula.variables.find(
      v => v.symbol === (solveFor ?? formula.result_variable),
    );
    if (!targetVar) {
      return { error: `Variable not found in formula ${formulaId}: ${solveFor}` };
    }

    // Build known values from prerequisite_results
    const values: Record<string, number> = {};
    const knowns = formula.variables
      .filter(v => v.role === 'input')
      .filter(v => {
        const result = inputs.prerequisite_results[v.quantity]
          ?? inputs.prerequisite_results[v.symbol];
        if (!result || result.kind !== 'value') return false;
        const val = (result as ValueExpr).value;
        if (typeof val !== 'number') return false;
        values[v.quantity] = val;
        return true;
      })
      .map(v => ({ quantity: v.quantity, role: v.semantic_role }));

    const plan = planDerivation(
      { quantity: targetVar.quantity, role: targetVar.semantic_role },
      knowns,
      rules,
      index,
    );

    if (!plan) {
      return { error: `No derivation path found for ${targetVar.quantity}` };
    }

    const executionResult = executePlan(plan, { formulas, constants, values });
    const answer: ValueExpr = { kind: 'value', value: executionResult.result };
    return { answer };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Equation handler failed: ${message}` };
  }
}
