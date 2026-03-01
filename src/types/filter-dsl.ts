/** Atomic predicate — tests a single field of an entity */
export interface FilterPred {
  field: string;
  eq?: string | number | boolean;
  in?: (string | number)[];
  /** For array fields — checks if array contains this value */
  has?: string;
  gt?: number;
  lt?: number;
}

/** Filter expression node */
export type FilterExpr =
  | { all: FilterExpr[] }
  | { any: FilterExpr[] }
  | { not: FilterExpr }
  | { pred: FilterPred }
  | { concept: string };

/** Root filter — a FilterExpr (wraps in `all` implicitly if bare predicates) */
export type ConceptFilter = FilterExpr;
