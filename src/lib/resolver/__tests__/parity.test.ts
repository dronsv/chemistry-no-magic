/**
 * Parity tests: resolveQuery() against known expected values.
 *
 * Covers:
 *   1. Lookup — element electronegativity → 0.93
 *   2. Fingerprint stability — same query structure → same fingerprint
 *   3. Cache reuse — two different ids, same structure → cache size = 1
 *   4. Cycle detection — A⇄B → failure, no infinite loop
 *   5. Real formulas — generated resolution index contains quantity.amount / quantity.mass
 *   6. Given matching for derive — prereq resolved from givens, child trace present
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { resolveQuery, type ResolverEnv } from '../resolve-query.js';
import { computeFingerprint } from '../query-utils.js';
import type {
  QueryExpr,
  SymbolExpr,
  CallExpr,
  EqualityExpr,
  ValueExpr,
} from '../../../types/query-ast.js';
import type { ResolutionDef } from '../../../types/resolution.js';
import type { HandlerEnv } from '../handlers/index.js';
import type { LookupElementEntry } from '../handlers/lookup-handler.js';

// ── Path helpers ──────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_ROOT = join(__dirname, '../../../../data-src/foundations');

// ── Shared symbols ────────────────────────────────────────────────────────────

const naSymbol: SymbolExpr = {
  kind: 'symbol',
  ref: { kind: 'element', id: 'Na' },
};

const naclSymbol: SymbolExpr = {
  kind: 'symbol',
  ref: { kind: 'substance', id: 'sub:nacl' },
};

// ── Mock ontology ─────────────────────────────────────────────────────────────

/** Minimal element set matching task spec. */
const MOCK_ELEMENTS: LookupElementEntry[] = [
  {
    Z: 11,
    symbol: 'Na',
    characteristics: {
      'concept:electronegativity': { value: 0.93 },
      'concept:atomic_mass': { value: 22.99 },
    },
  },
  {
    Z: 17,
    symbol: 'Cl',
    characteristics: {
      'concept:electronegativity': { value: 3.16 },
      'concept:atomic_mass': { value: 35.45 },
    },
  },
];

const BASE_HANDLER_ENV: HandlerEnv = {
  elements: MOCK_ELEMENTS,
  substances: [{ id: 'sub:nacl', formula: 'NaCl', class: 'salt' }],
  ions: [],
  formulas: [],
  constants: {},
  ontologyData: {} as never,
};

function makeEnv(
  resolutionIndex: Record<string, ResolutionDef[]>,
  overrides: Partial<HandlerEnv> = {},
): ResolverEnv {
  return {
    predicateRegistry: [],
    resolutionIndex,
    ontology: { ...BASE_HANDLER_ENV, ...overrides },
    formulaRegistry: [],
    constants: {},
    policy: {},
    queryCache: new Map(),
    activeQueryStack: new Set(),
  };
}

// ── Resolution fixture (lookup) ───────────────────────────────────────────────

const RES_ELECTRONEGATIVITY: ResolutionDef = {
  id: 'res:parity.element_electronegativity',
  origin: 'manual',
  target: 'element.electronegativity',
  target_pattern: 'element.electronegativity($element)',
  kind: 'lookup',
  prerequisites: [],
  cost: 10,
  uncertainty_mode: 'exact',
};

// ── 1. Lookup: element electronegativity ─────────────────────────────────────

describe('parity — lookup: element.electronegativity(Na)', () => {
  it('resolves to 0.93 from mock element data', () => {
    const query: QueryExpr = {
      kind: 'query',
      id: 'parity:q-en-na',
      intent: 'find',
      target: {
        kind: 'call',
        predicate: 'element.electronegativity',
        args: [naSymbol],
      } satisfies CallExpr,
    };

    const env = makeEnv({
      'element.electronegativity': [RES_ELECTRONEGATIVITY],
    });

    const result = resolveQuery(query, env);

    expect(result.trace.status).toBe('success');
    expect(result.answer.kind).toBe('value');
    expect((result.answer as ValueExpr).value).toBe(0.93);
    expect(result.certainty).toBe('exact');
  });

  it('resolves Cl electronegativity to 3.16', () => {
    const clSymbol: SymbolExpr = {
      kind: 'symbol',
      ref: { kind: 'element', id: 'Cl' },
    };

    const query: QueryExpr = {
      kind: 'query',
      id: 'parity:q-en-cl',
      intent: 'find',
      target: {
        kind: 'call',
        predicate: 'element.electronegativity',
        args: [clSymbol],
      } satisfies CallExpr,
    };

    const env = makeEnv({
      'element.electronegativity': [RES_ELECTRONEGATIVITY],
    });

    const result = resolveQuery(query, env);

    expect(result.trace.status).toBe('success');
    expect((result.answer as ValueExpr).value).toBe(3.16);
  });
});

