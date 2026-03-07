export interface OxidationRule {
  id: string;
  order: number;
  name: string;
  rule: string;
  examples: string[];
}

export interface RedoxConcepts {
  oxidizer: string;
  reducer: string;
  mnemonic: string;
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
