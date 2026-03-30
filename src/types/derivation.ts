import type { SemanticRole } from './formula';
import type { ComputableFormula } from './formula';
import type { ConstantsDict, IndexedBindings, EvalTrace } from './eval-trace';

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

// ── Operator type system ────────────────────────────────────────

/** Common fields for all operator kinds. */
interface OperatorBase {
  id: string;
  kind: string;
  targetQuantity: string;
  targetRole?: SemanticRole;
  baseCost?: number;
}

/**
 * Formula operator: algebraic computation from a ComputableFormula.
 * This is the original DerivationRule with a kind discriminant added.
 */
export interface FormulaOperator extends OperatorBase {
  kind: 'formula';
  formulaId: string;
  targetSymbol: string;
  inputs: DerivationRuleInput[];
  isInversion: boolean;
  isApproximate: boolean;
  needsIndexedBindings: boolean;
  indexSets?: string[];
}

/** Lookup operator: resolve a quantity by direct ontology lookup (leaf node). */
export interface LookupOperator extends OperatorBase {
  kind: 'lookup';
  lookupQuantity: string;
  systemType: string;                        // 'element'
}

/** Indexed aggregate operator: decompose + lookup + indexed formula evaluation. */
export interface IndexedAggregateOperator extends OperatorBase {
  kind: 'indexed_aggregate';
  formulaId: string;
  indexSet: string;                          // 'composition_elements'
  sourceSystemType: string;                  // 'substance'
}

/** Stoichiometric bridge operator: cross-role amount conversion via stoichiometric ratio. */
export interface StoichiometricBridgeOperator extends OperatorBase {
  kind: 'stoichiometric_bridge';
  formulaId: string;                            // 'formula:stoichiometry_ratio'
  fromRole: SemanticRole;
  toRole: SemanticRole;
}

/**
 * Table fact operator stub — resolves discrete facts from lookup tables
 * (solubility, activity series, etc.). Returns non-numeric values.
 *
 * Implementation deferred: discrete facts use a different evaluation model
 * than numeric derivation. The type is defined here for forward compatibility
 * so future handlers can be registered without type changes.
 */
export interface TableFactOperator extends OperatorBase {
  kind: 'table_fact';
  tableId: string;                            // e.g., 'solubility_table', 'activity_series'
  factType: string;                           // e.g., 'solubility', 'activity_rank'
}

/** Discriminated union of all operator kinds. */
export type DerivationOperator =
  | FormulaOperator
  | LookupOperator
  | IndexedAggregateOperator
  | StoichiometricBridgeOperator
  | TableFactOperator;

/**
 * Backward-compatible alias: DerivationRule = FormulaOperator.
 * Existing code that creates/consumes DerivationRule continues to work unchanged.
 */
export type DerivationRule = FormulaOperator;

// ── Operator handler protocol ───────────────────────────────────

/** Ontology access for operator handlers (re-exported from resolvers at runtime). */
export interface OntologyAccessForHandler {
  elements: unknown[];
  parseFormula: (ascii: string) => Record<string, number>;
  entityFormulas: Map<string, string>;
}

/** Execution environment passed to operator handlers. */
export interface ExecutionEnv {
  formulas: ComputableFormula[];
  constants: ConstantsDict;
  values: Record<string, number>;
  indexed?: IndexedBindings;
  ontology?: OntologyAccessForHandler;
}

/** Result returned by an operator handler's execute method. */
export interface OperatorResult {
  value: number;
  trace: EvalTrace;
  internalSteps?: ReasonStep[];              // for aggregate: decompose + lookup sub-steps
}

/** Handler protocol for a single operator kind (no switch blocks). */
export interface OperatorHandler {
  /** Does this operator match the given target? */
  matches(op: DerivationOperator, target: QRef): boolean;
  /** What sub-goals are needed? Empty = leaf node. */
  expand(op: DerivationOperator, target: QRef): QRef[];
  /** Execute this operator step. */
  execute(op: DerivationOperator, step: PlanStep, env: ExecutionEnv): OperatorResult;
}

// ── Plan types ──────────────────────────────────────────────────

/** A step in the derivation plan (before execution). */
export interface PlanStep {
  rule: DerivationOperator;
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

// ── Proof tree ─────────────────────────────────────────────────

/** A node in the proof tree — mirrors the AND/OR planner structure. */
export interface ProofNode {
  operator: DerivationOperator | null;   // null for given/leaf nodes
  target: QRef;
  value?: number;
  children: ProofNode[];                 // AND-children (all needed for this step)
  internalSteps?: ReasonStep[];          // sub-steps from aggregate/lookup execution
}

/** Complete proof tree with result. */
export interface ProofTree {
  root: ProofNode;
  result: number;
  isApproximate: boolean;
}

// ── Reasoning query ──────────────────────────────────────────

/** A participant in a reasoning query (e.g., acid solution, base solution). */
export interface QueryParticipant {
  role: string;                              // 'acid', 'base', 'reactant', 'product'
  entity: string;                            // ontology ref: 'sub:hcl', 'sub:naoh'
  given: Array<{ quantity: string; role?: SemanticRole; value: number }>;
}

/** A discrete fact to derive (non-numeric goal). */
export interface FactGoal {
  fact: string;                              // 'indicator_color', 'excess', 'medium'
  params?: Record<string, string>;           // e.g., { indicator: 'ind:litmus' }
}

/**
 * Ontologized reasoning query — structured problem description
 * that the derivation engine can solve via proof tree.
 */
export interface ReasoningQuery {
  system: {
    type: string;                            // 'mixing', 'reaction', 'single_substance'
    reaction?: string;                       // reaction ref: 'rx_neutral_01_hcl_naoh'
    participants: QueryParticipant[];
  };
  find: FactGoal | { quantity: string; role?: SemanticRole; entity?: string };
}

/** Result of solving a reasoning query. */
export interface ReasoningResult {
  answer: string | number;                   // 'color:red', 36, 'medium:acidic'
  intermediates: Record<string, number>;     // all derived quantities keyed by label
  steps: ReasonStep[];                       // flat trace
  proofTree?: ProofNode;                     // structured tree
}
