import type {
  QueryExpr,
  CallExpr,
  EqualityExpr,
  Expr,
  ResolvedInputs,
  TraceNode,
  ResolverResult,
  SolverPolicy,
} from '../../types/query-ast.js';
import type { ResolutionDef, CertaintyLevel } from '../../types/resolution.js';
import type { PredicateDef } from '../../types/predicate.js';
import type { ComputableFormula } from '../../types/formula.js';
import type { ConstantsDict } from '../../types/eval-trace.js';
import { computeFingerprint, unifyTarget, instantiatePattern } from './query-utils.js';
import { executeHandler, type HandlerEnv, IMPLEMENTED_KINDS } from './handlers/index.js';

// ── Public interface ──────────────────────────────────────────────────────────

export interface ResolverEnv {
  predicateRegistry: PredicateDef[];
  resolutionIndex: Record<string, ResolutionDef[]>;
  ontology: HandlerEnv;
  formulaRegistry: ComputableFormula[];
  constants: ConstantsDict;
  indicatorRules?: unknown[];
  policy: SolverPolicy;
  queryCache: Map<string, ResolverResult>;
  activeQueryStack: Set<string>;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const MAX_BACKTRACK_ATTEMPTS = 5;

/** Synthesize a failure ResolverResult with a given status note. */
function failureResult(
  query: QueryExpr,
  note: string,
  status: TraceNode['status'] = 'not_applicable',
): ResolverResult {
  const emptyInputs: ResolvedInputs = {
    target: query.target,
    bindings: {},
    prerequisite_results: {},
    givens: query.givens,
  };
  const trace: TraceNode = {
    query_id: query.id,
    step_role: 'resolution',
    inputs: emptyInputs,
    output: { kind: 'value', value: note },
    children: [],
    status,
  };
  return {
    answer: { kind: 'value', value: note },
    trace,
    error_sources: [{ kind: status, note }],
  };
}

/** Map uncertainty_mode → CertaintyLevel. */
function certaintyFromMode(
  mode: ResolutionDef['uncertainty_mode'],
): CertaintyLevel {
  switch (mode) {
    case 'exact':
      return 'exact';
    case 'propagate':
      return 'derived_exact_under_model';
    case 'model_limited':
      return 'model_limited';
  }
}

/**
 * Try to resolve a prerequisite pattern from the parent query's givens.
 * Returns the given value Expr if found, or null.
 *
 * A given `left = right` matches if left is a CallExpr whose predicate
 * equals the target predicate of the instantiated prerequisite.
 */
function matchGiven(
  instantiatedPattern: string,
  givens: EqualityExpr[],
): Expr | null {
  // Extract predicate from instantiated pattern (everything before '(')
  const parenIdx = instantiatedPattern.indexOf('(');
  const targetPredicate =
    parenIdx >= 0 ? instantiatedPattern.slice(0, parenIdx).trim() : instantiatedPattern;

  for (const given of givens) {
    if (given.left.kind === 'call') {
      const callLeft = given.left as CallExpr;
      if (callLeft.predicate === targetPredicate) {
        return given.right;
      }
    }
  }
  return null;
}

/**
 * Build a child QueryExpr from a prerequisite pattern + bindings.
 * Used to recursively plan subqueries.
 */
function buildSubQuery(
  prereqPattern: string,
  bindings: Record<string, Expr>,
  parentQuery: QueryExpr,
  env: ResolverEnv,
): QueryExpr | null {
  const instantiated = instantiatePattern(prereqPattern, bindings);

  // Parse the instantiated pattern to build a CallExpr
  const parenIdx = instantiated.indexOf('(');
  if (parenIdx < 0) return null;

  const predicate = instantiated.slice(0, parenIdx).trim();
  const argsStr = instantiated.slice(parenIdx + 1, -1).trim(); // strip trailing ')'

  // We build the args by recovering original bound expressions from bindings
  // rather than reparsing strings. Iterate over the original pattern vars to
  // map positions back to their Expr values.
  const parsed = prereqPattern.match(/^([^(]+)\(([^)]*)\)$/);
  if (!parsed) return null;

  const varNames = parsed[2] === '' ? [] : parsed[2].split(',').map((s) => s.trim());
  const args: Expr[] = varNames.map((v) => {
    const bound = bindings[v];
    return bound ?? ({ kind: 'value', value: argsStr } as Expr);
  });

  const targetCall: CallExpr = { kind: 'call', predicate, args };

  const subQuery: QueryExpr = {
    kind: 'query',
    id: `${parentQuery.id}:sub:${predicate}`,
    intent: 'derive',
    target: targetCall,
    givens: parentQuery.givens,
    policy: parentQuery.policy ?? env.policy,
    meta: parentQuery.meta
      ? { ...parentQuery.meta, parent_query_id: parentQuery.id }
      : { origin: 'planner', parent_query_id: parentQuery.id },
  };
  return subQuery;
}

// ── Core dispatch ─────────────────────────────────────────────────────────────

/**
 * Resolve a QueryExpr through the resolution registry.
 *
 * Steps:
 * 1. Canonicalize (pass-through in Phase 1)
 * 2. Compute fingerprint; check cache
 * 3. Cycle check
 * 4. Push fingerprint onto activeQueryStack
 * 5. Normalize target to CallExpr
 * 6. Extract predicate id
 * 7. Get + sort candidates by cost
 * 8. For each candidate (up to MAX_BACKTRACK_ATTEMPTS):
 *    a. unifyTarget
 *    b. Skip if kind not in IMPLEMENTED_KINDS
 *    c. Resolve prerequisites (from givens or recursive subquery)
 *    d. executeHandler
 *    e. Build and return successful ResolverResult on success
 * 9. Cache result; pop from activeQueryStack
 * 10. Return result
 */
export function resolveQuery(query: QueryExpr, env: ResolverEnv): ResolverResult {
  // Step 1: Canonicalize (pass-through for now)
  const canonicalized = query;

  // Step 2: Fingerprint + cache check
  const fingerprint = computeFingerprint(canonicalized);
  const cached = env.queryCache.get(fingerprint);
  if (cached !== undefined) {
    return cached;
  }

  // Step 3: Cycle check
  if (env.activeQueryStack.has(fingerprint)) {
    const result = failureResult(
      canonicalized,
      `Cycle detected for query ${fingerprint}`,
      'subquery_failed',
    );
    return result;
  }

  // Step 4: Push onto active stack
  env.activeQueryStack.add(fingerprint);

  // Step 5: Normalize target to CallExpr
  let normalizedTarget: CallExpr;

  if (canonicalized.target.kind === 'call') {
    normalizedTarget = canonicalized.target as CallExpr;
  } else if (canonicalized.target.kind === 'equality') {
    // Lower check intent: eq(left, right) → find(logic.equal(left, right))
    const eq = canonicalized.target as EqualityExpr;
    normalizedTarget = {
      kind: 'call',
      predicate: 'logic.equal',
      args: [eq.left, eq.right],
    };
  } else {
    env.activeQueryStack.delete(fingerprint);
    const result = failureResult(
      canonicalized,
      `Cannot normalize target of kind '${canonicalized.target.kind}' to CallExpr`,
    );
    env.queryCache.set(fingerprint, result);
    return result;
  }

  // Step 6: Extract predicate id
  const predicateId = normalizedTarget.predicate;

  // Step 7: Get candidates sorted by cost
  const candidates = (env.resolutionIndex[predicateId] ?? [])
    .slice()
    .sort((a, b) => a.cost - b.cost);

  if (candidates.length === 0) {
    env.activeQueryStack.delete(fingerprint);
    const result = failureResult(
      canonicalized,
      `No resolution found for predicate '${predicateId}'`,
      'not_applicable',
    );
    env.queryCache.set(fingerprint, result);
    return result;
  }

  // Step 8: Try candidates with backtracking
  let attempts = 0;

  for (const candidate of candidates) {
    if (attempts >= MAX_BACKTRACK_ATTEMPTS) break;

    // Step 8a: Unify
    const bindings = unifyTarget(normalizedTarget, candidate.target_pattern);
    if (bindings === null) continue;

    // Step 8b: Skip unimplemented kinds (unless policy explicitly allows)
    if (!IMPLEMENTED_KINDS.has(candidate.kind)) continue;

    // Count this as an actual attempt (not skips)
    attempts++;

    // Step 8c: Resolve prerequisites
    const prereqResults: Record<string, Expr> = {};
    const childTraces: TraceNode[] = [];
    let prereqFailed = false;

    for (const prereqPattern of candidate.prerequisites) {
      // Try to match from parent givens first
      const givenValue = matchGiven(
        instantiatePattern(prereqPattern, bindings),
        canonicalized.givens ?? [],
      );

      if (givenValue !== null) {
        // Extract predicate name for keying
        const parenIdx = prereqPattern.indexOf('(');
        const prereqPredicate =
          parenIdx >= 0 ? prereqPattern.slice(0, parenIdx).trim() : prereqPattern;
        prereqResults[prereqPredicate] = givenValue;

        // Build a given-matched trace node
        const givenTrace: TraceNode = {
          query_id: `${canonicalized.id}:given:${prereqPredicate}`,
          step_role: 'given',
          inputs: {
            target: normalizedTarget,
            bindings,
            prerequisite_results: {},
            givens: canonicalized.givens,
          },
          output: givenValue,
          children: [],
          status: 'success',
        };
        childTraces.push(givenTrace);
        continue;
      }

      // Build and recursively resolve subquery
      const subQuery = buildSubQuery(prereqPattern, bindings, canonicalized, env);
      if (!subQuery) {
        prereqFailed = true;
        break;
      }

      const subResult = resolveQuery(subQuery, env);
      if (subResult.trace.status !== 'success') {
        prereqFailed = true;
        break;
      }

      // Key by predicate extracted from pattern
      const parenIdx = prereqPattern.indexOf('(');
      const prereqPredicate =
        parenIdx >= 0 ? prereqPattern.slice(0, parenIdx).trim() : prereqPattern;
      prereqResults[prereqPredicate] = subResult.answer;
      childTraces.push(subResult.trace);
    }

    if (prereqFailed) continue;

    // Step 8d: Build ResolvedInputs and execute handler
    const resolvedInputs: ResolvedInputs = {
      target: normalizedTarget,
      bindings,
      prerequisite_results: prereqResults,
      givens: canonicalized.givens,
    };

    const handlerResult = executeHandler(candidate, resolvedInputs, env.ontology);

    if ('error' in handlerResult) {
      continue;
    }

    // Step 8f: Success — build trace and ResolverResult
    const successTrace: TraceNode = {
      query_id: canonicalized.id,
      step_role: 'resolution',
      resolution_kind: candidate.kind,
      resolution_id: candidate.id,
      inputs: resolvedInputs,
      output: handlerResult.answer,
      formula_rendered: handlerResult.formula_rendered,
      children: childTraces,
      status: 'success',
    };

    const resolverResult: ResolverResult = {
      answer: handlerResult.answer,
      trace: successTrace,
      certainty: certaintyFromMode(candidate.uncertainty_mode),
    };

    // Step 9: Cache and remove from active stack
    env.activeQueryStack.delete(fingerprint);
    env.queryCache.set(fingerprint, resolverResult);
    return resolverResult;
  }

  // All candidates exhausted
  env.activeQueryStack.delete(fingerprint);
  const failResult = failureResult(
    canonicalized,
    `All resolution candidates failed for '${predicateId}'`,
    'handler_failed',
  );
  env.queryCache.set(fingerprint, failResult);
  return failResult;
}
