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

export interface Relation {
  subject: string;
  predicate: string;
  object: string;
  step?: number;
  solubility?: string;
  knowledge_level?: string;
  source_kind?: string;
  condition?: string;
}

export interface RelationsIndex {
  bySubject: Map<string, Relation[]>;
  byObject: Map<string, Relation[]>;
  byPredicate: Map<string, Relation[]>;
}

export interface OntologyIndex {
  entitiesByRef: Map<string, OntologyEntity>;
  aliasIndex: Map<string, string[]>;   // normalized text → refs
  formulaIndex: Map<string, string>;   // formula → ref
  symbolIndex: Map<string, string>;    // element symbol → ref
  relations: RelationsIndex;
}

export interface IndexRef {
  current: OntologyIndex;
}

export type AdditionType =
  | 'alias_addition'
  | 'overlay_addition'
  | 'relation_addition'
  | 'entity_extension'
  | 'new_core_entity';

export interface AdmissionChecks {
  is_alias_only: boolean;
  is_overlay_only: boolean;
  is_reusable: boolean;
  is_language_independent: boolean;
  is_non_redundant: boolean;
  has_structural_value: boolean;
}

export interface ProposalDraft {
  proposal_id: string;
  proposal_type: AdditionType;
  candidate_text: string;
  language: string;
  target_ref?: string;
  proposed_ref?: string;
  proposed_label?: string;
  rationale: string;
  evidence_spans: Array<{ source_doc_id?: string; text: string; start?: number; end?: number }>;
  nearest_existing_refs: Array<{ ref: string; reason: string; score: number }>;
  admission_checks: AdmissionChecks;
  status: 'draft' | 'review' | 'accepted' | 'rejected';
}

export interface Annotation {
  text: string;
  start: number;
  end: number;
  kind: OntRefKind | string;
  chosen_ref?: string;
  confidence?: number;
  candidates: SearchCandidate[];
}

export interface UnresolvedMention {
  text: string;
  start: number;
  end: number;
  reason: string;
}

export interface AnnotationResult {
  doc_id: string;
  material_language: string;
  annotations: Annotation[];
  unresolved_mentions: UnresolvedMention[];
  valid: boolean;
  errors: string[];
  warnings: string[];
}
