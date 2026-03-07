/**
 * Frame renderer for kinetics theory rules (Stage 4 pilot).
 *
 * Generates compact structural statements from rule entities without prose:
 *   directional_influence:   "концентрация реагентов ↑ → скорость реакции ↑"
 *   quantified_influence:    "температура ↑ 10 K → скорость реакции × 2–4"
 *
 * Locale text comes from prop_names vocabulary (loaded from overlay _prop_names).
 * short_statement from overlay serves as override / fallback for edge cases.
 */

import type { KineticsRule, InfluenceOperator } from '../types/kinetics';

export type PropNames = Record<string, string>;

export interface KineticsFrame {
  /** Rendered source property name. */
  source: string;
  /** Source change indicator, e.g. "↑", "↓", "+". */
  sourceSymbol: string;
  /** Optional delta string, e.g. "10 K". */
  delta?: string;
  /** Rendered target property name. */
  target: string;
  /** Target response indicator, e.g. "↑", "↓", "× 2–4". */
  targetSymbol: string;
  /** Compact single-line statement ready for display. */
  compact: string;
}

const OPERATOR_SYMBOL: Record<InfluenceOperator, string> = {
  increase: '↑',
  decrease: '↓',
  enable: '+',
  disable: '−',
  increase_by: '↑',
  decrease_by: '↓',
};

const DIRECTION_SYMBOL: Record<string, string> = {
  increase: '↑',
  decrease: '↓',
};

/** Strip namespace prefix and format as display string (fallback only). */
function stripNs(id: string): string {
  return id.replace(/^[a-z]+:/, '').replace(/_/g, '\u00a0');
}

/** Look up a prop or unit name from vocabulary; fall back to stripped id. */
function lookup(id: string, vocab: PropNames): string {
  return vocab[id] ?? stripNs(id);
}

/**
 * Build a KineticsFrame from a rule entity and prop vocabulary.
 * Returns null if the rule kind is not renderable (e.g. empirical_rule).
 */
export function renderKineticsFrame(rule: KineticsRule, propNames: PropNames): KineticsFrame | null {
  if (rule.kind !== 'directional_influence' && rule.kind !== 'quantified_influence') return null;
  if (!rule.source_property || !rule.target_property) return null;

  const sc = rule.source_change;
  const tr = rule.target_response;

  const source = lookup(rule.source_property, propNames);
  const target = lookup(rule.target_property, propNames);

  const sourceSymbol = sc ? (OPERATOR_SYMBOL[sc.operator] ?? '?') : '';

  let delta: string | undefined;
  if (sc?.value !== undefined) {
    const unitName = sc.unit ? lookup(sc.unit, propNames) : '';
    delta = `${sc.value}${unitName ? '\u202f' + unitName : ''}`;
  }

  let targetSymbol = '';
  if (tr) {
    if (tr.mode === 'direction' && tr.direction) {
      targetSymbol = DIRECTION_SYMBOL[tr.direction] ?? '';
    } else if (tr.mode === 'multiplier_range' && tr.min !== undefined && tr.max !== undefined) {
      targetSymbol = `×\u202f${tr.min}–${tr.max}`;
    } else if (tr.mode === 'fixed_value' && tr.value !== undefined) {
      targetSymbol = `=\u202f${tr.value}`;
    }
  }

  const sourcePart = delta ? `${source} ${sourceSymbol} ${delta}` : `${source} ${sourceSymbol}`;
  const compact = `${sourcePart} → ${target} ${targetSymbol}`.trim();

  return { source, sourceSymbol, delta, target, targetSymbol, compact };
}
