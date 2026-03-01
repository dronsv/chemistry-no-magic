import type { RichText } from './ontology-ref';

export type TheoryBlock =
  | { t: 'concept_card'; conceptId: string; reactivity_rules?: RichText;
      examples: { mode: 'filter'; limit?: number } }
  | { t: 'text_block'; content: RichText };

export interface TheorySection {
  id: string;
  title_ref: string;
  blocks: TheoryBlock[];
}

export interface TheoryModule {
  id: string;
  kind: 'theory_module';
  applies_to: string[];
  sections: TheorySection[];
}

export interface Course {
  id: string;
  title_ru: string;
  modules: string[];
}
