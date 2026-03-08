export type OxRuleKind = 'assignment' | 'default' | 'exception' | 'constraint';

export interface OxRule {
  id: string;
  kind: OxRuleKind;
  title: string;
  description: string;
  examples?: string[];
}

export interface OxRulesData {
  ruleset_id: string;
  rules: OxRule[];
}
