export type OntRefKind =
  | 'element'
  | 'substance'
  | 'ion'
  | 'reaction'
  | 'substance_class'
  | 'element_group'
  | 'reaction_type'
  | 'reaction_family'
  | 'concept';

export interface SearchCandidate {
  ref: string;
  kind: OntRefKind | string;
  score: number;
  matchReason: string;
}

export interface Annotation {
  text: string;
  start: number;
  end: number;
  kind: OntRefKind | string;
  chosenRef?: string;
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
  docId: string;
  materialLanguage: string;
  annotations: Annotation[];
  unresolvedMentions: UnresolvedMention[];
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

export type AdditionType =
  | 'alias_addition'
  | 'overlay_addition'
  | 'relation_addition'
  | 'entity_extension'
  | 'new_core_entity';
