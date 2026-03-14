# Stoichiometry & Yield — Quantity Network Slice 3

## Goal

Extend `deriveQuantity()` to support single-source stoichiometry and reaction yield, then migrate `solver.stoichiometry` and `solver.reaction_yield` from procedural formula chains to the unified derivation entry point.

**What changes:** Two new branches in `deriveQuantity()`, built from small composable helper units. Two solvers in `solvers.ts` call `deriveQuantity()` instead of manually chaining `evaluateFormula`/`formulaSolveFor`.

**What stays:** Formulas (`formula:stoichiometry_ratio`, `formula:yield`, `formula:amount_from_mass`), quantity IDs, trace step vocabulary, planner/executor internals, `BoundContext` type — all unchanged.

---

## Scope

### In scope

- Mass of product from mass of one reactant (single-source stoichiometry)
- Amount of product from known amount of one reactant
- Actual mass of product with yield
- Yield from theoretical and actual mass
- Reverse direction: product → reactant (neutral `fromRole`/`toRole` API)
- M auto-derived from substance composition when not in knowns

### Not in scope

- Limiting reagent (multiple source reactants)
- Excess reagent calculation
- Post-reaction mixture composition
- New formula or quantity definitions
- Changes to planner, executor, evaluator, or trace types
- Renderer changes for new trace patterns

---

## Architecture

### Design principles

1. **Neutral API.** Helper units take `fromRole`/`toRole` parameters — not hardwired reactant→product. Enables reverse derivations (product mass → reactant mass).
2. **Typed results.** Every helper returns `{ qref: QRef; value: number }`, not bare numbers. Enables composition without losing provenance.
3. **Signature-based branching.** `deriveQuantity()` selects the stoichiometry/yield branch by checking the presence of stoichiometric knowns (ν coefficients + source mass/amount), not just by target quantity name.
4. **Role = participant only.** `QRef.role` carries only participant roles: `reactant`/`product`. The `actual`/`theoretical` distinction is a derivation stage, not a participant role — it lives in trace semantics and helper-internal logic, never on `QRef.role`. Both theoretical and actual product mass have `role: 'product'`; the yield step in the trace explicitly marks the transition from theoretical to actual.
5. **Transitional orchestration.** All new helper units are explicitly transitional — they manually chain formulas because the planner doesn't yet handle cross-role bridging. The planner and executor remain untouched.

### Helper unit decomposition

Five small functions, each doing one step. All take a single options object (not positional params) for clarity:

```
deriveAmountForRole(role, mass, M, ontology, trace)
  → { qref: QRef{q:amount, role}, value: number }
  Uses: formula:amount_from_mass (n = m/M)
  Auto-derives M from substance composition if not provided.

deriveStoichiometricAmount(n_from, ν_from, ν_to, fromRole, toRole, trace)
  → { qref: QRef{q:amount, role: toRole}, value: number }
  Uses: formula:stoichiometry_ratio (n₂ = n₁ × ν₂/ν₁)

deriveMassForRole(role, n, M, ontology, trace)
  → { qref: QRef{q:mass, role}, value: number }
  Uses: formula:amount_from_mass solved for m (m = n × M)
  Auto-derives M from substance composition if not provided.

applyYield(m_theoretical, eta, trace)
  → { qref: QRef{q:mass, role: 'product'}, value: number }
  Uses: formula:yield solved for m_actual (eta in percent, matching formula convention)
  Output keeps role: 'product' — the yield step in trace marks the theoretical→actual transition.

deriveYield(m_actual, m_theoretical, trace)
  → { qref: QRef{q:yield}, value: number }
  Uses: formula:yield forward (η = m_actual/m_theoretical × 100)
```

### Supported input signatures

Branch selection in `deriveQuantity()` is by signature — checking which knowns are present:

