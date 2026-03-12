import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  detectContext,
  findApplicableTrend,
  checkException,
  predictHigher,
  reasonTrend,
} from '../trend-reasoner';
import type { TrendRule } from '../../types/trend-rule';
import type { TrendAnomaly } from '../../types/storage';

const DATA_DIR = join(import.meta.dirname, '../../../data-src');
const trendRules: TrendRule[] = JSON.parse(readFileSync(join(DATA_DIR, 'foundations/trend_rules.json'), 'utf8'));
const exceptions: TrendAnomaly[] = JSON.parse(readFileSync(join(DATA_DIR, 'rules/periodic_trend_anomalies.json'), 'utf8'));

// Minimal element stubs
const Na = { symbol: 'Na', Z: 11, group: 1, period: 3 };
const Mg = { symbol: 'Mg', Z: 12, group: 2, period: 3 };
const Cl = { symbol: 'Cl', Z: 17, group: 17, period: 3 };
const Li = { symbol: 'Li', Z: 3, group: 1, period: 2 };
const K  = { symbol: 'K', Z: 19, group: 1, period: 4 };
const Be = { symbol: 'Be', Z: 4, group: 2, period: 2 };
const B  = { symbol: 'B', Z: 5, group: 13, period: 2 };
const N  = { symbol: 'N', Z: 7, group: 15, period: 2 };
const O  = { symbol: 'O', Z: 8, group: 16, period: 2 };
const F  = { symbol: 'F', Z: 9, group: 17, period: 2 };
const Fe = { symbol: 'Fe', Z: 26, group: 8, period: 4 };

// ── detectContext ───────────────────────────────────────────────

describe('detectContext', () => {
  it('same period → across_period', () => {
    expect(detectContext(Na, Cl)).toBe('across_period');
  });

  it('same group → down_group', () => {
    expect(detectContext(Li, Na)).toBe('down_group');
    expect(detectContext(Na, K)).toBe('down_group');
  });

  it('different period and group → null', () => {
    expect(detectContext(Na, Fe)).toBe(null);
    expect(detectContext(Li, Cl)).toBe(null);
  });
});

// ── findApplicableTrend ─────────────────────────────────────────

describe('findApplicableTrend', () => {
  it('finds IE across period', () => {
    const t = findApplicableTrend('ionization_energy', 'across_period', trendRules);
    expect(t).not.toBeNull();
    expect(t!.id).toBe('trend:ie_across_period');
    expect(t!.direction).toBe('increases');
  });

  it('finds EN down group', () => {
    const t = findApplicableTrend('electronegativity', 'down_group', trendRules);
    expect(t).not.toBeNull();
    expect(t!.id).toBe('trend:en_down_group');
    expect(t!.direction).toBe('decreases');
  });

  it('finds atomic_radius across period', () => {
    const t = findApplicableTrend('atomic_radius', 'across_period', trendRules);
    expect(t!.direction).toBe('decreases');
  });

  it('finds metallic_character down group', () => {
    const t = findApplicableTrend('metallic_character', 'down_group', trendRules);
    expect(t!.direction).toBe('increases');
  });

  it('returns null for property without trend rules', () => {
    expect(findApplicableTrend('density', 'across_period', trendRules)).toBeNull();
    expect(findApplicableTrend('melting_point', 'down_group', trendRules)).toBeNull();
  });

  it('covers all 10 trend rules', () => {
    expect(trendRules).toHaveLength(10);
    for (const rule of trendRules) {
      const found = findApplicableTrend(rule.property, rule.context, trendRules);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(rule.id);
    }
  });
});

// ── checkException ──────────────────────────────────────────────

describe('checkException', () => {
  it('finds Be→B IE exception', () => {
    const exc = checkException('Be', 'B', 'trend:ie_across_period', exceptions);
    expect(exc).not.toBeNull();
    expect(exc!.id).toBe('exc:ie_be_b');
    expect(exc!.reason).toBe('filled_s_subshell');
  });

  it('finds exception in reverse order (B→Be)', () => {
    const exc = checkException('B', 'Be', 'trend:ie_across_period', exceptions);
    expect(exc).not.toBeNull();
    expect(exc!.id).toBe('exc:ie_be_b');
  });

  it('finds N→O IE exception', () => {
    const exc = checkException('N', 'O', 'trend:ie_across_period', exceptions);
    expect(exc!.id).toBe('exc:ie_n_o');
    expect(exc!.reason).toBe('half_filled_p_subshell');
  });

  it('finds F→Cl EA exception (group direction)', () => {
    const exc = checkException('F', 'Cl', 'trend:ea_down_group', exceptions);
    expect(exc!.id).toBe('exc:ea_f_cl');
    expect(exc!.reason).toBe('small_atomic_radius_repulsion');
  });

  it('returns null for non-exception pair', () => {
    expect(checkException('Na', 'Cl', 'trend:ie_across_period', exceptions)).toBeNull();
    expect(checkException('Li', 'Na', 'trend:ie_down_group', exceptions)).toBeNull();
  });

  it('returns null when trend ID does not match', () => {
    expect(checkException('Be', 'B', 'trend:en_across_period', exceptions)).toBeNull();
  });
});

// ── predictHigher ───────────────────────────────────────────────

