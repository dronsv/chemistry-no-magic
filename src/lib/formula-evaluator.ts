import type { ExprNode, ComputableFormula, PhysicalConstant } from '../types/formula';
import type { Bindings, IndexedBindings, ConstantsDict, EvalStep, EvalTrace } from '../types/eval-trace';

/**
 * Build a ConstantsDict from PhysicalConstant[].
 */
export function toConstantsDict(constants: PhysicalConstant[]): ConstantsDict {
  const dict: ConstantsDict = {};
  for (const c of constants) {
    dict[c.id] = c.value;
  }
  return dict;
}

/**
 * Evaluate an ExprNode tree given bindings and constants.
 * @throws if a required binding or constant is missing.
 */
export function evaluateExpr(
  expr: ExprNode | string | number,
  bindings: Bindings,
  constants: ConstantsDict,
  indexed?: IndexedBindings,
): number {
  if (typeof expr === 'string') {
    if (expr in bindings) return bindings[expr];
    throw new Error(`Missing binding for symbol: ${expr}`);
  }
  if (typeof expr === 'number') return expr;

  switch (expr.op) {
    case 'literal':
      return expr.value;

    case 'const': {
      const val = constants[expr.ref];
      if (val === undefined) throw new Error(`Missing constant: ${expr.ref}`);
      return val;
    }

    case 'add':
      return expr.operands.reduce<number>(
        (acc, op) => acc + evaluateExpr(op, bindings, constants, indexed), 0,
      );

    case 'subtract': {
      const [first, ...rest] = expr.operands;
      const base = evaluateExpr(first, bindings, constants, indexed);
      return rest.reduce<number>(
        (acc, op) => acc - evaluateExpr(op, bindings, constants, indexed), base,
      );
    }

    case 'multiply':
      return expr.operands.reduce<number>(
        (acc, op) => acc * evaluateExpr(op, bindings, constants, indexed), 1,
      );

    case 'divide': {
      const [num, den] = expr.operands;
      const denominator = evaluateExpr(den, bindings, constants, indexed);
      if (denominator === 0) throw new Error('Division by zero');
      return evaluateExpr(num, bindings, constants, indexed) / denominator;
    }

    case 'power': {
      const [base, exponent] = expr.operands;
      return Math.pow(
        evaluateExpr(base, bindings, constants, indexed),
        evaluateExpr(exponent, bindings, constants, indexed),
      );
    }

    case 'exp':
      return Math.exp(evaluateExpr(expr.operand, bindings, constants, indexed));
    case 'log10':
      return Math.log10(evaluateExpr(expr.operand, bindings, constants, indexed));

    case 'sum': {
      const items = indexed?.[expr.index_set];
      if (!items || items.length === 0) {
        throw new Error(`Missing indexed bindings for index_set: ${expr.index_set}`);
      }
      let total = 0;
      for (const itemBindings of items) {
        const merged = { ...bindings, ...itemBindings };
        total += evaluateExpr(expr.term, merged, constants, indexed);
      }
      return total;
    }

    default:
      throw new Error(`Unknown ExprNode op: ${(expr as { op: string }).op}`);
  }
}

/** Convert an ExprNode to a human-readable string for traces/display. */
export function exprToString(expr: ExprNode | string | number): string {
  if (typeof expr === 'string') return expr;
  if (typeof expr === 'number') return String(expr);

  switch (expr.op) {
    case 'literal': return String(expr.value);
    case 'const': return expr.ref.replace('const:', '');
    case 'add': return expr.operands.map(exprToString).join(' + ');
    case 'subtract': return expr.operands.map(exprToString).join(' − ');
    case 'multiply': return expr.operands.map(exprToString).join(' × ');
    case 'divide': return `${exprToString(expr.operands[0])} / ${exprToString(expr.operands[1])}`;
    case 'power': return `${exprToString(expr.operands[0])}^${exprToString(expr.operands[1])}`;
    case 'exp': return `exp(${exprToString(expr.operand)})`;
    case 'log10': return `lg(${exprToString(expr.operand)})`;
    case 'sum': return `Σ(${exprToString(expr.term)})`;
    default: return '?';
  }
}

