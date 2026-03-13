import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const FOUNDATIONS = join(import.meta.dirname, '../../../data-src/foundations');
const ENGINE = join(import.meta.dirname, '../../../data-src/engine');
const RULES = join(import.meta.dirname, '../../../data-src/rules');

function loadJson<T>(filename: string): T {
  return JSON.parse(readFileSync(filename, 'utf8')) as T;
}

describe('constants.json', () => {
  const data = loadJson<Array<Record<string, unknown>>>(join(FOUNDATIONS, 'constants.json'));

  it('is a non-empty array', () => {
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(5);
  });

  it('all entries have required fields', () => {
    for (const c of data) {
      expect(c.id).toMatch(/^const:/);
      expect(typeof c.symbol).toBe('string');
      expect(typeof c.value).toBe('number');
      expect(typeof c.unit).toBe('string');
      expect(c.unit).toMatch(/^unit:/);
      expect(typeof c.labels_key).toBe('string');
    }
  });

  it('has no locale-suffixed fields (ADR-003)', () => {
    for (const c of data) {
      for (const key of Object.keys(c)) {
        expect(key).not.toMatch(/_(ru|en|pl|es)$/);
      }
    }
  });
});

describe('formulas.json', () => {
  const data = loadJson<Array<Record<string, unknown>>>(join(FOUNDATIONS, 'formulas.json'));

  it('has 20 formulas', () => {
    expect(data.length).toBe(20);
  });

  it('all IDs use formula: namespace', () => {
    for (const f of data) {
      expect(f.id).toMatch(/^formula:/);
    }
  });

  it('all have expression, result_variable, variables', () => {
    for (const f of data) {
      expect(f.expression).toBeDefined();
      expect(typeof f.result_variable).toBe('string');
      expect(Array.isArray(f.variables)).toBe(true);
      expect((f.variables as Array<unknown>).length).toBeGreaterThan(0);
    }
  });

  it('result_variable matches one of the variable symbols', () => {
    for (const f of data) {
      const symbols = (f.variables as Array<{ symbol: string }>).map(v => v.symbol);
      expect(symbols).toContain(f.result_variable);
    }
  });

  it('invertible_for entries match variable symbols', () => {
    for (const f of data) {
      const symbols = (f.variables as Array<{ symbol: string }>).map(v => v.symbol);
      for (const inv of (f.invertible_for as string[]) ?? []) {
        expect(symbols).toContain(inv);
      }
    }
  });

  it('inversions keys match invertible_for', () => {
    for (const f of data) {
      const invFor = new Set((f.invertible_for as string[]) ?? []);
      const invKeys = new Set(Object.keys((f.inversions as Record<string, unknown>) ?? {}));
      expect(invKeys).toEqual(invFor);
    }
  });

  it('prerequisite_formulas reference existing formula IDs', () => {
    const ids = new Set(data.map(f => f.id as string));
    for (const f of data) {
      for (const pre of (f.prerequisite_formulas as string[]) ?? []) {
        expect(ids.has(pre)).toBe(true);
      }
    }
  });

  it('constants_used reference existing constant IDs', () => {
    const constants = loadJson<Array<{ id: string }>>(join(FOUNDATIONS, 'constants.json'));
    const constIds = new Set(constants.map(c => c.id));
    for (const f of data) {
      for (const c of (f.constants_used as string[]) ?? []) {
        expect(constIds.has(c)).toBe(true);
      }
    }
  });

  it('has no locale-suffixed fields (ADR-003)', () => {
    for (const f of data) {
      for (const key of Object.keys(f)) {
        expect(key).not.toMatch(/_(ru|en|pl|es)$/);
      }
    }
  });

  it('collision formulas have valid semantic_role on collision variables', () => {
    const VALID_ROLES = ['actual', 'theoretical', 'solute', 'solution', 'reactant', 'product', 'initial', 'final'];
    const COLLISION_FORMULAS = [
      'formula:yield', 'formula:stoichiometry_ratio', 'formula:mass_fraction_solution',
      'formula:vant_hoff_rule', 'formula:hess_law',
    ];
    for (const f of data) {
      if (!COLLISION_FORMULAS.includes(f.id as string)) continue;
      const vars = f.variables as Array<{ symbol: string; quantity: string; semantic_role?: string }>;
      // Find quantities that appear more than once
      const qCounts = new Map<string, number>();
      for (const v of vars) {
        qCounts.set(v.quantity, (qCounts.get(v.quantity) ?? 0) + 1);
      }
      for (const v of vars) {
        if ((qCounts.get(v.quantity) ?? 0) > 1) {
          expect(v.semantic_role).toBeDefined();
          expect(VALID_ROLES).toContain(v.semantic_role);
        }
      }
    }
  });
});