// ── 2. Fingerprint stability ──────────────────────────────────────────────────

describe('parity — fingerprint stability', () => {
  it('same query structure produces identical fingerprint across multiple calls', () => {
    const query: QueryExpr = {
      kind: 'query',
      id: 'parity:q-fp-1',
      intent: 'find',
      target: {
        kind: 'call',
        predicate: 'element.electronegativity',
        args: [naSymbol],
      } satisfies CallExpr,
    };

    const fp1 = computeFingerprint(query);
    const fp2 = computeFingerprint(query);
    const fp3 = computeFingerprint(query);

    expect(fp1).toBe(fp2);
    expect(fp2).toBe(fp3);
    expect(fp1).toMatch(/^fp_[0-9a-f]{8}$/);
  });

  it('queries with different ids but same structure share the same fingerprint', () => {
    const queryA: QueryExpr = {
      kind: 'query',
      id: 'parity:q-fp-id-a',
      intent: 'find',
      target: {
        kind: 'call',
        predicate: 'element.electronegativity',
        args: [naSymbol],
      } satisfies CallExpr,
    };

    const queryB: QueryExpr = { ...queryA, id: 'parity:q-fp-id-b' };

    expect(computeFingerprint(queryA)).toBe(computeFingerprint(queryB));
  });

  it('queries with different intents produce different fingerprints', () => {
    const base: QueryExpr = {
      kind: 'query',
      id: 'parity:q-fp-base',
      intent: 'find',
      target: {
        kind: 'call',
        predicate: 'element.electronegativity',
        args: [naSymbol],
      } satisfies CallExpr,
    };
    const derived: QueryExpr = { ...base, id: 'parity:q-fp-derived', intent: 'derive' };

    expect(computeFingerprint(base)).not.toBe(computeFingerprint(derived));
  });
});

// ── 3. Cache reuse ────────────────────────────────────────────────────────────

describe('parity — cache reuse', () => {
  it('two calls with different ids but same structure → cache size stays 1', () => {
    const q1: QueryExpr = {
      kind: 'query',
      id: 'parity:q-cache-1',
      intent: 'find',
      target: {
        kind: 'call',
        predicate: 'element.electronegativity',
        args: [naSymbol],
      } satisfies CallExpr,
    };
    const q2: QueryExpr = { ...q1, id: 'parity:q-cache-2' };

    const env = makeEnv({
      'element.electronegativity': [RES_ELECTRONEGATIVITY],
    });

    resolveQuery(q1, env);
    expect(env.queryCache.size).toBe(1);

    resolveQuery(q2, env);
    expect(env.queryCache.size).toBe(1);
  });

  it('two calls with structurally different queries → cache size grows to 2', () => {
    const clSymbol: SymbolExpr = { kind: 'symbol', ref: { kind: 'element', id: 'Cl' } };
    const qNa: QueryExpr = {
      kind: 'query',
      id: 'parity:q-cache-na',
      intent: 'find',
      target: { kind: 'call', predicate: 'element.electronegativity', args: [naSymbol] } satisfies CallExpr,
    };
    const qCl: QueryExpr = {
      kind: 'query',
      id: 'parity:q-cache-cl',
      intent: 'find',
      target: { kind: 'call', predicate: 'element.electronegativity', args: [clSymbol] } satisfies CallExpr,
    };

    const env = makeEnv({
      'element.electronegativity': [RES_ELECTRONEGATIVITY],
    });

    resolveQuery(qNa, env);
    resolveQuery(qCl, env);
    expect(env.queryCache.size).toBe(2);
  });
});

// ── 4. Cycle detection ────────────────────────────────────────────────────────

