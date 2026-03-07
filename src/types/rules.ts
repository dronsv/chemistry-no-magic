export interface ClassificationRule {
  id: string;
  class: string;
  subclass?: string;
  pattern: string;
  description: string;
  examples: string[];
}

export interface NamingRule {
  id: string;
  class: string;
  pattern: string;
  template: string;
  examples: Array<{ formula: string; name: string }>;
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
  name?: string;  // present only after locale overlay is applied
  position: number;
  reduces_H: boolean;
  /** Reacts with cold water to release H₂ (alkali and alkaline earth metals only). */
  reduces_H_from_water?: boolean;
  /** Can displace metals below it from aqueous salt solutions. False for alkali/alkaline earths (react with water first) and for H and below. */
  displacement_below?: boolean;
}

export interface ApplicabilityRule {
  id: string;
  type: string;
  rule_kind?: string;
  /** Locale overlay fields — present only when overlay loaded */
  pedagogical_note?: string | null;
}