describe('qualitative_relations.json', () => {
  const data = loadJson<Array<Record<string, unknown>>>(join(FOUNDATIONS, 'qualitative_relations.json'));

  it('has 5 relations', () => {
    expect(data.length).toBe(5);
  });

  it('all IDs use qrel: namespace', () => {
    for (const r of data) {
      expect(r.id).toMatch(/^qrel:/);
    }
  });

  it('all have factors and predictions', () => {
    for (const r of data) {
      expect(Array.isArray(r.factors)).toBe(true);
      expect(Array.isArray(r.predictions)).toBe(true);
    }
  });

  it('grounded_in references valid formulas or relations', () => {
    const formulaIds = new Set(loadJson<Array<{ id: string }>>(join(FOUNDATIONS, 'formulas.json')).map(f => f.id));
    const relIds = new Set(data.map(r => r.id as string));
    for (const r of data) {
      if (r.grounded_in) {
        const ref = r.grounded_in as string;
        expect(formulaIds.has(ref) || relIds.has(ref)).toBe(true);
      }
    }
  });
});

describe('trend_rules.json', () => {
  const data = loadJson<Array<Record<string, unknown>>>(join(FOUNDATIONS, 'trend_rules.json'));

  it('has 10 trends', () => {
    expect(data.length).toBe(10);
  });

  it('all IDs use trend: namespace', () => {
    for (const t of data) {
      expect(t.id).toMatch(/^trend:/);
    }
  });

  it('each trend has applicability, reasoning_chain, exception_rule_ids', () => {
    for (const t of data) {
      expect(t.applicability).toBeDefined();
      expect(Array.isArray(t.reasoning_chain)).toBe(true);
      expect(Array.isArray(t.exception_rule_ids)).toBe(true);
    }
  });

  it('reasoning_chain references valid qualitative relations', () => {
    const relIds = new Set(loadJson<Array<{ id: string }>>(join(FOUNDATIONS, 'qualitative_relations.json')).map(r => r.id));
    for (const t of data) {
      for (const step of t.reasoning_chain as Array<{ relation: string }>) {
        expect(relIds.has(step.relation)).toBe(true);
      }
    }
  });

  it('covers all 5 properties x 2 contexts', () => {
    const pairs = data.map(t => `${t.property}:${t.context}`);
    const expected = [
      'ionization_energy:across_period', 'ionization_energy:down_group',
      'electronegativity:across_period', 'electronegativity:down_group',
      'atomic_radius:across_period', 'atomic_radius:down_group',
      'metallic_character:across_period', 'metallic_character:down_group',
      'electron_affinity:across_period', 'electron_affinity:down_group',
    ];
    expect(new Set(pairs)).toEqual(new Set(expected));
  });

  it('has no school_note in base JSON (ADR-003)', () => {
    for (const t of data) {
      expect(t).not.toHaveProperty('school_note');
    }
  });
});

describe('periodic_trend_anomalies.json (extended)', () => {
  const data = loadJson<Array<Record<string, unknown>>>(join(RULES, 'periodic_trend_anomalies.json'));

  it('all 5 entries have id with exc: namespace', () => {
    expect(data.length).toBe(5);
    for (const a of data) {
      expect(a.id).toMatch(/^exc:/);
    }
  });

  it('all entries have overrides_trend', () => {
    for (const a of data) {
      expect(typeof a.overrides_trend).toBe('string');
      expect(a.overrides_trend).toMatch(/^trend:/);
    }
  });

  it('overrides_trend references valid trend IDs', () => {
    const trendIds = new Set(loadJson<Array<{ id: string }>>(join(FOUNDATIONS, 'trend_rules.json')).map(t => t.id));
    for (const a of data) {
      expect(trendIds.has(a.overrides_trend as string)).toBe(true);
    }
  });

  it('exception_rule_ids in trend_rules reference valid anomaly IDs', () => {
    const anomalyIds = new Set(data.map(a => a.id as string));
    const trends = loadJson<Array<{ exception_rule_ids: string[] }>>(join(FOUNDATIONS, 'trend_rules.json'));
    for (const t of trends) {
      for (const excId of t.exception_rule_ids) {
        expect(anomalyIds.has(excId)).toBe(true);
      }
    }
  });
});

