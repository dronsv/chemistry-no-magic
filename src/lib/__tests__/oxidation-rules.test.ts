import { describe, it, expect } from 'vitest';
import type { OxRule, OxRulesData, OxRuleKind } from '../../types/oxidation-rules';

describe('OxRule types', () => {
  // These assignments are compile-time checks: if the type shape changes
  // (renamed field, changed optionality), the file fails to build.
  it('OxRule accepts all required fields', () => {
    const _rule: OxRule = {
      id: 'oxygen',
      kind: 'default',
      title: 'Кислород: обычно −2',
      description: 'В большинстве соединений кислород имеет −2.',
      examples: ['H2O'],
    };
    // TypeScript assignment IS the test.
  });

  it('OxRule examples is optional', () => {
    const _rule: OxRule = {
      id: 'sum_equals_zero',
      kind: 'constraint',
      title: 'Сумма = 0',
      description: 'Сумма равна 0.',
      // no examples — must compile without error
    };
  });

  it('OxRulesData accepts empty rules array', () => {
    const _data: OxRulesData = {
      ruleset_id: 'oxidation_rules.school.v1',
      rules: [],
    };
  });

  it('all OxRuleKind literals are assignable', () => {
    const _kinds: OxRuleKind[] = ['assignment', 'default', 'exception', 'constraint'];
    expect(_kinds).toHaveLength(4);
  });

  it('buildRulesById lookup returns undefined for missing keys', () => {
    const rules: OxRule[] = [
      { id: 'oxygen', kind: 'default', title: 'O', description: 'desc' },
      { id: 'fluorine', kind: 'assignment', title: 'F', description: 'desc' },
    ];
    const byId: Record<string, OxRule> = Object.fromEntries(rules.map(r => [r.id, r]));
    expect(byId['oxygen']?.kind).toBe('default');
    expect(byId['fluorine']?.kind).toBe('assignment');
    expect(byId['unknown']).toBeUndefined();
  });
});
