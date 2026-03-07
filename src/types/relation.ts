/** A single knowledge graph triple. */
export interface Relation {
  /** Subject entity ID (e.g. "ion:SO4_2minus", "sub:h2so4", "el:H"). */
  subject: string;
  /** Relation predicate (e.g. "has_conjugate_base", "forms_salt_with", "has_naming_rule"). */
  predicate: string;
  /** Object entity ID or value (e.g. "ion:HSO4_minus", "binary_ide"). */
  object: string;
  /** Step index for multi-step chains (e.g. proton dissociation steps). */
  step?: number;
}

export type RelationGraph = Relation[];
