/** Theory rule kinds for the kinetics layer. */
export type KineticsRuleKind =
  | 'empirical_rule'
  | 'directional_influence'
  | 'quantified_influence'
  | 'condition_required';

/** Operator describing how the source property changes. */
export type InfluenceOperator =
  | 'increase'
  | 'decrease'
  | 'enable'
  | 'disable'
  | 'increase_by'
  | 'decrease_by';

/** How the target property responds. */
export type ResponseMode = 'direction' | 'multiplier_range' | 'fixed_value';

export interface SourceChange {
  operator: InfluenceOperator;
  /** Magnitude (for increase_by / decrease_by). */
  value?: number;
  /** Unit reference, e.g. "unit:K". */
  unit?: string;
}

export interface TargetResponse {
  mode: ResponseMode;
  /** For mode=direction. */
  direction?: 'increase' | 'decrease';
  /** For mode=multiplier_range. */
  min?: number;
  max?: number;
  /** For mode=fixed_value. */
  value?: number;
}

export interface KineticsRule {
  id: string;
  kind: KineticsRuleKind;
  category: string;
  domain: string;
  /** Reference to the empirical law this rule implements. */
  law_ref?: string;
  /** Source property reference, e.g. "prop:temperature". */
  source_property?: string;
  source_change?: SourceChange;
  /** Target property reference, e.g. "prop:reaction_rate". */
  target_property?: string;
  target_response?: TargetResponse;
  scope?: string;
  applicability?: string[];
  /** Rules that must be understood before this one. */
  depends_on?: string[];
  /** Locale overlay fields (merged at load time). */
  name?: string;
  short_statement?: string;
  explanation?: string;
}