| Signature | Knowns required | Target | Chain |
|-----------|----------------|--------|-------|
| S1: mass→mass | m\|fromRole, M\|fromRole (or entity_ref), ν_from, ν_to, M\|toRole (or entity_ref) | q:mass\|toRole | m→n→n₂→m₂ |
| S2: amount→mass | n\|fromRole, ν_from, ν_to, M\|toRole (or entity_ref) | q:mass\|toRole | n→n₂→m₂ |
| S2r: mass→amount | m\|fromRole, M\|fromRole (or entity_ref), ν_from, ν_to | q:amount\|toRole | m→n→n₂ |
| S3: with yield | S1 or S2 knowns + q:yield | q:mass\|product | chain + yield (trace marks theoretical→actual) |
| S3r: find yield | m_actual + m_theoretical (or S1 chain) | q:yield | chain + η |

When `M` is not in knowns but `entity_ref` is on the QRef context, M is auto-derived via the existing `deriveMolarMass()` function (currently private in `derive-quantity.ts` — must be exported in Step 1).

### Role binding rules

- `q:molar_mass` — semantically, M is a property of the substance, not of its participation role. Distinguished by `context.entity_ref`. However, in stoichiometry orchestration context, M knowns also carry `role: 'reactant'`/`'product'` for non-fragile matching (avoids positional or cross-referencing logic). This pragmatic addition is specific to the stoichiometry chain; in other contexts M remains role-less.
- `q:amount`, `q:mass` — carry participant role (`reactant`/`product`) in stoichiometry context.
- `q:yield` — carries no participant role. The `actual`/`theoretical` distinction for mass values is not expressed through `QRef.role`; it is handled internally by helpers and recorded as trace-level semantics.
- Stoichiometric coefficients (`ν`) — passed as plain knowns with quantity `q:stoich_coeff` and role `reactant`/`product`. These are context inputs, not ontology quantities.

### Target QRef convention

The stoichiometry branch's **target QRef carries `quantity` + `role` only — no `context`**. Example: `{ quantity: 'q:mass', role: 'product' }`. This distinguishes it from the existing single-substance branch which checks `target.context?.system_type === 'substance'`.

Intermediate QRefs in the trace _may_ carry `context.entity_ref` for rendering (e.g., to show which substance the M derivation refers to), but the entry-point target does not.

**Limitation:** In Slice 3, target identity is resolved from the known signature and solver-provided metadata; target QRef itself remains context-free to avoid colliding with the existing single-substance branch. This means only one meaningful product target per `deriveQuantity()` call — sufficient for single-source stoichiometry.

### `deriveQuantity()` branch addition

New branch inserted before the existing `q:mass`/`q:amount` substance branch. Pseudo-logic:

```typescript
// Stoichiometry/yield: detected by presence of stoichiometric coefficient knowns
if (hasStoichiometricKnowns(knowns)) {
  return deriveStoichiometryChain(target, knowns, formulas, constants, ontology, trace);
}
```

`hasStoichiometricKnowns()` requires all three conditions:

1. Two `q:stoich_coeff` knowns with different roles (one `reactant`, one `product`)
2. At least one source-side quantity: `q:mass|fromRole` or `q:amount|fromRole`
3. Enough target-side info to complete the chain: either `q:molar_mass` with matching `entity_ref` for the target substance, or an `entity_ref` context that enables auto-derivation

This prevents the branch from activating on incomplete signatures where the fallback branch would be more appropriate.

`deriveStoichiometryChain()` orchestrates the helper units in sequence based on which signature matches.

### Reverse direction mechanics

`formula:stoichiometry_ratio` has `semantic_role: "reactant"` on `n_1`/`nu_1` and `semantic_role: "product"` on `n_2`/`nu_2`. The formula also has `"invertible_for": ["n_1"]` with a pre-built inversion expression.

For reverse direction (product → reactant), `deriveStoichiometricAmount` calls `formulaSolveFor(formula, 'n_1', { n_2, nu_1, nu_2 })` — using the formula's own inversion. The helper maps `fromRole`/`toRole` to the correct formula variable names:

