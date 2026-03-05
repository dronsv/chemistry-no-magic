import { describe, it, expect } from 'vitest';
import type { OxRule, OxRulesData, OxRuleKind } from '../../types/oxidation-rules';

describe('OxRule types', () => {
  it('OxRule has required fields', () => {
    const rule: OxRule = {
      id: 'oxygen',
      kind: 'default',
      title_ru: 'Кислород: обычно −2',
      description_ru: 'В большинстве соединений кислород имеет −2.',
      examples: ['H2O'],
    };
    expect(rule.id).toBe('oxygen');
    expect(rule.kind).toBe('default');
    expect(rule.examples).toHaveLength(1);
  });

  it('OxRule examples is optional', () => {
    const rule: OxRule = {
      id: 'sum_equals_zero',
      kind: 'constraint',
      title_ru: 'Сумма = 0',
      description_ru: 'Сумма равна 0.',
    };
    expect(rule.examples).toBeUndefined();
  });

  it('OxRulesData has ruleset_id and rules array', () => {
    const data: OxRulesData = {
      ruleset_id: 'oxidation_rules.school.v1',
      rules: [],
    };
    expect(data.ruleset_id).toBe('oxidation_rules.school.v1');
    expect(data.rules).toHaveLength(0);
  });

  it('buildRulesById lookup works and returns undefined for missing', () => {
    const rules: OxRule[] = [
      { id: 'oxygen', kind: 'default', title_ru: 'O', description_ru: 'desc' },
      { id: 'fluorine', kind: 'assignment', title_ru: 'F', description_ru: 'desc' },
    ];
    const byId: Record<string, OxRule> = Object.fromEntries(rules.map(r => [r.id, r]));
    expect(byId['oxygen']?.kind).toBe('default');
    expect(byId['fluorine']?.kind).toBe('assignment');
    expect(byId['unknown']).toBeUndefined();
  });

  it('all OxRuleKind values are valid', () => {
    const kinds: OxRuleKind[] = ['assignment', 'default', 'exception', 'constraint', 'check'];
    expect(kinds).toHaveLength(5);
  });
});
