import type { RichText } from './ontology-ref';

// ---------------------------------------------------------------------------
// Semantic didactic blocks (locale-free educational intent)
// ---------------------------------------------------------------------------

/** Threshold/criterion for a bond type rule */
export interface SemanticCriterion {
  property_ref: string;
  comparator: 'gte' | 'lt' | 'lte' | 'between' | 'eq';
  value?: number;
  range?: [number, number];
  participant_refs: string[];
}

export interface SemanticBondRuleCard {
  id: string;
  kind: 'bond_rule_card';
  concept_ref: string;
  criterion: SemanticCriterion;
  mechanism_ref: string;
  result_refs: string[];
  lattice_ref?: string;
}

/** A column in a comparison table. Can be a plain key or an ontology ref. */
export interface ComparisonColumn {
  key: string;
  /** Ontology ref for the column header (renders as clickable OntRef chip). */
  ref?: string;
}

export interface SemanticComparisonTable {
  id: string;
  kind: 'comparison_table';
  row_refs: string[];
  columns: ComparisonColumn[];
}

export type SemanticBlock =
  | SemanticBondRuleCard
  | SemanticComparisonTable;

export interface SemanticSection {
  id: string;
  title_template?: string;
  blocks: SemanticBlock[];
}

export interface SemanticDidacticModule {
  id: string;
  kind: 'semantic_didactic';
  sections: SemanticSection[];
}

// ---------------------------------------------------------------------------
// Language templates (per-locale sentence patterns)
// ---------------------------------------------------------------------------

/**
 * Per-locale didactic template pack.
 * Keys are template IDs (e.g. "ionic.rule", "bond_mechanism.two_participants").
 * Values use the same format as engine PromptTemplate:
 *   - `question`: pattern string with {slot} and {ref:id|case} placeholders
 *   - `slots`: optional directive map for slot resolution
 */
export interface DidacticTemplate {
  question: string;
  slots?: Record<string, string | Record<string, string>>;
}

export type DidacticTemplatePack = Record<string, DidacticTemplate>;

// ---------------------------------------------------------------------------
// Didactic overrides (optional per-locale handcrafted RichText)
// Reuses DidacticModule/DidacticBlockOverlay from theory-module.ts
// ---------------------------------------------------------------------------