- `fromRole = 'reactant'` → bind to `n_1`/`nu_1`, evaluate forward for `n_2`
- `fromRole = 'product'` → bind to `n_2`/`nu_2`, solve for `n_1` via inversion

---

## Data layer

### Existing formulas (no changes)

| Formula ID | Expression | Semantic roles | Used for |
|-----------|-----------|----------------|----------|
| `formula:amount_from_mass` | n = m/M | none | m↔n conversion (both roles) |
| `formula:stoichiometry_ratio` | n₂ = n₁×ν₂/ν₁ | reactant, product | cross-role amount |
| `formula:yield` | η = m_actual/m_theoretical×100 | actual, theoretical | yield chain |

### Existing quantity IDs (no changes)

- `q:mass` (g) — with role: reactant/product (no actual/theoretical on role axis)
- `q:amount` (mol) — with role: reactant/product
- `q:molar_mass` (g/mol) — role-less
- `q:yield` (percent) — role-less

### Known ontology inconsistency: `q:stoich_coeff`

Slice 3 requires no new ontology edits, but continues to rely on an existing inconsistency: `formula:stoichiometry_ratio` references `q:stoich_coeff` in its variable definitions, which is not defined in `quantities_units_ontology.json`. This is acceptable because the new helpers bypass planner discovery for stoichiometry — they call `evaluateFormula`/`formulaSolveFor` directly. Adding `q:stoich_coeff` to the ontology is deferred until the planner becomes context-aware. Stoichiometric coefficients are passed as pre-resolved knowns with `quantity: 'q:stoich_coeff'` and `role: 'reactant'`/`'product'`.

### Yield normalization

`formula:yield` uses percent (0..100) in its expression (`η = m_actual/m_theoretical × 100`). The solver currently passes `yield_percent` directly. The new helpers will pass yield in the same format — percent. Internal normalization to 0..1 is NOT done in this slice. If the formula definition changes later, the helpers adapt.

### Slot-to-QRef mapping (current boundary)

The mapping from task engine slots (`given_mass`, `given_coeff`, `given_M`, `find_coeff`, `find_M`, `yield_percent`) to typed QRefs lives in the solver wiring code in `solvers.ts`. This is explicitly a **current boundary** — it is the point where the task engine's flat slot model meets the typed derivation system. It may move closer to the task engine later, but for now it stays in the solver function.

Note: current generators produce `given_formula`/`find_formula` slots (e.g., `"H2SO4"`) — not `entity_ref` values. The solver wiring must construct entity refs from these slots: `'substance:' + slots.given_formula`. If M is already resolved as a numeric slot (`given_M`), the entity_ref on the molar mass QRef is optional (used only for auto-derivation when M is absent).

```typescript
// Example mapping in solver wiring:
const givenEntityRef = 'substance:' + String(slots.given_formula);
const findEntityRef = 'substance:' + String(slots.find_formula);
const knowns = [
  { qref: { quantity: 'q:mass', role: 'reactant' as SemanticRole }, value: Number(slots.given_mass) },
  { qref: { quantity: 'q:stoich_coeff', role: 'reactant' as SemanticRole }, value: Number(slots.given_coeff) },
  { qref: { quantity: 'q:molar_mass', role: 'reactant' as SemanticRole, context: { system_type: 'substance', entity_ref: givenEntityRef } }, value: Number(slots.given_M) },
  { qref: { quantity: 'q:stoich_coeff', role: 'product' as SemanticRole }, value: Number(slots.find_coeff) },
  { qref: { quantity: 'q:molar_mass', role: 'product' as SemanticRole, context: { system_type: 'substance', entity_ref: findEntityRef } }, value: Number(slots.find_M) },
];
const target: QRef = { quantity: 'q:mass', role: 'product' as SemanticRole };
```

The two `q:molar_mass` knowns are distinguished by both `role` and `context.entity_ref`. The `role` enables the stoichiometry orchestrator to match M to the correct participant side without fragile positional logic. The `context.entity_ref` provides substance identity for auto-derivation and provenance. In non-stoichiometry contexts, M remains role-less.

