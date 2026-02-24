export interface OxidationRule {
  id: string;
  order: number;
  name_ru: string;
  rule_ru: string;
  examples: string[];
}

export interface RedoxConcepts {
  oxidizer_ru: string;
  reducer_ru: string;
  mnemonic_ru: string;
}

export interface OxidationTheory {
  rules: OxidationRule[];
  redox_concepts: RedoxConcepts;
}

export interface OxidationExample {
  formula: string;
  target_element: string;
  oxidation_state: number;
  difficulty: 'easy' | 'medium' | 'hard';
}
