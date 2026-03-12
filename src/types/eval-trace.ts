/** Symbol → numeric value mapping for formula evaluation. */
export type Bindings = Record<string, number>;

/**
 * For `sum` ops: maps index_set name → array of per-item bindings.
 * E.g. { composition_elements: [{ Ar_i: 23, count_i: 1 }, { Ar_i: 35.5, count_i: 1 }] }
 */
export type IndexedBindings = Record<string, Bindings[]>;

/** Physical constants dict: const ID (e.g. "const:N_A") → numeric value. */
export type ConstantsDict = Record<string, number>;

/** One step in the evaluation trace. */
export interface EvalStep {
  /** Human-readable expression description, e.g. "m / M" or "Σ(Ar_i × count_i)" */
  expr: string;
  /** Computed numeric value at this step */
  value: number;
  /** Optional: which bindings were substituted at this step */
  substitutions?: Record<string, number>;
}

/** Complete evaluation trace for a formula computation. */
export interface EvalTrace {
  formulaId: string;
  solvedFor: string;
  steps: EvalStep[];
  result: number;
  /** True when the formula is an approximate proxy, not an exact physical law. */
  is_approximate?: boolean;
  /** What physical quantity this proxy approximates (ref to q:*). */
  proxy_for?: string;
  /** Known limitations of the approximate model. */
  limitations?: string[];
}
