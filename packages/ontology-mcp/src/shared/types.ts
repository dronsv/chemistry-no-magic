/**
 * OntRefKind — all entity kinds recognized by the ontology MCP server.
 * Aligns with src/types/ontology-ref.ts in the main project, plus
 * 'formula' for mathematical/chemical formula definitions and
 * 'concept' as a catch-all fallback for unrecognised prefixes.
 */
export type OntRefKind =
  | 'element'
  | 'substance'
  | 'ion'
  | 'substance_class'
  | 'element_group'
  | 'reaction_type'
  | 'reaction_facet'
  | 'domain_concept'
  | 'process'
  | 'property'
  | 'formula'
  | 'concept';   // fallback for unrecognised prefix

export interface OntologyEntity {
  ref: string;
  kind: OntRefKind;
  labels: Record<string, string>;       // locale → display name
  aliases: Record<string, string[]>;    // locale → alias list
  description?: Record<string, string>; // locale → description
  formula?: string;                     // for substances/ions/elements
  symbol?: string;                      // for elements
  parent_ref?: string;                  // for hierarchical concepts
  related_refs?: string[];              // related concepts
  tags?: string[];                      // free-form tags from source data
}

export interface SearchCandidate {
  ref: string;
  kind: OntRefKind;
  label: string;
  score: number;
  matchReason: string;
}

export interface OntologyIndex {
  entitiesByRef: Map<string, OntologyEntity>;
  aliasIndex: Map<string, string[]>;   // normalized text → refs
  formulaIndex: Map<string, string>;   // formula → ref
  symbolIndex: Map<string, string>;    // element symbol → ref
}
