/** All entity kinds in the ontology */
export type OntRefKind =
  | 'element'
  | 'substance'
  | 'ion'
  | 'reaction'
  | 'substance_class'
  | 'element_group'
  | 'reaction_type'
  | 'process'
  | 'property'
  | 'context';

/** Typed entity reference */
export interface OntRef {
  kind: OntRefKind;
  id: string;
}

/** Concept kinds (subset of OntRefKind that has pages) */
export type ConceptKind =
  | 'substance_class'
  | 'element_group'
  | 'reaction_type'
  | 'process'
  | 'property';

/** A concept entry from data-src/concepts.json */
export interface ConceptEntry {
  kind: ConceptKind;
  parent_id: string | null;
  order: number;
  filters: Record<string, string | string[]>;
  examples: OntRef[];
  children_order?: string[];
}

/** Concept registry: conceptId -> ConceptEntry */
export type ConceptRegistry = Record<string, ConceptEntry>;

/** Grammatical forms map (e.g. gen_pl -> "щелочных металлов") */
export type GramForms = Record<string, string>;

/** Per-concept locale overlay entry */
export interface ConceptOverlayEntry {
  name: string;
  slug: string;
  surface_forms?: string[];
  forms?: GramForms;
}

/** Full locale overlay for concepts */
export type ConceptOverlay = Record<string, ConceptOverlayEntry>;

/** Concept lookup: surface form -> concept ID (for text auto-detection) */
export type ConceptLookup = Record<string, string>;

// -- RichText AST --

export type TextSeg =
  | { t: 'text'; v: string }
  | { t: 'ref'; id: string; form?: string; surface?: string }
  | { t: 'formula'; kind: 'substance' | 'ion' | 'element'; id?: string; formula: string }
  | { t: 'br' }
  | { t: 'em'; children: RichText }
  | { t: 'strong'; children: RichText };

export type RichText = TextSeg[];
