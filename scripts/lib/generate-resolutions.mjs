/**
 * Generate ResolutionDef entries from ComputableFormula data.
 *
 * Produces forward + inverse resolution defs for each formula,
 * then merges with manually authored resolutions from resolutions.json.
 *
 * Exported functions:
 *   generateResolutionsFromFormulas(formulas)  → ResolutionDef[]
 *   mergeResolutions(generated, manual)         → ResolutionDef[]
 *   buildResolutionIndex(resolutions)           → Record<string, ResolutionDef[]>
 *   generateResolutionRegistry(formulas, manual, outDir) → writes JSON files
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ── Quantity predicate mapping ────────────────────────────────────────────────

/**
 * Convert a quantity ref like "q:mass" → "quantity.mass".
 * Falls back gracefully: "q:foo_bar" → "quantity.foo_bar".
 *
 * @param {string} qRef
 * @returns {string}
 */
export function quantityToPredicate(qRef) {
  if (!qRef || !qRef.startsWith('q:')) {
    return qRef ?? '';
  }
  const name = qRef.slice(2); // strip "q:"
  return `quantity.${name}`;
}

// ── Expression AST serializer ─────────────────────────────────────────────────

/**
 * Serialize an expression AST node to a human-readable string.
 * Variable symbols are mapped to their predicate form using varToPredicateMap.
 *
 * Supported ops: divide, multiply, add, subtract, power, sum, log10,
 *                exp, const, literal, (string → variable reference)
 *
 * @param {unknown} node  - AST node (string symbol, number, or op object)
 * @param {Map<string, string>} varToPredicateMap  - symbol → predicate($entity)
 * @returns {string}
 */
export function serializeExpr(node, varToPredicateMap) {
  if (typeof node === 'string') {
    // Variable symbol reference
    return varToPredicateMap.get(node) ?? node;
  }
  if (typeof node === 'number') {
    return String(node);
  }
  if (!node || typeof node !== 'object') {
    return String(node);
  }

  const { op } = node;

  switch (op) {
    case 'literal':
      return String(node.value);

    case 'const':
      return node.ref ?? 'const';

    case 'divide': {
      const [num, den] = node.operands;
      return `divide(${serializeExpr(num, varToPredicateMap)}, ${serializeExpr(den, varToPredicateMap)})`;
    }

    case 'multiply': {
      const parts = node.operands.map((o) => serializeExpr(o, varToPredicateMap));
      return `multiply(${parts.join(', ')})`;
    }

    case 'add': {
      const parts = node.operands.map((o) => serializeExpr(o, varToPredicateMap));
      return `add(${parts.join(', ')})`;
    }

    case 'subtract': {
      const [left, right] = node.operands;
      return `subtract(${serializeExpr(left, varToPredicateMap)}, ${serializeExpr(right, varToPredicateMap)})`;
    }

    case 'power': {
      const [base, exp] = node.operands;
      return `power(${serializeExpr(base, varToPredicateMap)}, ${serializeExpr(exp, varToPredicateMap)})`;
    }

    case 'sum': {
      const termStr = serializeExpr(node.term, varToPredicateMap);
      return `sum(over=${node.over}, index_set=${node.index_set}, term=${termStr})`;
    }

    case 'log10': {
      const arg = node.operand ?? (node.operands && node.operands[0]);
      return `log10(${serializeExpr(arg, varToPredicateMap)})`;
    }

    case 'exp': {
      const arg = node.operand ?? (node.operands && node.operands[0]);
      return `exp(${serializeExpr(arg, varToPredicateMap)})`;
    }

    default:
      return `${op}(?)`;
  }
}

// ── Denominator detection ─────────────────────────────────────────────────────

/**
 * Check whether a variable symbol appears as a denominator in any divide node
 * within the expression AST (recursively).
 *
 * @param {unknown} expr     - AST node to inspect
 * @param {string}  varSymbol
 * @returns {boolean}
 */
export function isDenominator(expr, varSymbol) {
  if (!expr || typeof expr !== 'object') return false;

  const { op } = expr;

  if (op === 'divide') {
    const den = expr.operands?.[1];
    // Direct variable in denominator position
    if (den === varSymbol) return true;
    // Nested variable anywhere inside denominator subtree
    if (_containsSymbol(den, varSymbol)) return true;
    // Also recurse into numerator in case of nested divides
    return isDenominator(expr.operands?.[0], varSymbol);
  }

  // Recurse into all child nodes
  const children = [];
  if (Array.isArray(expr.operands)) children.push(...expr.operands);
  if (expr.operand) children.push(expr.operand);
  if (expr.term) children.push(expr.term);

  return children.some((child) => isDenominator(child, varSymbol));
}

/** Helper: does the subtree contain the variable symbol anywhere? */
function _containsSymbol(node, varSymbol) {
  if (node === varSymbol) return true;
  if (!node || typeof node !== 'object') return false;
  const children = [];
  if (Array.isArray(node.operands)) children.push(...node.operands);
  if (node.operand) children.push(node.operand);
  if (node.term) children.push(node.term);
  return children.some((c) => _containsSymbol(c, varSymbol));
}