describe('predictHigher', () => {
  const ieAcross = trendRules.find(t => t.id === 'trend:ie_across_period')!;
  const ieDown = trendRules.find(t => t.id === 'trend:ie_down_group')!;
  const radiusAcross = trendRules.find(t => t.id === 'trend:radius_across_period')!;
  const radiusDown = trendRules.find(t => t.id === 'trend:radius_down_group')!;

  it('IE increases across period → higher Z wins', () => {
    expect(predictHigher(Na, Cl, ieAcross)).toBe('Cl');
    expect(predictHigher(Cl, Na, ieAcross)).toBe('Cl');
  });

  it('IE decreases down group → lower period wins', () => {
    expect(predictHigher(Li, K, ieDown)).toBe('Li');
    expect(predictHigher(K, Li, ieDown)).toBe('Li');
  });

  it('radius decreases across period → lower Z wins', () => {
    expect(predictHigher(Na, Cl, radiusAcross)).toBe('Na');
  });

  it('radius increases down group → higher period wins', () => {
    expect(predictHigher(Li, K, radiusDown)).toBe('K');
  });
});

// ── reasonTrend ─────────────────────────────────────────────────

describe('reasonTrend', () => {
  it('EN across period: Na vs Cl → Cl higher', () => {
    const trace = reasonTrend('electronegativity', Na, Cl, trendRules, exceptions);
    expect(trace.context).toBe('across_period');
    expect(trace.trend_id).toBe('trend:en_across_period');
    expect(trace.trend_direction).toBe('increases');
    expect(trace.predicted_higher).toBe('Cl');
    expect(trace.reasoning_chain.length).toBeGreaterThan(0);
    expect(trace.exception).toBeNull();
  });

  it('EN down group: Li vs K → Li higher', () => {
    const trace = reasonTrend('electronegativity', Li, K, trendRules, exceptions);
    expect(trace.context).toBe('down_group');
    expect(trace.trend_id).toBe('trend:en_down_group');
    expect(trace.predicted_higher).toBe('Li');
  });

  it('IE across period with exception: Be vs B', () => {
    const trace = reasonTrend('ionization_energy', Be, B, trendRules, exceptions);
    expect(trace.context).toBe('across_period');
    expect(trace.trend_id).toBe('trend:ie_across_period');
    expect(trace.predicted_higher).toBe('B'); // trend predicts B, but exception exists
    expect(trace.exception).not.toBeNull();
    expect(trace.exception!.id).toBe('exc:ie_be_b');
    expect(trace.exception!.reason).toBe('filled_s_subshell');
  });

  it('IE across period with exception: N vs O', () => {
    const trace = reasonTrend('ionization_energy', N, O, trendRules, exceptions);
    expect(trace.predicted_higher).toBe('O'); // trend predicts O
    expect(trace.exception).not.toBeNull();
    expect(trace.exception!.id).toBe('exc:ie_n_o');
  });

  it('IE across period without exception: Na vs Mg', () => {
    const trace = reasonTrend('ionization_energy', Na, Mg, trendRules, exceptions);
    expect(trace.predicted_higher).toBe('Mg');
    expect(trace.exception).toBeNull();
  });

  it('atomic radius down group: Li vs Na → Na larger', () => {
    const trace = reasonTrend('atomic_radius', Li, Na, trendRules, exceptions);
    expect(trace.predicted_higher).toBe('Na');
    expect(trace.trend_direction).toBe('increases');
  });

  it('metallic character across period: Na vs Cl → Na higher', () => {
    const trace = reasonTrend('metallic_character', Na, Cl, trendRules, exceptions);
    expect(trace.predicted_higher).toBe('Na');
    expect(trace.trend_direction).toBe('decreases');
  });

  it('no applicable context: Na vs Fe → null prediction', () => {
    const trace = reasonTrend('electronegativity', Na, Fe, trendRules, exceptions);
    expect(trace.context).toBeNull();
    expect(trace.trend_id).toBeNull();
    expect(trace.predicted_higher).toBeNull();
    expect(trace.reasoning_chain).toEqual([]);
  });

  it('property without trend rules → null prediction', () => {
    const trace = reasonTrend('density', Na, Cl, trendRules, exceptions);
    expect(trace.context).toBe('across_period');
    expect(trace.trend_id).toBeNull();
    expect(trace.predicted_higher).toBeNull();
  });

  it('EA down group with exception: F vs Cl', () => {
    const trace = reasonTrend('electron_affinity', F, Cl, trendRules, exceptions);
    expect(trace.context).toBe('down_group');
    expect(trace.trend_id).toBe('trend:ea_down_group');
    expect(trace.exception).not.toBeNull();
    expect(trace.exception!.id).toBe('exc:ea_f_cl');
  });

  it('trace includes full reasoning chain from trend rule', () => {
    const trace = reasonTrend('ionization_energy', Na, Cl, trendRules, exceptions);
    expect(trace.reasoning_chain).toHaveLength(3);
    expect(trace.reasoning_chain[0].relation).toBe('qrel:zeff_in_period');
    expect(trace.reasoning_chain[1].relation).toBe('qrel:atomic_radius_factors');
    expect(trace.reasoning_chain[2].relation).toBe('qrel:ionization_energy_factors');
  });
});

// ── All 5 exception pairs ───────────────────────────────────────

describe('all 5 anomaly pairs detected', () => {
  const pairs: Array<{ a: typeof Na; b: typeof Na; property: string; excId: string }> = [
    { a: Be, b: B, property: 'ionization_energy', excId: 'exc:ie_be_b' },
    { a: N, b: O, property: 'ionization_energy', excId: 'exc:ie_n_o' },
    { a: Be, b: B, property: 'electron_affinity', excId: 'exc:ea_be_b' },
    { a: N, b: O, property: 'electron_affinity', excId: 'exc:ea_n_o' },
    { a: F, b: Cl, property: 'electron_affinity', excId: 'exc:ea_f_cl' },
  ];

  for (const { a, b, property, excId } of pairs) {
    it(`${a.symbol}→${b.symbol} ${property} → ${excId}`, () => {
      const trace = reasonTrend(property, a, b, trendRules, exceptions);
      expect(trace.exception).not.toBeNull();
      expect(trace.exception!.id).toBe(excId);
    });
  }
});
