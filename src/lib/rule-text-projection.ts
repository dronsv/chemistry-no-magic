import type { GeneratedRuleText } from '../types/rule-text';
import type { ApplicabilityRule } from '../types/rules';

export interface RuleSummaryProjection {
  /** Primary display text: canonical summary sentence. */
  summary: string;
  /**
   * Secondary display text: exception note + pedagogical note combined.
   * Undefined if neither is available.
   */
  detail?: string;
}

/**
 * Build a locale-specific display projection from generated rule texts and applicability rules.
 *
 * Page components should consume rules via this projection rather than reading
 * generated/ files directly.
 *
 * @param ruleTexts - Generated rule texts (from loadRuleTexts())
 * @param rules     - Applicability rules with locale overlay applied (from loadApplicabilityRules(locale))
 * @param locale    - Active locale code
 * @returns Map of rule_id → RuleSummaryProjection
 */
export function buildRuleSummaryProjection(
  ruleTexts: GeneratedRuleText[],
  rules: ApplicabilityRule[],
  locale: string,
): Record<string, RuleSummaryProjection> {
  const rulesById = Object.fromEntries(rules.map(r => [r.id, r]));
  const result: Record<string, RuleSummaryProjection> = {};

  for (const rt of ruleTexts) {
    const rule = rulesById[rt.rule_id];
    const summary = rt.slots.canonical_summary?.[locale]
      ?? rt.slots.canonical_summary?.['ru']
      ?? rt.rule_id;

    const parts: string[] = [];
    const exNote = rt.slots.exception_note?.[locale] ?? rt.slots.exception_note?.['ru'];
    if (exNote) parts.push(exNote);
    const pedNote = rule?.pedagogical_note ?? undefined;
    if (pedNote) parts.push(pedNote);

    result[rt.rule_id] = {
      summary,
      detail: parts.length > 0 ? parts.join(' ') : undefined,
    };
  }

  return result;
}