// ---------------------------------------------------------------------------
// Display symbol mapping — Layer B (canonical notation)
// ---------------------------------------------------------------------------

/** Symbol → display_symbol map for semantic formula rendering. */
export type DisplaySymbolMap = Record<string, string>;

/** Standard international abbreviations for semantic roles (Layer B, locale-free). */
const ROLE_QUALIFIER: Record<string, string> = {
  actual: 'act.',
  theoretical: 'theor.',
  solute: 'sol.',
  solution: 'soln.',
};

/**
 * Build a display symbol map from a formula's variables and constants.
 * - Variables with `display_symbol` are mapped.
 * - When multiple variables share the same display symbol, semantic_role
 *   is appended as a parenthesized qualifier (e.g. m → m(act.)).
 * - Constants are resolved by their full ref (e.g. "const:N_A" → "Nₐ").
 */
export function buildDisplayMap(
  formula: ComputableFormula,
  constants?: PhysicalConstant[],
): DisplaySymbolMap {
  const map: DisplaySymbolMap = {};

  // First pass: assign display symbols
  for (const v of formula.variables) {
    map[v.symbol] = v.display_symbol ?? v.symbol;
  }

  // Second pass: detect display collisions and qualify with semantic_role
  const displayCounts = new Map<string, number>();
  for (const v of formula.variables) {
    const d = map[v.symbol];
    displayCounts.set(d, (displayCounts.get(d) ?? 0) + 1);
  }
  for (const v of formula.variables) {
    const d = v.display_symbol ?? v.symbol;
    if ((displayCounts.get(d) ?? 0) > 1 && v.semantic_role) {
      const q = ROLE_QUALIFIER[v.semantic_role] ?? v.semantic_role;
      map[v.symbol] = `${d}(${q})`;
    }
  }

  // Constants: map by full ref (e.g. "const:N_A")
  if (constants) {
    for (const c of constants) {
      if (c.display_symbol) {
        map[c.id] = c.display_symbol;
      }
    }
  }
  return map;
}

/**
 * Convert an ExprNode to a display string using canonical notation.
 * Resolves variable symbols and constant refs through the display map.
 */
export function exprToDisplayString(
  expr: ExprNode | string | number,
  displayMap: DisplaySymbolMap,
): string {
  if (typeof expr === 'string') return displayMap[expr] ?? expr;
  if (typeof expr === 'number') return String(expr);

  switch (expr.op) {
    case 'literal': return String(expr.value);
    case 'const': {
      // Check full ref first (e.g. "const:N_A"), then strip prefix
      if (displayMap[expr.ref]) return displayMap[expr.ref];
      return expr.ref.replace('const:', '');
    }
    case 'add':
      return expr.operands.map(o => exprToDisplayString(o, displayMap)).join(' + ');
    case 'subtract':
      return expr.operands.map(o => exprToDisplayString(o, displayMap)).join(' − ');
    case 'multiply': {
      // Handle negation: -1 × X → −X
      if (expr.operands.length === 2) {
        const first = expr.operands[0];
        if (typeof first === 'object' && 'op' in first && first.op === 'literal' && first.value === -1) {
          return `−${exprToDisplayString(expr.operands[1], displayMap)}`;
        }
      }
      return expr.operands.map(o => exprToDisplayString(o, displayMap)).join(' × ');
    }
    case 'divide':
      return `${exprToDisplayString(expr.operands[0], displayMap)} / ${exprToDisplayString(expr.operands[1], displayMap)}`;
    case 'power':
      return `${exprToDisplayString(expr.operands[0], displayMap)}^${exprToDisplayString(expr.operands[1], displayMap)}`;
    case 'exp':
      return `exp(${exprToDisplayString(expr.operand, displayMap)})`;
    case 'log10':
      return `lg(${exprToDisplayString(expr.operand, displayMap)})`;
    case 'sum':
      return `Σ(${exprToDisplayString(expr.term, displayMap)})`;
    default: return '?';
  }
}

