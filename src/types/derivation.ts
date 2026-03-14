import type { SemanticRole } from './formula';

/** Context binding for ontology-aware quantity references. */
export interface BoundContext {
  system_type: string;                       // 'substance' | 'element' | 'substance_component'
  entity_ref?: string;                       // 'substance:H2SO4' | 'element:O'
  parent_ref?: string;                       // component's parent: 'substance:CO2'
  bindings?: Record<string, string>;         // e.g., { component: 'element:O' }
}

/**
 * Qualified quantity reference with explicit semantic role.
 *
 * Identity model:
 * - `role` = domain semantic identity (actual, theoretical, solute...). Affects derivation matching.
 * - `phase` = procedural status (given, find, intermediate). Does NOT affect derivation identity.
 *   Used only by UI/task-state layer, excluded from planner keys.
 * - `context` = ontology binding (substance, element). Affects derivation identity when present.
 */
export interface QRef {
  quantity: string;                          // e.g., 'q:mass'
  role?: SemanticRole;                       // e.g., 'actual', 'solute'
  phase?: 'given' | 'find' | 'intermediate'; // procedural only, NOT part of derivation identity
  context?: BoundContext;                    // ontology binding
}

/** Input descriptor for a derivation rule. */
export interface DerivationRuleInput {
  symbol: string;
  quantity: string;
  role?: SemanticRole;
}

/**
 * One way to compute a target variable. Built from ComputableFormula.
 *
 * baseCost governance: only for pedagogical preference that cannot be
 * expressed through standard scoring. Default 0. Not a substitute for
 * broken identity or modeling.
 */
export interface DerivationRule {
  id: string;                                // e.g., 'formula:amount_from_mass/forward'
  formulaId: string;
  targetSymbol: string;
  targetQuantity: string;
  targetRole?: SemanticRole;
  inputs: DerivationRuleInput[];
  isInversion: boolean;
  isApproximate: boolean;
  needsIndexedBindings: boolean;
  indexSets?: string[];
  baseCost?: number;
}

/** A step in the derivation plan (before execution). */
export interface PlanStep {
  rule: DerivationRule;
  target: QRef;
  inputRefs: Record<string, QRef>;           // symbol → resolved QRef
  inputSources: Record<string, 'known' | string>;  // symbol → 'known' | ruleId
}

/** Complete plan with score. */
export interface DerivationPlan {
  target: QRef;
  steps: PlanStep[];
  score: number;
}

/** Structured reason trace — no baked text, structured data only. */
export type ReasonStep =
  | { type: 'given'; qref: QRef; value: number }
  | { type: 'lookup'; qref: QRef; value: number; source: string }
  | { type: 'decompose'; sourceRef: string; components: Array<{ element: string; count: number }> }
  | { type: 'formula_select'; formulaId: string; target: QRef }
  | { type: 'substitution'; formulaId: string; bindings: Record<string, number> }
  | { type: 'compute'; formulaId: string; result: number; approximate?: boolean }
  | { type: 'conclusion'; target: QRef; value: number };

export interface ReasonTrace {
  target: QRef;
  steps: ReasonStep[];
  result: number;
  isApproximate: boolean;
}
