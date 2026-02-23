export interface SuffixRule {
  id: string;
  condition: string;
  prefix_ru?: string;
  prefix_en?: string;
  suffix_ru: string;
  suffix_en: string;
  description_ru: string;
  examples: string[];
}

export interface AcidAnionPair {
  acid: string;
  anion_id: string;
  acid_name_ru: string;
}

export interface MultilingualComparison {
  description_ru: string;
  columns: string[];
  binary: string[];
  oxy_max: string[];
  oxy_lower: string[];
}

export interface IonNomenclatureRules {
  suffix_rules: SuffixRule[];
  multilingual_comparison: MultilingualComparison;
  mnemonic_ru: string;
  acid_to_anion_pairs: AcidAnionPair[];
}