describe('parity — cycle detection', () => {
  it('returns failure (no hang) when A→B→A', () => {
    const resA: ResolutionDef = {
      id: 'res:parity.cycle_a',
      origin: 'manual',
      target: 'cycle.a',
      target_pattern: 'cycle.a($x)',
      kind: 'lookup',
      prerequisites: ['cycle.b($x)'],
      cost: 10,
      uncertainty_mode: 'exact',
    };
    const resB: ResolutionDef = {
      id: 'res:parity.cycle_b',
      origin: 'manual',
      target: 'cycle.b',
      target_pattern: 'cycle.b($x)',
      kind: 'lookup',
      prerequisites: ['cycle.a($x)'],
      cost: 10,
      uncertainty_mode: 'exact',
    };

    const env = makeEnv({
      'cycle.a': [resA],
      'cycle.b': [resB],
    });

    const query: QueryExpr = {
      kind: 'query',
      id: 'parity:q-cycle',
      intent: 'find',
      target: { kind: 'call', predicate: 'cycle.a', args: [naSymbol] } satisfies CallExpr,
    };

    // Must complete without hanging or throwing
    const result = resolveQuery(query, env);
    expect(result.trace.status).not.toBe('success');
    expect(result.error_sources).toBeDefined();
    expect(result.error_sources!.length).toBeGreaterThan(0);
  });
});

// ── 5. Real formulas: generated resolution index ──────────────────────────────

describe('parity — real formulas.json: generated resolution index', () => {
  // These are loaded once in beforeAll via dynamic import of the mjs script
  let resolutionIndex: Record<string, string[]> = {};

  beforeAll(async () => {
    // Load real data files
    const [formulasRaw, resolutionsRaw] = await Promise.all([
      readFile(join(DATA_ROOT, 'formulas.json'), 'utf-8'),
      readFile(join(DATA_ROOT, 'resolutions.json'), 'utf-8'),
    ]);

    const formulas = JSON.parse(formulasRaw) as unknown[];
    const manualResolutions = JSON.parse(resolutionsRaw) as Array<{ id: string; target: string }>;

    // Dynamically import the generator (it's an ES module .mjs)
    const { generateResolutionsFromFormulas, mergeResolutions, buildResolutionIndex } =
      await import('../../../../scripts/lib/generate-resolutions.mjs');

    const generated = generateResolutionsFromFormulas(formulas);
    const merged = mergeResolutions(generated, manualResolutions);
    const index = buildResolutionIndex(merged);

    // Store just the predicate keys for assertions
    resolutionIndex = Object.fromEntries(
      Object.entries(index as Record<string, Array<{ id: string }>>) .map(([k, v]) => [k, v.map((r) => r.id)])
    );
  });

  it('resolution index contains quantity.amount (from formula:amount_from_mass forward)', () => {
    expect(resolutionIndex['quantity.amount']).toBeDefined();
    expect(resolutionIndex['quantity.amount'].length).toBeGreaterThan(0);
  });

  it('resolution index contains quantity.mass (inverse of amount_from_mass)', () => {
    expect(resolutionIndex['quantity.mass']).toBeDefined();
    expect(resolutionIndex['quantity.mass'].length).toBeGreaterThan(0);
  });

  it('resolution index contains quantity.molar_mass', () => {
    expect(resolutionIndex['quantity.molar_mass']).toBeDefined();
    expect(resolutionIndex['quantity.molar_mass'].length).toBeGreaterThan(0);
  });

  it('resolution ids for quantity.amount include the forward formula resolution', () => {
    const amountIds = resolutionIndex['quantity.amount'] ?? [];
    // Generated forward id: res:formula.amount_from_mass
    expect(amountIds.some((id) => id.includes('amount_from_mass'))).toBe(true);
  });

  it('manual resolutions are present (e.g. res:substance.class)', () => {
    expect(resolutionIndex['substance.class']).toBeDefined();
    const ids = resolutionIndex['substance.class'] ?? [];
    expect(ids).toContain('res:substance.class');
  });

  it('total resolution count is at least 10 (formulas generate multiple entries)', () => {
    const total = Object.values(resolutionIndex).reduce((sum, ids) => sum + ids.length, 0);
    expect(total).toBeGreaterThanOrEqual(10);
  });
});

// ── 6. Given matching for derive with equation resolution ─────────────────────