When M is NOT in slots (future scenario), the knowns omit the molar mass entries entirely and the helpers auto-derive M from the `entity_ref` via `deriveMolarMass()`.

### What the migration replaces

Current solvers (`solveStoichiometry`, `solveReactionYield`) contain procedural sequencing: manually calling `evaluateFormula` and `formulaSolveFor` in a hardcoded order. The migration replaces this with a single `deriveQuantity()` call — a reusable derivation entry point that produces the same numeric result plus a structured trace.

---

## Trace structure

New stoichiometry/yield branches produce traces using **existing step vocabulary only** — no new `ReasonStep` type variants.

### Full trace for S1 (mass→mass stoichiometry)

```
given:        m(reactant) = 4.9 g
decompose:    H₂SO₄ → H×2, S×1, O×4        (if M auto-derived)
lookup:       Ar(H)=1.008, Ar(S)=32.06, ...  (if M auto-derived)
compute:      M(H₂SO₄) = 98.07              (if M auto-derived)
formula_select: formula:amount_from_mass
substitution:   m=4.9, M=98.07
compute:        n(reactant) = 0.05
formula_select: formula:stoichiometry_ratio
substitution:   n₁=0.05, ν₁=1, ν₂=1
compute:        n(product) = 0.05
decompose:    BaSO₄ → ...                   (if M auto-derived)
lookup:       Ar(Ba), Ar(S), Ar(O)           (if M auto-derived)
compute:      M(BaSO₄) = 233.39             (if M auto-derived)
formula_select: formula:amount_from_mass
substitution:   n=0.05, M=233.39
compute:        m(product) = 11.67
conclusion:     m(product) = 11.67 g
```

### S3 extension (with yield)

After the S1 chain, the yield step explicitly marks the theoretical→actual transition:
```
formula_select: formula:yield
substitution:   m_theoretical=11.67, η=85
compute:        m(product) = 9.92              (yield applied; trace marks this as actual)
conclusion:     m(product) = 9.92 g
```

### Trace invariants

- Each helper unit appends its own steps to the shared `trace` array.
- QRefs in trace carry `context.entity_ref` — renderer can show which substance.
- Role appears on QRef (`role: 'reactant'`), not as a step type.
- `actual`/`theoretical` is NOT expressed through `QRef.role`. Both theoretical and actual product mass carry `role: 'product'`. The yield step in trace (`formula_select: formula:yield`) explicitly marks the theoretical→actual transition. Helpers track this distinction internally.
- M derivation steps (decompose/lookup/compute) are included only when M is auto-derived, not when M is a pre-resolved known.

---

## Testing strategy

### Layer 1: Unit tests for helper units (~8 tests)

Each helper tested in isolation with minimal data:

- `deriveAmountForRole({ role: 'reactant', mass: 9.8, M: 98 })` → n = 0.1
- `deriveAmountForRole({ role: 'product', ... })` — same logic, different role tag
- `deriveStoichiometricAmount({ n: 0.1, ν_from: 1, ν_to: 2 })` → n = 0.2
- `deriveMassForRole({ role: 'product', n: 0.2, M: 233 })` → m = 46.6
- `applyYield({ m_theoretical: 46.6, eta: 85 })` → m_actual ≈ 39.61
- `deriveYield({ m_actual: 39.61, m_theoretical: 46.6 })` → η ≈ 85
- Each returns `{ qref, value }` with correct role/context on qref
- M auto-derive: omit M from inputs, provide entity_ref → M resolved from ontology

### Layer 2: Integration tests via `deriveQuantity()` (~10 tests, real data)

Per signature, using real `formulas.json`, `elements.json`, `constants.json`:

