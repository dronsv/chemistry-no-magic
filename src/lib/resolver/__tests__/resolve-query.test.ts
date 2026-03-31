import { describe, it, expect, beforeEach } from 'vitest';
import { resolveQuery, type ResolverEnv } from '../resolve-query.js';
import type { QueryExpr, SymbolExpr, CallExpr, EqualityExpr, ValueExpr } from '../../../types/query-ast.js';
import type { ResolutionDef } from '../../../types/resolution.js';
import type { HandlerEnv } from '../handlers/index.js';
import type { LookupElementEntry } from '../handlers/lookup-handler.js';

// ── Shared fixtures ───────────────────────────────────────────────────────────

const naSymbol: SymbolExpr = {
  kind: 'symbol',
  ref: { kind: 'element', id: 'Na' },
};

const naclSymbol: SymbolExpr = {
  kind: 'symbol',
  ref: { kind: 'substance', id: 'nacl' },
};

/** Element Na with electronegativity characteristic. */
const naElement: LookupElementEntry = {
  Z: 11,
  symbol: 'Na',
  characteristics: {
    'concept:electronegativity': { value: 0.93 },
  },
};

/** Resolution: element.electronegativity via lookup. */
const resElectronegativity: ResolutionDef = {
  id: 'res.element_en',
  origin: 'generated_from_formula',
  target: 'element.electronegativity',
  target_pattern: 'element.electronegativity($element)',
  kind: 'lookup',
  prerequisites: [],
  cost: 10,
  uncertainty_mode: 'exact',
};

const baseHandlerEnv: HandlerEnv = {
  elements: [naElement],
  substances: [],
  ions: [],
  formulas: [],
  constants: {},
  ontologyData: {} as never,
};

function makeEnv(
  resolutionIndex: Record<string, ResolutionDef[]>,
  handlerEnvOverrides: Partial<HandlerEnv> = {},
): ResolverEnv {
  return {
    predicateRegistry: [],
    resolutionIndex,
    ontology: { ...baseHandlerEnv, ...handlerEnvOverrides },
    formulaRegistry: [],
    constants: {},
    policy: {},
    queryCache: new Map(),
    activeQueryStack: new Set(),
  };
}

// ── Test 1: Direct lookup ─────────────────────────────────────────────────────

describe('resolveQuery — direct lookup', () => {
  it('resolves element.electronegativity(Na) via lookup handler → 0.93', () => {
    const query: QueryExpr = {
      kind: 'query',
      id: 'q-en-na',
      intent: 'find',
      target: {
        kind: 'call',
        predicate: 'element.electronegativity',
        args: [naSymbol],
      } satisfies CallExpr,
    };

    const env = makeEnv({
      'element.electronegativity': [resElectronegativity],
    });

    const result = resolveQuery(query, env);

    expect(result.trace.status).toBe('success');
    expect(result.answer.kind).toBe('value');
    const answer = result.answer as ValueExpr;
    expect(answer.value).toBe(0.93);
    expect(result.certainty).toBe('exact');
  });

  it('builds a resolution trace with correct step_role and resolution_id', () => {
    const query: QueryExpr = {
      kind: 'query',
      id: 'q-trace',
      intent: 'find',
      target: {
        kind: 'call',
        predicate: 'element.electronegativity',
        args: [naSymbol],
      } satisfies CallExpr,
    };

    const env = makeEnv({
      'element.electronegativity': [resElectronegativity],
    });

    const result = resolveQuery(query, env);

    expect(result.trace.step_role).toBe('resolution');
    expect(result.trace.resolution_kind).toBe('lookup');
    expect(result.trace.resolution_id).toBe('res.element_en');
    expect(result.trace.query_id).toBe('q-trace');
  });
});

// ── Test 2: Cache hit ─────────────────────────────────────────────────────────

describe('resolveQuery — cache hit', () => {
  it('returns cached result on second call, cache size stays at 1', () => {
    const query: QueryExpr = {
      kind: 'query',
      id: 'q-cache',
      intent: 'find',
      target: {
        kind: 'call',
        predicate: 'element.electronegativity',
        args: [naSymbol],
      } satisfies CallExpr,
    };

    const env = makeEnv({
      'element.electronegativity': [resElectronegativity],
    });

    const result1 = resolveQuery(query, env);
    expect(env.queryCache.size).toBe(1);

    const result2 = resolveQuery(query, env);
    expect(env.queryCache.size).toBe(1);

    // Both results are identical
    expect(result2.trace.status).toBe('success');
    const a1 = result1.answer as ValueExpr;
    const a2 = result2.answer as ValueExpr;
    expect(a1.value).toBe(a2.value);
  });

  it('different query id but same structure → same fingerprint → cache hit', () => {
    const query1: QueryExpr = {
      kind: 'query',
      id: 'q-id-1',
      intent: 'find',
      target: {
        kind: 'call',
        predicate: 'element.electronegativity',
        args: [naSymbol],
      } satisfies CallExpr,
    };
    const query2: QueryExpr = { ...query1, id: 'q-id-2' };

    const env = makeEnv({
      'element.electronegativity': [resElectronegativity],
    });

    resolveQuery(query1, env);
    expect(env.queryCache.size).toBe(1);

    resolveQuery(query2, env);
    // same fingerprint → no new cache entry
    expect(env.queryCache.size).toBe(1);
  });
});

// ── Test 3: Cycle detection ───────────────────────────────────────────────────

