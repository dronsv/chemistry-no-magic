import type { ResolutionDef } from '../../../types/resolution.js';
import type { Expr, ResolvedInputs, ValueExpr, SymbolExpr } from '../../../types/query-ast.js';
import type { OntologyData, SlotValues } from '../../task-engine/types.js';
import { runSolver } from '../../task-engine/solvers.js';

export type HandlerResult =
  | { answer: Expr; formula_rendered?: string }
  | { error: string };

export interface RuleHandlerEnv {
  ontologyData: OntologyData;
}

/**
 * Convert a single Expr binding value to a SlotValues-compatible string or number.
 * SymbolExpr → ref.id (stripped of kind prefix is NOT done — keep full "kind:id" for solver)
 * ValueExpr (number) → number
 * ValueExpr (string) → string
 * Others → JSON string
 */
function exprToSlotValue(expr: Expr): string | number | string[] {
  if (expr.kind === 'symbol') {
    const s = expr as SymbolExpr;
    return s.ref.id;
  }
  if (expr.kind === 'value') {
    const v = expr as ValueExpr;
    if (typeof v.value === 'number') return v.value;
    return String(v.value);
  }
  if (expr.kind === 'list') {
    return expr.items.map(item => String(exprToSlotValue(item)));
  }
  return JSON.stringify(expr);
}

/**
 * Wraps existing solvers for rule-type resolutions.
 * Converts bindings from ResolvedInputs into SlotValues, then calls runSolver.
 */
export function executeRule(
  resolution: ResolutionDef,
  inputs: ResolvedInputs,
  env: RuleHandlerEnv,
): HandlerResult {
  const solverId = resolution.solver_id;
  if (!solverId) {
    return { error: `Resolution ${resolution.id} has no solver_id` };
  }

  // Build SlotValues from bindings: strip leading $ from variable names
  const slots: SlotValues = {};
  for (const [key, expr] of Object.entries(inputs.bindings)) {
    const slotKey = key.startsWith('$') ? key.slice(1) : key;
    slots[slotKey] = exprToSlotValue(expr);
  }

  // Also fold prerequisite_results into slots (quantity → value)
  for (const [key, expr] of Object.entries(inputs.prerequisite_results)) {
    if (expr.kind === 'value') {
      const v = expr as ValueExpr;
      slots[key] = typeof v.value === 'number' ? v.value : String(v.value);
    }
  }

  try {
    const solverResult = runSolver(solverId, {}, slots, env.ontologyData);

    if (solverResult.error) {
      return { error: solverResult.error };
    }

    const raw = solverResult.answer;
    if (raw === undefined) {
      return { error: `Solver ${solverId} returned no answer` };
    }

    let answer: Expr;
    if (typeof raw === 'number') {
      const v: ValueExpr = { kind: 'value', value: raw };
      answer = v;
    } else if (typeof raw === 'string') {
      const v: ValueExpr = { kind: 'value', value: raw };
      answer = v;
    } else if (Array.isArray(raw)) {
      // string[] → ListExpr of ValueExpr
      answer = {
        kind: 'list',
        items: raw.map(item => ({ kind: 'value', value: item } as ValueExpr)),
      };
    } else {
      const v: ValueExpr = { kind: 'value', value: String(raw) };
      answer = v;
    }

    return { answer };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Rule handler (${solverId}) failed: ${message}` };
  }
}