describe('parity — given matching for derive', () => {
  it('resolves prereq quantity.amount from givens, succeeds with given-trace child', () => {
    /**
     * Resolution: quantity.mass($entity) with prereq quantity.amount($entity)
     * We supply quantity.amount(Na) = 2 mol as a given.
     * The handler is a lookup that reads concept:mass from the element.
     * We add concept:mass to Na so it succeeds.
     */
    const resMass: ResolutionDef = {
      id: 'res:parity.mass_from_amount',
      origin: 'manual',
      target: 'quantity.mass',
      target_pattern: 'quantity.mass($entity)',
      kind: 'lookup',
      prerequisites: ['quantity.amount($entity)'],
      cost: 10,
      uncertainty_mode: 'exact',
    };

    const naWithMass: LookupElementEntry = {
      Z: 11,
      symbol: 'Na',
      characteristics: {
        'concept:mass': { value: 22.99 },
        'concept:electronegativity': { value: 0.93 },
        'concept:atomic_mass': { value: 22.99 },
      },
    };

    const amountValue: ValueExpr = { kind: 'value', value: 2, unit: 'mol' };
    const amountGiven: EqualityExpr = {
      kind: 'equality',
      left: {
        kind: 'call',
        predicate: 'quantity.amount',
        args: [naSymbol],
      } satisfies CallExpr,
      right: amountValue,
    };

    const query: QueryExpr = {
      kind: 'query',
      id: 'parity:q-given-mass',
      intent: 'derive',
      target: {
        kind: 'call',
        predicate: 'quantity.mass',
        args: [naSymbol],
      } satisfies CallExpr,
      givens: [amountGiven],
    };

    const env = makeEnv(
      { 'quantity.mass': [resMass] },
      { elements: [naWithMass] },
    );

    const result = resolveQuery(query, env);

    // Handler succeeds: lookup finds concept:mass = 22.99 on Na
    expect(result.trace.status).toBe('success');

    // There must be a child trace with step_role 'given' for the prereq
    const givenChild = result.trace.children.find((c) => c.step_role === 'given');
    expect(givenChild).toBeDefined();
    expect(givenChild!.status).toBe('success');

    // The given output carries the value we supplied (2 mol)
    const givenOutput = givenChild!.output as ValueExpr;
    expect(givenOutput.value).toBe(2);
  });

  it('fails gracefully when required given is absent and no resolution exists for prereq', () => {
    const resWithPrereq: ResolutionDef = {
      id: 'res:parity.needs_missing_prereq',
      origin: 'manual',
      target: 'quantity.foo',
      target_pattern: 'quantity.foo($entity)',
      kind: 'lookup',
      prerequisites: ['quantity.bar($entity)'],
      cost: 10,
      uncertainty_mode: 'exact',
    };

    const query: QueryExpr = {
      kind: 'query',
      id: 'parity:q-missing-prereq',
      intent: 'derive',
      target: {
        kind: 'call',
        predicate: 'quantity.foo',
        args: [naSymbol],
      } satisfies CallExpr,
      // No givens, and no resolution for quantity.bar
    };

    const env = makeEnv({ 'quantity.foo': [resWithPrereq] });

    const result = resolveQuery(query, env);
    expect(result.trace.status).not.toBe('success');
  });
});

// ── Extra: naclSymbol is wired correctly ──────────────────────────────────────

// Confirm the naclSymbol fixture resolves substance.class correctly via lookup.
describe('parity — substance class lookup', () => {
  it('resolves substance.class(sub:nacl) → "salt"', () => {
    const resClass: ResolutionDef = {
      id: 'res:parity.substance_class',
      origin: 'manual',
      target: 'substance.class',
      target_pattern: 'substance.class($substance)',
      kind: 'lookup',
      prerequisites: [],
      cost: 10,
      uncertainty_mode: 'exact',
    };

    const query: QueryExpr = {
      kind: 'query',
      id: 'parity:q-class-nacl',
      intent: 'find',
      target: {
        kind: 'call',
        predicate: 'substance.class',
        args: [naclSymbol],
      } satisfies CallExpr,
    };

    const env = makeEnv({ 'substance.class': [resClass] });

    const result = resolveQuery(query, env);

    expect(result.trace.status).toBe('success');
    expect((result.answer as ValueExpr).value).toBe('salt');
  });
});
