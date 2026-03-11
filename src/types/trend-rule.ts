export interface ApplicabilityContext {
  scope: string;
  same: 'period' | 'group';
  exclude?: string[];
}

export interface ReasoningStep {
  step: number;
  relation: string;        // ref to qrel:*
  conclusion: string;      // machine-readable conclusion key
}

export interface TrendRule {
  id: string;              // namespace trend:
  kind: 'trend_rule';
  property: string;
  direction: 'increases' | 'decreases';
  context: 'across_period' | 'down_group';
  applicability: ApplicabilityContext;
  reasoning_chain: ReasoningStep[];
  exception_rule_ids: string[];   // ref to exc:* in periodic_trend_anomalies
  // Overlay fields
  school_note?: string;
}
