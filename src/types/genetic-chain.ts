export interface ChainStep {
  substance: string;
  reagent: string;
  next: string;
  type: string;
}

export interface GeneticChain {
  chain_id: string;
  title_ru: string;
  class_sequence: string[];
  steps: ChainStep[];
}
