/** G.1 Physical Foundations Pilot — locale-neutral catalog types + overlay fields */

export interface PhysicalIndices {
  /** concept_id → bridge_ids that require it */
  concept_to_bridges: Record<string, string[]>;
  /** mechanism_id → bridge_ids that contain it */
  mechanism_to_bridges: Record<string, string[]>;
  /** bridge_id → page slugs where it's wired */
  bridge_to_pages: Record<string, string[]>;
  /** bridge_id → mechanism_ids in causal order */
  mechanism_order: Record<string, string[]>;
}


export interface PhysicalConcept {
  id: string;
  kind: 'physical_concept';
  quantity: string;
  unit: string | null;
  si_unit?: string;
  scale?: 'intensive' | 'extensive';
  observable?: string;
  forms?: string[];
  distribution?: string;
  discreteness?: string;
  related_concepts?: string[];
  // Overlay fields (populated by loadPhysicalConcepts(locale))
  name?: string;
  summary?: string;
  intuition?: string;
}

export interface MathConcept {
  id: string;
  kind: 'math_concept';
  operation?: string;
  relation?: string;
  input_type?: string;
  output_type?: string;
  parameter?: string;
  parameter_role?: string;
  axes?: string[];
  curve_types?: string[];
  monotone?: boolean;
  related_concepts?: string[];
  // Overlay fields
  name?: string;
  summary?: string;
}

export interface Mechanism {
  id: string;
  kind: 'mechanism';
  cause: string;
  effect: string;
  direction: 'positive' | 'negative' | 'discrete';
  physics_concepts: string[];
  math_concepts: string[];
  activation_condition?: string;
  stabilization_family?: string;
  applies_to: string[];
  depends_on?: string[];
  grounded_in_relation?: string; // ref to qrel:* or formula:*
  // Overlay fields
  name?: string;
  school?: string;
}

export interface BridgeExplanation {
  id: string;
  kind: 'bridge_explanation';
  chemistry_phenomenon: string;
  mechanism_ids: string[];
  target_rule_ids: string[];
  school_grade_range: [number, number];
  prerequisite_concepts: string[];
  exception_element_ids?: string[];
  page_slugs?: string[];
  // Overlay fields
  title?: string;
  hint?: string;
  school_explanation?: string;
}
