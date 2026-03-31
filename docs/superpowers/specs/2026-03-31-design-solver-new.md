# Quantity Network Slice 2: Component Mass Fraction + Ontology Overlays + Rich Refs

## Context

Slice 1 (complete, 2026-03-14) established the `deriveQuantity()` orchestration layer with substance context: `substance → composition → Ar(element) → M(substance) → m/n`. This slice extends the network with component-level context and adds supporting data tasks.

Three tasks in one spec:
1. **Component mass fraction derivation** — `q:component_mass_fraction` via intermediate `q:component_molar_mass_contribution`
2. **en/pl/es quantity/unit translation overlays** — fill the gap where only `ru` has `quantities_units_ontology.json`
3. **Rich text ref segments** — replace plain-text quantity symbols in theory module with ontology refs

---

## Task 1: Component Mass Fraction Derivation

### 1.1 Semantic Model

Mass fraction of an element in a substance requires two dimensions:
- **which element** (the component)
- **in which substance** (the parent)

The target quantity lives in `substance_component` context, not plain `substance`.

### 1.2 New Quantities

Add to `data-src/quantities_units_ontology.json`:

| ID | display_symbol | dimension | recommended_units |
|----|---------------|-----------|-------------------|
| `q:atom_count_in_composition` | — | 1 | dimensionless |
| `q:component_molar_mass_contribution` | — | M/N | g/mol |
| `q:component_mass_fraction` | ω | 1 | fraction, percent |

`q:atom_count_in_composition` is already used in resolver QRefs but missing from the ontology.

