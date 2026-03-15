# Derivation and Formula Evaluation System -- Current-State Reference

Last updated: 2026-03-15

---

## 1. Architecture Overview

The derivation and formula evaluation system computes unknown physical
quantities from known ones. It combines a pure-math expression evaluator,
a graph-based planner, ontology-aware resolvers, and domain-specific
orchestration for stoichiometry and mass fraction calculations.

```
                          ┌──────────────────────────────────┐
                          │   deriveQuantity()                │  Orchestrator
                          │   src/lib/derivation/             │  (ontology-aware)
                          │   derive-quantity.ts               │
                          └───┬──────────┬───────┬──────┬────┘
                              │          │       │      │
           ┌──────────────────┤          │       │      └──────────────────┐
           ▼                  ▼          ▼       ▼                        ▼
  ┌───────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐
  │  Resolvers    │  │  Planner     │  │  Executor    │  │  Stoichiometry     │
  │  resolvers.ts │  │  derivation- │  │  derivation- │  │  Helpers           │
  │  molar-mass-  │  │  planner.ts  │  │  executor.ts │  │  stoichiometry-    │
  │  resolver.ts  │  │              │  │              │  │  helpers.ts        │
  └───────────────┘  └──────┬───────┘  └──────┬───────┘  └────────────────────┘
                            │                 │
                            ▼                 ▼
                     ┌──────────────────────────────────┐
                     │   formula-evaluator.ts            │  Pure math
                     │   (evaluateExpr, evaluateFormula, │
                     │    solveFor, display functions)    │
                     └──────────────────────────────────┘
```

**formula-evaluator.ts** (`src/lib/formula-evaluator.ts`) -- Pure mathematical
engine. Evaluates `ExprNode` expression trees given numeric bindings and physical
constants. Handles forward evaluation, algebraic inversion via pre-stored
expressions, and formula display/stringification. No chemistry knowledge; no
ontology access.

**derivation-planner.ts** (`src/lib/derivation/derivation-planner.ts`) --
AND/OR backward-search graph planner with memoization. Given a target `QRef`,
a set of known `QRef`s, and a rule set built from formulas, finds the optimal
derivation path. Pure algorithm; no formula evaluation.

**derivation-executor.ts** (`src/lib/derivation/derivation-executor.ts`) --
Walks a `DerivationPlan` step by step, calling `evaluateFormula()` or
`solveFor()` for each step. Produces `ExecutionResult` with all intermediate
values and evaluation traces.

**derive-quantity.ts** (`src/lib/derivation/derive-quantity.ts`) -- Top-level
orchestrator. Decides which derivation strategy to use based on the target
quantity and context. Handles ontology-specific operations (decompose substance,
lookup element Ar) that the pure planner cannot model, then delegates algebraic
chains to the planner + executor.

Supporting modules:

- **derivation-graph.ts** -- Builds `DerivationRule[]` from `ComputableFormula[]` and constructs the quantity index.
- **resolvers.ts** -- `resolveLookup()` (element Ar) and `resolveDecompose()` (substance to elements). Defines `OntologyAccess`.
- **molar-mass-resolver.ts** -- `deriveMolarMass()` shortcut: decompose + lookup + indexed formula.
- **stoichiometry-helpers.ts** -- Multi-step stoichiometry chain with yield support.
- **qref.ts** -- QRef identity key serialization.
- **derivation-trace.ts** -- `buildReasonTrace()` for structured trace construction.
- **formula-parser.ts** (`src/lib/formula-parser.ts`) -- ASCII chemical formula parsing.

---

## 2. Formula Catalog

All 21 formulas live in `data-src/foundations/formulas.json`. Each is a
`ComputableFormula` (type defined in `src/types/formula.ts`) with an `ExprNode`
expression tree, explicit inversions, and metadata.

### 2.1 Stoichiometry Domain (10 formulas)

| # | ID | Kind | Expression | Result Variable | Invertible For | Index Sets | Grade |
|---|-----|------|-----------|----------------|---------------|-----------|-------|
| 1 | `formula:molar_mass_from_composition` | definition | M = Sum(Ar_i * count_i) | M (`q:molar_mass`) | -- | `composition_elements` | 8 |
| 2 | `formula:amount_from_mass` | definition | n = m / M | n (`q:amount`) | m, M | -- | 8-9 |
| 3 | `formula:particle_count` | definition | N = n * N_A | N (`q:particle_count`) | n | -- | 8-9 |
| 4 | `formula:gas_volume_stp` | law | V = n * V_m | V (`q:volume`) | n | -- | 8-9 |
| 5 | `formula:mass_fraction_element` | definition | omega = (Ar * n_atom / M) * 100 | omega (`q:mass_fraction`) | Ar, n_atom, M | -- | 8-9 |
| 6 | `formula:density` | definition | rho = m / V | rho (`q:density`) | m, V | -- | 8 |
| 7 | `formula:yield` | definition | eta = (m_actual / m_theoretical) * 100 | eta (`q:yield`) | m_actual, m_theoretical | -- | 9 |
| 8 | `formula:stoichiometry_ratio` | law | n_2 = (n_1 / nu_1) * nu_2 | n_2 (`q:amount`, product) | n_1 | -- | 8-9 |
| 9 | `formula:component_molar_mass_contribution` | definition | M_part = Ar * count | M_part (`q:component_molar_mass_contribution`) | Ar, count | -- | 8-9 |
| 10 | `formula:component_mass_fraction` | definition | omega = M_part / M | omega (`q:component_mass_fraction`) | M_part, M | -- | 8-9 |

