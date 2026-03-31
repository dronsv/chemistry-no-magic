import type {
  Expr,
  QueryExpr,
  CallExpr,
  EqualityExpr,
  ValueExpr,
  SymbolExpr,
  ListExpr,
  EventExpr,
  TimeExpr,
  SuggestedGiven,
} from '../../types/query-ast.js';
import type { ResolutionDef } from '../../types/resolution.js';

// ── Fingerprint ───────────────────────────────────────────────────────────────

/** Canonical serialization of an Expr, ignoring id/meta. */
function serializeExprCanonical(expr: Expr): string {
  switch (expr.kind) {
    case 'query': {
      const q = expr as QueryExpr;
      const target = serializeExprCanonical(q.target);
      const givens = q.givens
        ? q.givens.map(serializeExprCanonical).sort().join(',')
        : '';
      const constraints = q.constraints
        ? q.constraints.map(serializeExprCanonical).sort().join(',')
        : '';
      return `query(${q.intent},target=${target},givens=[${givens}],constraints=[${constraints}])`;
    }
    case 'call': {
      const c = expr as CallExpr;
      const args = c.args.map(serializeExprCanonical).join(',');
      return `call(${c.predicate},[${args}])`;
    }
    case 'equality': {
      const e = expr as EqualityExpr;
      return `eq(${serializeExprCanonical(e.left)},${serializeExprCanonical(e.right)})`;
    }
    case 'value': {
      const v = expr as ValueExpr;
      const unit = v.unit ? `/${v.unit}` : '';
      return `val(${v.value}${unit})`;
    }
    case 'symbol': {
      const s = expr as SymbolExpr;
      return `sym(${s.ref.kind}:${s.ref.id})`;
    }
    case 'list': {
      const l = expr as ListExpr;
      return `list([${l.items.map(serializeExprCanonical).join(',')}])`;
    }
    case 'event': {
      const ev = expr as EventExpr;
      const params = ev.params
        ? Object.entries(ev.params)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${serializeExprCanonical(v)}`)
            .join(',')
        : '';
      return `event(${ev.event_type},{${params}})`;
    }
    case 'time': {
      const t = expr as TimeExpr;
      const base =
        t.base === 'start' ? 'start' : serializeExprCanonical(t.base as Expr);
      const offset = t.offset ? serializeExprCanonical(t.offset) : '';
      return `time(${t.relation},${base},${offset})`;
    }
  }
}

/** djb2-style hash — fast, collision-resistant enough for fingerprinting. */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0; // keep unsigned 32-bit
  }
  return h;
}

/**
 * Produces a stable hash string from query content, EXCLUDING id and meta.
 * Two queries with different ids/meta but identical structure → same fingerprint.
 */
export function computeFingerprint(query: QueryExpr): string {
  const canonical = serializeExprCanonical(query);
  const hash = hashString(canonical);
  return `fp_${hash.toString(16).padStart(8, '0')}`;
}

// ── Unification ───────────────────────────────────────────────────────────────

/** Parse `"quantity.mass($entity)"` → `{ predicate: "quantity.mass", vars: ["$entity"] }` */
function parsePattern(pattern: string): { predicate: string; vars: string[] } | null {
  const match = pattern.match(/^([^(]+)\(([^)]*)\)$/);
  if (!match) return null;
  const predicate = match[1].trim();
  const argsStr = match[2].trim();
  const vars = argsStr === '' ? [] : argsStr.split(',').map((s) => s.trim());
  return { predicate, vars };
}

/**
 * Unify a CallExpr against a target_pattern string like `"quantity.mass($entity)"`.
 * Returns bindings map `{ $entity: Expr }` or null on failure.
 */
export function unifyTarget(
  target: CallExpr,
  pattern: string
): Record<string, Expr> | null {
  const parsed = parsePattern(pattern);
  if (!parsed) return null;

  if (target.predicate !== parsed.predicate) return null;
  if (target.args.length !== parsed.vars.length) return null;

  const bindings: Record<string, Expr> = {};
  for (let i = 0; i < parsed.vars.length; i++) {
    const varName = parsed.vars[i];
    bindings[varName] = target.args[i];
  }
  return bindings;
}

// ── Pattern instantiation ─────────────────────────────────────────────────────

/** Render a single Expr to a compact string for use inside patterns. */
function renderExprInline(expr: Expr): string {
  switch (expr.kind) {
    case 'symbol': {
      const s = expr as SymbolExpr;
      return `${s.ref.kind}:${s.ref.id}`;
    }
    case 'value': {
      const v = expr as ValueExpr;
      return v.unit ? `${v.value} ${v.unit}` : String(v.value);
    }
    case 'call': {
      const c = expr as CallExpr;
      return `${c.predicate}(${c.args.map(renderExprInline).join(', ')})`;
    }
    default:
      return serializeExprCanonical(expr);
  }
}

/**
 * Replace $variables in a pattern string with their bound expressions.
 * e.g. `"quantity.amount($entity)"` + `{ $entity: SymbolExpr(substance:nacl) }`
 *   → `"quantity.amount(substance:sub:nacl)"`
 */
export function instantiatePattern(
  pattern: string,
  bindings: Record<string, Expr>
): string {
  let result = pattern;
  // Sort by length descending to replace longer variable names first (avoid partial matches).
  const keys = Object.keys(bindings).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    result = result.split(key).join(renderExprInline(bindings[key]));
  }
  return result;
}

// ── Canonical rendering ───────────────────────────────────────────────────────

/** Render an Expr as human-readable text. */
function renderExprHuman(expr: Expr): string {
  switch (expr.kind) {
    case 'query':
      return renderCanonical(expr as QueryExpr);
    case 'call': {
      const c = expr as CallExpr;
      if (c.args.length === 0) return c.predicate;
      return `${c.predicate}(${c.args.map(renderExprHuman).join(', ')})`;
    }
    case 'equality': {
      const e = expr as EqualityExpr;
      return `${renderExprHuman(e.left)} = ${renderExprHuman(e.right)}`;
    }
    case 'value': {
      const v = expr as ValueExpr;
      return v.unit ? `${v.value} ${v.unit}` : String(v.value);
    }
    case 'symbol': {
      const s = expr as SymbolExpr;
      return `${s.ref.kind}:${s.ref.id}`;
    }
    case 'list': {
      const l = expr as ListExpr;
      return `[${l.items.map(renderExprHuman).join(', ')}]`;
    }
    case 'event': {
      const ev = expr as EventExpr;
      return `event(${ev.event_type})`;
    }
    case 'time': {
      const t = expr as TimeExpr;
      const base = t.base === 'start' ? 'start' : renderExprHuman(t.base as Expr);
      return `time(${t.relation} ${base})`;
    }
  }
}

/**
 * Pretty-print a QueryExpr as human-readable canonical form.
 * Examples:
 *   `derive(quantity.mass(substance:nacl), given=[quantity.amount(substance:nacl) = 2 mol])`
 *   `find(substance.class(substance:h2so4))`
 *   `check(reaction.possible(reactants=[substance:na2co3, substance:hcl]))`
 */
export function renderCanonical(query: QueryExpr): string {
  const target = renderExprHuman(query.target);
  if (!query.givens || query.givens.length === 0) {
    return `${query.intent}(${target})`;
  }
  const givens = query.givens.map(renderExprHuman).join(', ');
  return `${query.intent}(${target}, given=[${givens}])`;
}

// ── Suggest givens ────────────────────────────────────────────────────────────

const LIKELY_GIVEN_PREDICATES = new Set([
  'quantity.mass',
  'quantity.amount',
  'quantity.volume',
  'quantity.molar_concentration',
  'quantity.mass_fraction',
]);

const USUALLY_DERIVED_PREDICATES = new Set([
  'quantity.molar_mass',
  'quantity.relative_atomic_mass',
]);

/**
 * First-level heuristic: find best (lowest-cost) resolution for target,
 * return its prerequisites as SuggestedGiven entries.
 */
export function suggestGivens(
  targetPredicate: string,
  resolutionIndex: Record<string, ResolutionDef[]>
): SuggestedGiven[] {
  const candidates = resolutionIndex[targetPredicate];
  if (!candidates || candidates.length === 0) return [];

  // Pick lowest-cost resolution.
  const best = candidates.reduce((min, r) => (r.cost < min.cost ? r : min), candidates[0]);

  return best.prerequisites.map((prereq): SuggestedGiven => {
    // prereq looks like "quantity.mass($entity)" — extract predicate name.
    const parsed = parsePattern(prereq);
    const predicate = parsed ? parsed.predicate : prereq;

    let suggestion_kind: SuggestedGiven['suggestion_kind'];
    if (LIKELY_GIVEN_PREDICATES.has(predicate)) {
      suggestion_kind = 'likely_given';
    } else if (USUALLY_DERIVED_PREDICATES.has(predicate)) {
      suggestion_kind = 'usually_derived';
    } else {
      suggestion_kind = 'optional';
    }

    return {
      predicate,
      pattern: prereq,
      suggestion_kind,
    };
  });
}