| Test | Signature | Input | Expected |
|------|-----------|-------|----------|
| S1 forward | mass→mass | m(H₂SO₄)=9.8g, ν₁=1, ν₂=1, M auto | m(BaSO₄) ≈ 23.3g |
| S1 reverse | mass→mass | m(product) known → m(reactant) | correct reverse |
| S2 amount→mass | amount→mass | n(reactant)=0.1, ν, M | m(product) |
| S2r mass→amount | mass→amount | m(reactant), ν | n(product) |
| S3 with yield | S1 + yield | m + η=85% | m_actual |
| S3r find yield | actual+theoretical | m_actual + m_theoretical | η |
| M auto-derived | no M in knowns | entity_ref on context | M from composition |
| Unsupported | missing ν | only mass, no coefficients | throws clear error |

**Trace assertions on each:**
- Trace contains expected step types in order
- QRefs have correct `context.entity_ref` and `role`
- Stoichiometry step has both role-bound QRefs
- No duplicate or missing steps

### Layer 3: Solver migration parity (~6 tests)

Golden tests that lock in identical outputs (±0.01):

- 3 representative `solver.stoichiometry` inputs → same answer via `deriveQuantity()`
- 3 representative `solver.reaction_yield` inputs → same answer via `deriveQuantity()`

These use the exact slot values from existing task template instances.

### What we don't test

- Renderer (no rendering changes)
- Planner internals (46 existing tests, untouched)
- Limiting reagent (out of scope)

---

## Error handling

- **Helper units throw descriptive errors:** Include the entity ref and missing quantity.
  Example: `"deriveAmountForRole: missing q:molar_mass for substance:H2SO4"`
- **`deriveQuantity()` rethrows with signature context:**
  Example: `"Unsupported stoichiometry signature: knowns=[m|reactant, ν×2], missing=[M|reactant]"`
- **Transition fallback (temporary):** During migration, solver wrapper catches errors and falls back to the old solver with `console.warn`. Removed once parity tests are green.
- **No silent failures:** Every branch either succeeds with `{ qref, value }` or throws.
- **Rounding:** Helpers return full-precision values. Rounding to 2 decimal places (`Math.round(x * 100) / 100`) happens only at the solver boundary in `solvers.ts`, matching the current `solveStoichiometry`/`solveReactionYield` behavior. This ensures parity.

---

## Migration sequence

Three independently deployable steps:

### Step 1: Add helpers + new branches

- New helper functions (5 units) in `derive-quantity.ts` or a co-located file
- New `hasStoichiometricKnowns()` + `deriveStoichiometryChain()` in `derive-quantity.ts`
- New tests (layers 1 + 2)
- No solver changes — existing code untouched

### Step 2: Wire solvers

- In `solvers.ts`, replace `solveStoichiometry()` and `solveReactionYield()` bodies with `deriveQuantity()` calls
- Slot-to-QRef mapping in the solver function (the current boundary)
- Parity tests (layer 3) confirm identical outputs
- Temporary fallback wrapper for safety

### Step 3: Cleanup

- Remove old procedural solver bodies (the replaced code)
- Remove fallback wrappers
- Each step is one commit with its own test coverage

---

## Files affected

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/derivation/derive-quantity.ts` | MODIFY | Add stoichiometry/yield branches + helper units; export `deriveMolarMass` (currently private) |
| `src/lib/task-engine/solvers.ts` | MODIFY | Replace solveStoichiometry/solveReactionYield bodies |
| `src/lib/__tests__/derive-stoichiometry.test.ts` | NEW | ~24 tests (3 layers) |
| `src/types/derivation.ts` | NO CHANGE | Existing types sufficient |
| `data-src/foundations/formulas.json` | NO CHANGE | Existing formulas sufficient |
| `data-src/quantities_units_ontology.json` | NO CHANGE | Existing quantities sufficient |

---

## Not in scope (deferred to later phases)

- **Limiting reagent** — requires multi-source comparison, `compare`/`select_limiting` step types
- **Reaction context in derivation engine** — coefficients stay as pre-resolved knowns
- **Concentration-based stoichiometry** — solution volume + concentration → mass chain
- **Post-reaction composition** — leftover amounts, mixture properties
- **New trace step types** — existing vocabulary covers all Slice 3 needs
- **Explanation renderer** — no new step types means no renderer changes
