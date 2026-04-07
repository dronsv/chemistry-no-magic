/**
 * End-to-end test: derive quantity.mass from quantity.amount via equation resolution.
 *
 * Full chain: derive(quantity.mass(NaCl), given=[quantity.amount(NaCl) = 2 mol])
 *   → resolution: res:formula.amount_from_mass.inv.m (m = n × M)
 *   → prereqs: quantity.amount (from given = 2), quantity.molar_mass (from lookup = 58.44)
 *   → equation handler evaluates: 2 × 58.44 = 116.88
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolveQuery, type ResolverEnv } from '../resolve-query.js';
import { parseDsl } from '../parse-dsl.js';
import type { ResolutionDef } from '../../../types/resolution.js';
import type { ComputableFormula } from '../../../types/formula.js';

let resolutionIndex: Record<string, ResolutionDef[]>;
let formulas: ComputableFormula[];
let constants: Record<string, number>;

beforeAll(async () => {
  const {
    generateResolutionsFromFormulas,
    generateLookupResolutionsFromProperties,
    mergeResolutions,
    buildResolutionIndex,
  } = await import('../../../../scripts/lib/generate-resolutions.mjs');

  formulas = JSON.parse(readFileSync('data-src/foundations/formulas.json', 'utf8'));
  const manualRes = JSON.parse(readFileSync('data-src/foundations/resolutions.json', 'utf8'));
  const constantsList = JSON.parse(readFileSync('data-src/foundations/constants.json', 'utf8'));
  const properties = JSON.parse(readFileSync('data-src/rules/properties.json', 'utf8'));

  constants = {};
  for (const c of constantsList) constants[c.id] = c.value;

  // Use the full registry generation (same as build pipeline)
  const { generateResolutionRegistry } = await import('../../../../scripts/lib/generate-resolutions.mjs');
  const merged = generateResolutionRegistry(formulas, manualRes, '/tmp/test-res-output', properties);
  resolutionIndex = buildResolutionIndex(merged);
});

function makeEnv(overrides?: Partial<ResolverEnv>): ResolverEnv {
  return {
    predicateRegistry: [],
    resolutionIndex,
    ontology: {
      formulas,
      constants,
      ontologyData: {} as never,
      elements: [
        {
          Z: 11, symbol: 'Na',
          characteristics: {
            'concept:atomic_mass': { value: 22.99 },
            'concept:electronegativity': { value: 0.93 },
          },
        },
        {
          Z: 17, symbol: 'Cl',
          characteristics: {
            'concept:atomic_mass': { value: 35.45 },
            'concept:electronegativity': { value: 3.16 },
          },
        },
      ],
      substances: [{
        id: 'sub:nacl', formula: 'NaCl', class: 'salt',
        characteristics: { 'concept:molar_mass': { value: 58.44 } },
      }],
      ions: [],
    },
    formulaRegistry: formulas,
    constants,
    policy: { max_depth: 6 },
    queryCache: new Map(),
    activeQueryStack: new Set(),
    ...overrides,
  };
}

describe('equation E2E: derive quantity.mass from amount', () => {
  it('parses and resolves derive(quantity.mass(sub:nacl), given=[quantity.amount(sub:nacl) = 2 mol])', () => {
    const { query, error } = parseDsl(
      'derive(quantity.mass(sub:nacl), given=[quantity.amount(sub:nacl) = 2 mol])',
    );
    expect(error).toBeUndefined();
    expect(query).not.toBeNull();

    const env = makeEnv();
    const result = resolveQuery(query!, env);

    function printTrace(t: typeof result.trace, indent = '') {
      console.log(indent + t.query_id + ' [' + t.status + '] ' + t.step_role + (t.resolution_kind ? ':' + t.resolution_kind : ''));
      if (t.output?.kind === 'value') console.log(indent + '  output:', (t.output as any).value);
      if (t.resolution_id) console.log(indent + '  resolution:', t.resolution_id);
      for (const c of t.children || []) printTrace(c, indent + '  ');
    }
    console.log('--- TRACE ---');
    printTrace(result.trace);
    console.log('--- END ---');

    expect(result.trace.status).toBe('success');
    expect(result.answer.kind).toBe('value');
    if (result.answer.kind === 'value') {
      // m = n × M = 2 × 58.44 = 116.88
      expect(result.answer.value).toBeCloseTo(116.88, 1);
    }
  });

  it('finds element electronegativity via lookup', () => {
    const { query } = parseDsl('find(element.electronegativity(Na))');
    const result = resolveQuery(query!, makeEnv());
    expect(result.trace.status).toBe('success');
    expect(result.answer).toEqual({ kind: 'value', value: 0.93 });
  });

  it('finds substance class via lookup', () => {
    const { query } = parseDsl('find(substance.class(sub:nacl))');
    const result = resolveQuery(query!, makeEnv());
    expect(result.trace.status).toBe('success');
    expect(result.answer).toEqual({ kind: 'value', value: 'salt' });
  });
});
