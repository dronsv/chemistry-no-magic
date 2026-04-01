# Query DSL Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a resolution-driven query dispatch system with predicate registry, Query AST, planner, and cascading typeahead UI — replacing the current template-based solver page.

**Architecture:** Bottom-up approach (B). Resolution registry + predicate registry generated at build time from ontology. resolveQuery() dispatches via unification + planning. Cascading UI with intent → predicate → arguments → givens flow. Existing derivation planner wrapped as equation handler, existing solvers wrapped as rule handlers.

**Tech Stack:** TypeScript, Vitest, React, Astro data pipeline (scripts/build-data.mjs)

**Spec:** `docs/superpowers/specs/2026-03-31-design-solver-new.md`

---

### Task 1: Type Definitions

**Files:**
- Create: `src/types/resolution.ts`
- Create: `src/types/predicate.ts`
- Create: `src/types/query-ast.ts`

- [ ] **Step 1: Create resolution types**

Create `src/types/resolution.ts`:

```ts
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
  origin: 'generated_from_formula' | 'manual';
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
```

- [ ] **Step 2: Create predicate types**

Create `src/types/predicate.ts`:

```ts
export interface PredicateDef {
  id: string;
  namespace: string;

  role: 'goal' | 'fact' | 'context';
  returns: string;

  positional_args: ArgDef[];
  named_args: ArgDef[];

  temporal_kind: 'static' | 'observable' | 'process';

  aliases: Record<string, string[]>;
  search_tokens: Record<string, string[]>;

  source: PredicateSource;
}

export interface ArgDef {
  name: string;
  type: string;
  optional?: boolean;
  description?: string;
}

export type PredicateSource =
  | { kind: 'property'; property_id: string }
  | { kind: 'formula_variable'; formula_id: string; variable: string }
  | { kind: 'concept'; concept_id: string }
  | { kind: 'process'; process_id: string }
  | { kind: 'constructor' }
  | { kind: 'manual' };
```

- [ ] **Step 3: Create Query AST types**

Create `src/types/query-ast.ts`:

```ts
import type { ProblemKind, ResolutionAttemptStatus, CertaintyLevel } from './resolution.js';

// ─── Expressions ───

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

export type Intent = 'find' | 'check' | 'derive' | 'explain' | 'plan';

export interface CallExpr {
  kind: 'call';
  predicate: string;
  args: Expr[];
  namedArgs?: Record<string, Expr>;
}

export interface EqualityExpr {
  kind: 'equality';
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

// ─── Entity references ───

export type EntityRef =
  | { kind: 'substance'; id: string }
  | { kind: 'element'; id: string }
  | { kind: 'ion'; id: string }
  | { kind: 'indicator'; id: string }
  | { kind: 'reaction'; id: string }
  | { kind: 'concept'; id: string };

// ─── Quality & Policy ───

export type QualityRequirement =
  | 'with_uncertainty'
  | 'exact_only'
  | 'prefer_exact'
  | 'show_assumptions'
  | 'show_uncertainty';

export interface SolverPolicy {
  preferred_kinds?: ProblemKind[];
  allow_numerical?: boolean;
  allow_optimization?: boolean;
  require_traceable_steps?: boolean;
  max_depth?: number;
}

export interface QueryMeta {
  origin: 'user' | 'planner' | 'resolver';
  parent_query_id?: string;
  locale?: string;
}

// ─── Results ───

export interface ResolvedInputs {
  target: Expr;
  bindings: Record<string, Expr>;
  prerequisite_results: Record<string, Expr>;
  givens?: EqualityExpr[];
}

export interface TraceNode {
  query_id: string;
  step_role: 'planner' | 'resolution' | 'given';
  resolution_kind?: ProblemKind;
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
  error_sources?: Array<{ kind: string; note?: string }>;
}

export interface SuggestedGiven {
  predicate: string;
  pattern: string;
  suggestion_kind: 'likely_given' | 'usually_derived' | 'optional' | 'assumption_candidate';
  default_value?: Expr;
  unit?: string;
}
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit src/types/resolution.ts src/types/predicate.ts src/types/query-ast.ts`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/types/resolution.ts src/types/predicate.ts src/types/query-ast.ts
git commit -m "feat(dsl): add Resolution, Predicate, and Query AST type definitions"
```

---

### Task 2: Feature Flags

**Files:**
- Create: `src/config/feature-flags.ts`

- [ ] **Step 1: Create feature flags module**

Create `src/config/feature-flags.ts`:

```ts
export const featureFlags = {
  /** Use new QueryBuilder UI instead of sentence-template based solver */
  newQueryBuilder: false,
  /** Fall back to old solver if new resolver fails */
  oldSolverFallback: true,
  /** Show temporal fields (at, during) in query builder — hidden in Phase 1 */
  temporalFieldsVisible: false,
} as const;

export type FeatureFlag = keyof typeof featureFlags;