describe('resolveQuery — cycle detection', () => {
  it('returns failure (not infinite loop) when A needs B needs A', () => {
    /**
     * Resolution A: predicate.a($x) requires predicate.b($x)
     * Resolution B: predicate.b($x) requires predicate.a($x)
     */
    const resA: ResolutionDef = {
      id: 'res.a',
      origin: 'manual',
      target: 'predicate.a',
      target_pattern: 'predicate.a($x)',
      kind: 'lookup',
      prerequisites: ['predicate.b($x)'],
      cost: 10,
      uncertainty_mode: 'exact',
    };
    const resB: ResolutionDef = {
      id: 'res.b',
      origin: 'manual',
      target: 'predicate.b',
      target_pattern: 'predicate.b($x)',
      kind: 'lookup',
      prerequisites: ['predicate.a($x)'],
      cost: 10,
      uncertainty_mode: 'exact',
    };

    const env = makeEnv({
      'predicate.a': [resA],
      'predicate.b': [resB],
    });

    const query: QueryExpr = {
      kind: 'query',
      id: 'q-cycle',
      intent: 'find',
      target: {
        kind: 'call',
        predicate: 'predicate.a',
        args: [naSymbol],
      } satisfies CallExpr,
    };

    // Must not throw or hang
    const result = resolveQuery(query, env);
    expect(result.trace.status).not.toBe('success');
  });
});

// ── Test 4: Unknown predicate ─────────────────────────────────────────────────

describe('resolveQuery — unknown predicate', () => {
  it('returns not_applicable failure for predicate with no resolutions', () => {
    const query: QueryExpr = {
      kind: 'query',
      id: 'q-unknown',
      intent: 'find',
      target: {
        kind: 'call',
        predicate: 'unknown.pred',
        args: [],
      } satisfies CallExpr,
    };

    const env = makeEnv({});

    const result = resolveQuery(query, env);
    expect(result.trace.status).toBe('not_applicable');
    expect(result.error_sources).toBeDefined();
    expect(result.error_sources![0].kind).toBe('not_applicable');
  });
});

// ── Test 5: Given matching ────────────────────────────────────────────────────

describe('resolveQuery — given matching', () => {
  it('resolves prerequisite from givens without recursing', () => {
    /**
     * quantity.mass(NaCl) = amount(mol) × molar_mass(g/mol)
     * Resolution needs quantity.amount(NaCl) as prereq.
     * Given: quantity.amount(NaCl) = 2
     *
     * We use a lookup resolution that has quantity.amount as a prereq,
     * but simulate success by providing it in the givens.
     *
     * Since we can't easily wire a real equation handler here without formulas,
     * we test that the planner:
     *   a) reads the given correctly
     *   b) builds a given-matched child trace
     *   c) proceeds to executeHandler (which may still fail if no formula,
     *      but prereq resolution from givens must work)
     *
     * To make the handler succeed, we use a lookup resolution that reads
     * quantity.amount from its bindings — but that's the substance, not the
     * amount value. Instead we verify the given trace child appears.
     */

    // Resolution: derives quantity.molar_mass from quantity.amount (synthetic, just to test given-matching plumbing)
    // We use a rule-less lookup that will fail at the handler, but we want to see
    // whether the given-matching trace node was created for the prereq.

    // Better approach: create a resolution with no prereqs and verify given is ignored cleanly,
    // then a resolution WITH a prereq and a given that covers it.

    // quantity.mass($entity) requires quantity.amount($entity)
    const resMass: ResolutionDef = {
      id: 'res.mass_from_amount',
      origin: 'manual',
      target: 'quantity.mass',
      target_pattern: 'quantity.mass($entity)',
      kind: 'lookup',
      prerequisites: ['quantity.amount($entity)'],
      cost: 10,
      uncertainty_mode: 'exact',
    };

    // The lookup handler will try to look up 'concept:mass' on the element 'nacl',
    // which won't be found; but we want to verify prereq resolution via given first.
    // We can check that the given trace child is present in the failure trace.
    // Actually, to keep the test focused, let's use a lookup that WILL succeed
    // when the entity is in our elements list — so make $entity resolve to 'Na'
    // and add 'concept:mass' to Na's characteristics.

    const naWithMass: LookupElementEntry = {
      Z: 11,
      symbol: 'Na',
      characteristics: {
        'concept:mass': { value: 22.99 },
      },
    };

    const massCallNacl: CallExpr = {
      kind: 'call',
      predicate: 'quantity.mass',
      args: [naSymbol],
    };

    const amountValue: ValueExpr = { kind: 'value', value: 2, unit: 'mol' };
    const amountGiven: EqualityExpr = {
      kind: 'equality',
      left: { kind: 'call', predicate: 'quantity.amount', args: [naSymbol] } satisfies CallExpr,
      right: amountValue,
    };

    const query: QueryExpr = {
      kind: 'query',
      id: 'q-given',
      intent: 'derive',
      target: massCallNacl,
      givens: [amountGiven],
    };

    const env = makeEnv(
      { 'quantity.mass': [resMass] },
      { elements: [naWithMass] },
    );

    const result = resolveQuery(query, env);

    // The handler will succeed (Na.concept:mass = 22.99) after given-resolving the prereq.
    expect(result.trace.status).toBe('success');

    // There should be a child trace node with step_role 'given'
    const givenChild = result.trace.children.find(c => c.step_role === 'given');
    expect(givenChild).toBeDefined();
    expect(givenChild!.status).toBe('success');
    const givenOutput = givenChild!.output as ValueExpr;
    expect(givenOutput.value).toBe(2);
  });
});