### 2.2 Solutions Domain (3 formulas)

| # | ID | Kind | Expression | Result Variable | Invertible For | Index Sets | Grade |
|---|-----|------|-----------|----------------|---------------|-----------|-------|
| 11 | `formula:mass_fraction_solution` | definition | w = m_solute / m_solution | w (`q:mass_fraction`) | m_solute, m_solution | -- | 8-9 |
| 12 | `formula:molar_concentration` | definition | C = n / V | C (`q:molar_concentration`) | n, V | -- | 9-10 |
| 13 | `formula:dilution_conservation` | conservation_law | m2 = (w1 * m1) / w2 | m2 (`q:mass`, final_solution) | w1, m1, w2 | -- | 8-9 |

### 2.3 Thermochemistry Domain (2 formulas)

| # | ID | Kind | Expression | Result Variable | Invertible For | Index Sets | Grade |
|---|-----|------|-----------|----------------|---------------|-----------|-------|
| 14 | `formula:hess_law` | law | delta_H = Sum(nu_j * deltaHf_j) - Sum(nu_i * deltaHf_i) | delta_H (`q:enthalpy_change`) | -- | `products`, `reactants` | 10-11 |
| 15 | `formula:calorimetry_delta_t` | law | delta_T = Q / Sum(m_i * c_i) | delta_T (`q:temperature_change`) | Q_total | `system_components` | 10-11 |

### 2.4 Atomic Structure Domain (4 formulas)

| # | ID | Kind | Expression | Result Variable | Invertible For | Approximate? | Grade |
|---|-----|------|-----------|----------------|---------------|-------------|-------|
| 16 | `formula:effective_nuclear_charge` | definition | Z_eff = Z - sigma | Z_eff (`q:effective_nuclear_charge`) | Z, sigma | exact | 10-11 |
| 17 | `formula:photon_energy` | law | E = h * nu | E (`q:energy`) | nu | exact | 10-11 |
| 18 | `formula:radius_proxy` | law | r ~ n^2 / Z_eff | r_proxy (`q:atomic_radius_proxy`) | -- | approximate; proxy for `q:atomic_radius` | 10-11 |
| 19 | `formula:ie_proxy` | law | IE ~ Z_eff^2 / n^2 | IE_proxy (`q:ionization_energy_proxy`) | -- | approximate; proxy for `q:ionization_energy` | 10-11 |

### 2.5 Kinetics Domain (2 formulas)

| # | ID | Kind | Expression | Result Variable | Invertible For | Approximate? | Grade |
|---|-----|------|-----------|----------------|---------------|-------------|-------|
| 20 | `formula:vant_hoff_rule` | law | v_2 = v_1 * gamma^((T_2-T_1)/10) | v_2 (`q:reaction_rate`, final) | -- | approximate; proxy for `q:reaction_rate` | 9-11 |
| 21 | `formula:arrhenius` | law | k = A * exp(-Ea / (R*T)) | k (`q:rate_constant`) | -- | exact | 10-11 |

### 2.6 Physical Constants

5 constants in `data-src/foundations/constants.json`:

| ID | Symbol | Display | Value | Unit | Labels Key |
|----|--------|---------|-------|------|------------|
| `const:N_A` | N_A | Nₐ | 6.022e23 | per_mol | `const.avogadro` |
| `const:V_m_stp` | V_m | Vₘ | 22.4 | L_per_mol | `const.molar_volume_stp` |
| `const:k_coulomb` | k | -- | 8.988e9 | N_m2_per_C2 | `const.coulomb_constant` |
| `const:h_planck` | h | -- | 6.626e-34 | J_s | `const.planck` |
| `const:R` | R | -- | 8.314 | J_per_mol_K | `const.gas_constant` |

### 2.7 Formula Variable Roles

Each variable in a `ComputableFormula` has a `role` field:

| Role | Meaning |
|------|---------|
| `result` | The output variable (LHS of the formula). |
| `input` | Required binding for forward evaluation. |
| `constant` | Resolved from `ConstantsDict` via `const:*` refs (e.g. N_A, V_m). |
| `index` | Iterated over in `sum` operations via `IndexedBindings`. |

Variables may also carry `semantic_role` (from the `SemanticRole` type). This
disambiguates the same quantity in different contexts -- for example,
`formula:yield` has two mass variables: `m_actual` with role `actual` and
`m_theoretical` with role `theoretical`. The planner uses semantic roles for
matching.

### 2.8 Approximation Metadata

Formulas may carry an `approximation` field:

```typescript
interface FormulaApproximation {
  kind: 'exact' | 'approximate';
  proxy_for?: string;      // which exact quantity this approximates
  limitations?: string[];  // known limitations
  usage_note?: string;     // locale key for student-facing note
}
```