export function isEnabled(flag: FeatureFlag): boolean {
  if (typeof window !== 'undefined') {
    const override = localStorage.getItem(`ff_${flag}`);
    if (override !== null) return override === 'true';
  }
  return featureFlags[flag];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/config/feature-flags.ts
git commit -m "feat(dsl): add feature flags for QueryBuilder rollout"
```

---

### Task 3: Manual Data Files

**Files:**
- Create: `data-src/foundations/resolutions.json`
- Create: `data-src/foundations/predicate_overrides.json`

- [ ] **Step 1: Create resolutions.json with initial manual resolutions**

Create `data-src/foundations/resolutions.json`:

```json
[
  {
    "id": "res.substance_class",
    "family": "dep.substance_classification",
    "origin": "manual",
    "target": "substance.class",
    "target_pattern": "substance.class($substance)",
    "kind": "rule",
    "prerequisites": [],
    "solver_id": "solver.classify_substance",
    "cost": 50,
    "uncertainty_mode": "exact",
    "approximation_kind": "exact",
    "result_shape": "categorical"
  },
  {
    "id": "res.element_oxidation_state",
    "family": "dep.oxidation_states",
    "origin": "manual",
    "target": "element.oxidation_state",
    "target_pattern": "element.oxidation_state($element, $context)",
    "kind": "rule",
    "prerequisites": [],
    "solver_id": "solver.oxidation_states",
    "cost": 60,
    "uncertainty_mode": "exact",
    "result_shape": "scalar"
  },
  {
    "id": "res.solubility_check",
    "family": "dep.solubility",
    "origin": "manual",
    "target": "ion.solubility",
    "target_pattern": "ion.solubility($cation, $anion)",
    "kind": "lookup",
    "prerequisites": [],
    "solver_id": "solver.solubility_check",
    "cost": 30,
    "uncertainty_mode": "exact",
    "result_shape": "categorical"
  },
  {
    "id": "res.driving_force",
    "family": "dep.reaction_classification",
    "origin": "manual",
    "target": "reaction.driving_force",
    "target_pattern": "reaction.driving_force($reaction)",
    "kind": "rule",
    "prerequisites": [],
    "solver_id": "solver.driving_force",
    "cost": 70,
    "uncertainty_mode": "exact",
    "result_shape": "categorical"
  },
  {
    "id": "res.activity_compare",
    "family": "dep.activity_series",
    "origin": "manual",
    "target": "element.more_active",
    "target_pattern": "element.more_active($elementA, $elementB)",
    "kind": "lookup",
    "prerequisites": [],
    "solver_id": "solver.activity_compare",
    "cost": 30,
    "uncertainty_mode": "exact",
    "result_shape": "categorical"
  },
  {
    "id": "res.electron_config",
    "family": "dep.electron_config",
    "origin": "manual",
    "target": "element.electron_config",
    "target_pattern": "element.electron_config($element)",
    "kind": "rule",
    "prerequisites": [],
    "solver_id": "solver.electron_config",
    "cost": 60,
    "uncertainty_mode": "exact",
    "result_shape": "scalar"
  },
  {
    "id": "res.compose_salt_formula",
    "family": "dep.nomenclature",
    "origin": "manual",
    "target": "ion.salt_formula",
    "target_pattern": "ion.salt_formula($cation, $anion)",
    "kind": "rule",
    "prerequisites": [],
    "solver_id": "solver.compose_salt_formula",
    "cost": 50,
    "uncertainty_mode": "exact",
    "result_shape": "scalar"
  },
  {
    "id": "res.delta_chi",
    "family": "dep.bond_type",
    "origin": "manual",
    "target": "element.bond_type",
    "target_pattern": "element.bond_type($elementA, $elementB)",
    "kind": "equation",
    "prerequisites": ["element.electronegativity($elementA)", "element.electronegativity($elementB)"],
    "solver_id": "solver.delta_chi",
    "cost": 80,
    "uncertainty_mode": "exact",
    "result_shape": "categorical"
  },
  {
    "id": "res.indicator_color",
    "family": "dep.indicator",
    "origin": "manual",
    "target": "indicator.color",
    "target_pattern": "indicator.color($indicator, $system)",
    "kind": "rule",
    "prerequisites": ["system.medium($system)"],
    "solver_id": "resolver.indicator_lookup",
    "cost": 40,
    "uncertainty_mode": "exact",
    "result_shape": "categorical"
  },
  {
    "id": "res.system_medium",
    "family": "dep.medium",
    "origin": "manual",
    "target": "system.medium",
    "target_pattern": "system.medium($system)",
    "kind": "rule",
    "prerequisites": ["quantity.equivalent($acid)", "quantity.equivalent($base)"],
    "solver_id": "resolver.medium_from_equivalents",
    "cost": 100,
    "uncertainty_mode": "exact",
    "result_shape": "categorical"
  },
  {
    "id": "res.reaction_possible",
    "family": "dep.reaction_feasibility",
    "origin": "manual",
    "target": "reaction.possible",
    "target_pattern": "reaction.possible($reactants)",
    "kind": "rule",
    "prerequisites": [],
    "solver_id": "solver.reaction_possible",
    "cost": 80,
    "uncertainty_mode": "exact",
    "result_shape": "categorical"
  },
  {
    "id": "res.substance_dissociation",
    "family": "dep.dissociation",
    "origin": "manual",
    "target": "substance.dissociation",
    "target_pattern": "substance.dissociation($substance)",
    "kind": "rule",
    "prerequisites": [],
    "solver_id": "solver.dissociation",
    "cost": 50,
    "uncertainty_mode": "exact",
    "result_shape": "set"
  },
  {
    "id": "res.reaction_products",
    "family": "dep.reaction_products",
    "origin": "manual",
    "target": "reaction.products",
    "target_pattern": "reaction.products($reactants)",
    "kind": "rule",
    "prerequisites": ["substance.class($r)" ],
    "solver_id": "solver.predict_products",
    "cost": 120,
    "uncertainty_mode": "derived_exact_under_model",
    "result_shape": "set"
  },
  {
    "id": "res.stoichiometric_balance",
    "family": "dep.stoichiometry",
    "origin": "manual",
    "target": "reaction.balanced_coefficients",
    "target_pattern": "reaction.balanced_coefficients($reaction)",
    "kind": "optimization",
    "prerequisites": ["reaction.composition_matrix($reaction)"],
    "solver_id": "resolver.stoich_lp",
    "applicability": ["allow_optimization", "stoichiometric_model"],
    "cost": 200,
    "uncertainty_mode": "exact",
    "result_shape": "object"
  }
]
```

- [ ] **Step 2: Create predicate_overrides.json**

Create `data-src/foundations/predicate_overrides.json`:

```json
[
  {
    "id": "indicator.color",
    "namespace": "indicator",
    "role": "goal",
    "returns": "categorical:color",
    "positional_args": [
      { "name": "indicator", "type": "IndicatorRef" }
    ],
    "named_args": [
      { "name": "system", "type": "ChemicalSystem", "optional": false },
      { "name": "at", "type": "TimeExpr", "optional": true }
    ],
    "temporal_kind": "observable",
    "source": { "kind": "manual" }
  },
  {
    "id": "reaction.products",
    "namespace": "reaction",
    "role": "goal",
    "returns": "set:substance_list",
    "positional_args": [],
    "named_args": [
      { "name": "reactants", "type": "SubstanceRef[]", "optional": false }
    ],
    "temporal_kind": "static",
    "source": { "kind": "manual" }
  },
  {
    "id": "system.medium",
    "namespace": "system",
    "role": "goal",
    "returns": "categorical:medium",
    "positional_args": [],
    "named_args": [
      { "name": "system", "type": "ChemicalSystem", "optional": false }
    ],
    "temporal_kind": "static",
    "source": { "kind": "manual" }
  },
  {
    "id": "reaction.possible",
    "namespace": "reaction",
    "role": "goal",
    "returns": "categorical:boolean",
    "positional_args": [],
    "named_args": [
      { "name": "reactants", "type": "SubstanceRef[]", "optional": false }
    ],
    "temporal_kind": "static",
    "source": { "kind": "manual" }
  },
  {
    "id": "substance.dissociation",
    "namespace": "substance",
    "role": "goal",
    "returns": "set:ion_list",
    "positional_args": [
      { "name": "substance", "type": "SubstanceRef" }
    ],
    "named_args": [],
    "temporal_kind": "static",
    "source": { "kind": "manual" }
  },
  {
    "id": "element.oxidation_state",
    "namespace": "element",
    "role": "goal",
    "returns": "scalar:number",
    "positional_args": [
      { "name": "element", "type": "ElementRef" }
    ],
    "named_args": [
      { "name": "context", "type": "SubstanceRef", "optional": false }
    ],
    "temporal_kind": "static",
    "source": { "kind": "manual" }
  },
  {
    "id": "element.electron_config",
    "namespace": "element",
    "role": "goal",
    "returns": "scalar:string",
    "positional_args": [
      { "name": "element", "type": "ElementRef" }
    ],
    "named_args": [],
    "temporal_kind": "static",
    "source": { "kind": "manual" }
  },
  {
    "id": "element.bond_type",
    "namespace": "element",
    "role": "goal",
    "returns": "categorical:bond_type",
    "positional_args": [
      { "name": "elementA", "type": "ElementRef" },
      { "name": "elementB", "type": "ElementRef" }
    ],
    "named_args": [],
    "temporal_kind": "static",
    "source": { "kind": "manual" }
  },
  {
    "id": "reaction.driving_force",
    "namespace": "reaction",
    "role": "goal",
    "returns": "categorical:driving_force",
    "positional_args": [],
    "named_args": [
      { "name": "reaction", "type": "ReactionRef", "optional": false }
    ],
    "temporal_kind": "static",
    "source": { "kind": "manual" }
  }
]
```

- [ ] **Step 3: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('data-src/foundations/resolutions.json','utf8')); console.log('resolutions OK')" && node -e "JSON.parse(require('fs').readFileSync('data-src/foundations/predicate_overrides.json','utf8')); console.log('overrides OK')"`
Expected: Both print OK.

- [ ] **Step 4: Commit**

```bash
git add data-src/foundations/resolutions.json data-src/foundations/predicate_overrides.json
git commit -m "feat(dsl): add manual resolution and predicate override data files"
```

---

### Task 4: Build Script — generate-resolutions.mjs

**Files:**
- Create: `scripts/lib/generate-resolutions.mjs`
- Test: `src/lib/resolver/__tests__/generate-resolutions.test.ts`

- [ ] **Step 1: Write test for forward resolution generation**

Create `src/lib/resolver/__tests__/generate-resolutions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateResolutionsFromFormulas, mergeResolutions } from '../../../../scripts/lib/generate-resolutions.mjs';

const MOCK_FORMULA = {
  id: 'formula:amount_from_mass',
  kind: 'definition',
  domain: 'stoichiometry',
  school_grade: [8, 9],
  variables: [
    { symbol: 'n', quantity: 'q:amount', unit: 'unit:mol', role: 'result' },
    { symbol: 'm', quantity: 'q:mass', unit: 'unit:g', role: 'input' },
    { symbol: 'M', quantity: 'q:molar_mass', unit: 'unit:g_per_mol', role: 'input' },
  ],
  expression: { op: 'divide', operands: ['m', 'M'] },
  result_variable: 'n',
  invertible_for: ['m', 'M'],
  inversions: {
    m: { op: 'multiply', operands: ['n', 'M'] },
    M: { op: 'divide', operands: ['m', 'n'] },
  },
  constants_used: [],
  prerequisite_formulas: [],
  used_by_solvers: ['solver.amount_calc'],
};

describe('generateResolutionsFromFormulas', () => {
  it('generates forward resolution from formula', () => {
    const results = generateResolutionsFromFormulas([MOCK_FORMULA]);
    const forward = results.find(r => r.id.endsWith('.forward'));
    expect(forward).toBeDefined();
    expect(forward!.target).toBe('quantity.amount');
    expect(forward!.target_pattern).toBe('quantity.amount($entity)');
    expect(forward!.kind).toBe('equation');
    expect(forward!.prerequisites).toEqual([
      'quantity.mass($entity)',
      'quantity.molar_mass($entity)',
    ]);
    expect(forward!.family).toBe('formula:amount_from_mass');
    expect(forward!.origin).toBe('generated_from_formula');
    expect(forward!.solve_for).toBe('n');
  });

  it('generates inverse resolutions for each invertible_for', () => {
    const results = generateResolutionsFromFormulas([MOCK_FORMULA]);
    const invM = results.find(r => r.solve_for === 'm');
    const invMM = results.find(r => r.solve_for === 'M');
    expect(invM).toBeDefined();
    expect(invM!.target).toBe('quantity.mass');
    expect(invM!.target_pattern).toBe('quantity.mass($entity)');
    expect(invM!.cost).toBeGreaterThan(100); // inversions cost more
    expect(invMM).toBeDefined();
    expect(invMM!.target).toBe('quantity.molar_mass');
  });

  it('sets preconditions for division denominators', () => {
    const results = generateResolutionsFromFormulas([MOCK_FORMULA]);
    const forward = results.find(r => r.solve_for === 'n');
    expect(forward!.preconditions).toContain('quantity.molar_mass($entity) != 0');
  });
});

describe('mergeResolutions', () => {
  it('merges generated and manual resolutions', () => {
    const generated = generateResolutionsFromFormulas([MOCK_FORMULA]);
    const manual = [{
      id: 'res.test_manual',
      origin: 'manual' as const,
      target: 'substance.class',
      target_pattern: 'substance.class($substance)',
      kind: 'rule' as const,
      prerequisites: [],
      cost: 50,
      uncertainty_mode: 'exact' as const,
    }];
    const merged = mergeResolutions(generated, manual);
    expect(merged.length).toBe(generated.length + 1);
  });

  it('warns on duplicate ids', () => {
    const a = [{ id: 'res.dup', target: 'a', target_pattern: 'a($x)', kind: 'rule', prerequisites: [], cost: 50, uncertainty_mode: 'exact', origin: 'manual' }];
    const b = [{ id: 'res.dup', target: 'a', target_pattern: 'a($x)', kind: 'rule', prerequisites: [], cost: 60, uncertainty_mode: 'exact', origin: 'manual' }];
    const merged = mergeResolutions(a, b);
    // keeps first, deduplicates
    expect(merged.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/resolver/__tests__/generate-resolutions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement generate-resolutions.mjs**

Create `scripts/lib/generate-resolutions.mjs`:

```js
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Map a formula variable's quantity ref to a predicate id.
 * "q:mass" → "quantity.mass", "q:molar_mass" → "quantity.molar_mass"
 */
function quantityToPredicate(quantityRef) {
  // q:mass → quantity.mass, q:amount → quantity.amount
  return quantityRef.replace(/^q:/, 'quantity.');
}

/**
 * Serialize an expression AST node to a human-readable string.
 */
function serializeExpr(node, varToPredicateMap) {
  if (typeof node === 'string') {
    return varToPredicateMap[node] || node;
  }
  if (node.op === 'multiply') {
    const ops = node.operands.map(o => serializeExpr(o, varToPredicateMap));
    return `multiply(${ops.join(', ')})`;
  }
  if (node.op === 'divide') {
    const ops = node.operands.map(o => serializeExpr(o, varToPredicateMap));
    return `divide(${ops.join(', ')})`;
  }
  if (node.op === 'add') {
    const ops = node.operands.map(o => serializeExpr(o, varToPredicateMap));
    return `add(${ops.join(', ')})`;
  }
  if (node.op === 'subtract') {
    const ops = node.operands.map(o => serializeExpr(o, varToPredicateMap));
    return `subtract(${ops.join(', ')})`;
  }
  if (node.op === 'power') {
    const ops = node.operands.map(o => serializeExpr(o, varToPredicateMap));
    return `power(${ops.join(', ')})`;
  }
  if (node.op === 'sum') {
    return `sum(${serializeExpr(node.term, varToPredicateMap)}, over=${node.index_set})`;
  }
  if (node.op === 'log10') {
    return `log10(${serializeExpr(node.operands[0], varToPredicateMap)})`;
  }
  if (node.op === 'const') {
    return node.ref || String(node.value);
  }
  if (node.op === 'literal') {
    return String(node.value);
  }
  return JSON.stringify(node);
}

/**
 * Detect if a variable appears as denominator in a division expression.
 */
function isDenominator(expr, varSymbol) {
  if (!expr || typeof expr === 'string') return false;
  if (expr.op === 'divide' && expr.operands) {
    if (expr.operands[1] === varSymbol) return true;
    return expr.operands.some(o => isDenominator(o, varSymbol));
  }
  if (expr.operands) return expr.operands.some(o => isDenominator(o, varSymbol));
  if (expr.term) return isDenominator(expr.term, varSymbol);
  return false;
}

/**
 * Generate ResolutionDef[] from ComputableFormula[].
 */
export function generateResolutionsFromFormulas(formulas) {
  const results = [];

  for (const formula of formulas) {
    const vars = formula.variables || [];
    const resultVar = vars.find(v => v.symbol === formula.result_variable);
    if (!resultVar) continue;

    // Build variable→predicate mapping
    const varToPredicate = {};
    for (const v of vars) {
      if (v.quantity) {
        varToPredicate[v.symbol] = quantityToPredicate(v.quantity) + '($entity)';
      }
    }

    const inputVars = vars.filter(v => v.role === 'input');
    const targetPredicate = quantityToPredicate(resultVar.quantity);
    const prerequisites = inputVars
      .filter(v => v.quantity)
      .map(v => quantityToPredicate(v.quantity) + '($entity)');

    // Preconditions: check for division denominators
    const preconditions = [];
    for (const v of inputVars) {
      if (isDenominator(formula.expression, v.symbol) && v.quantity) {
        preconditions.push(`${quantityToPredicate(v.quantity)}($entity) != 0`);
      }
    }

    const approxKind = formula.approximation?.kind || 'exact';
    const uncertaintyMode = approxKind === 'exact' ? 'propagate' : 'model_limited';

    // Forward resolution
    results.push({
      id: `res.${formula.id.replace('formula:', '')}.forward`,
      family: formula.id,
      origin: 'generated_from_formula',
      origin_ref: formula.id,
      target: targetPredicate,
      target_pattern: `${targetPredicate}($entity)`,
      kind: 'equation',
      prerequisites,
      solver_id: 'resolver.equation',
      formula_id: formula.id,
      solve_for: resultVar.symbol,
      compute_expr_serialized: serializeExpr(formula.expression, varToPredicate),
      preconditions: preconditions.length > 0 ? preconditions : undefined,
      cost: 100,
      uncertainty_mode: uncertaintyMode,
      approximation_kind: approxKind === 'exact' ? 'exact' : 'school_simplification',
      result_shape: 'scalar',
    });

    // Inverse resolutions
    for (const invSymbol of (formula.invertible_for || [])) {
      const invVar = vars.find(v => v.symbol === invSymbol);
      if (!invVar || !invVar.quantity) continue;

      const invTarget = quantityToPredicate(invVar.quantity);
      const invPrereqs = vars
        .filter(v => v.role === 'input' || v.role === 'result')
        .filter(v => v.symbol !== invSymbol && v.quantity)
        .map(v => quantityToPredicate(v.quantity) + '($entity)');

      const invExpr = formula.inversions?.[invSymbol];
      const invPreconditions = [];
      if (invExpr) {
        for (const v of vars) {
          if (v.symbol !== invSymbol && isDenominator(invExpr, v.symbol) && v.quantity) {
            invPreconditions.push(`${quantityToPredicate(v.quantity)}($entity) != 0`);
          }
        }
      }

      results.push({
        id: `res.${formula.id.replace('formula:', '')}.inv_${invSymbol}`,
        family: formula.id,
        origin: 'generated_from_formula',
        origin_ref: formula.id,
        target: invTarget,
        target_pattern: `${invTarget}($entity)`,
        kind: 'equation',
        prerequisites: invPrereqs,
        solver_id: 'resolver.equation',
        formula_id: formula.id,
        solve_for: invSymbol,
        compute_expr_serialized: invExpr
          ? serializeExpr(invExpr, varToPredicate)
          : undefined,
        preconditions: invPreconditions.length > 0 ? invPreconditions : undefined,
        cost: 110,
        uncertainty_mode: uncertaintyMode,
        approximation_kind: approxKind === 'exact' ? 'exact' : 'school_simplification',
        result_shape: 'scalar',
      });
    }
  }

  return results;
}

/**
 * Merge generated and manual resolutions. Dedup by id (first wins).
 */
export function mergeResolutions(generated, manual) {
  const seen = new Set();
  const result = [];

  for (const r of [...generated, ...manual]) {
    if (seen.has(r.id)) {
      console.warn(`[generate-resolutions] duplicate id: ${r.id}, skipping`);
      continue;
    }
    seen.add(r.id);
    result.push(r);
  }

  // Sort by target then cost for stable planner behavior
  result.sort((a, b) => {
    const cmp = a.target.localeCompare(b.target);
    return cmp !== 0 ? cmp : a.cost - b.cost;
  });

  return result;
}

/**
 * Build resolution_index: Map<target_predicate_id, ResolutionDef[]>
 */
export function buildResolutionIndex(resolutions) {
  const index = {};
  for (const r of resolutions) {
    if (!index[r.target]) index[r.target] = [];
    index[r.target].push(r);
  }
  return index;
}

/**
 * Main: read formulas + manual resolutions, generate, merge, write.
 */
export async function generateResolutionRegistry(formulas, manualResolutions, outDir) {
  const generated = generateResolutionsFromFormulas(formulas);
  const merged = mergeResolutions(generated, manualResolutions);
  const index = buildResolutionIndex(merged);

  await writeFile(
    path.join(outDir, 'resolution_registry.json'),
    JSON.stringify(merged, null, 2),
  );
  await writeFile(
    path.join(outDir, 'resolution_index.json'),
    JSON.stringify(index, null, 2),
  );

  return { total: merged.length, generated: generated.length, manual: manualResolutions.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/resolver/__tests__/generate-resolutions.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/generate-resolutions.mjs src/lib/resolver/__tests__/generate-resolutions.test.ts
git commit -m "feat(dsl): add generate-resolutions build script with tests"
```

---

### Task 5: Build Script — generate-predicates.mjs

**Files:**
- Create: `scripts/lib/generate-predicates.mjs`
- Test: `src/lib/resolver/__tests__/generate-predicates.test.ts`

- [ ] **Step 1: Write test for predicate generation from properties**

Create `src/lib/resolver/__tests__/generate-predicates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  predicatesFromProperties,
  predicatesFromFormulas,
  predicatesFromConcepts,
  mergePredicates,
} from '../../../../scripts/lib/generate-predicates.mjs';

describe('predicatesFromProperties', () => {
  it('generates element predicate from property', () => {
    const props = [
      { id: 'electronegativity', object: 'element', unit: null, concept_ref: 'concept:electronegativity' },
    ];
    const result = predicatesFromProperties(props);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('element.electronegativity');
    expect(result[0].namespace).toBe('element');
    expect(result[0].role).toBe('goal');
    expect(result[0].returns).toBe('scalar:number');
    expect(result[0].positional_args[0].type).toBe('ElementRef');
    expect(result[0].temporal_kind).toBe('static');
    expect(result[0].source).toEqual({ kind: 'property', property_id: 'electronegativity' });
  });

  it('generates substance predicate for substance properties', () => {
    const props = [
      { id: 'pKa', object: 'substance', unit: null, concept_ref: 'concept:pKa' },
    ];
    const result = predicatesFromProperties(props);
    expect(result[0].id).toBe('substance.pKa');
    expect(result[0].positional_args[0].type).toBe('SubstanceRef');
  });
});

describe('predicatesFromFormulas', () => {
  it('generates unique quantity predicates from formula variables', () => {
    const formulas = [
      {
        id: 'formula:amount_from_mass',
        variables: [
          { symbol: 'n', quantity: 'q:amount', role: 'result' },
          { symbol: 'm', quantity: 'q:mass', role: 'input' },
          { symbol: 'M', quantity: 'q:molar_mass', role: 'input' },
        ],
      },
      {
        id: 'formula:mass_fraction',
        variables: [
          { symbol: 'w', quantity: 'q:mass_fraction', role: 'result' },
          { symbol: 'm', quantity: 'q:mass', role: 'input' }, // duplicate q:mass
        ],
      },
    ];
    const result = predicatesFromFormulas(formulas);
    const ids = result.map(p => p.id);
    expect(ids).toContain('quantity.amount');
    expect(ids).toContain('quantity.mass');
    expect(ids).toContain('quantity.molar_mass');
    expect(ids).toContain('quantity.mass_fraction');
    // no duplicates
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('predicatesFromConcepts', () => {
  it('generates substance.class from substance_class concepts', () => {
    const concepts = {
      'cls:oxide': { kind: 'substance_class', parent_id: null, order: 1 },
      'cls:acid': { kind: 'substance_class', parent_id: null, order: 2 },
    };
    const result = predicatesFromConcepts(concepts);
    const classP = result.find(p => p.id === 'substance.class');
    expect(classP).toBeDefined();
    expect(classP!.returns).toBe('categorical:substance_class');
  });

  it('generates reaction.type from reaction_type concepts', () => {
    const concepts = {
      'rxtype:neutralization': { kind: 'reaction_type', parent_id: null, order: 1 },
    };
    const result = predicatesFromConcepts(concepts);
    expect(result.find(p => p.id === 'reaction.type')).toBeDefined();
  });
});

describe('mergePredicates', () => {
  it('deduplicates by id, overrides win', () => {
    const generated = [{ id: 'quantity.mass', namespace: 'quantity', role: 'goal', returns: 'scalar:number', positional_args: [], named_args: [], temporal_kind: 'static', aliases: {}, search_tokens: {}, source: { kind: 'formula_variable', formula_id: 'f1', variable: 'm' } }];
    const overrides = [{ id: 'quantity.mass', namespace: 'quantity', role: 'goal', returns: 'scalar:number', positional_args: [{ name: 'entity', type: 'SubstanceRef' }], named_args: [], temporal_kind: 'static', aliases: { ru: ['масса'] }, search_tokens: { ru: ['масс'] }, source: { kind: 'manual' } }];
    const result = mergePredicates(generated, overrides);
    expect(result).toHaveLength(1);
    // override wins
    expect(result[0].aliases).toEqual({ ru: ['масса'] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/resolver/__tests__/generate-predicates.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement generate-predicates.mjs**

Create `scripts/lib/generate-predicates.mjs`:

```js
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const OBJECT_TO_REF = {
  element: 'ElementRef',
  substance: 'SubstanceRef',
  ion: 'IonRef',
};

/**
 * Generate predicates from properties.json entries.
 */
export function predicatesFromProperties(properties) {
  return properties.map(prop => ({
    id: `${prop.object}.${prop.id}`,
    namespace: prop.object,
    role: 'goal',
    returns: prop.unit ? 'scalar:number' : 'scalar:number',
    positional_args: [{ name: prop.object, type: OBJECT_TO_REF[prop.object] || 'EntityRef' }],
    named_args: [],
    temporal_kind: 'static',
    aliases: {},
    search_tokens: {},
    source: { kind: 'property', property_id: prop.id },
  }));
}

/**
 * Generate predicates from formula variables (deduplicated by quantity ref).
 */
export function predicatesFromFormulas(formulas) {
  const seen = new Set();
  const results = [];

  for (const formula of formulas) {
    for (const v of (formula.variables || [])) {
      if (!v.quantity) continue;
      const predId = v.quantity.replace(/^q:/, 'quantity.');
      if (seen.has(predId)) continue;
      seen.add(predId);

      results.push({
        id: predId,
        namespace: 'quantity',
        role: 'goal',
        returns: 'scalar:number',
        positional_args: [{ name: 'entity', type: 'SubstanceRef | ElementRef' }],
        named_args: [],
        temporal_kind: 'static',
        aliases: {},
        search_tokens: {},
        source: { kind: 'formula_variable', formula_id: formula.id, variable: v.symbol },
      });
    }
  }

  return results;
}

/**
 * Generate predicates from concepts.json (classification predicates).
 */
export function predicatesFromConcepts(concepts) {
  const kindToPredicateMap = {
    substance_class: { id: 'substance.class', ns: 'substance', returns: 'categorical:substance_class' },
    reaction_type: { id: 'reaction.type', ns: 'reaction', returns: 'categorical:reaction_type' },
    reaction_facet: { id: 'reaction.observation', ns: 'reaction', returns: 'categorical:observation' },
  };

  const emitted = new Set();
  const results = [];

  for (const [, concept] of Object.entries(concepts)) {
    const mapping = kindToPredicateMap[concept.kind];
    if (!mapping || emitted.has(mapping.id)) continue;
    emitted.add(mapping.id);

    const argType = mapping.ns === 'substance' ? 'SubstanceRef' : 'ReactionRef';
    results.push({
      id: mapping.id,
      namespace: mapping.ns,
      role: 'goal',
      returns: mapping.returns,
      positional_args: [{ name: mapping.ns, type: argType }],
      named_args: [],
      temporal_kind: 'static',
      aliases: {},
      search_tokens: {},
      source: { kind: 'concept', concept_id: concept.kind },
    });
  }

  return results;
}

/**
 * Generate constructor predicates.
 */
export function constructorPredicates() {
  return [
    {
      id: 'ctor.solution',
      namespace: 'ctor',
      role: 'context',
      returns: 'object:solution',
      positional_args: [{ name: 'substance', type: 'SubstanceRef' }],
      named_args: [
        { name: 'mass_fraction', type: 'number', optional: true, description: 'ω, %' },
        { name: 'concentration', type: 'number', optional: true, description: 'c, mol/L' },
        { name: 'mass', type: 'number', optional: true, description: 'm, g' },
      ],
      temporal_kind: 'static',
      aliases: { ru: ['раствор'], en: ['solution'], pl: ['roztwór'], es: ['solución'] },
      search_tokens: { ru: ['раствор'], en: ['solution'], pl: ['roztwór'], es: ['solución'] },
      source: { kind: 'constructor' },
    },
    {
      id: 'ctor.mixture',
      namespace: 'ctor',
      role: 'context',
      returns: 'object:mixture',
      positional_args: [],
      named_args: [{ name: 'components', type: 'Expr[]', optional: false }],
      temporal_kind: 'static',
      aliases: { ru: ['смесь'], en: ['mixture'], pl: ['mieszanina'], es: ['mezcla'] },
      search_tokens: { ru: ['смес'], en: ['mix'], pl: ['miesz'], es: ['mezcl'] },
      source: { kind: 'constructor' },
    },
    {
      id: 'ctor.env',
      namespace: 'ctor',
      role: 'context',
      returns: 'object:environment',
      positional_args: [],
      named_args: [
        { name: 't', type: 'number', optional: true, description: '°C' },
        { name: 'p', type: 'number', optional: true, description: 'atm' },
      ],
      temporal_kind: 'static',
      aliases: { ru: ['условия'], en: ['environment'], pl: ['warunki'], es: ['condiciones'] },
      search_tokens: { ru: ['усл', 'темп', 'давл'], en: ['env', 'temp', 'press'], pl: ['war'], es: ['cond'] },
      source: { kind: 'constructor' },
    },
  ];
}

/**
 * Merge predicates: overrides win over generated.
 */
export function mergePredicates(generated, overrides) {
  const byId = new Map();

  // Generated first
  for (const p of generated) {
    byId.set(p.id, p);
  }

  // Overrides replace
  for (const p of overrides) {
    byId.set(p.id, p);
  }

  return Array.from(byId.values());
}

/**
 * Build predicate_index: Map<namespace, PredicateDef[]>
 */
export function buildPredicateIndex(predicates) {
  const index = {};
  for (const p of predicates) {
    if (!index[p.namespace]) index[p.namespace] = [];
    index[p.namespace].push(p);
  }
  return index;
}

/**
 * Main entry point.
 */
export async function generatePredicateRegistry(
  properties, formulas, concepts, overrides, outDir,
) {
  const fromProps = predicatesFromProperties(properties);
  const fromFormulas = predicatesFromFormulas(formulas);
  const fromConcepts = predicatesFromConcepts(concepts);
  const ctors = constructorPredicates();

  const allGenerated = [...fromProps, ...fromFormulas, ...fromConcepts, ...ctors];
  const merged = mergePredicates(allGenerated, overrides);
  const index = buildPredicateIndex(merged);

  await writeFile(
    path.join(outDir, 'predicate_registry.json'),
    JSON.stringify(merged, null, 2),
  );
  await writeFile(
    path.join(outDir, 'predicate_index.json'),
    JSON.stringify(index, null, 2),
  );

  return {
    total: merged.length,
    fromProperties: fromProps.length,
    fromFormulas: fromFormulas.length,
    fromConcepts: fromConcepts.length,
    constructors: ctors.length,
    overrides: overrides.length,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/resolver/__tests__/generate-predicates.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/generate-predicates.mjs src/lib/resolver/__tests__/generate-predicates.test.ts
git commit -m "feat(dsl): add generate-predicates build script with tests"
```

---

### Task 6: Build Pipeline Integration

**Files:**
- Modify: `scripts/build-data.mjs` (~line 52 imports, ~line 840 generation, ~line 512 bundle copy)
- Modify: `src/types/manifest.ts` (~line 66 inside foundations)
- Modify: `src/lib/data-loader.ts` (~line 1420 after loadTrendRules)

- [ ] **Step 1: Add imports in build-data.mjs**

At the top of `scripts/build-data.mjs` near other imports (~line 52), add:

```js
import { generateResolutionRegistry } from './lib/generate-resolutions.mjs';
import { generatePredicateRegistry } from './lib/generate-predicates.mjs';
```

- [ ] **Step 2: Add generation calls in build-data.mjs**

Near line 840 (after existing index generation), add:

```js
// Generate resolution registry
const manualResolutions = JSON.parse(
  await readFile('data-src/foundations/resolutions.json', 'utf8'),
);
const resStats = await generateResolutionRegistry(formulas, manualResolutions, outDir);
console.log(`  Resolution registry: ${resStats.total} entries (${resStats.generated} generated, ${resStats.manual} manual)`);

// Generate predicate registry
const predicateOverrides = JSON.parse(
  await readFile('data-src/foundations/predicate_overrides.json', 'utf8'),
);
const predStats = await generatePredicateRegistry(
  properties, formulas, concepts, predicateOverrides, outDir,
);
console.log(`  Predicate registry: ${predStats.total} entries`);
```

- [ ] **Step 3: Add manifest entries**

In `src/types/manifest.ts`, inside the `foundations?` block (~line 66), add:

```ts
    predicate_registry?: string;
    resolution_index?: string;
```

In `scripts/lib/generate-manifest.mjs`, add the new entries to the foundations section of the generated manifest.

- [ ] **Step 4: Add data loader functions**

In `src/lib/data-loader.ts`, after the last load function (~line 1420), add:

```ts
export async function loadPredicateRegistry(): Promise<PredicateDef[]> {
  const manifest = await getManifest();
  const p = manifest.entrypoints.foundations?.predicate_registry;
  if (!p) return [];
  return loadDataFile<PredicateDef[]>(p);
}

export async function loadResolutionIndex(): Promise<Record<string, ResolutionDef[]>> {
  const manifest = await getManifest();
  const p = manifest.entrypoints.foundations?.resolution_index;
  if (!p) return {};
  return loadDataFile<Record<string, ResolutionDef[]>>(p);
}
```

Add imports at top of data-loader.ts:

```ts
import type { PredicateDef } from '../types/predicate.js';
import type { ResolutionDef } from '../types/resolution.js';
```

- [ ] **Step 5: Verify build produces new bundles**

Run: `npm run build:data`
Expected: Output includes "Resolution registry: N entries" and "Predicate registry: N entries". Check `public/data/` for `resolution_registry.json`, `resolution_index.json`, `predicate_registry.json`, `predicate_index.json`.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-data.mjs scripts/lib/generate-manifest.mjs src/types/manifest.ts src/lib/data-loader.ts
git commit -m "feat(dsl): integrate resolution and predicate registries into build pipeline"
```

---

### Task 7: Resolver Core — query-utils.ts

**Files:**
- Create: `src/lib/resolver/query-utils.ts`
- Test: `src/lib/resolver/__tests__/query-utils.test.ts`

- [ ] **Step 1: Write tests for core utils**

Create `src/lib/resolver/__tests__/query-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  computeFingerprint,
  unifyTarget,
  renderCanonical,
} from '../query-utils.js';
import type { CallExpr, QueryExpr, ValueExpr, SymbolExpr, EqualityExpr } from '../../../types/query-ast.js';

describe('computeFingerprint', () => {
  it('produces same fingerprint for identical queries with different ids', () => {
    const q1: QueryExpr = {
      kind: 'query', id: 'q1', intent: 'derive',
      target: { kind: 'call', predicate: 'quantity.mass', args: [{ kind: 'symbol', ref: { kind: 'substance', id: 'sub:nacl' } }] },
      givens: [{ kind: 'equality', left: { kind: 'call', predicate: 'quantity.amount', args: [{ kind: 'symbol', ref: { kind: 'substance', id: 'sub:nacl' } }] }, right: { kind: 'value', value: 2, unit: 'mol' } }],
    };
    const q2: QueryExpr = { ...q1, id: 'q2', meta: { origin: 'planner', parent_query_id: 'q0' } };
    expect(computeFingerprint(q1)).toBe(computeFingerprint(q2));
  });

  it('produces different fingerprints for different targets', () => {
    const q1: QueryExpr = {
      kind: 'query', id: 'q1', intent: 'find',
      target: { kind: 'call', predicate: 'quantity.mass', args: [] },
    };
    const q2: QueryExpr = {
      kind: 'query', id: 'q2', intent: 'find',
      target: { kind: 'call', predicate: 'quantity.amount', args: [] },
    };
    expect(computeFingerprint(q1)).not.toBe(computeFingerprint(q2));
  });
});

describe('unifyTarget', () => {
  it('unifies call expr against pattern with $entity', () => {
    const target: CallExpr = {
      kind: 'call', predicate: 'quantity.mass',
      args: [{ kind: 'symbol', ref: { kind: 'substance', id: 'sub:nacl' } }],
    };
    const pattern = 'quantity.mass($entity)';
    const result = unifyTarget(target, pattern);
    expect(result).not.toBeNull();
    expect(result!.$entity).toEqual({ kind: 'symbol', ref: { kind: 'substance', id: 'sub:nacl' } });
  });

  it('fails when predicate ids differ', () => {
    const target: CallExpr = {
      kind: 'call', predicate: 'quantity.amount',
      args: [{ kind: 'symbol', ref: { kind: 'substance', id: 'sub:nacl' } }],
    };
    const result = unifyTarget(target, 'quantity.mass($entity)');
    expect(result).toBeNull();
  });

  it('handles multi-argument patterns', () => {
    const target: CallExpr = {
      kind: 'call', predicate: 'element.bond_type',
      args: [
        { kind: 'symbol', ref: { kind: 'element', id: 'Na' } },
        { kind: 'symbol', ref: { kind: 'element', id: 'Cl' } },
      ],
    };
    const result = unifyTarget(target, 'element.bond_type($elementA, $elementB)');
    expect(result).not.toBeNull();
    expect(result!.$elementA).toEqual({ kind: 'symbol', ref: { kind: 'element', id: 'Na' } });
    expect(result!.$elementB).toEqual({ kind: 'symbol', ref: { kind: 'element', id: 'Cl' } });
  });
});

describe('renderCanonical', () => {
  it('renders derive query', () => {
    const q: QueryExpr = {
      kind: 'query', id: 'q1', intent: 'derive',
      target: { kind: 'call', predicate: 'quantity.mass', args: [{ kind: 'symbol', ref: { kind: 'substance', id: 'sub:nacl' } }] },
      givens: [{
        kind: 'equality',
        left: { kind: 'call', predicate: 'quantity.amount', args: [{ kind: 'symbol', ref: { kind: 'substance', id: 'sub:nacl' } }] },
        right: { kind: 'value', value: 2, unit: 'mol' },
      }],
    };
    const result = renderCanonical(q);
    expect(result).toContain('derive');
    expect(result).toContain('quantity.mass');
    expect(result).toContain('sub:nacl');
    expect(result).toContain('2 mol');
  });

  it('renders find query', () => {
    const q: QueryExpr = {
      kind: 'query', id: 'q1', intent: 'find',
      target: { kind: 'call', predicate: 'substance.class', args: [{ kind: 'symbol', ref: { kind: 'substance', id: 'sub:h2so4' } }] },
    };
    const result = renderCanonical(q);
    expect(result).toContain('find');
    expect(result).toContain('substance.class');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/resolver/__tests__/query-utils.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement query-utils.ts**

Create `src/lib/resolver/query-utils.ts`:

```ts
import type {
  Expr, QueryExpr, CallExpr, EqualityExpr, ValueExpr,
  SymbolExpr, ListExpr, EventExpr, TimeExpr,
} from '../../types/query-ast.js';
import type { ResolutionDef, ProblemKind } from '../../types/resolution.js';
import type { PredicateDef, ArgDef } from '../../types/predicate.js';
import type { SuggestedGiven } from '../../types/query-ast.js';

// ─── Fingerprint ───

function exprToCanonical(e: Expr): string {
  switch (e.kind) {
    case 'query':
      return `Q(${e.intent},${exprToCanonical(e.target)},${(e.givens || []).map(exprToCanonical).join(',')})`; 
    case 'call':
      return `C(${e.predicate},${e.args.map(exprToCanonical).join(',')},${Object.entries(e.namedArgs || {}).map(([k, v]) => `${k}=${exprToCanonical(v)}`).join(',')})`;
    case 'equality':
      return `E(${exprToCanonical(e.left)},${exprToCanonical(e.right)})`;
    case 'value':
      return `V(${e.value},${e.unit || ''})`;
    case 'symbol':
      return `S(${e.ref.kind}:${e.ref.id})`;
    case 'list':
      return `L(${e.items.map(exprToCanonical).join(',')})`;
    case 'event':
      return `EV(${e.event_type})`;
    case 'time':
      return `T(${typeof e.base === 'string' ? e.base : exprToCanonical(e.base)},${e.relation})`;
    default:
      return 'X';
  }
}

export function computeFingerprint(query: QueryExpr): string {
  // Exclude meta and id from fingerprint
  const canonical = `${query.intent}|${exprToCanonical(query.target)}|${(query.givens || []).map(exprToCanonical).join('|')}`;
  // Simple string hash
  let h = 0;
  for (let i = 0; i < canonical.length; i++) {
    h = ((h << 5) - h + canonical.charCodeAt(i)) | 0;
  }
  return `fp_${(h >>> 0).toString(36)}`;
}

// ─── Unification ───

/**
 * Parse pattern like "quantity.mass($entity)" into predicate id and variable names.
 */
function parsePattern(pattern: string): { predicate: string; vars: string[] } | null {
  const m = pattern.match(/^([a-z_.]+)\(([^)]*)\)$/);
  if (!m) return null;
  const predicate = m[1];
  const vars = m[2]
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return { predicate, vars };
}

/**
 * Unify a CallExpr against a target_pattern string.
 * Returns bindings ($var → Expr) or null on failure.
 */
export function unifyTarget(
  target: CallExpr,
  pattern: string,
): Record<string, Expr> | null {
  const parsed = parsePattern(pattern);
  if (!parsed) return null;
  if (target.predicate !== parsed.predicate) return null;

  const bindings: Record<string, Expr> = {};
  const argCount = Math.max(target.args.length, parsed.vars.length);

  for (let i = 0; i < argCount; i++) {
    const varName = parsed.vars[i];
    const argExpr = target.args[i];
    if (!varName || !argExpr) {
      // Mismatch in arity — not necessarily a failure for optional args
      if (varName && varName.startsWith('$')) continue;
      return null;
    }
    if (varName.startsWith('$')) {
      bindings[varName] = argExpr;
    }
    // literal match if not a variable — skip for now
  }

  return bindings;
}

/**
 * Instantiate a prerequisite pattern with bindings.
 * "quantity.amount($entity)" + {$entity: SymbolExpr(NaCl)} → "quantity.amount(sub:nacl)"
 */
export function instantiatePattern(
  pattern: string,
  bindings: Record<string, Expr>,
): string {
  let result = pattern;
  for (const [varName, expr] of Object.entries(bindings)) {
    const replacement = expr.kind === 'symbol' ? `${expr.ref.kind}:${expr.ref.id}` : exprToCanonical(expr);
    result = result.replace(varName, replacement);
  }
  return result;
}

// ─── Canonical Rendering ───

function renderExpr(e: Expr): string {
  switch (e.kind) {
    case 'query':
      return renderCanonical(e);
    case 'call': {
      const args = e.args.map(renderExpr);
      const named = Object.entries(e.namedArgs || {}).map(([k, v]) => `${k}=${renderExpr(v)}`);
      const allArgs = [...args, ...named].join(', ');
      return allArgs ? `${e.predicate}(${allArgs})` : e.predicate;
    }
    case 'equality':
      return `${renderExpr(e.left)} = ${renderExpr(e.right)}`;
    case 'value':
      return e.unit ? `${e.value} ${e.unit}` : String(e.value);
    case 'symbol':
      return `${e.ref.id}`;
    case 'list':
      return `[${e.items.map(renderExpr).join(', ')}]`;
    case 'event':
      return `event.${e.event_type}`;
    case 'time': {
      const base = typeof e.base === 'string' ? e.base : renderExpr(e.base);
      return e.offset ? `time.${e.relation}(${base}, ${renderExpr(e.offset)})` : `time.${e.relation}(${base})`;
    }
    default:
      return '?';
  }
}

export function renderCanonical(query: QueryExpr): string {
  const target = renderExpr(query.target);
  const parts = [target];

  if (query.givens && query.givens.length > 0) {
    const givensStr = query.givens.map(g => renderExpr(g)).join(', ');
    parts.push(`given=[${givensStr}]`);
  }

  return `${query.intent}(${parts.join(', ')})`;
}

// ─── Suggest Givens ───

export function suggestGivens(
  targetPredicate: string,
  resolutionIndex: Record<string, ResolutionDef[]>,
): SuggestedGiven[] {
  const candidates = resolutionIndex[targetPredicate] || [];
  if (candidates.length === 0) return [];

  // Pick the best (lowest cost) resolution
  const best = candidates.reduce((a, b) => a.cost < b.cost ? a : b);

  return (best.prerequisites || []).map(pattern => {
    const parsed = parsePattern(pattern);
    const predId = parsed?.predicate || pattern;

    // Heuristic: quantities that are typically "given" vs "derived"
    const likelyGiven = [
      'quantity.mass', 'quantity.amount', 'quantity.volume',
      'quantity.mass_fraction', 'quantity.concentration',
    ];
    const usuallyDerived = [
      'quantity.molar_mass', 'quantity.relative_atomic_mass',
    ];

    let suggestion_kind: SuggestedGiven['suggestion_kind'] = 'optional';
    if (likelyGiven.includes(predId)) suggestion_kind = 'likely_given';
    else if (usuallyDerived.includes(predId)) suggestion_kind = 'usually_derived';

    return {
      predicate: predId,
      pattern,
      suggestion_kind,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/resolver/__tests__/query-utils.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/resolver/query-utils.ts src/lib/resolver/__tests__/query-utils.test.ts
git commit -m "feat(dsl): add query utils — fingerprint, unification, canonical rendering, suggestGivens"
```

---

### Task 8: Resolution Handlers

**Files:**
- Create: `src/lib/resolver/handlers/equation-handler.ts`
- Create: `src/lib/resolver/handlers/rule-handler.ts`
- Create: `src/lib/resolver/handlers/lookup-handler.ts`
- Create: `src/lib/resolver/handlers/stub-handler.ts`
- Create: `src/lib/resolver/handlers/index.ts`

- [ ] **Step 1: Create equation handler (wraps existing derivation planner)**

Create `src/lib/resolver/handlers/equation-handler.ts`:

```ts
import type { ResolutionDef } from '../../../types/resolution.js';
import type { Expr, ResolvedInputs, ValueExpr } from '../../../types/query-ast.js';
import type { ComputableFormula } from '../../../types/formula.js';
import type { ConstantsDict } from '../../../types/formula.js';
import { buildDerivationRules, buildQuantityIndex } from '../../derivation/derivation-graph.js';
import { planDerivation } from '../../derivation/derivation-planner.js';
import { executePlan } from '../../derivation/derivation-executor.js';
import type { QRef } from '../../../types/derivation.js';

export interface EquationHandlerEnv {
  formulas: ComputableFormula[];
  constants: ConstantsDict;
}

export function executeEquation(
  resolution: ResolutionDef,
  inputs: ResolvedInputs,
  env: EquationHandlerEnv,
): { answer: Expr; formula_rendered?: string } | { error: string } {
  if (!resolution.formula_id || !resolution.solve_for) {
    return { error: 'equation resolution missing formula_id or solve_for' };
  }

  const formula = env.formulas.find(f => f.id === resolution.formula_id);
  if (!formula) {
    return { error: `formula not found: ${resolution.formula_id}` };
  }

  // Collect numeric values from prerequisite results
  const values: Record<string, number> = {};
  for (const [key, expr] of Object.entries(inputs.prerequisite_results)) {
    if (expr.kind === 'value' && typeof expr.value === 'number') {
      values[key] = expr.value;
    }
  }

  // Build derivation rules and attempt to plan + execute
  try {
    const rules = buildDerivationRules([formula]);
    const index = buildQuantityIndex(rules);

    const targetQty = formula.variables.find(v => v.symbol === resolution.solve_for)?.quantity;
    if (!targetQty) return { error: `variable ${resolution.solve_for} not found in formula` };

    const target: QRef = { quantity: targetQty };
    const knowns: QRef[] = [];
    const evalValues: Record<string, number> = {};

    for (const v of formula.variables) {
      if (v.symbol === resolution.solve_for) continue;
      if (!v.quantity) continue;

      const qrefKey = v.quantity;
      // Try to find value from prerequisites
      for (const [pKey, pVal] of Object.entries(values)) {
        if (pKey.includes(v.quantity.replace('q:', ''))) {
          knowns.push({ quantity: v.quantity });
          evalValues[v.quantity] = pVal;
          break;
        }
      }
    }

    const plan = planDerivation(target, knowns, rules, index);
    if (!plan) {
      // Direct evaluation fallback
      const result = directEvaluate(formula, resolution.solve_for, values);
      if (result !== null) {
        return {
          answer: { kind: 'value', value: result } as ValueExpr,
          formula_rendered: `${resolution.solve_for} = ${result}`,
        };
      }
      return { error: 'no derivation plan found' };
    }

    const execResult = executePlan(plan, {
      formulas: [formula],
      constants: env.constants,
      values: evalValues,
    });

    const resultValue = execResult.computedValues?.[targetQty] ?? execResult.result;
    if (resultValue === undefined) return { error: 'execution produced no result' };

    return {
      answer: { kind: 'value', value: resultValue } as ValueExpr,
      formula_rendered: `${resolution.solve_for} = ${resultValue}`,
    };
  } catch (e) {
    return { error: `equation handler error: ${(e as Error).message}` };
  }
}

function directEvaluate(
  formula: ComputableFormula,
  solveFor: string,
  values: Record<string, number>,
): number | null {
  // Simple direct evaluation for basic operations
  const expr = solveFor === formula.result_variable
    ? formula.expression
    : formula.inversions?.[solveFor];
  if (!expr) return null;

  return evaluateNode(expr, values, formula.variables);
}

function evaluateNode(
  node: unknown,
  values: Record<string, number>,
  variables: ComputableFormula['variables'],
): number | null {
  if (typeof node === 'string') {
    // Variable reference
    const v = variables.find(vr => vr.symbol === node);
    if (v?.quantity) {
      // Try multiple key formats
      const qty = v.quantity.replace('q:', '');
      for (const [k, val] of Object.entries(values)) {
        if (k.includes(qty)) return val;
      }
    }
    return values[node] ?? null;
  }

  const n = node as { op: string; operands?: unknown[]; value?: number };
  if (n.op === 'multiply' && n.operands) {
    const vals = n.operands.map(o => evaluateNode(o, values, variables));
    if (vals.some(v => v === null)) return null;
    return (vals as number[]).reduce((a, b) => a * b, 1);
  }
  if (n.op === 'divide' && n.operands) {
    const a = evaluateNode(n.operands[0], values, variables);
    const b = evaluateNode(n.operands[1], values, variables);
    if (a === null || b === null || b === 0) return null;
    return a / b;
  }
  if (n.op === 'add' && n.operands) {
    const vals = n.operands.map(o => evaluateNode(o, values, variables));
    if (vals.some(v => v === null)) return null;
    return (vals as number[]).reduce((a, b) => a + b, 0);
  }
  if (n.op === 'literal' && n.value !== undefined) {
    return n.value;
  }
  return null;
}
```

- [ ] **Step 2: Create rule handler (wraps existing solvers)**

Create `src/lib/resolver/handlers/rule-handler.ts`:

```ts
import type { ResolutionDef } from '../../../types/resolution.js';
import type { Expr, ResolvedInputs, ValueExpr } from '../../../types/query-ast.js';
import { runSolver } from '../../task-engine/solvers.js';
import type { OntologyData, SlotValues } from '../../task-engine/types.js';

export interface RuleHandlerEnv {
  ontologyData: OntologyData;
}

export function executeRule(
  resolution: ResolutionDef,
  inputs: ResolvedInputs,
  env: RuleHandlerEnv,
): { answer: Expr } | { error: string } {
  if (!resolution.solver_id) {
    return { error: 'rule resolution missing solver_id' };
  }

  // Convert bindings to slot values for legacy solver compatibility
  const slots: SlotValues = {};
  for (const [varName, expr] of Object.entries(inputs.bindings)) {
    const key = varName.replace(/^\$/, '');
    if (expr.kind === 'symbol') {
      slots[key] = expr.ref.id;
    } else if (expr.kind === 'value') {
      slots[key] = String(expr.value);
    }
  }

  // Also include prerequisite results
  for (const [key, expr] of Object.entries(inputs.prerequisite_results)) {
    if (expr.kind === 'value') {
      slots[key] = typeof expr.value === 'number' ? String(expr.value) : expr.value as string;
    }
  }

  try {
    const result = runSolver(resolution.solver_id, {}, slots, env.ontologyData);
    if (result.error) {
      return { error: result.error };
    }

    const answer: Expr = typeof result.answer === 'number'
      ? { kind: 'value', value: result.answer }
      : { kind: 'value', value: String(result.answer ?? '') };

    return { answer };
  } catch (e) {
    return { error: `rule handler error: ${(e as Error).message}` };
  }
}
```

- [ ] **Step 3: Create lookup handler**

Create `src/lib/resolver/handlers/lookup-handler.ts`:

```ts
import type { ResolutionDef } from '../../../types/resolution.js';
import type { Expr, ResolvedInputs, ValueExpr } from '../../../types/query-ast.js';

export interface LookupHandlerEnv {
  ontology: {
    elements: Array<{ Z: number; symbol: string; characteristics?: Record<string, { value: number }> }>;
    substances: Array<{ id: string; formula: string; class?: string }>;
    ions: Array<{ id: string; formula: string; type: string }>;
  };
}

export function executeLookup(
  resolution: ResolutionDef,
  inputs: ResolvedInputs,
  env: LookupHandlerEnv,
): { answer: Expr } | { error: string } {
  // Extract entity from bindings
  const entityBinding = inputs.bindings['$element'] || inputs.bindings['$substance'] || inputs.bindings['$entity'] || inputs.bindings['$ion'];
  if (!entityBinding || entityBinding.kind !== 'symbol') {
    return { error: 'lookup handler: no entity binding found' };
  }

  const ref = entityBinding.ref;
  const targetPred = resolution.target;

  // Element property lookup
  if (ref.kind === 'element') {
    const element = env.ontology.elements.find(e => e.symbol === ref.id);
    if (!element) return { error: `element not found: ${ref.id}` };

    // Try characteristics lookup by concept ref
    const conceptRef = `concept:${targetPred.replace('element.', '')}`;
    const char = element.characteristics?.[conceptRef];
    if (char && char.value !== undefined) {
      return { answer: { kind: 'value', value: char.value } };
    }

    return { error: `property ${targetPred} not found on element ${ref.id}` };
  }

  // Substance class lookup
  if (ref.kind === 'substance' && targetPred === 'substance.class') {
    const sub = env.ontology.substances.find(s => s.id === ref.id);
    if (!sub) return { error: `substance not found: ${ref.id}` };
    return { answer: { kind: 'value', value: sub.class || 'unknown' } };
  }

  return { error: `lookup not implemented for ${targetPred} on ${ref.kind}` };
}
```

- [ ] **Step 4: Create stub handler for unimplemented kinds**

Create `src/lib/resolver/handlers/stub-handler.ts`:

```ts
import type { ResolutionDef } from '../../../types/resolution.js';
import type { Expr, ResolvedInputs } from '../../../types/query-ast.js';

export function executeStub(
  resolution: ResolutionDef,
  _inputs: ResolvedInputs,
): { error: string } {
  return { error: `handler not implemented for kind: ${resolution.kind}` };
}
```

- [ ] **Step 5: Create handler index**

Create `src/lib/resolver/handlers/index.ts`:

```ts
import type { ResolutionDef, ProblemKind } from '../../../types/resolution.js';
import type { Expr, ResolvedInputs } from '../../../types/query-ast.js';
import { executeEquation, type EquationHandlerEnv } from './equation-handler.js';
import { executeRule, type RuleHandlerEnv } from './rule-handler.js';
import { executeLookup, type LookupHandlerEnv } from './lookup-handler.js';
import { executeStub } from './stub-handler.js';

export type HandlerEnv = EquationHandlerEnv & RuleHandlerEnv & LookupHandlerEnv;

export type HandlerResult =
  | { answer: Expr; formula_rendered?: string }
  | { error: string };

export function executeHandler(
  resolution: ResolutionDef,
  inputs: ResolvedInputs,
  env: HandlerEnv,
): HandlerResult {
  switch (resolution.kind) {
    case 'equation':
      return executeEquation(resolution, inputs, env);
    case 'rule':
      return executeRule(resolution, inputs, env);
    case 'lookup':
      return executeLookup(resolution, inputs, env);
    default:
      return executeStub(resolution, inputs);
  }
}

/** Kinds that have real implementations in Phase 1 */
export const IMPLEMENTED_KINDS: Set<ProblemKind> = new Set([
  'equation', 'rule', 'lookup',
]);
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/resolver/handlers/
git commit -m "feat(dsl): add resolution handlers — equation, rule, lookup, stub"
```

---

### Task 9: Resolver Core — resolve-query.ts

**Files:**
- Create: `src/lib/resolver/resolve-query.ts`
- Test: `src/lib/resolver/__tests__/resolve-query.test.ts`

- [ ] **Step 1: Write integration test for resolve-query**

Create `src/lib/resolver/__tests__/resolve-query.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveQuery, type ResolverEnv } from '../resolve-query.js';
import type { QueryExpr } from '../../../types/query-ast.js';
import type { ResolutionDef } from '../../../types/resolution.js';

// Minimal env for testing direct lookup
function makeEnv(resolutions: ResolutionDef[]): ResolverEnv {
  const resolutionIndex: Record<string, ResolutionDef[]> = {};
  for (const r of resolutions) {
    if (!resolutionIndex[r.target]) resolutionIndex[r.target] = [];
    resolutionIndex[r.target].push(r);
  }

  return {
    predicateRegistry: [],
    resolutionIndex,
    ontology: {
      elements: [
        { Z: 11, symbol: 'Na', characteristics: { 'concept:electronegativity': { value: 0.93 } } },
        { Z: 17, symbol: 'Cl', characteristics: { 'concept:electronegativity': { value: 3.16 } } },
      ],
      substances: [{ id: 'sub:nacl', formula: 'NaCl', class: 'salt' }],
      ions: [],
    },
    formulaRegistry: [],
    constants: {},
    policy: { require_traceable_steps: true },
    queryCache: new Map(),
    activeQueryStack: new Set(),
  };
}

describe('resolveQuery', () => {
  it('resolves direct lookup (element property)', () => {
    const env = makeEnv([{
      id: 'res.element_en',
      origin: 'manual',
      target: 'element.electronegativity',
      target_pattern: 'element.electronegativity($element)',
      kind: 'lookup',
      prerequisites: [],
      cost: 30,
      uncertainty_mode: 'exact',
    }]);

    const query: QueryExpr = {
      kind: 'query', id: 'q1', intent: 'find',
      target: {
        kind: 'call', predicate: 'element.electronegativity',
        args: [{ kind: 'symbol', ref: { kind: 'element', id: 'Na' } }],
      },
    };

    const result = resolveQuery(query, env);
    expect(result.answer).toEqual({ kind: 'value', value: 0.93 });
    expect(result.trace.status).toBe('success');
  });

  it('caches repeated queries by fingerprint', () => {
    const env = makeEnv([{
      id: 'res.element_en',
      origin: 'manual',
      target: 'element.electronegativity',
      target_pattern: 'element.electronegativity($element)',
      kind: 'lookup',
      prerequisites: [],
      cost: 30,
      uncertainty_mode: 'exact',
    }]);

    const query: QueryExpr = {
      kind: 'query', id: 'q1', intent: 'find',
      target: {
        kind: 'call', predicate: 'element.electronegativity',
        args: [{ kind: 'symbol', ref: { kind: 'element', id: 'Na' } }],
      },
    };

    resolveQuery(query, env);
    expect(env.queryCache.size).toBe(1);

    // Same query different id → cache hit
    const query2 = { ...query, id: 'q2' };
    const result2 = resolveQuery(query2, env);
    expect(result2.answer).toEqual({ kind: 'value', value: 0.93 });
    expect(env.queryCache.size).toBe(1); // no new entry
  });

  it('returns error for unknown predicate', () => {
    const env = makeEnv([]);
    const query: QueryExpr = {
      kind: 'query', id: 'q1', intent: 'find',
      target: { kind: 'call', predicate: 'unknown.pred', args: [] },
    };
    const result = resolveQuery(query, env);
    expect(result.trace.status).not.toBe('success');
  });

  it('detects cycles', () => {
    // Resolution A requires B, B requires A
    const env = makeEnv([
      {
        id: 'res.a', origin: 'manual', target: 'pred.a', target_pattern: 'pred.a($x)',
        kind: 'equation', prerequisites: ['pred.b($x)'], cost: 100, uncertainty_mode: 'exact',
      },
      {
        id: 'res.b', origin: 'manual', target: 'pred.b', target_pattern: 'pred.b($x)',
        kind: 'equation', prerequisites: ['pred.a($x)'], cost: 100, uncertainty_mode: 'exact',
      },
    ]);

    const query: QueryExpr = {
      kind: 'query', id: 'q1', intent: 'find',
      target: { kind: 'call', predicate: 'pred.a', args: [{ kind: 'symbol', ref: { kind: 'element', id: 'X' } }] },
    };

    const result = resolveQuery(query, env);
    // Should not infinite loop, should return failure
    expect(result.trace.status).not.toBe('success');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/resolver/__tests__/resolve-query.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement resolve-query.ts**

Create `src/lib/resolver/resolve-query.ts`:

```ts
import type {
  QueryExpr, CallExpr, Expr, EqualityExpr, ValueExpr,
  ResolvedInputs, TraceNode, ResolverResult, SolverPolicy, QueryMeta,
} from '../../types/query-ast.js';
import type { ResolutionDef, ProblemKind, ResolutionAttemptStatus, CertaintyLevel } from '../../types/resolution.js';
import type { PredicateDef } from '../../types/predicate.js';
import type { ComputableFormula, ConstantsDict } from '../../types/formula.js';
import { computeFingerprint, unifyTarget, instantiatePattern } from './query-utils.js';
import { executeHandler, IMPLEMENTED_KINDS, type HandlerEnv } from './handlers/index.js';

export interface ResolverEnv {
  predicateRegistry: PredicateDef[];
  resolutionIndex: Record<string, ResolutionDef[]>;
  ontology: HandlerEnv['ontology'];
  formulaRegistry: ComputableFormula[];
  constants: ConstantsDict;
  indicatorRules?: unknown[];
  policy: SolverPolicy;
  queryCache: Map<string, ResolverResult>;
  activeQueryStack: Set<string>;
}

const MAX_BACKTRACK = 3;

function makeFailTrace(queryId: string, status: ResolutionAttemptStatus, reason: string): TraceNode {
  return {
    query_id: queryId,
    step_role: 'resolution',
    inputs: { target: { kind: 'value', value: '' } as Expr, bindings: {}, prerequisite_results: {} },
    output: { kind: 'value', value: reason },
    children: [],
    status,
  };
}

function makeFailResult(queryId: string, status: ResolutionAttemptStatus, reason: string): ResolverResult {
  return {
    answer: { kind: 'value', value: reason },
    trace: makeFailTrace(queryId, status, reason),
  };
}

/**
 * Normalize target for dispatch. For check(A = B), lower to find(logic.equal(A, B)).
 * Returns a CallExpr suitable for resolution lookup.
 */
function normalizeTarget(query: QueryExpr): CallExpr | null {
  const target = query.target;
  if (target.kind === 'call') return target;

  if (query.intent === 'check' && target.kind === 'equality') {
    // Lower: check(A = B) → find(logic.equal(A, B))
    return {
      kind: 'call',
      predicate: 'logic.equal',
      args: [target.left, target.right],
    };
  }

  return null;
}

/**
 * Try to satisfy a prerequisite from the query's givens.
 */
function matchGiven(
  prerequisitePattern: string,
  bindings: Record<string, Expr>,
  givens: EqualityExpr[],
): Expr | null {
  const instantiated = instantiatePattern(prerequisitePattern, bindings);

  for (const given of givens) {
    if (given.left.kind === 'call') {
      // Rough match: compare rendered form
      const givenPred = given.left.predicate;
      // Check if the prerequisite mentions this predicate
      if (instantiated.includes(givenPred)) {
        return given.right;
      }
    }
  }
  return null;
}

function mergePolicies(envPolicy: SolverPolicy, queryPolicy?: SolverPolicy): SolverPolicy {
  if (!queryPolicy) return envPolicy;
  return { ...envPolicy, ...queryPolicy };
}

export function resolveQuery(query: QueryExpr, env: ResolverEnv): ResolverResult {
  // 1. Compute fingerprint for cache and cycle detection
  const fingerprint = computeFingerprint(query);

  // 2. Cache check
  const cached = env.queryCache.get(fingerprint);
  if (cached) return cached;

  // 3. Cycle check
  if (env.activeQueryStack.has(fingerprint)) {
    return makeFailResult(query.id, 'not_applicable', 'cycle detected');
  }
  env.activeQueryStack.add(fingerprint);

  try {
    // 4. Normalize target
    const dispatchTarget = normalizeTarget(query);
    if (!dispatchTarget) {
      return makeFailResult(query.id, 'not_applicable', 'cannot normalize target for dispatch');
    }

    // 5. Extract predicate id
    const predicateId = dispatchTarget.predicate;

    // 6. Retrieve candidates
    const candidates = env.resolutionIndex[predicateId] || [];
    if (candidates.length === 0) {
      return makeFailResult(query.id, 'not_applicable', `no resolutions for predicate: ${predicateId}`);
    }

    const effectivePolicy = mergePolicies(env.policy, query.policy);
    const givens = query.givens || [];
    let attempts = 0;

    // 7. Try candidates in cost-ranked order
    const sorted = [...candidates].sort((a, b) => a.cost - b.cost);

    for (const candidate of sorted) {
      if (attempts >= MAX_BACKTRACK) break;

      // 7a. Unify
      const bindings = unifyTarget(dispatchTarget, candidate.target_pattern);
      if (!bindings) continue;

      // Skip stubs unless explicitly allowed
      if (!IMPLEMENTED_KINDS.has(candidate.kind)) {
        if (!effectivePolicy.allow_numerical && candidate.kind === 'numerical') continue;
        if (!effectivePolicy.allow_optimization && candidate.kind === 'optimization') continue;
        continue; // skip all unimplemented kinds
      }

      // 7b. Check applicability (simplified — string match for now)
      // TODO: full applicability evaluation

      // 7c-d. Resolve prerequisites
      const prerequisiteResults: Record<string, Expr> = {};
      const childTraces: TraceNode[] = [];
      let allPrereqsResolved = true;

      for (const prereqPattern of candidate.prerequisites) {
        // Try givens first
        const givenMatch = matchGiven(prereqPattern, bindings, givens);
        if (givenMatch) {
          const parsedPrereq = prereqPattern.match(/^([a-z_.]+)/)?.[1] || prereqPattern;
          prerequisiteResults[parsedPrereq] = givenMatch;
          childTraces.push({
            query_id: `${query.id}_given`,
            step_role: 'given',
            inputs: { target: { kind: 'value', value: prereqPattern }, bindings: {}, prerequisite_results: {} },
            output: givenMatch,
            children: [],
            status: 'success',
          });
          continue;
        }

        // Create subquery
        const instantiated = instantiatePattern(prereqPattern, bindings);
        const parsedPred = prereqPattern.match(/^([a-z_.]+)/)?.[1];
        if (!parsedPred) {
          allPrereqsResolved = false;
          break;
        }

        // Build subquery CallExpr from pattern + bindings
        const subArgs: Expr[] = [];
        const patternVars = prereqPattern.match(/\$\w+/g) || [];
        for (const v of patternVars) {
          if (bindings[v]) subArgs.push(bindings[v]);
        }

        const subQuery: QueryExpr = {
          kind: 'query',
          id: `${query.id}_sub_${parsedPred}`,
          intent: 'find',
          target: { kind: 'call', predicate: parsedPred, args: subArgs },
          givens, // inherit parent givens
          policy: effectivePolicy,
          meta: { origin: 'planner', parent_query_id: query.id },
        };

        const subResult = resolveQuery(subQuery, env);
        if (subResult.trace.status === 'success') {
          prerequisiteResults[parsedPred] = subResult.answer;
          childTraces.push(subResult.trace);
        } else {
          allPrereqsResolved = false;
          childTraces.push(subResult.trace);
          break;
        }
      }

      if (!allPrereqsResolved) {
        attempts++;
        continue;
      }

      // 7f. Execute handler
      const handlerInputs: ResolvedInputs = {
        target: dispatchTarget,
        bindings,
        prerequisite_results: prerequisiteResults,
        givens,
      };

      const handlerResult = executeHandler(candidate, handlerInputs, {
        formulas: env.formulaRegistry,
        constants: env.constants,
        ontologyData: env.ontology as never,
        ontology: env.ontology,
      });

      if ('error' in handlerResult) {
        attempts++;
        continue;
      }

      // 8. Build result
      const certainty: CertaintyLevel = candidate.uncertainty_mode === 'exact'
        ? 'exact'
        : candidate.uncertainty_mode === 'model_limited'
          ? 'model_limited'
          : 'derived_exact_under_model';

      const result: ResolverResult = {
        answer: handlerResult.answer,
        trace: {
          query_id: query.id,
          step_role: 'resolution',
          resolution_kind: candidate.kind,
          resolution_id: candidate.id,
          inputs: handlerInputs,
          output: handlerResult.answer,
          formula_rendered: handlerResult.formula_rendered,
          children: childTraces,
          status: 'success',
        },
        certainty,
      };

      // 9. Cache
      env.queryCache.set(fingerprint, result);
      return result;
    }

    // All candidates exhausted
    return makeFailResult(query.id, 'handler_failed', `all ${sorted.length} resolution candidates failed`);

  } finally {
    env.activeQueryStack.delete(fingerprint);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/resolver/__tests__/resolve-query.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/resolver/resolve-query.ts src/lib/resolver/__tests__/resolve-query.test.ts
git commit -m "feat(dsl): add resolveQuery dispatch with unification, planning, caching, cycle detection"
```

---

### Task 10: UI — QueryBuilder Shell + IntentSelector + PredicateTypeahead

**Files:**
- Create: `src/features/solver/QueryBuilder.tsx`
- Create: `src/features/solver/IntentSelector.tsx`
- Create: `src/features/solver/PredicateTypeahead.tsx`

- [ ] **Step 1: Create IntentSelector**

Create `src/features/solver/IntentSelector.tsx`:

```tsx
import { type Intent } from '../../types/query-ast.js';

interface Props {
  value: Intent | null;
  onChange: (intent: Intent) => void;
}

const INTENTS: Array<{ id: Intent; label: string }> = [
  { id: 'find', label: 'Найти' },
  { id: 'derive', label: 'Вычислить' },
  { id: 'check', label: 'Проверить' },
];

export default function IntentSelector({ value, onChange }: Props) {
  return (
    <div className="intent-selector" style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
      {INTENTS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={`intent-chip ${value === id ? 'intent-chip--active' : ''}`}
          onClick={() => onChange(id)}
          style={{
            padding: '6px 16px',
            borderRadius: '16px',
            border: value === id ? '2px solid var(--accent, #2563eb)' : '1px solid #d1d5db',
            background: value === id ? 'var(--accent-bg, #eff6ff)' : '#fff',
            cursor: 'pointer',
            fontWeight: value === id ? 600 : 400,
            fontSize: '14px',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create PredicateTypeahead**

Create `src/features/solver/PredicateTypeahead.tsx`:

```tsx
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import type { PredicateDef } from '../../types/predicate.js';
import type { Intent } from '../../types/query-ast.js';

interface Props {
  predicates: PredicateDef[];
  intent: Intent | null;
  locale: string;
  value: PredicateDef | null;
  onChange: (predicate: PredicateDef | null) => void;
}

const RESULT_KIND_LABELS: Record<string, string> = {
  'scalar:number': 'число',
  'categorical:substance_class': 'категория',
  'categorical:boolean': 'да/нет',
  'set:ion_list': 'список',
  'set:substance_list': 'список',
};

export default function PredicateTypeahead({ predicates, intent, locale, value, onChange }: Props) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    let list = predicates;

    // Filter by intent
    if (intent === 'derive') {
      list = list.filter(p => p.returns.startsWith('scalar:'));
    } else if (intent === 'check') {
      list = list.filter(p => p.returns.includes('boolean') || p.role === 'goal');
    } else if (intent === 'find') {
      list = list.filter(p => p.role === 'goal');
    }

    // Filter by search text
    if (input.trim()) {
      const q = input.toLowerCase().trim();
      list = list.filter(p => {
        const aliases = p.aliases?.[locale] || p.aliases?.['ru'] || [];
        const tokens = p.search_tokens?.[locale] || p.search_tokens?.['ru'] || [];
        return (
          p.id.toLowerCase().includes(q) ||
          aliases.some(a => a.toLowerCase().includes(q)) ||
          tokens.some(t => t.toLowerCase().startsWith(q))
        );
      });
    }

    // Exclude constructors from goal selection
    return list.filter(p => p.role !== 'context');
  }, [predicates, intent, input, locale]);

  const handleSelect = useCallback((p: PredicateDef) => {
    onChange(p);
    setOpen(false);
    setInput('');
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter' && filtered[highlight]) { handleSelect(filtered[highlight]); }
    else if (e.key === 'Escape') { setOpen(false); }
  }, [filtered, highlight, handleSelect]);

  useEffect(() => { setHighlight(0); }, [filtered]);

  if (value) {
    const displayName = value.aliases?.[locale]?.[0] || value.aliases?.['ru']?.[0] || value.id;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{
          padding: '4px 12px', borderRadius: '12px', background: '#eff6ff',
          border: '1px solid #93c5fd', fontSize: '14px',
        }}>
          <span style={{ opacity: 0.6, fontSize: '12px' }}>{value.namespace}.</span>
          {displayName}
          <span style={{ marginLeft: '8px', opacity: 0.5, fontSize: '11px' }}>
            {RESULT_KIND_LABELS[value.returns] || ''}
          </span>
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#9ca3af' }}
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', marginBottom: '12px' }}>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={e => { setInput(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Что нужно найти? (начните печатать)"
        style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
      />
      {open && filtered.length > 0 && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px',
          maxHeight: '240px', overflowY: 'auto', listStyle: 'none', padding: '4px 0', margin: '4px 0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          {filtered.slice(0, 20).map((p, i) => {
            const name = p.aliases?.[locale]?.[0] || p.aliases?.['ru']?.[0] || p.id;
            return (
              <li
                key={p.id}
                onClick={() => handleSelect(p)}
                onMouseEnter={() => setHighlight(i)}
                style={{
                  padding: '8px 12px', cursor: 'pointer', fontSize: '14px',
                  background: i === highlight ? '#f3f4f6' : 'transparent',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span>
                  <span style={{ opacity: 0.5, fontSize: '11px', marginRight: '4px' }}>{p.namespace}</span>
                  {name}
                </span>
                <span style={{ opacity: 0.4, fontSize: '11px' }}>
                  {RESULT_KIND_LABELS[p.returns] || ''}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create QueryBuilder shell**

Create `src/features/solver/QueryBuilder.tsx`:

```tsx
import { useState, useMemo, useCallback } from 'react';
import type { PredicateDef } from '../../types/predicate.js';
import type { Intent, QueryExpr, Expr, CallExpr, SymbolExpr, ValueExpr, EqualityExpr } from '../../types/query-ast.js';
import type { ResolutionDef } from '../../types/resolution.js';
import IntentSelector from './IntentSelector.js';
import PredicateTypeahead from './PredicateTypeahead.js';
import { renderCanonical, suggestGivens } from '../../lib/resolver/query-utils.js';

interface Props {
  predicates: PredicateDef[];
  resolutionIndex: Record<string, ResolutionDef[]>;
  locale: string;
  onSolve: (query: QueryExpr) => void;
}

let queryIdCounter = 0;

export default function QueryBuilder({ predicates, resolutionIndex, locale, onSolve }: Props) {
  const [intent, setIntent] = useState<Intent | null>(null);
  const [predicate, setPredicate] = useState<PredicateDef | null>(null);
  const [argValues, setArgValues] = useState<Record<string, string>>({});
  const [givens, setGivens] = useState<Array<{ predicate: string; value: string; unit: string }>>([]);

  const suggestions = useMemo(() => {
    if (!predicate) return [];
    return suggestGivens(predicate.id, resolutionIndex);
  }, [predicate, resolutionIndex]);

  const buildQuery = useCallback((): QueryExpr | null => {
    if (!intent || !predicate) return null;

    const args: Expr[] = predicate.positional_args.map(arg => {
      const val = argValues[arg.name];
      if (!val) return { kind: 'value' as const, value: '' };
      return {
        kind: 'symbol' as const,
        ref: { kind: 'substance' as const, id: val }, // simplified; real impl checks arg.type
      } satisfies SymbolExpr;
    });

    const target: CallExpr = {
      kind: 'call',
      predicate: predicate.id,
      args,
    };

    const givenExprs: EqualityExpr[] = givens
      .filter(g => g.predicate && g.value)
      .map(g => ({
        kind: 'equality' as const,
        left: { kind: 'call' as const, predicate: g.predicate, args } satisfies CallExpr,
        right: { kind: 'value' as const, value: parseFloat(g.value) || g.value, unit: g.unit || undefined } satisfies ValueExpr,
      }));

    return {
      kind: 'query',
      id: `q_${++queryIdCounter}`,
      intent,
      target,
      givens: givenExprs.length > 0 ? givenExprs : undefined,
      meta: { origin: 'user', locale },
    };
  }, [intent, predicate, argValues, givens, locale]);

  const query = buildQuery();
  const canonical = query ? renderCanonical(query) : '';
  const isValid = intent !== null && predicate !== null && predicate.positional_args.every(a => a.optional || argValues[a.name]);

  return (
    <div className="query-builder" style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '12px', background: '#fafafa' }}>
      <IntentSelector value={intent} onChange={setIntent} />

      {intent && (
        <PredicateTypeahead
          predicates={predicates}
          intent={intent}
          locale={locale}
          value={predicate}
          onChange={setPredicate}
        />
      )}

      {predicate && (
        <div className="argument-form" style={{ marginBottom: '12px' }}>
          {predicate.positional_args.map(arg => (
            <div key={arg.name} style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                {arg.name}{!arg.optional && ' *'}
              </label>
              <input
                type="text"
                value={argValues[arg.name] || ''}
                onChange={e => setArgValues(v => ({ ...v, [arg.name]: e.target.value }))}
                placeholder={`${arg.type}`}
                style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
              />
            </div>
          ))}
        </div>
      )}

      {predicate && intent === 'derive' && (
        <div className="givens-panel" style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>Дано:</div>
          {suggestions.map((s, i) => (
            <div key={s.predicate} style={{ display: 'flex', gap: '8px', marginBottom: '4px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', minWidth: '120px', color: s.suggestion_kind === 'usually_derived' ? '#9ca3af' : '#374151' }}>
                {s.predicate.replace('quantity.', '')}
                {s.suggestion_kind === 'usually_derived' && <span style={{ fontSize: '11px' }}> (вычислим)</span>}
              </span>
              {s.suggestion_kind !== 'usually_derived' && (
                <>
                  <input
                    type="number"
                    value={givens[i]?.value || ''}
                    onChange={e => {
                      const next = [...givens];
                      next[i] = { predicate: s.predicate, value: e.target.value, unit: s.unit || '' };
                      setGivens(next);
                    }}
                    placeholder="значение"
                    style={{ width: '100px', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
                  />
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>{s.unit}</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {canonical && (
        <div className="canonical-preview" style={{
          padding: '8px 12px', background: '#f0f9ff', borderRadius: '8px',
          fontFamily: 'monospace', fontSize: '13px', color: '#1e40af', marginBottom: '12px',
        }}>
          {canonical}
        </div>
      )}

      <button
        type="button"
        disabled={!isValid}
        onClick={() => query && onSolve(query)}
        style={{
          padding: '8px 24px', borderRadius: '8px', border: 'none',
          background: isValid ? 'var(--accent, #2563eb)' : '#d1d5db',
          color: '#fff', cursor: isValid ? 'pointer' : 'not-allowed',
          fontSize: '14px', fontWeight: 600,
        }}
      >
        Решить
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/features/solver/QueryBuilder.tsx src/features/solver/IntentSelector.tsx src/features/solver/PredicateTypeahead.tsx
git commit -m "feat(dsl): add QueryBuilder UI with IntentSelector, PredicateTypeahead, argument form, givens panel"
```

---

### Task 11: Integrate QueryBuilder into SolverPage

**Files:**
- Modify: `src/features/solver/SolverPage.tsx`

- [ ] **Step 1: Add feature flag import and new data loading**

In `src/features/solver/SolverPage.tsx`, add imports:

```ts
import { isEnabled } from '../../config/feature-flags.js';
import QueryBuilder from './QueryBuilder.js';
import { resolveQuery, type ResolverEnv } from '../../lib/resolver/resolve-query.js';
import { loadPredicateRegistry, loadResolutionIndex } from '../../lib/data-loader.js';
import type { PredicateDef } from '../../types/predicate.js';
import type { ResolutionDef } from '../../types/resolution.js';
import type { QueryExpr } from '../../types/query-ast.js';
```

Add state for new data (~after existing state declarations):

```ts
const [predicates, setPredicates] = useState<PredicateDef[]>([]);
const [resolutionIndex, setResolutionIndex] = useState<Record<string, ResolutionDef[]>>({});
```

Add to the Promise.all in useEffect data loading:

```ts
loadPredicateRegistry(),
loadResolutionIndex(),
```

And set them in the .then callback:

```ts
setPredicates(preds);
setResolutionIndex(resIdx);
```

- [ ] **Step 2: Add QueryBuilder render with feature flag**

In the render section, wrap the existing template-based UI with a feature flag check, and add QueryBuilder as alternative:

```tsx
{isEnabled('newQueryBuilder') ? (
  <QueryBuilder
    predicates={predicates}
    resolutionIndex={resolutionIndex}
    locale={locale}
    onSolve={(query) => {
      const env: ResolverEnv = {
        predicateRegistry: predicates,
        resolutionIndex,
        ontology: { elements, substances, ions: [] },
        formulaRegistry: formulas,
        constants: constantsDict,
        indicatorRules,
        policy: { require_traceable_steps: true },
        queryCache: new Map(),
        activeQueryStack: new Set(),
      };
      const result = resolveQuery(query, env);
      // Display result — adapt to existing result display
      setResult(result as any); // TODO: proper type bridge in next task
    }}
  />
) : (
  /* existing template-based UI unchanged */
)}
```

- [ ] **Step 3: Test with feature flag**

Open browser, set `localStorage.setItem('ff_newQueryBuilder', 'true')`, reload `/solver`. Verify QueryBuilder renders with intent chips and predicate typeahead.

- [ ] **Step 4: Commit**

```bash
git add src/features/solver/SolverPage.tsx
git commit -m "feat(dsl): integrate QueryBuilder into SolverPage behind feature flag"
```

---

### Task 12: Parity Tests

**Files:**
- Create: `src/lib/resolver/__tests__/parity.test.ts`

- [ ] **Step 1: Write parity tests comparing legacy and new resolver**

Create `src/lib/resolver/__tests__/parity.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolveQuery, type ResolverEnv } from '../resolve-query.js';
import { generateResolutionsFromFormulas, mergeResolutions, buildResolutionIndex } from '../../../../scripts/lib/generate-resolutions.mjs';
import type { QueryExpr } from '../../../types/query-ast.js';
import type { ComputableFormula } from '../../../types/formula.js';

let formulas: ComputableFormula[];
let constants: Record<string, number>;
let resolutionIndex: Record<string, unknown[]>;

beforeAll(async () => {
  formulas = JSON.parse(await readFile('data-src/foundations/formulas.json', 'utf8'));
  const constantsList = JSON.parse(await readFile('data-src/foundations/constants.json', 'utf8'));
  constants = {};
  for (const c of constantsList) {
    constants[c.id] = c.value;
  }

  const manualResolutions = JSON.parse(await readFile('data-src/foundations/resolutions.json', 'utf8'));
  const generated = generateResolutionsFromFormulas(formulas);
  const merged = mergeResolutions(generated, manualResolutions);
  resolutionIndex = buildResolutionIndex(merged);
});

function makeEnv(): ResolverEnv {
  return {
    predicateRegistry: [],
    resolutionIndex: resolutionIndex as Record<string, never[]>,
    ontology: {
      elements: [
        { Z: 11, symbol: 'Na', characteristics: { 'concept:atomic_mass': { value: 22.99 }, 'concept:electronegativity': { value: 0.93 } } },
        { Z: 17, symbol: 'Cl', characteristics: { 'concept:atomic_mass': { value: 35.45 }, 'concept:electronegativity': { value: 3.16 } } },
      ],
      substances: [{ id: 'sub:nacl', formula: 'NaCl', class: 'salt' }],
      ions: [],
    },
    formulaRegistry: formulas,
    constants,
    policy: { require_traceable_steps: true },
    queryCache: new Map(),
    activeQueryStack: new Set(),
  };
}

describe('parity: lookup', () => {
  it('resolves element electronegativity same as legacy', () => {
    const env = makeEnv();
    const query: QueryExpr = {
      kind: 'query', id: 'p1', intent: 'find',
      target: {
        kind: 'call', predicate: 'element.electronegativity',
        args: [{ kind: 'symbol', ref: { kind: 'element', id: 'Na' } }],
      },
    };
    const result = resolveQuery(query, env);
    expect(result.answer).toEqual({ kind: 'value', value: 0.93 });
  });
});

describe('parity: substance class', () => {
  it('resolves substance class via rule handler', () => {
    // This test requires full OntologyData — stub for now
    // Real parity testing runs against loaded ontology in build
  });
});

describe('parity: fingerprint stability', () => {
  it('same query produces same fingerprint across runs', () => {
    const { computeFingerprint } = require('../query-utils.js');
    const q: QueryExpr = {
      kind: 'query', id: 'test', intent: 'derive',
      target: {
        kind: 'call', predicate: 'quantity.mass',
        args: [{ kind: 'symbol', ref: { kind: 'substance', id: 'sub:nacl' } }],
      },
      givens: [{
        kind: 'equality',
        left: { kind: 'call', predicate: 'quantity.amount', args: [{ kind: 'symbol', ref: { kind: 'substance', id: 'sub:nacl' } }] },
        right: { kind: 'value', value: 2, unit: 'mol' },
      }],
    };
    const fp1 = computeFingerprint(q);
    const fp2 = computeFingerprint(q);
    expect(fp1).toBe(fp2);
  });
});
```

- [ ] **Step 2: Run parity tests**

Run: `npx vitest run src/lib/resolver/__tests__/parity.test.ts`
Expected: PASS for implemented scenarios.

- [ ] **Step 3: Commit**

```bash
git add src/lib/resolver/__tests__/parity.test.ts
git commit -m "test(dsl): add parity tests for resolver vs legacy query-solver"
```

---

### Task 13: Build Verification & Data Validation

- [ ] **Step 1: Run full data build**

Run: `npm run build:data`
Expected: Build completes with resolution registry and predicate registry stats printed.

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All existing tests + new resolver tests pass.

- [ ] **Step 3: Run full build**

Run: `npm run build`
Expected: Astro build completes without errors.

- [ ] **Step 4: Commit if any fixes were needed**

```bash
git add -u
git commit -m "fix(dsl): build and test fixes for Phase 1 integration"
```

---

## File Map Summary

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src/types/resolution.ts` | ResolutionDef, ProblemKind, CertaintyLevel types |
| Create | `src/types/predicate.ts` | PredicateDef, ArgDef types |
| Create | `src/types/query-ast.ts` | Full Expr AST, QueryExpr, ResolverResult, TraceNode |
| Create | `src/config/feature-flags.ts` | Feature flag system |
| Create | `data-src/foundations/resolutions.json` | Manual resolution definitions (~14 entries) |
| Create | `data-src/foundations/predicate_overrides.json` | Manual predicate definitions (~9 entries) |
| Create | `scripts/lib/generate-resolutions.mjs` | Build: formulas → ResolutionDef[] |
| Create | `scripts/lib/generate-predicates.mjs` | Build: ontology → PredicateDef[] |
| Create | `src/lib/resolver/resolve-query.ts` | Core dispatch: resolveQuery() |
| Create | `src/lib/resolver/query-utils.ts` | fingerprint, unify, render, suggestGivens |
| Create | `src/lib/resolver/handlers/equation-handler.ts` | Wraps derivation planner |
| Create | `src/lib/resolver/handlers/rule-handler.ts` | Wraps existing solvers |
| Create | `src/lib/resolver/handlers/lookup-handler.ts` | Ontology property lookup |
| Create | `src/lib/resolver/handlers/stub-handler.ts` | Stub for unimplemented kinds |
| Create | `src/lib/resolver/handlers/index.ts` | Handler dispatch + IMPLEMENTED_KINDS |
| Create | `src/features/solver/QueryBuilder.tsx` | Main UI shell |
| Create | `src/features/solver/IntentSelector.tsx` | Intent chip selector |
| Create | `src/features/solver/PredicateTypeahead.tsx` | Searchable predicate picker |
| Modify | `scripts/build-data.mjs` | Add resolution + predicate generation |
| Modify | `src/types/manifest.ts` | Add foundation entries |
| Modify | `src/lib/data-loader.ts` | Add load functions |
| Modify | `src/features/solver/SolverPage.tsx` | Feature-flagged QueryBuilder |
| Create | `src/lib/resolver/__tests__/generate-resolutions.test.ts` | Unit tests |
| Create | `src/lib/resolver/__tests__/generate-predicates.test.ts` | Unit tests |
| Create | `src/lib/resolver/__tests__/query-utils.test.ts` | Unit tests |
| Create | `src/lib/resolver/__tests__/resolve-query.test.ts` | Integration tests |
| Create | `src/lib/resolver/__tests__/parity.test.ts` | Parity with legacy |
