# Query DSL Phase 1: Resolution Registry, Predicate Registry, Query AST, Planner & Cascading UI

**Date**: 2026-03-31
**Status**: Design approved
**Approach**: B — Resolution layer as core, bottom-up
**Scope**: `derive` + `find` + `check` intents; mixing path decomposed into subqueries

## Table of Contents

1. [Resolution Registry](#1-resolution-registry)
2. [Predicate Registry](#2-predicate-registry)
3. [Query AST](#3-query-ast)
4. [Query Dispatch & Planner](#4-query-dispatch--planner)
5. [Cascading Typeahead UI](#5-cascading-typeahead-ui)
6. [Scope, Migration & Deliverables](#6-scope-migration--deliverables)

---

## 1. Resolution Registry

### Purpose

Describes **how** a semantic goal can be obtained. Equations auto-generate forward + inverse resolutions from `formulas.json`; non-equation resolutions (rule, lookup, optimization) are hand-authored in `resolutions.json`.

### Type: ResolutionDef

```ts
type ProblemKind =
  | "equation"
  | "rule"
  | "lookup"
  | "constraint_satisfaction"
  | "optimization"
  | "enumeration"
  | "numerical"
  | "simulation"

type ResolutionDef = {
  id: string                          // "res.mass_from_amount.forward"
  family?: string                     // "formula:mass_from_amount" — groups forward + inverses
  origin: "generated_from_formula" | "manual"
  origin_ref?: string                 // source formula id or resolutions.json entry

  target: string                      // predicate id for quick index: "quantity.mass"
  target_pattern: string              // "quantity.mass($entity)" — pattern with variables

  kind: ProblemKind

  prerequisites: string[]             // patterns: ["quantity.amount($entity)", "quantity.molar_mass($entity)"]
  solver_id?: string                  // "resolver.equation" | "solver.classify_substance" | ...

  formula_id?: string                 // link to ComputableFormula for any kind
  solve_for?: string                  // variable symbol for equation kind
  compute_expr_serialized?: string    // serialized normalized expression (not executable raw code; parsed at runtime)

  applicability?: string[]            // when resolution is relevant: ["ideal_gas", "school_model"]
  preconditions?: string[]            // must hold before applying: ["quantity.molar_mass($entity) != 0"]

  cost: number                        // relative planning heuristic (lower = preferred)
  uncertainty_mode: "exact" | "propagate" | "model_limited"
  approximation_kind?: "exact" | "school_simplification" | "empirical" | "idealized_model"

  result_shape?: "scalar" | "categorical" | "set" | "object" | "candidate_set" | "interval"
  explanation_template?: string
}
```

### Semantic norms

**A. target_pattern**: Planner-facing canonical pattern used for unification against instantiated query targets.

**B. prerequisites**: Planner subgoal patterns instantiated using bindings obtained from target_pattern unification.

**C. Empty prerequisites**: The selected resolver can derive the target directly from target arguments, context, and internal domain logic.

**D. cost**: Relative planning heuristic only. Must not be interpreted as a direct proxy for accuracy, pedagogical quality, or epistemic reliability.

### Source files

- **`data-src/foundations/formulas.json`** (existing, 26 formulas) — canonical source for equation resolutions.
- **`data-src/foundations/resolutions.json`** (new) — manual rule/lookup/constraint_satisfaction/optimization resolutions. Only for goals not derivable from formula inversion.

### Build pipeline: `scripts/lib/generate-resolutions.mjs`

**Step 1 — Parse formulas.json**:
- Validate variables, invertible_for, variable→predicate mapping.
- Generate forward ResolutionDef: target_pattern from result_variable, prerequisites from input variables.
- Generate inverse ResolutionDefs: one per `invertible_for` entry.
- Assign: family = formula id, origin = "generated_from_formula", formula_id, solve_for.
- Compile compute_expr_serialized from AST expression.

**Step 2 — Parse resolutions.json**:
- Validate target exists in predicate registry.
- Validate solver_id references a registered resolver.
- Assign origin = "manual".

**Step 3 — Merge + validate**:
- Deduplicate by id.
- Conflict check: same target_pattern + same prerequisites + same kind → warning.
- Sort by target → cost for stable planner behavior.

**Step 4 — Emit**:
- `resolution_registry.json` — full ResolutionDef array.
- `resolution_index.json` — `Map<target_predicate_id, ResolutionDef[]>` for O(1) planner lookup. Additional derived indexes may be added as needed.

### Examples

**Generated equation resolution** (from `formula:mass_from_amount`, m = n × M):

```json
{
  "id": "res.mass_from_amount.forward",
  "family": "formula:mass_from_amount",
  "origin": "generated_from_formula",
  "origin_ref": "formula:mass_from_amount",
  "target": "quantity.mass",
  "target_pattern": "quantity.mass($entity)",
  "kind": "equation",
  "prerequisites": ["quantity.amount($entity)", "quantity.molar_mass($entity)"],
  "solver_id": "resolver.equation",
  "formula_id": "formula:mass_from_amount",
  "solve_for": "m",
  "compute_expr_serialized": "multiply(quantity.amount($entity), quantity.molar_mass($entity))",
  "cost": 100,
  "uncertainty_mode": "propagate",
  "approximation_kind": "exact",
  "result_shape": "scalar"
}
```

**Generated inverse** (n = m / M):

```json
{
  "id": "res.mass_from_amount.inv_n",
  "family": "formula:mass_from_amount",
  "origin": "generated_from_formula",
  "origin_ref": "formula:mass_from_amount",
  "target": "quantity.amount",
  "target_pattern": "quantity.amount($entity)",
  "kind": "equation",
  "prerequisites": ["quantity.mass($entity)", "quantity.molar_mass($entity)"],
  "solver_id": "resolver.equation",
  "formula_id": "formula:mass_from_amount",
  "solve_for": "n",
  "compute_expr_serialized": "divide(quantity.mass($entity), quantity.molar_mass($entity))",
  "preconditions": ["quantity.molar_mass($entity) != 0"],
  "cost": 110,
  "uncertainty_mode": "propagate",
  "approximation_kind": "exact",
  "result_shape": "scalar"
}
```

**Manual rule resolution**:

```json
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
}
```

**Manual optimization resolution** (stoich_lp):

```json
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
  "approximation_kind": "exact",
  "result_shape": "object"
}
```

---

## 2. Predicate Registry

### Purpose

Describes **what** can be asked. Generated at build time from ontology data sources. The predicate registry is the autocomplete vocabulary for the UI and the dispatch target for the planner.

### Type: PredicateDef

```ts
type PredicateDef = {
  id: string                          // "quantity.mass", "substance.class", "indicator.color"
  namespace: string                   // "quantity", "substance", "element", "reaction", "indicator", "solution"

  role: "goal" | "fact" | "context"   // query target? given? context argument?
  returns: TypeRef                    // "scalar:number", "categorical:substance_class", "set:ion_list"

  positional_args: ArgDef[]           // [{name: "entity", type: "SubstanceRef | ElementRef"}]
  named_args: ArgDef[]                // [{name: "context", type: "ChemicalEntity", optional: true}]

  temporal_kind: "static" | "observable" | "process"

  // Search & UX (per-locale)
  aliases: Record<string, string[]>   // {"ru": ["масса"], "en": ["mass"], ...}
  search_tokens: Record<string, string[]>

  // Provenance
  source: PredicateSource
}

type ArgDef = {
  name: string
  type: string                        // "SubstanceRef" | "ElementRef" | "IonRef" | "number" | "TimeExpr"
  optional?: boolean
  description?: string
}

type PredicateSource =
  | { kind: "property"; property_id: string }
  | { kind: "formula_variable"; formula_id: string; variable: string }
  | { kind: "concept"; concept_id: string }
  | { kind: "process"; process_id: string }
  | { kind: "constructor" }
  | { kind: "manual" }
```

### Source mapping

| Source | File | Count | Generated predicates |
|--------|------|-------|---------------------|
| Properties | `rules/properties.json` | 11 | `element.{id}`, `substance.{id}`, `ion.charge` |
| Formulas | `foundations/formulas.json` | 26 | `quantity.{variable.quantity}` (deduplicated, ~15) |
| Concepts | `concepts.json` | 152 | `substance.class`, `reaction.type`, `reaction.observation` (~8 patterns) |
| Process vocab | `process_vocab.json` | 38 | `reaction.driving_force`, `system.operation` (~5 patterns) |
| Constructors | hardcoded list | 3 | `ctor.solution`, `ctor.mixture`, `ctor.env` (role: "context") |
| Overrides | `predicate_overrides.json` | ~10 | `indicator.color`, `reaction.products`, `system.medium`, etc. |

`predicate_overrides.json` is only for predicates not derivable from ontology/formula sources, or for UI/runtime metadata overrides. It must not duplicate ontology-derived predicates.

### Build pipeline: `scripts/lib/generate-predicates.mjs`

**Step 1** — Parse properties.json → property predicates.
**Step 2** — Parse formulas.json → quantity predicates (deduplicate by variable.quantity).
**Step 3** — Parse concepts.json → classification predicates (filter by kind).
**Step 4** — Parse process_vocab.json → process predicates.
**Step 5** — Inject constructor predicate defs (ctor.solution, ctor.mixture, ctor.env).
**Step 6** — Parse predicate_overrides.json → manual predicates.
**Step 7** — Merge, deduplicate, validate (no id collisions, all ArgDef types resolvable).
**Step 8** — Localize: pull aliases and search_tokens from translation overlays (4 locales).
**Step 9** — Emit:
  - `predicate_registry.json` — full PredicateDef array.
  - `predicate_index.json` — `Map<namespace, PredicateDef[]>` for UI filtering.

### Relationship with Resolution Registry

Each `ResolutionDef.target` references a `PredicateDef.id`. Build pipeline validates that all resolution targets have a corresponding predicate. Predicate describes **what** can be asked; resolution describes **how** to obtain it.

---

## 3. Query AST

### Core types

```ts
type Expr =
  | QueryExpr
  | CallExpr
  | EqualityExpr
  | ValueExpr
  | SymbolExpr
  | ListExpr
  | EventExpr
  | TimeExpr

type QueryExpr = {
  kind: "query"
  id: string
  intent: Intent
  target: Expr                        // typically CallExpr; for check may be EqualityExpr
  givens?: EqualityExpr[]
  constraints?: Expr[]                // boolean-like expressions or domain predicates
  quality?: QualityRequirement[]
  policy?: SolverPolicy
  meta?: QueryMeta
}

type Intent = "find" | "check" | "derive" | "explain" | "plan"

type CallExpr = {
  kind: "call"
  predicate: string
  args: Expr[]
  namedArgs?: Record<string, Expr>
}

type EqualityExpr = {
  kind: "equality"
  left: Expr
  right: Expr
}

type ValueExpr = {
  kind: "value"
  value: number | string | boolean
  unit?: string
  uncertainty?: number                // reserved for Phase 4
}

type SymbolExpr = {
  kind: "symbol"
  ref: EntityRef
}

type ListExpr = {
  kind: "list"
  items: Expr[]
}

// ─── Temporal (reserved in AST, hidden/feature-flagged in Phase 1 UI) ───

type EventExpr = {
  kind: "event"
  event_type: string                  // registered event id from event registry
  params?: Record<string, Expr>
}

type TimeExpr = {
  kind: "time"
  base: EventExpr | TimeExpr | "start"
  offset?: ValueExpr
  relation: "at" | "after" | "before"
}

// ─── Entity references ───

type EntityRef =
  | { kind: "substance"; id: string }
  | { kind: "element"; id: string }
  | { kind: "ion"; id: string }
  | { kind: "indicator"; id: string }
  | { kind: "reaction"; id: string }
  | { kind: "concept"; id: string }

// ─── Quality & Policy ───

type QualityRequirement =
  | "with_uncertainty"
  | "exact_only"
  | "prefer_exact"
  | "show_assumptions"
  | "show_uncertainty"

type SolverPolicy = {
  preferred_kinds?: ProblemKind[]
  allow_numerical?: boolean           // default: false (school mode)
  allow_optimization?: boolean        // default: false
  require_traceable_steps?: boolean   // default: true
  max_depth?: number                  // inherited from system default if omitted
}

type QueryMeta = {
  origin: "user" | "planner" | "resolver"
  parent_query_id?: string
  locale?: string
}
```

### Semantic norms

**A. target**: The semantic goal of the query. For `find`, `derive`, `explain`, and `plan`, it is typically a `CallExpr`. For `check`, it may also be an `EqualityExpr` or another boolean-like expression.

**B. givens**: User- or planner-supplied known facts. Commonly equalities, but may later be generalized to other asserted expressions.

**C. constraints**: Boolean-like expressions or domain predicates that must hold during planning/solving.

**D. Constructors**: `ctor.*` expressions are first-class AST nodes represented as `CallExpr`; they are valid arguments to predicates but are not usually top-level goals.

**E. Planner subqueries**: Reuse the same `QueryExpr` shape as user queries. They differ only in `meta.origin`, `parent_query_id`, and usually narrower scope.

### Canonical rendering

`renderCanonical(query: QueryExpr): string` — recursive pretty-printer. FormulaChip rendering for substance/element refs.

```
derive(quantity.mass(NaCl), given=[quantity.amount(NaCl) = 2 mol])
find(substance.class(H₂SO₄))
check(reaction.possible(reactants=[Na₂CO₃, HCl]))
```

### Constructors as CallExpr

```ts
// solution(H2SO4, ω=10%)
{ kind: "call", predicate: "ctor.solution",
  args: [{ kind: "symbol", ref: { kind: "substance", id: "sub:h2so4" } }],
  namedArgs: { "mass_fraction": { kind: "value", value: 10, unit: "%" } } }

// mixture(solution1, solution2)
{ kind: "call", predicate: "ctor.mixture", args: [solutionExpr1, solutionExpr2] }

// env(t=25°C, p=1atm)
{ kind: "call", predicate: "ctor.env",
  namedArgs: { "t": { kind: "value", value: 25, unit: "°C" },
               "p": { kind: "value", value: 1, unit: "atm" } } }
```

---

## 4. Query Dispatch & Planner

### resolveQuery() — single entry point

```ts
function resolveQuery(query: QueryExpr, env: ResolverEnv): ResolverResult

type ResolverEnv = {
  predicateRegistry: PredicateDef[]
  resolutionIndex: Map<string, ResolutionDef[]>
  ontology: OntologyAccess
  formulaRegistry: ComputableFormula[]
  constants: ConstantsDict
  indicatorRules?: IndicatorRule[]
  policy: SolverPolicy
  queryCache: Map<string, ResolverResult>   // by fingerprint
  activeQueryStack: Set<string>             // fingerprints for cycle detection
}
```

### Dispatch logic

1. **Canonicalize** query target, givens, and constructor expressions; resolve entity refs against ontology. Normalize constructor aliases, fill default named args, normalize unit forms.
2. **Compute query fingerprint** (predicate + args + givens, without meta/id). Check `queryCache` — if hit, return cached.
3. **Cycle check**: if fingerprint in `activeQueryStack` → cycle detected, abort with failure.
4. **Normalize target** into `DispatchableGoalExpr` (= `CallExpr`). Lowering rules: `check(A = B)` → `find(logic.equal(A, B))` with expected result `true`; `check(P)` where P is CallExpr → dispatch directly.
5. **Extract target predicate id** from normalized goal.
6. **Retrieve candidate** `ResolutionDef[]` from `resolutionIndex[targetPredicateId]`.
7. **For each candidate in cost-ranked order**:
   - a. `unifyTarget(normalizedGoal, candidate.target_pattern)` → bindings or fail. If fail → skip.
   - b. Filter by applicability, preconditions, and effective policy.
   - c. Instantiate prerequisites using bindings.
   - d. Try to satisfy prerequisites from givens first (structural match after binding substitution).
   - e. For unsatisfied prerequisites → create planner subqueries and `resolveQuery()` recursively. Subquery inheritance: givens inherited, effective policy inherited, constraints may narrow but not widen parent scope unless resolver explicitly introduces assumptions.
   - f. If all prerequisites succeed → execute resolution handler.
   - g. If handler fails → record `ResolutionAttemptStatus`, continue with next candidate.
8. **Build ResolverResult** with answer, trace, assumptions, certainty.
9. **Store** by fingerprint in `queryCache`. Remove from `activeQueryStack`.

### Effective policy

`effective_policy = merge(env.policy, query.policy)` where query.policy overrides env defaults.

### Resolution attempt statuses

```ts
type ResolutionAttemptStatus =
  | "success"
  | "not_applicable"       // unification failed or applicability mismatch
  | "precondition_failed"  // precondition check returned false
  | "subquery_failed"      // prerequisite subquery could not be resolved
  | "handler_failed"       // handler execution error
  | "not_implemented"      // stub handler
```

### Resolution handlers

```ts
type ResolutionHandler = {
  kind: ProblemKind
  execute(resolution: ResolutionDef, inputs: ResolvedInputs, env: ResolverEnv): HandlerResult
}

type ResolvedInputs = {
  target: Expr
  bindings: Record<string, Expr>
  prerequisite_results: Record<string, Expr>
  givens?: EqualityExpr[]
}

const HANDLERS: Record<ProblemKind, ResolutionHandler> = {
  equation:                equationHandler,       // wraps existing derivation planner
  rule:                    ruleHandler,           // calls solver by solver_id
  lookup:                  lookupHandler,         // ontology property lookup
  optimization:            optimizationHandler,   // stub Phase 1
  constraint_satisfaction: csHandler,             // stub Phase 1
  enumeration:             enumHandler,           // stub Phase 1
  numerical:               numericalHandler,      // stub Phase 1
  simulation:              simulationHandler,     // stub Phase 1
}
```

Stub handlers are registered but **not selected by planner unless explicitly allowed by policy and no implemented alternative exists**.

Phase 1 implements: **equation**, **rule**, **lookup**. equationHandler wraps the existing derivation planner as an implementation detail. ruleHandler wraps existing solvers via solver_id. lookupHandler reads from ontology data.

The boundary: equationHandler may delegate to existing derivation planner for internal formula-chain solving, but planner-level query decomposition remains external and resolution-driven.

### Backtracking

Max backtrack attempts: configurable in `SolverPolicy`, default 3. Failed subquery branch invalidates current candidate but does not invalidate parent query globally unless all candidates fail.

### ResolverResult

```ts
type ResolverResult = {
  answer: Expr
  trace: TraceNode
  certainty?: CertaintyLevel
  assumptions?: string[]
  error_sources?: ErrorSource[]
}

type CertaintyLevel =
  | "exact"
  | "derived_exact_under_model"
  | "approximate"
  | "measurement_limited"
  | "model_limited"
  | "qualitative_only"

type TraceNode = {
  query_id: string
  step_role: "planner" | "resolution" | "given"
  resolution_kind?: ProblemKind
  resolution_id?: string
  inputs: ResolvedInputs
  output: Expr
  formula_rendered?: string
  children: TraceNode[]
  status: ResolutionAttemptStatus
  assumptions?: string[]
}
```

Trace is a tree, not a flat list. Certainty defaults from `resolution.uncertainty_mode`.

### Caching

`queryCache` keyed by canonical fingerprint. Molar mass of NaCl computed once per session.

### Mixing decomposition example

```
find(indicator.color(litmus, system=mixture(solution(H₂SO₄,ω=10%), solution(NaOH,ω=10%))))

q_001: find(indicator.color(litmus, system=...))
  └─ q_002: find(system.medium(mixture(...)))
       ├─ q_003: derive(quantity.equivalent(H₂SO₄, ...))
       │    ├─ q_004: derive(quantity.amount(H₂SO₄, ...))
       │    │    ├─ q_005: derive(quantity.mass_solute(H₂SO₄, ...))  ← ω × m_solution
       │    │    │    note: m_solution from givens or didactic assumption (100g),
       │    │    │          recorded in assumptions trace
       │    │    └─ q_006: find(quantity.molar_mass(H₂SO₄))         ← Σ(Ar)
       │    └─ q_007: find(substance.valency_factor(H₂SO₄))
       ├─ q_008: derive(quantity.equivalent(NaOH, ...))  (analogous)
       └─ execution: compare equivalents → medium
  └─ q_009: find(indicator.transition_rule(litmus, medium))          ← lookup
```

Replaces ~220 lines of hardcoded mixing logic in current `query-solver.ts`.

### Relationship with existing code

| Current code | What happens |
|---|---|
| `query-solver.ts` → `solveQuery()` | Replaced by `resolveQuery()` |
| `query-solver.ts` mixing path | Replaced by ResolutionDefs + planner decomposition |
| `derivation-planner.ts` | Used inside `equationHandler` (not refactored in Phase 1) |
| `solvers.ts` → `runSolver()` | Called from `ruleHandler` by solver_id |
| `sentence-templates.ts` → `buildQuery()` | Builds QueryExpr instead of ReasoningQuery |

---

## 5. Cascading Typeahead UI

### Component architecture

```
QueryBuilder (replaces SolverPage query section)
├── IntentSelector              — find / derive / check chips
├── PredicateTypeahead          — filtered by intent, searchable
├── ArgumentForm                — dynamic form from PredicateDef signature
│   ├── EntityAutocomplete      — substance/element/ion picker (extended SlotAutocomplete)
│   ├── NumberInput             — number + unit
│   └── ConstructorBuilder      — solution/mixture/env nested forms (max depth 2)
├── GivensPanel                 — "what is given" with planner hints
│   └── GivenRow                — predicate autocomplete + ValueEditor
├── QueryValidationBanner       — live validation
├── CanonicalPreview            — renderCanonical() in real-time
└── SolveButton + ResultPanel
```

### Interaction flow

**Step 1 — Intent**: Three chip-buttons: `[ Найти ] [ Вычислить ] [ Проверить ]`. Intent initially narrows predicate list. Two check sub-modes: boolean predicate (`reaction.possible`) and equality check (`substance.class(X) = ?`).

**Step 2 — Predicate typeahead**: Single text input with dropdown. Multi-axis filtering: aliases + search_tokens (per locale), intent, namespace grouping. Each item shows: localized name, namespace badge, result kind badge (число/категория/список/да-нет). After selection: read-only chip with × clear button.

**Step 3 — Arguments**: Dynamic form from PredicateDef signature. Required args visible; optional (context, at, env) in collapsible "Дополнительно". EntityAutocomplete: filtered by ArgDef.type, morphology-aware, FormulaChip rendering. ConstructorBuilder: max depth 2 in Phase 1. Autocomplete is an interpretation layer — user sees localized name, AST stores canonical ref.

**Step 4 — Givens**: Available for all intents (expanded for derive, collapsed for find/check). `suggestGivens()` provides first-level heuristic suggestions:

```ts
type SuggestedGiven = {
  predicate: string
  pattern: string
  suggestion_kind: "likely_given" | "usually_derived" | "optional" | "assumption_candidate"
  default_value?: Expr
  unit?: string
}
```

UI treatment:
- `likely_given` → active input field
- `usually_derived` → grey "будет вычислено"
- `assumption_candidate` → shown with default

GivenRow ValueEditor supports: number+unit, categorical enum, entity ref, list. Values inside constructors are available as local bound facts and not re-requested as givens.

**Step 5 — Canonical Preview**: Real-time `renderCanonical()` with FormulaChip rendering. Solve is explicit by button; preview and validation happen continuously.

**Step 6 — Solve**: buildQueryFromForm() → resolveQuery() → ResultPanel (answer + trace tree).

### Migration

| Current | Replacement |
|---|---|
| QueryTypeahead.tsx | IntentSelector + PredicateTypeahead |
| SentenceEditor.tsx | ArgumentForm + GivensPanel |
| SlotAutocomplete.tsx | Extended into EntityAutocomplete |
| sentence-templates.ts | Phased out (registry-driven) |
| SolverPage.tsx | Refactored with QueryBuilder |

---

## 6. Scope, Migration & Deliverables

### Phase 1 deliverables

| Deliverable | Files |
|---|---|
| ResolutionDef type | `src/types/resolution.ts` |
| PredicateDef type | `src/types/predicate.ts` |
| Query AST types | `src/types/query-ast.ts` |
| Build: generate-resolutions | `scripts/lib/generate-resolutions.mjs` |
| Build: generate-predicates | `scripts/lib/generate-predicates.mjs` |
| Manual data: resolutions.json | `data-src/foundations/resolutions.json` |
| Manual data: predicate_overrides.json | `data-src/foundations/predicate_overrides.json` |
| resolveQuery() | `src/lib/resolver/resolve-query.ts` |
| Resolution handlers | `src/lib/resolver/handlers/` (equation, rule, lookup + stubs) |
| Query builder utils | `src/lib/resolver/query-utils.ts` |
| QueryBuilder UI | `src/features/solver/QueryBuilder.tsx` |
| EntityAutocomplete | `src/features/solver/EntityAutocomplete.tsx` |
| ConstructorBuilder | `src/features/solver/ConstructorBuilder.tsx` |
| Feature flags | `src/config/feature-flags.ts` |
| Data bundle updates | `scripts/build-data.mjs` + `src/types/manifest.ts` + `src/lib/data-loader.ts` |
| Unit tests | `src/lib/resolver/__tests__/` |
| Parity tests | `src/lib/resolver/__tests__/parity.test.ts` |

### Test coverage categories

1. Generated forward/inverse resolutions from formulas
2. Target-pattern unification
3. Given matching
4. Fingerprint stability
5. Planner backtracking
6. Direct lookup path
7. Equation chain path
8. Mixing decomposition path
9. Cache reuse

### Out of scope

- Derivation planner refactoring → Phase 2
- Task engine migration (121 templates) → separate project
- Temporal execution → reserved in AST, hidden in UI
- Uncertainty propagation → metadata only
- Advanced handlers (optimization/constraint/numerical/simulation) → stubs
- explain/plan intents → deferred
- stoich_lp → Phase 2

### Migration path

1. **Data pipeline**: generate-resolutions + generate-predicates scripts
2. **Resolver core**: resolve-query.ts + handlers + unit tests
3. **Query utils**: renderCanonical, computeFingerprint, unifyTarget, suggestGivens
4. **UI**: QueryBuilder in SolverPage, old templates behind `oldSolverFallback` flag
5. **Parity verification**: parallel run, compare with legacy query-solver
6. **Mixing migration**: ResolutionDefs replace hardcoded path
7. **Cleanup**: remove sentence-templates, old query section, deprecate ReasoningQuery

### Estimated scope

~2400–2700 lines new code (excluding generated bundle artifacts). Minimal changes to existing code (~160 lines).

---

## Reference

Implements Phase 1 + partial Phase 2 of `docs/chemistry_dsl_document_set_v3.zip` roadmap. Phase 3–6 (process/time, uncertainty, advanced resolution) reserved in types, deferred.
