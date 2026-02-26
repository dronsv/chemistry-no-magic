export interface ClassificationRule {
  id: string;
  class: string;
  subclass?: string;
  pattern: string;
  description_ru: string;
  examples: string[];
}

export interface NamingRule {
  id: string;
  class: string;
  pattern: string;
  template_ru: string;
  examples: Array<{ formula: string; name_ru: string }>;
}

export interface SolubilityEntry {
  cation: string;
  anion: string;
  solubility: 'soluble' | 'insoluble' | 'slightly_soluble' | 'decomposes';
}

export type SolubilityState = 'soluble' | 'insoluble' | 'slightly_soluble' | 'decomposes';

export interface SolubilityRuleException {
  cations: string[];
  solubility: SolubilityState;
}

export interface SolubilityRule {
  id: string;
  anions: string[] | null;
  cations: string[] | null;
  expected: SolubilityState;
  exceptions: SolubilityRuleException[];
}

export interface SolubilityRulesFull {
  cation_order: string[];
  anion_order: string[];
  pairs: SolubilityEntry[];
  rules: SolubilityRule[];
}

export interface ActivitySeriesEntry {
  symbol: string;
  name_ru: string;
  position: number;
  reduces_H: boolean;
}

export interface ApplicabilityRule {
  id: string;
  type: string;
  condition_ru: string;
  description_ru: string;
}
