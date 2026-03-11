/** A node in a formula expression tree. */
export type ExprNode =
  | { op: 'add' | 'subtract' | 'multiply' | 'divide'; operands: (string | number | ExprNode)[] }
  | { op: 'power'; operands: [string | ExprNode, number] }
  | { op: 'sum'; over: string; index_set: string; term: ExprNode }
  | { op: 'literal'; value: number }
  | { op: 'const'; ref: string };

export interface Variable {
  symbol: string;
  quantity: string;        // ref to q:* in quantities_units_ontology
  unit: string;            // ref to unit:*
  role: 'result' | 'input' | 'constant' | 'index';
}

export interface ComputableFormula {
  id: string;              // namespace formula:
  kind: 'definition' | 'law';
  domain: string;          // stoichiometry | solutions | thermochemistry | atomic_structure | gas_laws
  school_grade: number[];
  variables: Variable[];
  expression: ExprNode;
  result_variable: string;
  invertible_for: string[];
  inversions: Record<string, ExprNode>;
  constants_used: string[];          // ref to const:*
  prerequisite_formulas: string[];   // ref to formula:*
  used_by_solvers: string[];         // for migration tracking
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