describe('prompt_templates (explanation coverage)', () => {
  const ENGINE = join(import.meta.dirname, '../../../data-src/engine');
  const templates = loadJson<Array<{ template_id: string; explanation_template_id?: string }>>(
    join(ENGINE, 'task_templates.json'),
  );
  const LOCALES = ['ru', 'en', 'pl', 'es'] as const;

  for (const locale of LOCALES) {
    const prompts = loadJson<Record<string, { question?: string; slots: Record<string, unknown> }>>(
      join(ENGINE, `prompt_templates.${locale}.json`),
    );

    it(`${locale}: every explanation_template_id has a matching entry`, () => {
      for (const t of templates) {
        if (t.explanation_template_id) {
          expect(prompts).toHaveProperty(t.explanation_template_id);
        }
      }
    });

    it(`${locale}: all explain.* entries use "question" key (not "template")`, () => {
      for (const [key, val] of Object.entries(prompts)) {
        if (key.startsWith('explain.')) {
          expect(val.question).toBeDefined();
          expect(typeof val.question).toBe('string');
          expect(val.question!.length).toBeGreaterThan(0);
        }
      }
    });
  }
});

describe('reason_vocab.json (extended)', () => {
  const data = loadJson<Array<Record<string, unknown>>>(join(RULES, 'reason_vocab.json'));

  it('all entries have mechanism_ref (string or null)', () => {
    for (const r of data) {
      expect('mechanism_ref' in r).toBe(true);
    }
  });

  it('entries with subshell have fill_state', () => {
    for (const r of data) {
      if (r.subshell) {
        expect(typeof r.fill_state).toBe('string');
      }
    }
  });

  it('non-null mechanism_ref references valid mechanism IDs', () => {
    const mechs = loadJson<Array<{ id: string }>>(join(FOUNDATIONS, 'mechanisms.json'));
    const mechIds = new Set(mechs.map(m => m.id));
    for (const r of data) {
      if (r.mechanism_ref !== null) {
        expect(mechIds.has(r.mechanism_ref as string)).toBe(true);
      }
    }
  });
});

// ── task_templates.json: distractor_strategy validation ──────────

describe('task_templates.json distractor_strategy', () => {
  const templates = loadJson<Array<{
    template_id: string;
    meta: {
      distractor_strategy?: {
        id: string;
        params?: Record<string, unknown>;
      };
    };
  }>>(join(ENGINE, 'task_templates.json'));

  const VALID_STRATEGY_IDS = new Set(['other_formulas', 'other_names', 'same_pool']);

  const VALID_FORMULA_SOURCES = new Set([
    'substances', 'ions', 'anions', 'qualitative_reagents', 'oxidation_examples',
  ]);

  const VALID_NAME_SOURCES = new Set([
    'substances', 'ions', 'anions', 'qualitative_targets', 'acids',
  ]);

  const VALID_POOL_IDS = new Set([
    'rate_factors', 'equilibrium_shifts', 'catalysts', 'suffix_rules',
    'ion_suffixes', 'element_symbols',
  ]);

  const withStrategy = templates.filter(t => t.meta.distractor_strategy);

  it('has at least 15 templates with distractor_strategy', () => {
    expect(withStrategy.length).toBeGreaterThanOrEqual(15);
  });

  it('all strategy IDs are valid', () => {
    for (const t of withStrategy) {
      expect(VALID_STRATEGY_IDS).toContain(t.meta.distractor_strategy!.id);
    }
  });

  it('other_formulas strategies have valid source', () => {
    for (const t of withStrategy) {
      const ds = t.meta.distractor_strategy!;
      if (ds.id === 'other_formulas') {
        expect(VALID_FORMULA_SOURCES).toContain(ds.params?.source);
      }
    }
  });

  it('other_names strategies have valid source', () => {
    for (const t of withStrategy) {
      const ds = t.meta.distractor_strategy!;
      if (ds.id === 'other_names') {
        expect(VALID_NAME_SOURCES).toContain(ds.params?.source);
      }
    }
  });

  it('same_pool strategies have valid pool_id', () => {
    for (const t of withStrategy) {
      const ds = t.meta.distractor_strategy!;
      if (ds.id === 'same_pool') {
        expect(VALID_POOL_IDS).toContain(ds.params?.pool_id);
      }
    }
  });
});
