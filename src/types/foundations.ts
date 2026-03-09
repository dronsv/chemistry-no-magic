/** G.1 Physical Foundations Pilot — locale-neutral catalog types */

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
}