/**
 * Produce a complete formula display string (e.g. "ω = Aᵣ × n / M × 100").
 * Uses display_symbol from variables and constants.
 */
export function formulaToDisplayString(
  formula: ComputableFormula,
  inversionFor?: string,
  constants?: PhysicalConstant[],
): string {
  const displayMap = buildDisplayMap(formula, constants);
  if (inversionFor) {
    const invExpr = formula.inversions[inversionFor];
    if (!invExpr) return '';
    const targetDisplay = displayMap[inversionFor] ?? inversionFor;
    return `${targetDisplay} = ${exprToDisplayString(invExpr, displayMap)}`;
  }
  const resultDisplay = displayMap[formula.result_variable] ?? formula.result_variable;
  return `${resultDisplay} = ${exprToDisplayString(formula.expression, displayMap)}`;
}

/** A single renderable token of a formula expression. */
export type DisplayToken =
  | { kind: 'variable'; symbol: string; display: string }
  | { kind: 'const'; ref: string; display: string }
  | { kind: 'text'; text: string };

/** Set of variable symbols for a formula (so const/literal tokens are not misclassified). */
function variableSymbolSet(formula: ComputableFormula): Set<string> {
  return new Set(formula.variables.map(v => v.symbol));
}

function exprToTokens(
  expr: ExprNode | string | number,
  displayMap: DisplaySymbolMap,
  varSymbols: Set<string>,
  out: DisplayToken[],
): void {
  if (typeof expr === 'string') {
    if (varSymbols.has(expr)) {
      out.push({ kind: 'variable', symbol: expr, display: displayMap[expr] ?? expr });
    } else {
      out.push({ kind: 'text', text: displayMap[expr] ?? expr });
    }
    return;
  }
  if (typeof expr === 'number') {
    out.push({ kind: 'text', text: String(expr) });
    return;
  }

  switch (expr.op) {
    case 'literal':
      out.push({ kind: 'text', text: String(expr.value) });
      return;
    case 'const': {
      const display = displayMap[expr.ref] ?? expr.ref.replace('const:', '');
      out.push({ kind: 'const', ref: expr.ref, display });
      return;
    }
    case 'add':
      joinTokens(expr.operands, ' + ', displayMap, varSymbols, out);
      return;
    case 'subtract':
      joinTokens(expr.operands, ' − ', displayMap, varSymbols, out);
      return;
    case 'multiply': {
      if (expr.operands.length === 2) {
        const first = expr.operands[0];
        if (typeof first === 'object' && 'op' in first && first.op === 'literal' && first.value === -1) {
          out.push({ kind: 'text', text: '−' });
          exprToTokens(expr.operands[1], displayMap, varSymbols, out);
          return;
        }
      }
      joinTokens(expr.operands, ' × ', displayMap, varSymbols, out);
      return;
    }
    case 'divide':
      exprToTokens(expr.operands[0], displayMap, varSymbols, out);
      out.push({ kind: 'text', text: ' / ' });
      exprToTokens(expr.operands[1], displayMap, varSymbols, out);
      return;
    case 'power':
      exprToTokens(expr.operands[0], displayMap, varSymbols, out);
      out.push({ kind: 'text', text: '^' });
      exprToTokens(expr.operands[1], displayMap, varSymbols, out);
      return;
    case 'exp':
      out.push({ kind: 'text', text: 'exp(' });
      exprToTokens(expr.operand, displayMap, varSymbols, out);
      out.push({ kind: 'text', text: ')' });
      return;
    case 'log10':
      out.push({ kind: 'text', text: 'lg(' });
      exprToTokens(expr.operand, displayMap, varSymbols, out);
      out.push({ kind: 'text', text: ')' });
      return;
    case 'sum':
      out.push({ kind: 'text', text: 'Σ(' });
      exprToTokens(expr.term, displayMap, varSymbols, out);
      out.push({ kind: 'text', text: ')' });
      return;
    default:
      out.push({ kind: 'text', text: '?' });
  }
}

