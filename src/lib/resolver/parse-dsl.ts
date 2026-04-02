import type {
  QueryExpr, CallExpr, EqualityExpr, ValueExpr, SymbolExpr,
  Expr, Intent, EntityRef,
} from '../../types/query-ast.js';

/**
 * Lightweight parser for DSL canonical form.
 *
 * Parses strings like:
 *   find(element.electronegativity(Na))
 *   derive(quantity.mass(sub:nacl), given=[quantity.amount(sub:nacl) = 2 mol])
 *   check(substance.class(sub:h2so4))
 *
 * Not a full recursive-descent parser — handles the practical subset
 * produced by DslEditor autocomplete.
 */

let _parseCounter = 0;

const INTENTS = new Set<Intent>(['find', 'check', 'derive', 'explain', 'plan']);

interface ParseResult {
  query: QueryExpr | null;
  error?: string;
}

/**
 * Parse an entity reference string into EntityRef.
 * Handles: "el:Na" → element, "sub:nacl" → substance, "ion:Na_plus" → ion,
 * "ind:litmus" → indicator, bare "Na" → element (guess by length/format)
 */
function parseEntityRef(raw: string): EntityRef {
  const trimmed = raw.trim();
  if (trimmed.startsWith('el:')) return { kind: 'element', id: trimmed.slice(3) };
  if (trimmed.startsWith('sub:')) return { kind: 'substance', id: trimmed };
  if (trimmed.startsWith('ion:')) return { kind: 'ion', id: trimmed };
  if (trimmed.startsWith('ind:')) return { kind: 'indicator', id: trimmed };
  if (trimmed.startsWith('rxn:')) return { kind: 'reaction', id: trimmed };
  // Heuristic: short uppercase → element symbol
  if (/^[A-Z][a-z]?$/.test(trimmed)) return { kind: 'element', id: trimmed };
  // Default: substance
  return { kind: 'substance', id: trimmed };
}

/**
 * Parse a value expression like "2 mol", "117", "10 %"
 */
function parseValue(raw: string): ValueExpr {
  const trimmed = raw.trim();
  const match = trimmed.match(/^([\d.]+)\s*(.*)$/);
  if (match) {
    return {
      kind: 'value',
      value: parseFloat(match[1]),
      unit: match[2].trim() || undefined,
    };
  }
  // Non-numeric value
  return { kind: 'value', value: trimmed };
}

/**
 * Find the matching closing paren for an opening paren at position `start`.
 */
function findClosingParen(text: string, start: number): number {
  let depth = 1;
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '(') depth++;
    if (text[i] === ')') depth--;
    if (depth === 0) return i;
  }
  return text.length; // unclosed — use end
}

/**
 * Split by commas at depth 0 (respecting nested parens and brackets).
 */
function splitTopLevel(text: string, sep = ','): string[] {
  const parts: string[] = [];
  let depth = 0;
  let bracketDepth = 0;
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(' || text[i] === '[') {
      if (text[i] === '(') depth++;
      else bracketDepth++;
    }
    if (text[i] === ')' || text[i] === ']') {
      if (text[i] === ')') depth--;
      else bracketDepth--;
    }
    if (text[i] === sep && depth === 0 && bracketDepth === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts.filter(Boolean);
}

/**
 * Parse a predicate call like "element.electronegativity(Na)"
 * or "quantity.mass(sub:nacl)"
 */
function parseCallExpr(text: string): CallExpr | null {
  const trimmed = text.trim();
  const parenIdx = trimmed.indexOf('(');
  if (parenIdx < 0) {
    // Bare predicate without parens
    return { kind: 'call', predicate: trimmed, args: [] };
  }

  const predicate = trimmed.slice(0, parenIdx).trim();
  const closeIdx = findClosingParen(trimmed, parenIdx);
  const argsStr = trimmed.slice(parenIdx + 1, closeIdx).trim();

  if (!argsStr) {
    return { kind: 'call', predicate, args: [] };
  }

  const argParts = splitTopLevel(argsStr);
  const args: Expr[] = argParts.map(part => {
    // Check if it's a nested call
    if (part.includes('(')) {
      const nested = parseCallExpr(part);
      if (nested) return nested;
    }
    // Entity reference
    const ref = parseEntityRef(part);
    return { kind: 'symbol', ref } as SymbolExpr;
  });

  return { kind: 'call', predicate, args };
}

/**
 * Parse givens section: "given=[quantity.amount(sub:nacl) = 2 mol, ...]"
 */
function parseGivens(givensStr: string): EqualityExpr[] {
  // Extract content between [ ]
  const bracketMatch = givensStr.match(/\[([^\]]*)\]?/);
  if (!bracketMatch) return [];

  const content = bracketMatch[1].trim();
  if (!content) return [];

  const entries = splitTopLevel(content);
  const results: EqualityExpr[] = [];

  for (const entry of entries) {
    const eqIdx = entry.indexOf('=');
    if (eqIdx < 0) continue;

    // Check it's not inside parens (e.g., "quantity.amount(x=y)")
    let depth = 0;
    let realEqIdx = -1;
    for (let i = 0; i < entry.length; i++) {
      if (entry[i] === '(') depth++;
      if (entry[i] === ')') depth--;
      if (entry[i] === '=' && depth === 0) {
        realEqIdx = i;
        break;
      }
    }
    if (realEqIdx < 0) continue;

    const leftStr = entry.slice(0, realEqIdx).trim();
    const rightStr = entry.slice(realEqIdx + 1).trim();

    const left = parseCallExpr(leftStr) ?? { kind: 'call' as const, predicate: leftStr, args: [] };
    const right = parseValue(rightStr);

    results.push({ kind: 'equality', left, right });
  }

  return results;
}

/**
 * Parse a complete DSL query string into a QueryExpr.
 */
export function parseDsl(text: string): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { query: null, error: 'Empty input' };

  // Extract intent
  const intentMatch = trimmed.match(/^(\w+)\s*\(/);
  if (!intentMatch) {
    return { query: null, error: `Expected intent(... — got: ${trimmed.slice(0, 20)}` };
  }

  const intentStr = intentMatch[1].toLowerCase();
  if (!INTENTS.has(intentStr as Intent)) {
    return { query: null, error: `Unknown intent: ${intentStr}` };
  }
  const intent = intentStr as Intent;

  // Extract content inside intent(...)
  const outerOpenIdx = trimmed.indexOf('(');
  const outerCloseIdx = findClosingParen(trimmed, outerOpenIdx);
  const innerContent = trimmed.slice(outerOpenIdx + 1, outerCloseIdx).trim();

  if (!innerContent) {
    return { query: null, error: 'Empty query target' };
  }

  // Split into target and given sections at top level
  const topParts = splitTopLevel(innerContent);

  // First part is always the target
  const targetStr = topParts[0];
  const target = parseCallExpr(targetStr);
  if (!target) {
    return { query: null, error: `Cannot parse target: ${targetStr}` };
  }

  // Look for "given=[...]" in remaining parts
  let givens: EqualityExpr[] | undefined;
  for (let i = 1; i < topParts.length; i++) {
    const part = topParts[i].trim();
    if (part.startsWith('given=')) {
      givens = parseGivens(part.slice(6));
    }
  }

  const query: QueryExpr = {
    kind: 'query',
    id: `dsl_${++_parseCounter}`,
    intent,
    target,
    givens: givens && givens.length > 0 ? givens : undefined,
    meta: { origin: 'user' },
  };

  return { query };
}
