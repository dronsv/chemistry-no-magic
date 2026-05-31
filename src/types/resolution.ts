export type ProblemKind =
  | 'equation'
  | 'rule'
  | 'lookup'
  | 'constraint_satisfaction'
  | 'optimization'
  | 'enumeration'
  | 'numerical'
  | 'simulation';

export interface ResolutionDef {
  id: string;
  family?: string;
  origin: 'generated_from_formula' | 'generated_from_property' | 'manual';
  origin_ref?: string;

  target: string;
  target_pattern: string;

  kind: ProblemKind;

  prerequisites: string[];
  solver_id?: string;

  formula_id?: string;
  solve_for?: string;
  compute_expr_serialized?: string;

  applicability?: string[];
  preconditions?: string[];

  cost: number;
  uncertainty_mode: 'exact' | 'propagate' | 'model_limited';
  approximation_kind?: 'exact' | 'school_simplification' | 'empirical' | 'idealized_model';

  result_shape?: 'scalar' | 'categorical' | 'set' | 'object' | 'candidate_set' | 'interval';
  explanation_template?: string;
}

export type ResolutionAttemptStatus =
  | 'success'
  | 'not_applicable'
  | 'precondition_failed'
  | 'subquery_failed'
  | 'handler_failed'
  | 'not_implemented';

export type CertaintyLevel =
  | 'exact'
  | 'derived_exact_under_model'
  | 'approximate'
  | 'measurement_limited'
  | 'model_limited'
  | 'qualitative_only';
