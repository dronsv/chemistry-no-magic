export interface RuleTextSlots {
  /** Localized canonical summary per locale code. */
  canonical_summary?: Record<string, string>;
  /** Localized exception note per locale code (e.g. "alkali hydroxides are thermally stable"). */
  exception_note?: Record<string, string>;
  /** Reserved for future Phase B: observation facet summaries. */
  observation_summary?: Record<string, string>;
  /** Reserved for future Phase B: activity series summaries. */
  activity_summary?: Record<string, string>;
}

export interface GeneratedRuleText {
  rule_id: string;
  text_origin: 'generated';
  generation_kind: 'rule_summary';
  /** Template key used to produce canonical_summary (e.g. "canonical_summary:gas_evolution"). */
  template_id: string;
  slots: RuleTextSlots;
}

export type RuleTextsData = GeneratedRuleText[];

export interface GeneratedActivityText {
  metal_symbol: string;
  text_origin: 'generated';
  generation_kind: 'activity_summary';
  template_id: string;
  slots: {
    activity_summary?: Record<string, string>;
  };
}

export type ActivityTextsData = GeneratedActivityText[];
