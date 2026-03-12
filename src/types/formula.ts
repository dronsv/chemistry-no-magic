/** A node in a formula expression tree. */
export type ExprNode =
  | { op: 'add' | 'subtract' | 'multiply' | 'divide'; operands: (string | number | ExprNode)[] }
  | { op: 'power'; operands: [string | number | ExprNode, string | number | ExprNode] }
  | { op: 'exp'; operand: string | number | ExprNode }
  | { op: 'sum'; over: string; index_set: string; term: ExprNode }
  | { op: 'literal'; value: number }
  | { op: 'const'; ref: string };

export interface Variable {
  symbol: string;
  quantity: string;        // ref to q:* in quantities_units_ontology
  unit: string;            // ref to unit:*
  role: 'result' | 'input' | 'constant' | 'index';
}

/** Approximation metadata for formulas that compute proxy/heuristic values. */
export interface FormulaApproximation {
  kind: 'exact' | 'approximate';
  /** What physical quantity this proxy approximates (ref to q:*). */
  proxy_for?: string;
  /** Known limitations of the approximate model. */
  limitations?: string[];
  /** Locale key for a short usage note shown to students. */
  usage_note?: string;
}

export interface ComputableFormula {
  id: string;              // namespace formula:
  kind: 'definition' | 'law';
  domain: string;          // stoichiometry | solutions | thermochemistry | atomic_structure | gas_laws | kinetics
  school_grade: number[];
  variables: Variable[];
  expression: ExprNode;
  result_variable: string;
  invertible_for: string[];
  inversions: Record<string, ExprNode>;
  constants_used: string[];          // ref to const:*
  prerequisite_formulas: string[];   // ref to formula:*
  used_by_solvers: string[];         // for migration tracking
  /** If absent, formula is exact. Present with kind='approximate' for proxy formulas. */
  approximation?: FormulaApproximation;
}

export interface PhysicalConstant {
  id: string;              // namespace const:
  symbol: string;
  value: number;
  unit: string;            // ref to unit:*
  quantity?: string;       // optional ref to q:*
  condition_key?: string;  // ref to locale label for condition (e.g. STP)
  labels_key: string;      // ref to locale label for name
  // Overlay fields
  name?: string;
  condition?: string;
}