function joinTokens(
  operands: (ExprNode | string | number)[],
  sep: string,
  displayMap: DisplaySymbolMap,
  varSymbols: Set<string>,
  out: DisplayToken[],
): void {
  operands.forEach((o, i) => {
    if (i > 0) out.push({ kind: 'text', text: sep });
    exprToTokens(o, displayMap, varSymbols, out);
  });
}

/**
 * Tokenize a formula into ordered display tokens: result variable, ' = ',
 * then the expression. Variable tokens carry their symbol so the UI can wrap
 * them interactively; everything else is plain text or a constant.
 */
export function extractDisplayTokens(
  formula: ComputableFormula,
  inversionFor?: string,
  constants?: PhysicalConstant[],
): DisplayToken[] {
  const displayMap = buildDisplayMap(formula, constants);
  const varSymbols = variableSymbolSet(formula);
  const out: DisplayToken[] = [];

  if (inversionFor) {
    const invExpr = formula.inversions[inversionFor];
    if (!invExpr) return [];
    const targetDisplay = displayMap[inversionFor] ?? inversionFor;
    out.push({ kind: 'variable', symbol: inversionFor, display: targetDisplay });
    out.push({ kind: 'text', text: ' = ' });
    exprToTokens(invExpr, displayMap, varSymbols, out);
    return out;
  }

  const resultDisplay = displayMap[formula.result_variable] ?? formula.result_variable;
  out.push({ kind: 'variable', symbol: formula.result_variable, display: resultDisplay });
  out.push({ kind: 'text', text: ' = ' });
  exprToTokens(formula.expression, displayMap, varSymbols, out);
  return out;
}

/**
 * Evaluate a ComputableFormula's forward expression.
 * Returns the result value + an EvalTrace.
 */
export function evaluateFormula(
  formula: ComputableFormula,
  bindings: Bindings,
  constants: ConstantsDict,
  indexed?: IndexedBindings,
): EvalTrace {
  const steps: EvalStep[] = [];

  const relevantBindings: Record<string, number> = {};
  for (const v of formula.variables) {
    if (v.role !== 'result' && v.role !== 'constant' && v.symbol in bindings) {
      relevantBindings[v.symbol] = bindings[v.symbol];
    }
  }

  const result = evaluateExpr(formula.expression, bindings, constants, indexed);

  steps.push({
    expr: exprToString(formula.expression),
    value: result,
    substitutions: Object.keys(relevantBindings).length > 0 ? relevantBindings : undefined,
  });

  const trace: EvalTrace = {
    formulaId: formula.id,
    solvedFor: formula.result_variable,
    steps,
    result,
  };

  if (formula.approximation?.kind === 'approximate') {
    trace.is_approximate = true;
    trace.proxy_for = formula.approximation.proxy_for;
    trace.limitations = formula.approximation.limitations;
  }

  return trace;
}

/**
 * Solve a formula for a given variable using pre-stored inversions.
 * @param target — variable symbol to solve for (must be in formula.invertible_for)
 * @throws if variable is not invertible
 */
export function solveFor(
  formula: ComputableFormula,
  target: string,
  bindings: Bindings,
  constants: ConstantsDict,
  indexed?: IndexedBindings,
): EvalTrace {
  if (target === formula.result_variable) {
    return evaluateFormula(formula, bindings, constants, indexed);
  }

  if (!formula.invertible_for.includes(target)) {
    throw new Error(
      `Cannot solve ${formula.id} for '${target}'. Invertible for: [${formula.invertible_for.join(', ')}]`,
    );
  }

  const invExpr = formula.inversions[target];
  if (!invExpr) {
    throw new Error(`No inversion expression for '${target}' in ${formula.id}`);
  }

  const result = evaluateExpr(invExpr, bindings, constants, indexed);

  const steps: EvalStep[] = [{
    expr: `${target} = ${exprToString(invExpr)}`,
    value: result,
  }];

  const trace: EvalTrace = {
    formulaId: formula.id,
    solvedFor: target,
    steps,
    result,
  };

  if (formula.approximation?.kind === 'approximate') {
    trace.is_approximate = true;
    trace.proxy_for = formula.approximation.proxy_for;
    trace.limitations = formula.approximation.limitations;
  }

  return trace;
}