// ── Formula → ResolutionDef generation ───────────────────────────────────────

/**
 * Derive the "family" string from a formula id.
 * e.g. "formula:amount_from_mass" → "stoichiometry" (uses domain when available).
 *
 * @param {object} formula
 * @returns {string}
 */
function formulaFamily(formula) {
  return formula.domain ?? formula.id.replace(/^formula:/, '').replace(/_/g, '_');
}

/**
 * Build the varToPredicateMap for a formula's input/result/index variables.
 * Maps symbol → "quantity.xxx($entity)".
 * Constant variables are omitted (they need no prerequisite).
 *
 * @param {Array<{symbol: string, quantity: string, role: string}>} variables
 * @returns {Map<string, string>}
 */
function buildVarPredicateMap(variables) {
  const map = new Map();
  for (const v of variables) {
    if (v.role === 'constant') continue;
    const predicate = quantityToPredicate(v.quantity);
    map.set(v.symbol, `${predicate}($entity)`);
  }
  return map;
}

/**
 * Collect preconditions: if a variable appears as a denominator in the given
 * expression, emit a "!=0" guard for that variable's predicate.
 *
 * @param {unknown} expr
 * @param {Array<{symbol: string, quantity: string, role: string}>} variables
 * @param {Map<string, string>} varPredicateMap
 * @returns {string[]}
 */
function buildPreconditions(expr, variables, varPredicateMap) {
  const preconditions = [];
  for (const v of variables) {
    if (v.role === 'constant' || v.role === 'index') continue;
    if (isDenominator(expr, v.symbol)) {
      const pred = varPredicateMap.get(v.symbol) ?? `${quantityToPredicate(v.quantity)}($entity)`;
      preconditions.push(`${pred} != 0`);
    }
  }
  return preconditions;
}

/**
 * Generate all ResolutionDef entries from an array of ComputableFormula objects.
 *
 * For each formula:
 *   - One forward resolution (result_variable as target, input vars as prereqs)
 *   - One inverse resolution per entry in invertible_for[]
 *
 * @param {Array<object>} formulas
 * @returns {Array<object>}  ResolutionDef[]
 */
export function generateResolutionsFromFormulas(formulas) {
  const results = [];

  for (const formula of formulas) {
    const {
      id,
      variables = [],
      expression,
      result_variable,
      invertible_for = [],
      inversions = {},
      approximation,
    } = formula;

    if (!id || !result_variable) continue;

    const family = formulaFamily(formula);
    const uncertaintyMode = approximation ? 'model_limited' : 'propagate';
    const approximationKind = approximation?.kind;

    // Build symbol → predicate($entity) map for all non-constant variables
    const varPredicateMap = buildVarPredicateMap(variables);

    // Find result variable definition
    const resultVar = variables.find((v) => v.symbol === result_variable);
    if (!resultVar) continue;

    const resultPredicate = quantityToPredicate(resultVar.quantity);
    const resultPredicateWithEntity = `${resultPredicate}($entity)`;

    // Input variables (role: 'input') → prerequisites
    const inputVars = variables.filter(
      (v) => v.role === 'input' && v.symbol !== result_variable
    );
    const prerequisites = inputVars.map(
      (v) => varPredicateMap.get(v.symbol) ?? `${quantityToPredicate(v.quantity)}($entity)`
    );

    // Forward expression serialized
    const forwardExpr = expression
      ? serializeExpr(expression, varPredicateMap)
      : undefined;

    // Forward preconditions: denominators in the main expression
    const forwardPreconditions = expression
      ? buildPreconditions(expression, variables, varPredicateMap)
      : [];

    // ── Forward resolution ───────────────────────────────────────────────────
    const forwardId = `res:formula.${id.replace(/^formula:/, '')}`;

    const forward = {
      id: forwardId,
      family,
      origin: 'generated_from_formula',
      origin_ref: id,
      target: resultPredicate,
      target_pattern: resultPredicateWithEntity,
      kind: 'equation',
      prerequisites,
      formula_id: id,
      solve_for: result_variable,
      ...(forwardExpr !== undefined && { compute_expr_serialized: forwardExpr }),
      ...(forwardPreconditions.length > 0 && { preconditions: forwardPreconditions }),
      cost: 100,
      uncertainty_mode: uncertaintyMode,
      ...(approximationKind && { approximation_kind: approximationKind }),
    };

    results.push(forward);

    // ── Inverse resolutions ──────────────────────────────────────────────────
    for (const solveForSymbol of invertible_for) {
      const inverseExpr = inversions[solveForSymbol];
      const solveForVar = variables.find((v) => v.symbol === solveForSymbol);
      if (!solveForVar) continue;

      const inverseTargetPredicate = quantityToPredicate(solveForVar.quantity);
      const inverseTargetWithEntity = `${inverseTargetPredicate}($entity)`;

      // Prerequisites for inverse: all input vars except the solve-for var,
      // plus the result variable (now known)
      const inversePrereqs = [
        // result variable is now a known input
        resultPredicateWithEntity,
        // other input vars except the one we're solving for
        ...inputVars
          .filter((v) => v.symbol !== solveForSymbol)
          .map(
            (v) => varPredicateMap.get(v.symbol) ?? `${quantityToPredicate(v.quantity)}($entity)`
          ),
      ];

      const inverseExprStr = inverseExpr
        ? serializeExpr(inverseExpr, varPredicateMap)
        : undefined;

      // Preconditions: denominators in the inverse expression
      const inversePreconditions = inverseExpr
        ? buildPreconditions(inverseExpr, variables, varPredicateMap)
        : [];

      const inverseId = `res:formula.${id.replace(/^formula:/, '')}.inv.${solveForSymbol}`;

      const inverse = {
        id: inverseId,
        family,
        origin: 'generated_from_formula',
        origin_ref: id,
        target: inverseTargetPredicate,
        target_pattern: inverseTargetWithEntity,
        kind: 'equation',
        prerequisites: inversePrereqs,
        formula_id: id,
        solve_for: solveForSymbol,
        ...(inverseExprStr !== undefined && { compute_expr_serialized: inverseExprStr }),
        ...(inversePreconditions.length > 0 && { preconditions: inversePreconditions }),
        cost: 110,
        uncertainty_mode: uncertaintyMode,
        ...(approximationKind && { approximation_kind: approximationKind }),
      };

      results.push(inverse);
    }
  }

  return results;
}

