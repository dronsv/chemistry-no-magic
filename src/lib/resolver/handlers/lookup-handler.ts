import type { ResolutionDef } from '../../../types/resolution.js';
import type { Expr, ResolvedInputs, ValueExpr, SymbolExpr } from '../../../types/query-ast.js';

export type HandlerResult =
  | { answer: Expr; formula_rendered?: string }
  | { error: string };

export interface LookupElementEntry {
  Z: number;
  symbol: string;
  characteristics?: Record<string, { value: number }>;
}

export interface LookupSubstanceEntry {
  id: string;
  formula: string;
  class?: string;
}

export interface LookupIonEntry {
  id: string;
  formula: string;
  type: string;
}

export interface LookupHandlerEnv {
  elements: LookupElementEntry[];
  substances: LookupSubstanceEntry[];
  ions: LookupIonEntry[];
}

/**
 * Extract a string identifier from a binding Expr.
 * Accepts SymbolExpr (→ ref.id) or ValueExpr with string value.
 */
function extractId(expr: Expr): string | null {
  if (expr.kind === 'symbol') {
    return (expr as SymbolExpr).ref.id;
  }
  if (expr.kind === 'value') {
    const v = expr as ValueExpr;
    if (typeof v.value === 'string') return v.value;
  }
  return null;
}

/**
 * Derive the characteristic concept_ref from the target predicate.
 * e.g. "quantity.electronegativity" → "concept:electronegativity"
 *      "quantity.atomic_mass"        → "concept:atomic_mass"
 */
function predicateToConceptRef(predicate: string): string {
  // Strip "quantity." prefix and namespace it as concept:
  const parts = predicate.split('.');
  const last = parts[parts.length - 1];
  return `concept:${last}`;
}

/**
 * Reads properties directly from ontology data without calling a solver.
 * Supports element characteristic lookups and substance class lookups.
 */
export function executeLookup(
  resolution: ResolutionDef,
  inputs: ResolvedInputs,
  env: LookupHandlerEnv,
): HandlerResult {
  const { elements, substances, ions } = env;
  const { bindings } = inputs;

  // Determine the target predicate from the target_pattern
  // e.g. "quantity.electronegativity($element)" → predicate = "quantity.electronegativity"
  const patternMatch = resolution.target_pattern.match(/^([^(]+)\(/);
  const targetPredicate = patternMatch ? patternMatch[1].trim() : resolution.target;

  // ── Element property lookup ────────────────────────────────────────────────
  const elementExpr = bindings['$element'] ?? bindings['$entity'];
  if (elementExpr) {
    const symbolOrId = extractId(elementExpr);
    if (!symbolOrId) {
      return { error: `Cannot extract element id from binding` };
    }

    const element = elements.find(
      e => e.symbol === symbolOrId || e.symbol === symbolOrId.split(':').pop(),
    );
    if (!element) {
      return { error: `Element not found: ${symbolOrId}` };
    }

    const conceptRef = predicateToConceptRef(targetPredicate);
    const char = element.characteristics?.[conceptRef];
    if (char === undefined) {
      return { error: `Characteristic ${conceptRef} not found on element ${symbolOrId}` };
    }

    const answer: ValueExpr = { kind: 'value', value: char.value };
    return { answer };
  }

  // ── Substance class lookup ─────────────────────────────────────────────────
  const substanceExpr = bindings['$substance'];
  if (substanceExpr) {
    const substanceId = extractId(substanceExpr);
    if (!substanceId) {
      return { error: `Cannot extract substance id from binding` };
    }

    const substance = substances.find(
      s => s.id === substanceId || s.id === substanceId.split(':').pop(),
    );
    if (!substance) {
      return { error: `Substance not found: ${substanceId}` };
    }

    if (substance.class !== undefined) {
      const answer: ValueExpr = { kind: 'value', value: substance.class };
      return { answer };
    }

    return { error: `Substance ${substanceId} has no class` };
  }

  // ── Ion type lookup ────────────────────────────────────────────────────────
  const ionExpr = bindings['$ion'];
  if (ionExpr) {
    const ionId = extractId(ionExpr);
    if (!ionId) {
      return { error: `Cannot extract ion id from binding` };
    }

    const ion = ions.find(
      i => i.id === ionId || i.id === ionId.split(':').pop(),
    );
    if (!ion) {
      return { error: `Ion not found: ${ionId}` };
    }

    const answer: ValueExpr = { kind: 'value', value: ion.type };
    return { answer };
  }

  return {
    error: `Lookup handler: no recognized entity binding found in resolution ${resolution.id}`,
  };
}
