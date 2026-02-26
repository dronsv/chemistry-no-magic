export type MatterRef =
  | { kind: 'substance'; id: string }
  | { kind: 'context'; id: string }
  | { kind: 'context_template'; id: string }
  | { kind: 'substance_variant'; id: string };

export type EntityRef =
  | MatterRef
  | { kind: 'element'; id: string }
  | { kind: 'ion'; id: string };

export interface ChemContext {
  id: string;
  type: 'phase_form' | 'mixture' | 'melt' | 'solution_template';
  spec: Record<string, unknown>;
  canonical_key: string;
  tags: string[];
}

export interface SubstanceVariant {
  id: string;
  type: 'substance_variant';
  base: MatterRef;
  variant_type: string;
  formula: string;
  canonical_key: string;
  tags: string[];
}

export interface ChemTerm {
  id: string;
  kind: string;
  name_ru: string;
  synonyms_ru?: string[];
}

export interface TermBinding {
  term_id: string;
  ref: MatterRef;
}

export interface ContextsData {
  contexts: ChemContext[];
  variants: SubstanceVariant[];
  terms: ChemTerm[];
  bindings: TermBinding[];
  reverse_index: Record<string, string[]>;
}