Three formulas are marked approximate: `radius_proxy`, `ie_proxy`, `vant_hoff_rule`.
The planner penalizes approximate rules in scoring and prunes them when exact
alternatives exist.

---

## 3. QRef System

A **QRef** (Qualified quantity Reference) uniquely identifies a physical
quantity within a derivation. Defined in `src/types/derivation.ts`.

### 3.1 QRef Structure

```typescript
interface QRef {
  quantity: string;                          // e.g. 'q:mass', 'q:molar_mass'
  role?: SemanticRole;                       // e.g. 'actual', 'solute', 'reactant'
  phase?: 'given' | 'find' | 'intermediate'; // procedural only, NOT part of identity
  context?: BoundContext;                    // ontology binding
}
```

**Identity model:**
- `quantity` + `role` + `context` form the derivation identity (what is being derived).
- `phase` is procedural (used by UI/task layer only) and is **excluded** from identity keys.

### 3.2 BoundContext

```typescript
interface BoundContext {
  system_type: string;       // 'substance' | 'element' | 'substance_component'
  entity_ref?: string;       // 'substance:H2SO4' | 'element:O'
  parent_ref?: string;       // component's parent substance: 'substance:CO2'
  bindings?: Record<string, string>;  // e.g. { component: 'element:O' }
}
```

Contexts bind a quantity to a specific chemical entity. For example,
`q:molar_mass` with context `{ system_type: 'substance', entity_ref: 'substance:H2SO4' }`
means "the molar mass of H2SO4 specifically."

### 3.3 SemanticRole Values

Closed set defined in `src/types/formula.ts`:

| Role | Usage |
|------|-------|
| `actual` | Actual mass in yield formula |
| `theoretical` | Theoretical mass in yield formula |
| `solute` | Solute mass in solution mass fraction |
| `solution` | Solution mass in solution mass fraction |
| `reactant` | Reactant-side quantity in stoichiometry |
| `product` | Product-side quantity in stoichiometry |
| `initial` | Initial value (dilution w1, van't Hoff T1/v1) |
| `final` | Final value (dilution w2, van't Hoff T2/v2) |

Note: `solvers.ts` also uses `initial_solution` and `final_solution` (cast via
`as SemanticRole`) for the dilution formula's mass roles.

### 3.4 Identity Key (`qrefKey`)

`qrefKey()` in `src/lib/derivation/qref.ts` produces a string identity key from
a QRef. Used by the planner for memoization and by the executor for value lookup.

Format: `{quantity}[|{role}][@{contextKey}]`

Context key format: `{system_type}:{entity_ref}[^{parent_ref}][{k=v,...}]`

Examples:
- `q:mass` -- plain quantity
- `q:mass|reactant` -- quantity with semantic role
- `q:molar_mass@substance:substance:H2SO4` -- quantity bound to a substance
- `q:relative_atomic_mass@element:element:O` -- quantity bound to an element
- `q:atom_count_in_composition@substance_component:element:O^substance:H2O{component=element:O}` -- full context with parent and bindings

### 3.5 problemQRefKey

`problemQRefKey()` includes `phase` in the key. Used only by UI/task-state
layer, never by the planner.

### 3.6 qrefInSet

`qrefInSet(qref, knownKeys)` checks if a QRef matches a known set by its
semantic key.

---

## 4. Derivation Graph

### 4.1 Rule Construction (`derivation-graph.ts`)

`buildDerivationRules(formulas)` transforms `ComputableFormula[]` into
`DerivationRule[]`. Each formula produces:

- **1 forward rule**: target = `result_variable`, inputs = all `role:'input'`
  variables. ID format: `{formulaId}/forward`.
- **N inversion rules**: one per entry in `invertible_for`. Target = that
  variable, inputs = all non-constant, non-index variables (including the
  original result variable). ID format: `{formulaId}/inv:{symbol}`.

### 4.2 DerivationRule Structure

```typescript
interface DerivationRule {
  id: string;                    // 'formula:amount_from_mass/forward'
  formulaId: string;             // 'formula:amount_from_mass'
  targetSymbol: string;          // 'n'
  targetQuantity: string;        // 'q:amount'
  targetRole?: SemanticRole;     // from variable's semantic_role
  inputs: DerivationRuleInput[]; // [{ symbol: 'm', quantity: 'q:mass' }, ...]
  isInversion: boolean;          // false for forward, true for inversions
  isApproximate: boolean;        // from formula.approximation
  needsIndexedBindings: boolean; // true if formula has sum operations
  indexSets?: string[];          // ['composition_elements'] if needed
  baseCost?: number;             // pedagogical preference penalty (default 0)
}
```

Semantic roles on variables are read from `variable.semantic_role` (explicit
metadata, no suffix-based inference).

### 4.3 Quantity Index

`buildQuantityIndex(rules)` builds a `Map<string, DerivationRule[]>` keyed by
`targetQuantity`. This enables O(1) candidate lookup. Role filtering happens
at search time, not at index construction time.

### 4.4 Index Set Detection

`collectIndexSets(formula)` walks the expression tree (forward and all
inversions) to find all `sum` operations and extract their `index_set` names.
Rules that need indexed bindings are filtered by the planner based on
`availableIndexSets`.

### 4.5 Planner Algorithm (`derivation-planner.ts`)

`planDerivation(target, knowns, rules, quantityIndex, options?)` performs
AND/OR backward search with memoization.

```typescript
interface PlannerOptions {
  maxDepth?: number;             // default 6
  availableIndexSets?: string[]; // e.g. ['composition_elements']
}
```

**Algorithm:**

1. **Base case**: If target QRef is in knowns, return empty plan (score 0).
2. **Depth check**: If depth > maxDepth, return null.
3. **Cycle detection**: If target is in the current `visited` set, return null.
4. **Candidate lookup**: Get rules from quantity index for `target.quantity`.
5. **Pre-filter**: Remove rules that fail role compatibility or lack required index sets.
6. **Dominance pruning**: If any exact (non-approximate) rule exists, prune all approximate rules.
7. **Pre-rank** candidates by:
   - Fewer unresolved inputs first (inputs not directly in knowns).
   - Non-inversions before inversions.
   - Lower baseCost.
8. **Recursive search**: For each candidate, recursively search for all its inputs.
   If all inputs are satisfiable, build a candidate plan.
9. **Score and select**: Keep the plan with the lowest score.
10. **Memoize**: Store result (plan or null) for the target key. Backtrack visited set.

**Role compatibility:**
- Unscoped target: any rule matches.
- Unscoped rule: matches any target (penalized in scoring).
- Both scoped: must match exactly.

### 4.6 Plan Scoring

`scorePlan()` produces a numeric score (lower = better):

| Dimension | Weight |
|-----------|--------|
| Step count | +100 per step |
| Approximate formula | +50 per step |
| Indexed binding requirement | +30 per step |
| Inversion | +10 per step |
| baseCost | +baseCost per step |
| Unscoped rule matching scoped target | +20 per step |

### 4.7 DerivationPlan and PlanStep

```typescript
interface PlanStep {
  rule: DerivationRule;
  target: QRef;
  inputRefs: Record<string, QRef>;           // symbol -> resolved QRef
  inputSources: Record<string, 'known' | string>;  // symbol -> 'known' | ruleId
}

interface DerivationPlan {
  target: QRef;
  steps: PlanStep[];
  score: number;
}
```

---

## 5. Formula Evaluator (`formula-evaluator.ts`)

### 5.1 Expression Tree (`ExprNode`)

All formulas are stored as `ExprNode` trees (type in `src/types/formula.ts`):

| Op | Description | Operands |
|----|-------------|----------|
| `add` | Sum | N operands (any mix of string/number/ExprNode) |
| `subtract` | Difference | N operands (first - rest) |
| `multiply` | Product | N operands |
| `divide` | Quotient | 2 operands [numerator, denominator] |
| `power` | Exponentiation | 2 operands [base, exponent] |
| `exp` | Natural exponential (e^x) | 1 operand |
| `sum` | Indexed summation | `over` (index var), `index_set` (name), `term` (ExprNode) |
| `literal` | Numeric constant in expression | `value` (number) |
| `const` | Physical constant reference | `ref` (e.g. `const:N_A`) |

Leaf nodes can also be plain `string` (variable symbol resolved from bindings)
or `number`.

### 5.2 Bindings Types

```typescript
type Bindings = Record<string, number>;         // symbol -> value
type IndexedBindings = Record<string, Bindings[]>;  // index_set -> per-item bindings
type ConstantsDict = Record<string, number>;    // 'const:N_A' -> 6.022e23
```

`IndexedBindings` are required for formulas with `sum` operations. Each item in
the array provides bindings for one iteration. Example for molar mass:

```typescript
{
  composition_elements: [
    { Ar_i: 1.008, count_i: 2 },   // hydrogen
    { Ar_i: 16.00, count_i: 1 },   // oxygen
  ]
}
```

### 5.3 Core Evaluation Functions

**`evaluateExpr(expr, bindings, constants, indexed?)`**

Recursively evaluates an `ExprNode`. For `sum` operations, iterates over
`indexed[index_set]`, merging per-item bindings with the base bindings for each
iteration. Throws on missing bindings, missing constants, or division by zero.

**`evaluateFormula(formula, bindings, constants, indexed?)`**

Evaluates a formula's forward `expression`. Returns an `EvalTrace`:

```typescript
interface EvalTrace {
  formulaId: string;
  solvedFor: string;        // result_variable symbol
  steps: EvalStep[];
  result: number;
  is_approximate?: boolean;
  proxy_for?: string;       // what exact quantity this approximates
  limitations?: string[];
}
```

Each `EvalStep` has `expr` (human-readable string), `value`, and optional
`substitutions` (which bindings were used).

**`solveFor(formula, target, bindings, constants, indexed?)`**

Evaluates a formula's pre-stored inversion expression for the given target
symbol. If `target` equals `result_variable`, delegates to `evaluateFormula()`.
Throws if target is not in `invertible_for` or if no inversion expression
exists.

**`toConstantsDict(constants: PhysicalConstant[])`**

Converts `PhysicalConstant[]` array to `ConstantsDict` keyed by `id`.

### 5.4 Display Functions

**`exprToString(expr)`** -- Human-readable string using raw variable symbols.

**`buildDisplayMap(formula, constants?)`** -- Builds `symbol -> display_symbol`
mapping. When multiple variables share the same display symbol (e.g. two `m`
variables), qualifies them with semantic role abbreviations:

| Role | Qualifier |
|------|-----------|
| `actual` | `act.` |
| `theoretical` | `theor.` |
| `solute` | `sol.` |
| `solution` | `soln.` |

Example: `m` with role `actual` becomes `m(act.)`.

**`exprToDisplayString(expr, displayMap)`** -- Expression string using canonical
notation through the display map.

**`formulaToDisplayString(formula, inversionFor?, constants?)`** -- Complete
formula display with LHS. Supports rendering inversions. Example output:
`omega = Ar x n / M x 100`.

---

## 6. deriveQuantity() Branches

The orchestrator dispatches to different strategies based on the target quantity
and context. Branches are checked in order; the first match handles the request.

```
deriveQuantity(target, knowns, formulas, constants, ontology)
    |
    +-- Branch 1: Ar lookup           (q:relative_atomic_mass + element context)
    +-- Branch 2: Molar mass          (q:molar_mass + substance context)
    +-- Branch 3: Component M_part    (q:component_molar_mass_contribution + substance_component)
    +-- Branch 4: Component omega     (q:component_mass_fraction + substance_component)
    +-- Branch 5: Stoichiometry chain (detected by hasStoichiometricKnowns)
    +-- Branch 6: Mass/amount         (q:mass|q:amount + substance context)
    +-- Branch 7: Fallback            (pure formula planner chain)
```

### 6.1 Branch 1: Direct Lookup (Ar of Element)

**Condition**: `target.quantity === 'q:relative_atomic_mass'` and
`target.context.system_type === 'element'`

**Flow**: `resolveLookup()` finds element by symbol in `ontology.elements`,
returns `element.atomic_mass`. No planner involved.

**Trace**: `given* -> lookup -> conclusion`

### 6.2 Branch 2: Molar Mass of Substance

**Condition**: `target.quantity === 'q:molar_mass'` and
`target.context.system_type === 'substance'`

**Flow**: Delegates to `deriveMolarMass()` in `molar-mass-resolver.ts`:

1. `resolveDecompose(entityRef)` -- parse substance formula into elements + counts.
2. `resolveLookup()` for each element -- retrieve Ar values.
3. Build `IndexedBindings` for `composition_elements`.
4. `evaluateFormula('formula:molar_mass_from_composition', {}, constants, indexed)`.

This is a manually wired shortcut; decompose/lookup are not modeled as
DerivationRules in the planner graph.

**Trace**: `given* -> decompose -> lookup (per element) -> formula_select -> compute -> conclusion`

### 6.3 Branch 3: Component Molar Mass Contribution

**Condition**: `target.quantity === 'q:component_molar_mass_contribution'` and
`target.context.system_type === 'substance_component'`

**Flow**:

1. `resolveDecompose(parentRef)` -- decompose parent substance.
2. Find component element and its count.
3. `resolveLookup()` -- get Ar for that element.
4. `evaluateFormula('formula:component_molar_mass_contribution', { Ar, count })`.

**Result**: M_part = Ar * count

**Trace**: `given* -> decompose -> lookup -> formula_select -> substitution -> compute -> conclusion`

### 6.4 Branch 4: Component Mass Fraction

**Condition**: `target.quantity === 'q:component_mass_fraction'` and
`target.context.system_type === 'substance_component'`

**Flow**:

1. Derive M_part via Branch 3 logic (calls `deriveComponentContribution` internally).
2. Derive M of the parent substance via `deriveMolarMass()` (Branch 2 logic).
3. `evaluateFormula('formula:component_mass_fraction', { M_part, M })`.

**Result**: omega = M_part / M

**Trace**: `given* -> [Branch 3 trace] -> [Branch 2 trace] -> formula_select -> substitution -> compute -> conclusion`

### 6.5 Branch 5: Stoichiometry Chain

**Condition**: `hasStoichiometricKnowns(knowns)` returns true. Must be checked
**before** Branch 6 because stoichiometry targets have roles but no context,
while single-substance targets have `context.system_type === 'substance'`.

**Detection** (`hasStoichiometricKnowns`):
1. Two `q:stoich_coeff` knowns with roles `reactant` and `product`.
2. At least one source-side `q:mass` or `q:amount` with a role.
3. If source is mass only (no amount), at least one `q:molar_mass`.

Delegates to `deriveStoichiometryChain()` in `stoichiometry-helpers.ts`.

**Direction detection**: Determines `fromRole`/`toRole` by which side has mass/amount knowns.

**Chain steps**:

1. **Source amount (n_from)**: If amount is directly known, use it. Otherwise,
   convert mass to amount via `deriveAmountForRole()` using `formula:amount_from_mass`.
   M can be explicit (from knowns) or auto-derived via `deriveMolarMass()` from entity_ref.

2. **Cross-role ratio**: `deriveStoichiometricAmount()` using `formula:stoichiometry_ratio`.
   Forward (reactant->product): `n_2 = (n_1/nu_1)*nu_2`.
   Reverse (product->reactant): uses inversion for `n_1`.

3. **Check target**: If target is `q:amount`, return n_to directly.

4. **Convert to mass**: `deriveMassForRole()` using `formula:amount_from_mass`
   inverted for `m` (m = n * M).

5. **Apply yield** (optional): If `q:yield` is in knowns, `applyYield()` uses
   `formula:yield` inverted for `m_actual` (m_actual = eta/100 * m_theoretical).

**Yield edge case**: Finding yield from actual + theoretical masses (no stoich
coefficients) does NOT go through the stoichiometry chain. It falls through to
Branch 7 (generic planner fallback).

### 6.6 Branch 6: Mass/Amount of Substance

**Condition**: `target.quantity` is `q:mass` or `q:amount`, and
`target.context.system_type === 'substance'`

**Flow**:

1. Derive M via `deriveMolarMass(entityRef)`.
2. Collapse context-aware `q:molar_mass(substance:X)` into context-free
   `q:molar_mass` (MVP simplification for single-substance derivations).
3. Build rules via `buildDerivationRules()` + `buildQuantityIndex()`.
4. `planDerivation()` for the formula chain.
5. `executePlan()` -- evaluate each step.
6. Append formula trace steps (formula_select, substitution, compute per step).

**Trace**: `given* -> [M derivation trace] -> formula_select -> substitution -> compute (per chain step) -> conclusion`

### 6.7 Branch 7: Fallback (Pure Formula Chain)

**Condition**: None of the above conditions matched.

**Flow**: Builds rules from all formulas, runs planner with target QRef and
knowns as-is, executes the resulting plan. No ontology operations. This handles
dilution (semantic role matching on formula variables), finding yield from
masses, and any other algebraic chain the planner can solve directly.

**Trace**: `given* -> conclusion`

---

## 7. Resolvers

### 7.1 resolveLookup (`resolvers.ts`)

Resolves a quantity by direct ontology lookup.

**Supported**: `q:relative_atomic_mass` for `system_type: 'element'` only.

**Mechanism**: Extracts element symbol from `entity_ref` (stripping `element:`
prefix), finds element in `ontology.elements`, returns `element.atomic_mass`.

**Returns**: `LookupResult`:
```typescript
interface LookupResult {
  qref: QRef;
  value: number;
  step: ReasonStep & { type: 'lookup' };  // { type: 'lookup', qref, value, source: 'element:O' }
}
```

### 7.2 resolveDecompose (`resolvers.ts`)

Decomposes an entity (substance or ion) into elemental components.

**Mechanism**:
1. Looks up ASCII formula from `ontology.entityFormulas.get(entityRef)`.
2. Calls `ontology.parseFormula(formula)` to get `Record<string, number>`.
3. Verifies each element exists in `ontology.elements`.

**Returns**: `DecomposeResult`:
```typescript
interface DecomposeResult {
  items: DecomposeResultItem[];
  step: ReasonStep & { type: 'decompose' };
}

interface DecomposeResultItem {
  element: string;       // 'O'
  count: number;         // 3
  elementRef: string;    // 'element:O'
  arQRef: QRef;          // pre-built QRef for Ar lookup of this element
  countQRef: QRef;       // pre-built QRef for atom count in composition
}
```

**Key design**: Returns structural data only. Ar values are NOT looked up
here -- the caller is responsible for separate `resolveLookup()` calls, keeping
provenance explicit in the trace.

### 7.3 deriveMolarMass (`molar-mass-resolver.ts`)

Convenience function chaining decompose + lookup + evaluate:

1. `resolveDecompose(entityRef, ontology)` -- get elements + counts.
2. For each element: `resolveLookup(item.arQRef, ontology)` -- get Ar.
3. Build `IndexedBindings` for `composition_elements`:
   `{ composition_elements: [{ Ar_i: value, count_i: count }, ...] }`.
4. `evaluateFormula(formula:molar_mass_from_composition, {}, constants, indexed)`.

All steps are appended to the shared `trace` array passed by the caller.

### 7.4 Formula Parser (`formula-parser.ts`)

`parseFormula(ascii)` parses ASCII chemical formulas into element-count maps.
Handles parenthesized groups with multipliers.

Examples:
- `"NaCl"` -> `{ Na: 1, Cl: 1 }`
- `"H2O"` -> `{ H: 2, O: 1 }`
- `"Ca(OH)2"` -> `{ Ca: 1, O: 2, H: 2 }`
- `"Mg3(PO4)2"` -> `{ Mg: 3, P: 2, O: 8 }`

Helper functions:
- `unicodeToAscii(formula)` -- converts Unicode subscript digits to ASCII.
- `stripIonCharge(formula)` -- removes trailing superscript charge notation.

---

## 8. OntologyAccess Interface

`OntologyAccess` in `src/lib/derivation/resolvers.ts` defines the minimal
chemistry data needed by the derivation system:

```typescript
interface OntologyAccess {
  elements: Element[];
  parseFormula: (ascii: string) => Record<string, number>;
  entityFormulas: Map<string, string>;
}
```

| Field | Purpose |
|-------|---------|
| `elements` | Array of `Element` objects (at minimum: `symbol: string`, `atomic_mass: number`). Used by `resolveLookup()` to find Ar values. |
| `parseFormula` | Parses an ASCII formula string into an element-count map. Typically `parseFormula` from `formula-parser.ts`. |
| `entityFormulas` | Map from entity reference (e.g. `"substance:H2SO4"`, `"ion:SO4"`) to ASCII formula string. Used by `resolveDecompose()` to find the formula for a given entity. |

**Construction patterns**:

The `MolarMassCalculator` builds a full ontology adapter from loaded data:
```typescript
const entityFormulas = new Map<string, string>();
for (const s of substances) {
  const ascii = unicodeToAscii(s.formula);
  entityFormulas.set(`substance:${ascii}`, ascii);
}
for (const ion of ions) {
  const stripped = stripIonCharge(ion.formula);
  const ascii = unicodeToAscii(stripped);
  entityFormulas.set(`ion:${ascii}`, ascii);
}
const ontology: OntologyAccess = { elements, parseFormula, entityFormulas };
```

Solver-context calls (e.g. `solveStoichiometry`) pass a minimal ontology with
an empty `entityFormulas` map and a throwing `parseFormula`, because molar
masses are pre-resolved as knowns.

---

## 9. ReasonStep Trace

The derivation system produces structured trace data for explainability. All
trace steps are structured data with no baked text -- text rendering is
delegated to a separate explanation renderer layer.

### 9.1 ReasonStep Types

```typescript
type ReasonStep =
  | { type: 'given'; qref: QRef; value: number }
  | { type: 'lookup'; qref: QRef; value: number; source: string }
  | { type: 'decompose'; sourceRef: string; components: Array<{ element: string; count: number }> }
  | { type: 'formula_select'; formulaId: string; target: QRef }
  | { type: 'substitution'; formulaId: string; bindings: Record<string, number> }
  | { type: 'compute'; formulaId: string; result: number; approximate?: boolean }
  | { type: 'conclusion'; target: QRef; value: number }
```

| Type | Fields | When Produced |
|------|--------|---------------|
| `given` | qref, value | Once per known at start of `deriveQuantity()` |
| `lookup` | qref, value, source | `resolveLookup()` -- currently only for Ar of element. `source` is the entity ref (e.g. `element:O`). |
| `decompose` | sourceRef, components[] | `resolveDecompose()` -- substance split into elements + counts. |
| `formula_select` | formulaId, target | Before formula evaluation; identifies which formula and target quantity. |
| `substitution` | formulaId, bindings | Records numeric values bound to formula variables before evaluation. |
| `compute` | formulaId, result, approximate? | After formula evaluation; records computed value. `approximate` is true for proxy formulas. |
| `conclusion` | target, value | Final step; records the derivation target and its answer. |

### 9.2 ReasonTrace

```typescript
interface ReasonTrace {
  target: QRef;
  steps: ReasonStep[];
  result: number;
  isApproximate: boolean;
}
```

`buildReasonTrace()` in `derivation-trace.ts` constructs a `ReasonTrace` from
an executed plan:
1. Emits `given` steps for all known values.
2. For each plan step: `formula_select` + `substitution` + `compute`.
3. Emits a `conclusion` step.

It also includes a `parseQRefKey()` helper that inverts `qrefKey()` back to a
`QRef` (for reconstructing given steps from the values dict).

### 9.3 EvalTrace (Formula-Level)

```typescript
interface EvalTrace {
  formulaId: string;
  solvedFor: string;
  steps: EvalStep[];
  result: number;
  is_approximate?: boolean;
  proxy_for?: string;
  limitations?: string[];
}

interface EvalStep {
  expr: string;                          // e.g. "m / M" or "Sigma(Ar_i x count_i)"
  value: number;
  substitutions?: Record<string, number>;
}
```

Produced by `evaluateFormula()` and `solveFor()`. Lower-level than
`ReasonTrace`; captures per-formula evaluation details.

### 9.4 Typical Trace Sequences

**Molar mass (Branch 2):**
`given* -> decompose -> lookup -> lookup -> ... -> formula_select -> compute -> conclusion`

**Mass from amount for substance (Branch 6):**
`given -> decompose -> lookup* -> formula_select(composition) -> compute -> formula_select(amount_from_mass) -> substitution -> compute -> conclusion`

**Stoichiometry mass-to-mass (Branch 5):**
`given* -> formula_select(amount_from_mass) -> substitution -> compute -> formula_select(stoichiometry_ratio) -> substitution -> compute -> formula_select(amount_from_mass/inv:m) -> substitution -> compute -> conclusion`

**Stoichiometry with yield (Branch 5):**
Same as above, plus: `-> formula_select(yield/inv:m_actual) -> substitution -> compute -> conclusion`

**Component mass fraction (Branch 4):**
`given* -> decompose(parent) -> lookup(element) -> formula_select(component_contribution) -> substitution -> compute -> decompose(parent) -> lookup* -> formula_select(composition) -> compute -> formula_select(component_mass_fraction) -> substitution -> compute -> conclusion`

---

## 10. Integration Points

### 10.1 Task Engine Solvers (`src/lib/task-engine/solvers.ts`)

The task engine uses the derivation system through three integration patterns:

#### Pattern A: Direct `deriveQuantity()` Call

**`solver.stoichiometry`**:
- Target: `{ quantity: 'q:mass', role: 'product' }`
- Knowns: `q:mass|reactant`, `q:stoich_coeff|reactant`, `q:molar_mass|reactant` (with entity context), `q:stoich_coeff|product`, `q:molar_mass|product` (with entity context)
- M values are pre-resolved in slots (`given_M`, `find_M`), not auto-derived from ontology.
- Minimal ontology with throwing `parseFormula`.

**`solver.reaction_yield`**:
- Same as stoichiometry plus `{ quantity: 'q:yield', value: yield_percent }` in knowns.

**`solver.concentration` (dilution mode)**:
- Target: `{ quantity: 'q:mass', role: 'final_solution' }`
- Knowns: `q:mass_fraction|initial`, `q:mass|initial_solution`, `q:mass_fraction|final`
- Empty ontology (no decomposition needed). Falls through to Branch 7 in `deriveQuantity()`.

#### Pattern B: Planner-Only (`solver.derivation_planner`)

Generic solver that exposes the planner directly to task templates:
1. Reads `target_quantity` and `target_role` from solver params.
2. Reads `knowns_mapping` from params: a dict of `{ slotName: { quantity, role? } }`.
3. Builds rules from all formulas via `buildDerivationRules()`.
4. Calls `planDerivation()` then `executePlan()`.
5. Supports `available_index_sets` param for indexed formula access.

#### Pattern C: Direct Formula Evaluation (Legacy Solvers)

Several solvers bypass `deriveQuantity()` and call `evaluateFormula()`/`solveFor()` directly:

| Solver | Formula Used | Mode |
|--------|-------------|------|
| `solver.molar_mass` | `formula:molar_mass_from_composition` | `evaluateFormula` with IndexedBindings |
| `solver.mass_fraction` | `formula:mass_fraction_element` | `evaluateFormula` |
| `solver.amount_calc` (n) | `formula:amount_from_mass` | `evaluateFormula` (forward) |
| `solver.amount_calc` (m) | `formula:amount_from_mass` | `solveFor('m')` (inversion) |
| `solver.concentration` (omega) | `formula:mass_fraction_solution` | `evaluateFormula` |
| `solver.concentration` (inverse) | `formula:mass_fraction_solution` | `solveFor('m_solute')` |

These do not produce `ReasonStep` traces and are retained for backward
compatibility with the task engine.

### 10.2 MolarMassCalculator Component

`src/features/calculations/MolarMassCalculator.tsx` is a React island that
provides interactive molar mass calculation in the UI.

**Data loading** (on mount):
- `loadSubstancesIndex(locale)` + `loadIons(locale)` + `loadElements()` + `loadFormulas()` + `loadConstants()`

**OntologyAccess construction**:
- Builds `entityFormulas` map from substances (`substance:` prefix) and ions (`ion:` prefix).
- Uses `unicodeToAscii()` and `stripIonCharge()` to normalize display formulas to ASCII.
- `parseFormula` from `formula-parser.ts`.

**Per-item derivation**:
For each substance and ion, calls `deriveQuantity()` with:
```typescript
{
  target: { quantity: 'q:molar_mass', context: { system_type: 'substance', entity_ref: entityRef } },
  knowns: [],
  formulas, constants, ontology,
}
```

**Trace extraction**:
Extracts composition from the `decompose` and `lookup` steps in the returned
trace to render the step-by-step formula:
`M(H₂O) = Ar(H)=1 x 2 + Ar(O)=16 x 1 = 18 g/mol`

---

## 11. File Index

| Purpose | File |
|---------|------|
| Formula evaluator (pure math) | `src/lib/formula-evaluator.ts` |
| Formula parser (ASCII chemical) | `src/lib/formula-parser.ts` |
| Derivation types (QRef, rules, traces) | `src/types/derivation.ts` |
| Formula types (ComputableFormula, ExprNode) | `src/types/formula.ts` |
| Eval trace types (Bindings, EvalTrace) | `src/types/eval-trace.ts` |
| QRef key utilities | `src/lib/derivation/qref.ts` |
| Derivation graph builder | `src/lib/derivation/derivation-graph.ts` |
| Derivation planner (AND/OR search) | `src/lib/derivation/derivation-planner.ts` |
| Derivation executor | `src/lib/derivation/derivation-executor.ts` |
| Derivation trace builder | `src/lib/derivation/derivation-trace.ts` |
| Resolvers + OntologyAccess | `src/lib/derivation/resolvers.ts` |
| Molar mass resolver (decompose+lookup) | `src/lib/derivation/molar-mass-resolver.ts` |
| Stoichiometry helpers (chain+yield) | `src/lib/derivation/stoichiometry-helpers.ts` |
| Orchestrator (deriveQuantity) | `src/lib/derivation/derive-quantity.ts` |
| Task engine solvers | `src/lib/task-engine/solvers.ts` |
| MolarMassCalculator UI component | `src/features/calculations/MolarMassCalculator.tsx` |
| Ontology formulas data (21 formulas) | `data-src/foundations/formulas.json` |
| Physical constants data (5 constants) | `data-src/foundations/constants.json` |