`q:atom_count_in_composition` and `q:component_molar_mass_contribution` have no `display_symbol` — they are internal intermediate quantities, not shown in formula display. Their symbols are context-dependent (come from the formula variable's `display_symbol` when rendered).

### 1.3 New Formulas

Add to `data-src/foundations/formulas.json`:

**`formula:component_molar_mass_contribution`**
```
M_part(e, S) = Ar(e) × count(e, S)
```

```json
{
  "id": "formula:component_molar_mass_contribution",
  "kind": "definition",
  "domain": "stoichiometry",
  "school_grade": [8, 9],
  "variables": [
    { "symbol": "M_part", "quantity": "q:component_molar_mass_contribution", "unit": "unit:g_per_mol", "role": "result" },
    { "symbol": "Ar", "display_symbol": "Aᵣ", "quantity": "q:relative_atomic_mass", "unit": "unit:dimensionless", "role": "input" },
    { "symbol": "count", "quantity": "q:atom_count_in_composition", "unit": "unit:dimensionless", "role": "input" }
  ],
  "expression": { "op": "multiply", "operands": ["Ar", "count"] },
  "result_variable": "M_part",
  "invertible_for": ["Ar", "count"],
  "inversions": {
    "Ar": { "op": "divide", "operands": ["M_part", "count"] },
    "count": { "op": "divide", "operands": ["M_part", "Ar"] }
  },
  "constants_used": [],
  "prerequisite_formulas": [],
  "used_by_solvers": ["solver.mass_fraction"]
}
```

**`formula:component_mass_fraction`**
```
ω(e, S) = M_part(e, S) / M(S)
```

Returns fraction (0..1), not percent. UI formats as needed.

**Coexistence with `formula:mass_fraction_element`:** The existing formula returns percent and targets `q:mass_fraction`. It remains in use by the task engine solver (`solver.mass_fraction` in `solvers.ts`). The new `formula:component_mass_fraction` targets a different quantity (`q:component_mass_fraction`) and returns fraction. These are separate derivation paths: the task engine uses the old formula directly; `deriveQuantity()` uses the new decomposed chain. No conflict — they coexist by targeting different quantity IDs.

```json
{
  "id": "formula:component_mass_fraction",
  "kind": "definition",
  "domain": "stoichiometry",
  "school_grade": [8, 9],
  "variables": [
    { "symbol": "omega", "display_symbol": "ω", "quantity": "q:component_mass_fraction", "unit": "unit:fraction", "role": "result" },
    { "symbol": "M_part", "quantity": "q:component_molar_mass_contribution", "unit": "unit:g_per_mol", "role": "input" },
    { "symbol": "M", "quantity": "q:molar_mass", "unit": "unit:g_per_mol", "role": "input" }
  ],
  "expression": { "op": "divide", "operands": ["M_part", "M"] },
  "result_variable": "omega",
  "invertible_for": ["M_part", "M"],
  "inversions": {
    "M_part": { "op": "multiply", "operands": ["omega", "M"] },
    "M": { "op": "divide", "operands": ["M_part", "omega"] }
  },
  "constants_used": [],
  "prerequisite_formulas": ["formula:component_molar_mass_contribution", "formula:molar_mass_from_composition"],
  "used_by_solvers": ["solver.mass_fraction"]
}
```

### 1.4 Context Shapes

Already defined in `BoundContext` (no type changes needed):

**Substance:**
```typescript
{ system_type: 'substance', entity_ref: 'substance:H2SO4' }
```

**Substance component:**
```typescript
{
  system_type: 'substance_component',
  entity_ref: 'element:O',
  parent_ref: 'substance:H2SO4',
  bindings: { component: 'element:O' }
}
```

### 1.5 Derivation Chain

For target `q:component_mass_fraction` in `substance_component` context:

| Step | Action | Example |
|------|--------|---------|
| 1 | Decompose parent substance | H2SO4 → [{H,2}, {S,1}, {O,4}] |
| 2 | Select component from decomposition | element:O → count=4 |
| 3 | Lookup Ar of component element | Ar(O) = 15.999 |
| 4 | Evaluate `formula:component_molar_mass_contribution` | M_part = 15.999 × 4 = 63.996 |
| 5 | Derive M(substance) via `deriveMolarMass()` | M(H2SO4) = 98.077 |
| 6 | Evaluate `formula:component_mass_fraction` | ω = 63.996 / 98.077 ≈ 0.6526 |

### 1.6 Code Changes

**`src/lib/derivation/derive-quantity.ts`** — add two new handlers:

1. `q:component_molar_mass_contribution` + `substance_component` context → steps 1-4
2. `q:component_mass_fraction` + `substance_component` context → steps 1-6

New function `deriveMassFractionOfComponent(entityRef, parentRef, formulas, constants, ontology, trace)`:
- Calls `resolveDecompose(parentRef)` for step 1
- Finds component in items for step 2
- Calls `resolveLookup()` for step 3
- Evaluates `formula:component_molar_mass_contribution` for step 4
- Calls existing `deriveMolarMass(parentRef)` for step 5
- Evaluates `formula:component_mass_fraction` for step 6

New function `deriveComponentContribution(entityRef, parentRef, formulas, constants, ontology, trace)`:
- Steps 1-4 only, returns M_part value

Both are MVP shortcut functions (same pattern as `deriveMolarMass()`).

**`src/types/derivation.ts`** — no changes needed. Existing `ReasonStep` variants cover all steps.

**`src/lib/derivation/resolvers.ts`** — no changes needed.

**`src/lib/derivation/qref.ts`** — no changes needed.

### 1.7 Trace Output

For `ω(O in H2SO4)`:

```
decompose    substance:H2SO4 → [{H,2}, {S,1}, {O,4}]
lookup       Ar(O) = 15.999
formula_select  formula:component_molar_mass_contribution → q:component_molar_mass_contribution
substitution    { Ar: 15.999, count: 4 }
compute         result: 63.996
decompose    substance:H2SO4 → [{H,2}, {S,1}, {O,4}]  (for M derivation)
lookup       Ar(H) = 1.008
lookup       Ar(S) = 32.06
lookup       Ar(O) = 15.999
formula_select  formula:molar_mass_from_composition → q:molar_mass
compute         result: 98.077
formula_select  formula:component_mass_fraction → q:component_mass_fraction
substitution    { M_part: 63.996, M: 98.077 }
compute         result: 0.6526
conclusion      value: 0.6526
```

Note: decompose appears twice (once for component, once for M). This is acceptable for MVP — a future optimization could cache decompose results.

### 1.8 Tests

Add to `src/lib/__tests__/derive-quantity.test.ts`:

Tests use `toBeCloseTo(expected, 2)` (2 decimal places) to tolerate element mass precision.

```
describe('component mass fraction')
  ✓ ω(O in H2SO4) ≈ 0.6526
  ✓ ω(H in H2O) ≈ 0.1119
  ✓ ω(N in NH3) ≈ 0.8224
  ✓ trace contains decompose step
  ✓ trace contains component_molar_mass_contribution formula_select
  ✓ trace contains component_mass_fraction formula_select
  ✓ element not in substance throws (e.g., Fe in H2SO4)
  ✓ unknown element throws (e.g., Xx in anything)

describe('component molar mass contribution')
  ✓ M_part(O in H2SO4) ≈ 63.996
  ✓ M_part(H in H2SO4) ≈ 2.016
```

---

## Task 2: en/pl/es Quantity/Unit Translation Overlays

### 2.1 New Files

| File | Content |
|------|---------|
| `data-src/translations/en/quantities_units_ontology.json` | English quantity names + unit abbreviations |
| `data-src/translations/pl/quantities_units_ontology.json` | Polish quantity names + unit abbreviations |
| `data-src/translations/es/quantities_units_ontology.json` | Spanish quantity names + unit abbreviations |

### 2.2 Structure

Same as existing `ru` overlay — `quantities` and `units` sections keyed by ID:

```json
{
  "quantities": {
    "q:mass": { "name": "mass" },
    "q:molar_mass": { "name": "molar mass" },
    ...
  },
  "units": {
    "unit:g": { "name": "g" },
    "unit:mol": { "name": "mol" },
    ...
  }
}
```

### 2.3 Translation Table (quantities)

| ID | en | pl | es |
|----|----|----|-----|
| q:mass | mass | masa | masa |
| q:amount | amount of substance | ilość substancji | cantidad de sustancia |
| q:volume | volume | objętość | volumen |
| q:concentration | molar concentration | stężenie molowe | concentración molar |
| q:temperature | temperature | temperatura | temperatura |
| q:pressure | pressure | ciśnienie | presión |
| q:energy | energy/heat | energia/ciepło | energía/calor |
| q:density | density | gęstość | densidad |
| q:relative_atomic_mass | relative atomic mass | względna masa atomowa | masa atómica relativa |
| q:charge | electric charge | ładunek elektryczny | carga eléctrica |
| q:atom_count | atom count | liczba atomów | número de átomos |
| q:molar_mass | molar mass | masa molarna | masa molar |
| q:mass_fraction | mass fraction | udział masowy | fracción másica |
| q:volume_fraction | volume fraction | udział objętościowy | fracción volumétrica |
| q:molar_volume | molar volume | objętość molarna | volumen molar |
| q:solubility | solubility | rozpuszczalność | solubilidad |
| q:yield | reaction yield | wydajność reakcji | rendimiento de reacción |
| q:enthalpy | reaction enthalpy | entalpia reakcji | entalpía de reacción |
| q:condition | qualitative condition | warunek jakościowy | condición cualitativa |
| q:atom_count_in_composition | atom count in composition | liczba atomów w składzie | número de átomos en composición |
| q:component_molar_mass_contribution | component mass contribution | wkład masowy składnika | contribución másica del componente |
| q:component_mass_fraction | component mass fraction | udział masowy składnika | fracción másica del componente |

### 2.4 Translation Table (units)

Most units are locale-neutral. Differences:

| ID | ru | en | pl | es |
|----|----|----|----|----|
| unit:g | г | g | g | g |
| unit:kg | кг | kg | kg | kg |
| unit:mol | моль | mol | mol | mol |
| unit:L | л | L | L | L |
| unit:m3 | м³ | m³ | m³ | m³ |
| unit:mol_per_L | моль/л | mol/L | mol/L | mol/L |
| unit:mol_per_m3 | моль/м³ | mol/m³ | mol/m³ | mol/m³ |
| unit:K | K | K | K | K |
| unit:degC | °C | °C | °C | °C |
| unit:degF | °F | °F | °F | °F |
| unit:Pa | Па | Pa | Pa | Pa |
| unit:bar | бар | bar | bar | bar |
| unit:atm | атм | atm | atm | atm |
| unit:J | Дж | J | J | J |
| unit:kJ | кДж | kJ | kJ | kJ |
| unit:g_per_mL | г/мл | g/mL | g/mL | g/mL |
| unit:kg_per_m3 | кг/м³ | kg/m³ | kg/m³ | kg/m³ |
| unit:g_per_mol | г/моль | g/mol | g/mol | g/mol |
| unit:kg_per_mol | кг/моль | kg/mol | kg/mol | kg/mol |
| unit:mL | мл | mL | mL | mL |
| unit:kPa | кПа | kPa | kPa | kPa |
| unit:mmHg | мм рт. ст. | mmHg | mmHg | mmHg |
| unit:fraction | доля | fraction | ułamek | fracción |
| unit:percent | % | % | % | % |
| unit:L_per_mol | л/моль | L/mol | L/mol | L/mol |
| unit:g_per_100g | г/100 г | g/100 g | g/100 g | g/100 g |
| unit:kJ_per_mol | кДж/моль | kJ/mol | kJ/mol | kJ/mol |
| unit:J_per_mol | Дж/моль | J/mol | J/mol | J/mol |
| unit:enum | enum | enum | enum | enum |
| unit:dimensionless | безразмерная | dimensionless | bezwymiarowa | adimensional |
| unit:C | Кл | C | C | C |
| unit:elementary_charge | e | e | e | e |

No code changes — data only.

---

## Task 3: Rich Text Ref Segments in Theory Module

### 3.1 Blocks to Convert

Convert paragraphs containing quantity symbols from `{ "t": "paragraph" }` to `{ "t": "text_block", "content": [] }` in `data-src/theory_modules/calculations.json`.

| Section | Block idx | Current | Symbols | New type |
|---------|----------|---------|---------|----------|
| molar_mass | 0 | paragraph | M | text_block |
| amount | 0 | paragraph | n, M | text_block |
| mass_fraction_element | 0 | paragraph | ω | text_block |
| mass_fraction_element | 2 | paragraph | n | text_block |
| solution_fraction | 0 | paragraph | ω | text_block |
| yield | 0 | paragraph | η | text_block |
| yield | 3 | paragraph | η | text_block |

### 3.2 Base Data Changes

In `data-src/theory_modules/calculations.json`, change affected blocks from:
```json
{ "t": "paragraph" }
```
to:
```json
{ "t": "text_block", "content": [] }
```

### 3.3 Locale Overlay Changes

Each locale overlay provides `content` arrays with ref segments. Example for `molar_mass` block 0 in `ru`:

```json
{
  "content": [
    { "t": "text", "v": "Молярная масса (" },
    { "t": "ref", "id": "q:molar_mass", "surface": "M" },
    { "t": "text", "v": ") — масса одного моля вещества, измеряется в г/моль." }
  ]
}
```

Same in `en`:
```json
{
  "content": [
    { "t": "text", "v": "Molar mass (" },
    { "t": "ref", "id": "q:molar_mass", "surface": "M" },
    { "t": "text", "v": ") is the mass of one mole of a substance, measured in g/mol." }
  ]
}
```

### 3.4 Ref Segments Used

| Quantity | Surface | Used in sections |
|----------|---------|-----------------|
| q:molar_mass | M | molar_mass, amount |
| q:amount | n | amount |
| q:mass_fraction | ω | mass_fraction_element, solution_fraction |
| q:yield | η | yield |
| q:atom_count_in_composition | n | mass_fraction_element |

### 3.5 Files Modified

| File | Changes |
|------|---------|
| `data-src/theory_modules/calculations.json` | 7 blocks: paragraph → text_block |
| `data-src/translations/ru/theory_modules/calculations.json` | 7 blocks: add `content` arrays with refs |
| `data-src/translations/en/theory_modules/calculations.json` | 7 blocks: add `content` arrays with refs |
| `data-src/translations/pl/theory_modules/calculations.json` | 7 blocks: add `content` arrays with refs |
| `data-src/translations/es/theory_modules/calculations.json` | 7 blocks: add `content` arrays with refs |

---

## Files Summary

| File | Action | Task |
|------|--------|------|
| `data-src/quantities_units_ontology.json` | MODIFY — add 3 quantities | 1 |
| `data-src/foundations/formulas.json` | MODIFY — add 2 formulas | 1 |
| `src/lib/derivation/derive-quantity.ts` | MODIFY — add 2 handlers + 2 functions | 1 |
| `src/lib/__tests__/derive-quantity.test.ts` | MODIFY — add ~9 tests | 1 |
| `data-src/translations/en/quantities_units_ontology.json` | NEW | 2 |
| `data-src/translations/pl/quantities_units_ontology.json` | NEW | 2 |
| `data-src/translations/es/quantities_units_ontology.json` | NEW | 2 |
| `data-src/translations/ru/quantities_units_ontology.json` | MODIFY — add 3 new quantity names | 2 |
| `data-src/theory_modules/calculations.json` | MODIFY — 6 paragraph → text_block | 3 |
| `data-src/translations/ru/theory_modules/calculations.json` | MODIFY — 6 blocks get content arrays | 3 |
| `data-src/translations/en/theory_modules/calculations.json` | MODIFY — 6 blocks get content arrays | 3 |
| `data-src/translations/pl/theory_modules/calculations.json` | MODIFY — 6 blocks get content arrays | 3 |
| `data-src/translations/es/theory_modules/calculations.json` | MODIFY — 6 blocks get content arrays | 3 |

**No changes to:** planner, executor, evaluator, resolvers, qref, types, TheoryModulePanel, RichTextRenderer, OntologyRef.

---

## Verification

```bash
# Data validates
npm run validate:data

# All tests pass (existing + new)
npm test

# Full build
npm run build

# Manual QA
# 1. /calculations/ — theory panel shows quantity chips (yellow M, n, ω, η) not plain text
# 2. /en/calculations/ — English theory with same quantity chips
# 3. deriveQuantity({ target: q:component_mass_fraction, context: substance_component O in H2SO4 }) ≈ 0.6526
```
