import type { ResolutionAttemptStatus, CertaintyLevel } from './resolution.js';

export type Intent = 'find' | 'check' | 'derive' | 'explain' | 'plan';

export type QualityRequirement =
  | 'with_uncertainty'
  | 'exact_only'
  | 'prefer_exact'
  | 'show_assumptions'
  | 'show_uncertainty';

export interface SolverPolicy {
  preferred_kinds?: string[];
  allow_numerical?: boolean;
  allow_optimization?: boolean;
  require_traceable_steps?: boolean;
  max_depth?: number;
}

export interface QueryMeta {
  origin: string;
  parent_query_id?: string;
  locale?: string;
}

export type EntityRef =
  | { kind: 'substance'; id: string }
  | { kind: 'element'; id: string }
  | { kind: 'ion'; id: string }
  | { kind: 'indicator'; id: string }
  | { kind: 'reaction'; id: string }
  | { kind: 'concept'; id: string };

export type Expr =
  | QueryExpr
  | CallExpr
  | EqualityExpr
  | ValueExpr
  | SymbolExpr
  | ListExpr
  | EventExpr
  | TimeExpr;

export interface QueryExpr {
  kind: 'query';
  id: string;
  intent: Intent;
  target: Expr;
  givens?: EqualityExpr[];
  constraints?: Expr[];
  quality?: QualityRequirement[];
  policy?: SolverPolicy;
  meta?: QueryMeta;
}

export interface CallExpr {
  kind: 'call';
  predicate: string;
  args: Expr[];
  namedArgs?: Record<string, Expr>;
}

export interface EqualityExpr {
  kind: 'eq';
  left: Expr;
  right: Expr;
}

export interface ValueExpr {
  kind: 'value';
  value: number | string | boolean;
  unit?: string;
  uncertainty?: number;
}

export interface SymbolExpr {
  kind: 'symbol';
  ref: EntityRef;
}

export interface ListExpr {
  kind: 'list';
  items: Expr[];
}

export interface EventExpr {
  kind: 'event';
  event_type: string;
  params?: Record<string, Expr>;
}

export interface TimeExpr {
  kind: 'time';
  base: EventExpr | TimeExpr | 'start';
  offset?: ValueExpr;
  relation: 'at' | 'after' | 'before';
}

export interface ResolvedInputs {
  target: Expr;
  bindings: Record<string, Expr>;
  prerequisite_results: Record<string, Expr>;
  givens?: EqualityExpr[];
}

export interface TraceNode {
  query_id: string;
  step_role: string;
  resolution_kind?: string;
  resolution_id?: string;
  inputs: ResolvedInputs;
  output: Expr;
  formula_rendered?: string;
  children: TraceNode[];
  status: ResolutionAttemptStatus;
  assumptions?: string[];
}

export interface ResolverResult {
  answer: Expr;
  trace: TraceNode;
  certainty?: CertaintyLevel;
  assumptions?: string[];
  error_sources?: string[];
}

export interface SuggestedGiven {
  predicate: string;
  pattern: string;
  suggestion_kind: 'likely_given' | 'usually_derived' | 'optional' | 'assumption_candidate';
  default_value?: Expr;
  unit?: string;
}
