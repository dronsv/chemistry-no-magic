export interface SuffixRule {
  id: string;
  condition: string;
  prefix?: string;
  suffix: string;
  description: string;
  examples: string[];
}

export interface AcidAnionPair {
  acid: string;
  anion_id: string;
  acid_name: string;
}

export interface MultilingualComparison {
  description: string;
  columns: string[];
  binary: string[];
  oxy_max: string[];
  oxy_lower: string[];
}

export interface IonNomenclatureRules {
  suffix_rules: SuffixRule[];
  multilingual_comparison: MultilingualComparison;
  mnemonic: string;
  acid_to_anion_pairs: AcidAnionPair[];
}
