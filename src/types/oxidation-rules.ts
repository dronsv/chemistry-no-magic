export type OxRuleKind = 'assignment' | 'default' | 'exception' | 'constraint';

export interface OxRule {
  id: string;
  kind: OxRuleKind;
  title_ru: string;
  description_ru: string;
  examples?: string[];
}

export interface OxRulesData {
  ruleset_id: string;
  rules: OxRule[];
}
