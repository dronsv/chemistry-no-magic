export interface ChainStep {
  substance: string;
  reagent: string;
  next: string;
  type: string;
}

export interface GeneticChain {
  chain_id: string;
  title: string;
  class_sequence: string[];
  steps: ChainStep[];
}