// ── Merge ─────────────────────────────────────────────────────────────────────

/**
 * Merge generated and manual ResolutionDef arrays.
 *
 * Deduplication: first entry by id wins (generated before manual, so manual
 * entries override generated when both share an id if you want manual to win —
 * pass them as `generated` and `manual` accordingly).
 *
 * Actually per spec: "first wins" means generated[] entries come first, and
 * manual[] entries are appended only when not already present.
 * Then sorted by target ASC, cost ASC.
 *
 * @param {Array<object>} generated
 * @param {Array<object>} manual
 * @returns {Array<object>}
 */
export function mergeResolutions(generated, manual) {
  const seen = new Set();
  const merged = [];

  for (const res of [...generated, ...manual]) {
    if (!seen.has(res.id)) {
      seen.add(res.id);
      merged.push(res);
    }
  }

  merged.sort((a, b) => {
    const targetCmp = (a.target ?? '').localeCompare(b.target ?? '');
    if (targetCmp !== 0) return targetCmp;
    return (a.cost ?? 0) - (b.cost ?? 0);
  });

  return merged;
}

// ── Index ─────────────────────────────────────────────────────────────────────

/**
 * Build a resolution index grouped by target predicate.
 *
 * @param {Array<object>} resolutions
 * @returns {Record<string, Array<object>>}
 */
export function buildResolutionIndex(resolutions) {
  /** @type {Record<string, Array<object>>} */
  const index = {};
  for (const res of resolutions) {
    const key = res.target ?? '';
    if (!index[key]) index[key] = [];
    index[key].push(res);
  }
  return index;
}

// ── Lookup resolutions from properties ───────────────────────────────────────

const OBJECT_TO_ENTITY_VAR = {
  element: '$element',
  substance: '$substance',
  ion: '$ion',
};

/**
 * Generate lookup ResolutionDef for each property.
 * e.g. property {id: "electronegativity", object: "element"} →
 *   ResolutionDef {target: "element.electronegativity", kind: "lookup", ...}
 *
 * @param {Array<{id: string, object: string, concept_ref?: string}>} properties
 * @returns {Array<object>}
 */
export function generateLookupResolutionsFromProperties(properties) {
  const results = [];
  for (const prop of properties) {
    if (!prop.id || !prop.object) continue;
    const ns = prop.object;
    const predicateId = `${ns}.${prop.id}`;
    const entityVar = OBJECT_TO_ENTITY_VAR[ns] || '$entity';

    results.push({
      id: `res:${predicateId}.lookup`,
      family: `dep.property_lookup`,
      origin: 'generated_from_property',
      origin_ref: prop.id,
      target: predicateId,
      target_pattern: `${predicateId}(${entityVar})`,
      kind: 'lookup',
      prerequisites: [],
      cost: 20, // lookups are cheapest
      uncertainty_mode: 'exact',
      result_shape: 'scalar',
    });
  }
  return results;
}

/**
 * @param {Array<object>} formulas            - ComputableFormula[]
 * @param {Array<object>} manualResolutions   - ResolutionDef[] (manual origin)
 * @param {string}        outDir              - output directory path
 * @param {Array<object>} [properties]        - PropertyDef[] for lookup resolutions
 * @returns {Array<object>}                   - merged ResolutionDef[]
 */
export function generateResolutionRegistry(formulas, manualResolutions, outDir, properties) {
  const generated = generateResolutionsFromFormulas(formulas);
  const lookups = properties ? generateLookupResolutionsFromProperties(properties) : [];
  const merged = mergeResolutions([...generated, ...lookups], manualResolutions);
  const index = buildResolutionIndex(merged);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'resolution_registry.json'), JSON.stringify(merged, null, 2));
  writeFileSync(join(outDir, 'resolution_index.json'), JSON.stringify(index, null, 2));

  return merged;
}
