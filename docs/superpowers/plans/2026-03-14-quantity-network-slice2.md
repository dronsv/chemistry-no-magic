# Quantity Network Slice 2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `deriveQuantity()` with component mass fraction derivation, add translation overlays for quantities/units, and convert plain-text quantity symbols in theory modules to rich text ref segments.

**Architecture:** Three independent data+code tasks. Task 1 adds 2 formulas to the ontology and 2 handler functions to the orchestrator. Task 2 creates translation overlay files (data only). Task 3 converts 7 theory module paragraph blocks to text_block with ref segments (data only). No changes to planner, executor, evaluator, resolvers, or types.

**Tech Stack:** TypeScript, Vitest, JSON data files

**Spec:** `docs/superpowers/specs/2026-03-14-quantity-network-slice2-design.md`

---

## Chunk 1: Component Mass Fraction Derivation

### Task 1: Add New Quantities to Ontology

**Files:**
- Modify: `data-src/quantities_units_ontology.json:173-179` (insert after `q:condition`)

- [ ] **Step 1: Add 3 new quantities to `quantities_units_ontology.json`**

Insert these 3 entries at the end of the `"quantities"` array (before the closing `]`), after the `q:condition` entry:

```json
    {
      "id": "q:atom_count_in_composition",
      "dimension": "1",
      "recommended_units": [
        "unit:dimensionless"
      ]
    },
    {
      "id": "q:component_molar_mass_contribution",
      "dimension": "M/N",
      "recommended_units": [
        "unit:g_per_mol"
      ]
    },
    {
      "id": "q:component_mass_fraction",
      "display_symbol": "\u03c9",
      "dimension": "1",
      "recommended_units": [
        "unit:fraction",
        "unit:percent"
      ]
    }
```

Note: `q:atom_count_in_composition` and `q:component_molar_mass_contribution` intentionally have no `display_symbol` — they are internal intermediate quantities whose symbols come from formula variable `display_symbol` when rendered.

- [ ] **Step 2: Validate data**

Run: `npm run validate:data`
Expected: PASS (no schema errors)

- [ ] **Step 3: Commit**

```bash
git add data-src/quantities_units_ontology.json
git commit -m "feat(ontology): add component mass fraction quantities to ontology"
```

---

### Task 2: Add New Formulas to Ontology

**Files:**
- Modify: `data-src/foundations/formulas.json:458` (insert before closing `]`)

- [ ] **Step 1: Add `formula:component_molar_mass_contribution` to `formulas.json`**

Insert before the final `]` (after the `formula:arrhenius` entry, adding a comma after the closing `}` of arrhenius):

```json
  {
    "id": "formula:component_molar_mass_contribution",
    "kind": "definition",
    "domain": "stoichiometry",
    "school_grade": [8, 9],
    "variables": [
      { "symbol": "M_part", "quantity": "q:component_molar_mass_contribution", "unit": "unit:g_per_mol", "role": "result" },
      { "symbol": "Ar", "display_symbol": "A\u1d63", "quantity": "q:relative_atomic_mass", "unit": "unit:dimensionless", "role": "input" },
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

- [ ] **Step 2: Add `formula:component_mass_fraction` to `formulas.json`**

Insert after the entry from Step 1:

```json
  {
    "id": "formula:component_mass_fraction",
    "kind": "definition",
    "domain": "stoichiometry",
    "school_grade": [8, 9],
    "variables": [
      { "symbol": "omega", "display_symbol": "\u03c9", "quantity": "q:component_mass_fraction", "unit": "unit:fraction", "role": "result" },
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

Note: Returns fraction (0..1), not percent. Coexists with existing `formula:mass_fraction_element` which returns percent and targets `q:mass_fraction` — different quantity IDs, no conflict.

- [ ] **Step 3: Validate data**

Run: `npm run validate:data`
Expected: PASS

- [ ] **Step 4: Run existing tests to verify no regressions**

Run: `npx vitest run src/lib/__tests__/derive-quantity.test.ts`
Expected: All 19 existing tests pass (new formulas don't break existing derivation rules)

- [ ] **Step 5: Commit**

```bash
git add data-src/foundations/formulas.json
git commit -m "feat(ontology): add component mass fraction formulas"
```

---

### Task 3: Write Failing Tests for Component Mass Fraction

**Files:**
- Modify: `src/lib/__tests__/derive-quantity.test.ts`

- [ ] **Step 1: Add test substance NH3 to entityFormulas map**

In the test file, add `NH3` to the `entityFormulas` map (line 27-32):

```typescript
const entityFormulas = new Map<string, string>([
  ['substance:H2SO4', 'H2SO4'],
  ['substance:H2O', 'H2O'],
  ['substance:NaCl', 'NaCl'],
  ['substance:CO2', 'CO2'],
  ['substance:NH3', 'NH3'],
]);
```

- [ ] **Step 2: Add helper functions for component targets**

After the existing `molarMassTarget()` helper (line 38-40), add:

```typescript
function componentFractionTarget(element: string, substance: string): QRef {
  return {
    quantity: 'q:component_mass_fraction',
    context: {
      system_type: 'substance_component',
      entity_ref: `element:${element}`,
      parent_ref: `substance:${substance}`,
      bindings: { component: `element:${element}` },
    },
  };
}

function componentContributionTarget(element: string, substance: string): QRef {
  return {
    quantity: 'q:component_molar_mass_contribution',
    context: {
      system_type: 'substance_component',
      entity_ref: `element:${element}`,
      parent_ref: `substance:${substance}`,
      bindings: { component: `element:${element}` },
    },
  };
}
```

- [ ] **Step 3: Add component mass fraction tests**

After the `backward compatibility` describe block, add:

```typescript
  describe('component mass fraction', () => {
    it('\u03c9(O in H2SO4) \u2248 0.6526', () => {
      const result = deriveQuantity({
        target: componentFractionTarget('O', 'H2SO4'),
        knowns: [],
        formulas, constants, ontology,
      });
      expect(result.value).toBeCloseTo(0.6526, 2);
    });

    it('\u03c9(H in H2O) \u2248 0.1119', () => {
      const result = deriveQuantity({
        target: componentFractionTarget('H', 'H2O'),
        knowns: [],
        formulas, constants, ontology,
      });
      expect(result.value).toBeCloseTo(0.1119, 2);
    });

    it('\u03c9(N in NH3) \u2248 0.8224', () => {
      const result = deriveQuantity({
        target: componentFractionTarget('N', 'NH3'),
        knowns: [],
        formulas, constants, ontology,
      });
      expect(result.value).toBeCloseTo(0.8224, 2);
    });

    it('trace contains decompose step', () => {
      const result = deriveQuantity({
        target: componentFractionTarget('O', 'H2SO4'),
        knowns: [],
        formulas, constants, ontology,
      });
      expect(traceHas(result.trace, 'decompose')).toBe(true);
    });

    it('trace contains component_molar_mass_contribution formula_select', () => {
      const result = deriveQuantity({
        target: componentFractionTarget('O', 'H2SO4'),
        knowns: [],
        formulas, constants, ontology,
      });
      const selects = traceStepsOfType(result.trace, 'formula_select');
      expect(selects.some(s => s.formulaId === 'formula:component_molar_mass_contribution')).toBe(true);
    });

    it('trace contains component_mass_fraction formula_select', () => {
      const result = deriveQuantity({
        target: componentFractionTarget('O', 'H2SO4'),
        knowns: [],
        formulas, constants, ontology,
      });
      const selects = traceStepsOfType(result.trace, 'formula_select');
      expect(selects.some(s => s.formulaId === 'formula:component_mass_fraction')).toBe(true);
    });

    it('element not in substance throws', () => {
      expect(() =>
        deriveQuantity({
          target: componentFractionTarget('Fe', 'H2SO4'),
          knowns: [],
          formulas, constants, ontology,
        }),
      ).toThrow();
    });

    it('unknown substance throws', () => {
      expect(() =>
        deriveQuantity({
          target: componentFractionTarget('O', 'UNKNOWN'),
          knowns: [],
          formulas, constants, ontology,
        }),
      ).toThrow();
    });
  });

  describe('component molar mass contribution', () => {
    it('M_part(O in H2SO4) \u2248 63.996', () => {
      const result = deriveQuantity({
        target: componentContributionTarget('O', 'H2SO4'),
        knowns: [],
        formulas, constants, ontology,
      });
      expect(result.value).toBeCloseTo(63.996, 1);
    });

    it('M_part(H in H2SO4) \u2248 2.016', () => {
      const result = deriveQuantity({
        target: componentContributionTarget('H', 'H2SO4'),
        knowns: [],
        formulas, constants, ontology,
      });
      expect(result.value).toBeCloseTo(2.016, 1);
    });
  });
```

- [ ] **Step 4: Run the new tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/derive-quantity.test.ts`
Expected: 10 new tests FAIL (no handler for `q:component_mass_fraction` or `q:component_molar_mass_contribution` yet), 19 existing tests PASS

- [ ] **Step 5: Commit failing tests**

```bash
git add src/lib/__tests__/derive-quantity.test.ts
git commit -m "test(derivation): add failing tests for component mass fraction"
```

---

### Task 4: Implement Component Mass Fraction Derivation

**Files:**
- Modify: `src/lib/derivation/derive-quantity.ts`

- [ ] **Step 1: Add `deriveComponentContribution()` function**

Add after `deriveMolarMass()` at the end of the file:

```typescript
/**
 * Derive the molar mass contribution of a component element in a substance.
 * M_part(e, S) = Ar(e) * count(e, S)
 */
function deriveComponentContribution(
  entityRef: string,       // 'element:O'
  parentRef: string,       // 'substance:H2SO4'
  formulas: ComputableFormula[],
  constants: ConstantsDict,
  ontology: OntologyAccess,
  trace: ReasonStep[],
): number {
  // 1. Decompose parent substance
  const decomp = resolveDecompose(parentRef, ontology);
  if (!decomp) throw new Error(`Cannot decompose ${parentRef}`);
  trace.push(decomp.step);

  // 2. Find the component
  const symbol = entityRef.replace('element:', '');
  const component = decomp.items.find(i => i.element === symbol);
  if (!component) throw new Error(`Element ${symbol} not found in ${parentRef}`);

  // 3. Lookup Ar
  const lr = resolveLookup(component.arQRef, ontology);
  if (!lr) throw new Error(`Lookup failed for Ar of ${symbol}`);
  trace.push(lr.step);

  // 4. Evaluate formula:component_molar_mass_contribution
  const formula = formulas.find(f => f.id === 'formula:component_molar_mass_contribution');
  if (!formula) throw new Error('formula:component_molar_mass_contribution not found');

  const bindings: Record<string, number> = { Ar: lr.value, count: component.count };

  trace.push({
    type: 'formula_select',
    formulaId: formula.id,
    target: {
      quantity: 'q:component_molar_mass_contribution',
      context: { system_type: 'substance_component', entity_ref: entityRef, parent_ref: parentRef },
    },
  });
  trace.push({ type: 'substitution', formulaId: formula.id, bindings });

  const evalTrace = evaluateFormula(formula, bindings, constants);
  trace.push({ type: 'compute', formulaId: formula.id, result: evalTrace.result });

  return evalTrace.result;
}
```

- [ ] **Step 2: Add `deriveMassFractionOfComponent()` function**

Add after `deriveComponentContribution()`:

```typescript
/**
 * Derive mass fraction of a component element in a substance.
 * omega(e, S) = M_part(e, S) / M(S)
 */
function deriveMassFractionOfComponent(
  entityRef: string,       // 'element:O'
  parentRef: string,       // 'substance:H2SO4'
  formulas: ComputableFormula[],
  constants: ConstantsDict,
  ontology: OntologyAccess,
  trace: ReasonStep[],
): number {
  // Steps 1-4: derive M_part
  const M_part = deriveComponentContribution(entityRef, parentRef, formulas, constants, ontology, trace);

  // Step 5: derive M(substance)
  const M = deriveMolarMass(parentRef, formulas, constants, ontology, trace);

  // Step 6: evaluate formula:component_mass_fraction
  const formula = formulas.find(f => f.id === 'formula:component_mass_fraction');
  if (!formula) throw new Error('formula:component_mass_fraction not found');

  const bindings: Record<string, number> = { M_part, M };

  trace.push({
    type: 'formula_select',
    formulaId: formula.id,
    target: {
      quantity: 'q:component_mass_fraction',
      context: { system_type: 'substance_component', entity_ref: entityRef, parent_ref: parentRef },
    },
  });
  trace.push({ type: 'substitution', formulaId: formula.id, bindings });

  const evalTrace = evaluateFormula(formula, bindings, constants);
  trace.push({ type: 'compute', formulaId: formula.id, result: evalTrace.result });

  return evalTrace.result;
}
```

- [ ] **Step 3: Add handler for `q:component_molar_mass_contribution` in `deriveQuantity()`**

In the `deriveQuantity()` function, after the molar mass handler (after the `if (target.quantity === 'q:molar_mass' ...)` block, around line 56), insert:

```typescript
  // Component molar mass contribution: decompose → select component → lookup Ar → formula
  if (target.quantity === 'q:component_molar_mass_contribution'
      && target.context?.system_type === 'substance_component') {
    const entityRef = target.context.entity_ref!;
    const parentRef = target.context.parent_ref!;
    const value = deriveComponentContribution(entityRef, parentRef, formulas, constants, ontology, trace);
    trace.push({ type: 'conclusion', target, value });
    return { value, trace, isApproximate: false };
  }
```

- [ ] **Step 4: Add handler for `q:component_mass_fraction` in `deriveQuantity()`**

Immediately after the handler from Step 3, insert:

```typescript
  // Component mass fraction: M_part + M → omega
  if (target.quantity === 'q:component_mass_fraction'
      && target.context?.system_type === 'substance_component') {
    const entityRef = target.context.entity_ref!;
    const parentRef = target.context.parent_ref!;
    const value = deriveMassFractionOfComponent(entityRef, parentRef, formulas, constants, ontology, trace);
    trace.push({ type: 'conclusion', target, value });
    return { value, trace, isApproximate: false };
  }
```

- [ ] **Step 5: Run tests to verify all pass**

Run: `npx vitest run src/lib/__tests__/derive-quantity.test.ts`
Expected: All 29 tests pass (19 existing + 10 new)

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/lib/derivation/derive-quantity.ts
git commit -m "feat(derivation): add component mass fraction derivation chain"
```

---

## Chunk 2: Translation Overlays + Rich Text Refs

### Task 5: Add ru Overlay Entries for New Quantities

**Files:**
- Modify: `data-src/translations/ru/quantities_units_ontology.json`

- [ ] **Step 1: Add 3 new quantity entries to the ru overlay**

In `data-src/translations/ru/quantities_units_ontology.json`, add to the `"quantities"` object (after the `"q:condition"` entry):

```json
    "q:atom_count_in_composition": {
      "name": "число атомов в составе"
    },
    "q:component_molar_mass_contribution": {
      "name": "вклад компонента в молярную массу"
    },
    "q:component_mass_fraction": {
      "name": "массовая доля компонента"
    }
```

- [ ] **Step 2: Validate data**

Run: `npm run validate:data`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add data-src/translations/ru/quantities_units_ontology.json
git commit -m "feat(i18n): add ru names for component mass fraction quantities"
```

---

### Task 6: Create en/pl/es Quantity/Unit Overlays

**Files:**
- Create: `data-src/translations/en/quantities_units_ontology.json`
- Create: `data-src/translations/pl/quantities_units_ontology.json`
- Create: `data-src/translations/es/quantities_units_ontology.json`

- [ ] **Step 1: Create `data-src/translations/en/quantities_units_ontology.json`**

```json
{
  "quantities": {
    "q:mass": { "name": "mass" },
    "q:amount": { "name": "amount of substance" },
    "q:volume": { "name": "volume" },
    "q:concentration": { "name": "molar concentration" },
    "q:temperature": { "name": "temperature" },
    "q:pressure": { "name": "pressure" },
    "q:energy": { "name": "energy/heat" },
    "q:density": { "name": "density" },
    "q:relative_atomic_mass": { "name": "relative atomic mass" },
    "q:charge": { "name": "electric charge" },
    "q:atom_count": { "name": "atom count" },
    "q:molar_mass": { "name": "molar mass" },
    "q:mass_fraction": { "name": "mass fraction" },
    "q:volume_fraction": { "name": "volume fraction" },
    "q:molar_volume": { "name": "molar volume" },
    "q:solubility": { "name": "solubility" },
    "q:yield": { "name": "reaction yield" },
    "q:enthalpy": { "name": "reaction enthalpy" },
    "q:condition": { "name": "qualitative condition" },
    "q:atom_count_in_composition": { "name": "atom count in composition" },
    "q:component_molar_mass_contribution": { "name": "component contribution to molar mass" },
    "q:component_mass_fraction": { "name": "component mass fraction" }
  },
  "units": {
    "unit:g": { "name": "g" },
    "unit:kg": { "name": "kg" },
    "unit:mol": { "name": "mol" },
    "unit:L": { "name": "L" },
    "unit:m3": { "name": "m\u00b3" },
    "unit:mol_per_L": { "name": "mol/L" },
    "unit:mol_per_m3": { "name": "mol/m\u00b3" },
    "unit:K": { "name": "K" },
    "unit:degC": { "name": "\u00b0C" },
    "unit:degF": { "name": "\u00b0F" },
    "unit:Pa": { "name": "Pa" },
    "unit:bar": { "name": "bar" },
    "unit:atm": { "name": "atm" },
    "unit:J": { "name": "J" },
    "unit:kJ": { "name": "kJ" },
    "unit:g_per_mL": { "name": "g/mL" },
    "unit:kg_per_m3": { "name": "kg/m\u00b3" },
    "unit:g_per_mol": { "name": "g/mol" },
    "unit:kg_per_mol": { "name": "kg/mol" },
    "unit:mL": { "name": "mL" },
    "unit:kPa": { "name": "kPa" },
    "unit:mmHg": { "name": "mmHg" },
    "unit:fraction": { "name": "fraction" },
    "unit:percent": { "name": "%" },
    "unit:L_per_mol": { "name": "L/mol" },
    "unit:g_per_100g": { "name": "g/100 g" },
    "unit:kJ_per_mol": { "name": "kJ/mol" },
    "unit:J_per_mol": { "name": "J/mol" },
    "unit:enum": { "name": "enum" },
    "unit:dimensionless": { "name": "dimensionless" },
    "unit:C": { "name": "C" },
    "unit:elementary_charge": { "name": "e" }
  }
}
```

- [ ] **Step 2: Create `data-src/translations/pl/quantities_units_ontology.json`**

```json
{
  "quantities": {
    "q:mass": { "name": "masa" },
    "q:amount": { "name": "ilo\u015b\u0107 substancji" },
    "q:volume": { "name": "obj\u0119to\u015b\u0107" },
    "q:concentration": { "name": "st\u0119\u017cenie molowe" },
    "q:temperature": { "name": "temperatura" },
    "q:pressure": { "name": "ci\u015bnienie" },
    "q:energy": { "name": "energia/ciep\u0142o" },
    "q:density": { "name": "g\u0119sto\u015b\u0107" },
    "q:relative_atomic_mass": { "name": "wzgl\u0119dna masa atomowa" },
    "q:charge": { "name": "\u0142adunek elektryczny" },
    "q:atom_count": { "name": "liczba atom\u00f3w" },
    "q:molar_mass": { "name": "masa molarna" },
    "q:mass_fraction": { "name": "udzia\u0142 masowy" },
    "q:volume_fraction": { "name": "udzia\u0142 obj\u0119to\u015bciowy" },
    "q:molar_volume": { "name": "obj\u0119to\u015b\u0107 molarna" },
    "q:solubility": { "name": "rozpuszczalno\u015b\u0107" },
    "q:yield": { "name": "wydajno\u015b\u0107 reakcji" },
    "q:enthalpy": { "name": "entalpia reakcji" },
    "q:condition": { "name": "warunek jako\u015bciowy" },
    "q:atom_count_in_composition": { "name": "liczba atom\u00f3w w sk\u0142adzie" },
    "q:component_molar_mass_contribution": { "name": "wk\u0142ad sk\u0142adnika w mas\u0119 molarn\u0105" },
    "q:component_mass_fraction": { "name": "udzia\u0142 masowy sk\u0142adnika" }
  },
  "units": {
    "unit:g": { "name": "g" },
    "unit:kg": { "name": "kg" },
    "unit:mol": { "name": "mol" },
    "unit:L": { "name": "L" },
    "unit:m3": { "name": "m\u00b3" },
    "unit:mol_per_L": { "name": "mol/L" },
    "unit:mol_per_m3": { "name": "mol/m\u00b3" },
    "unit:K": { "name": "K" },
    "unit:degC": { "name": "\u00b0C" },
    "unit:degF": { "name": "\u00b0F" },
    "unit:Pa": { "name": "Pa" },
    "unit:bar": { "name": "bar" },
    "unit:atm": { "name": "atm" },
    "unit:J": { "name": "J" },
    "unit:kJ": { "name": "kJ" },
    "unit:g_per_mL": { "name": "g/mL" },
    "unit:kg_per_m3": { "name": "kg/m\u00b3" },
    "unit:g_per_mol": { "name": "g/mol" },
    "unit:kg_per_mol": { "name": "kg/mol" },
    "unit:mL": { "name": "mL" },
    "unit:kPa": { "name": "kPa" },
    "unit:mmHg": { "name": "mmHg" },
    "unit:fraction": { "name": "u\u0142amek" },
    "unit:percent": { "name": "%" },
    "unit:L_per_mol": { "name": "L/mol" },
    "unit:g_per_100g": { "name": "g/100 g" },
    "unit:kJ_per_mol": { "name": "kJ/mol" },
    "unit:J_per_mol": { "name": "J/mol" },
    "unit:enum": { "name": "enum" },
    "unit:dimensionless": { "name": "bezwymiarowa" },
    "unit:C": { "name": "C" },
    "unit:elementary_charge": { "name": "e" }
  }
}
```

- [ ] **Step 3: Create `data-src/translations/es/quantities_units_ontology.json`**

```json
{
  "quantities": {
    "q:mass": { "name": "masa" },
    "q:amount": { "name": "cantidad de sustancia" },
    "q:volume": { "name": "volumen" },
    "q:concentration": { "name": "concentraci\u00f3n molar" },
    "q:temperature": { "name": "temperatura" },
    "q:pressure": { "name": "presi\u00f3n" },
    "q:energy": { "name": "energ\u00eda/calor" },
    "q:density": { "name": "densidad" },
    "q:relative_atomic_mass": { "name": "masa at\u00f3mica relativa" },
    "q:charge": { "name": "carga el\u00e9ctrica" },
    "q:atom_count": { "name": "n\u00famero de \u00e1tomos" },
    "q:molar_mass": { "name": "masa molar" },
    "q:mass_fraction": { "name": "fracci\u00f3n m\u00e1sica" },
    "q:volume_fraction": { "name": "fracci\u00f3n volum\u00e9trica" },
    "q:molar_volume": { "name": "volumen molar" },
    "q:solubility": { "name": "solubilidad" },
    "q:yield": { "name": "rendimiento de reacci\u00f3n" },
    "q:enthalpy": { "name": "entalp\u00eda de reacci\u00f3n" },
    "q:condition": { "name": "condici\u00f3n cualitativa" },
    "q:atom_count_in_composition": { "name": "n\u00famero de \u00e1tomos en composici\u00f3n" },
    "q:component_molar_mass_contribution": { "name": "contribuci\u00f3n del componente a la masa molar" },
    "q:component_mass_fraction": { "name": "fracci\u00f3n m\u00e1sica del componente" }
  },
  "units": {
    "unit:g": { "name": "g" },
    "unit:kg": { "name": "kg" },
    "unit:mol": { "name": "mol" },
    "unit:L": { "name": "L" },
    "unit:m3": { "name": "m\u00b3" },
    "unit:mol_per_L": { "name": "mol/L" },
    "unit:mol_per_m3": { "name": "mol/m\u00b3" },
    "unit:K": { "name": "K" },
    "unit:degC": { "name": "\u00b0C" },
    "unit:degF": { "name": "\u00b0F" },
    "unit:Pa": { "name": "Pa" },
    "unit:bar": { "name": "bar" },
    "unit:atm": { "name": "atm" },
    "unit:J": { "name": "J" },
    "unit:kJ": { "name": "kJ" },
    "unit:g_per_mL": { "name": "g/mL" },
    "unit:kg_per_m3": { "name": "kg/m\u00b3" },
    "unit:g_per_mol": { "name": "g/mol" },
    "unit:kg_per_mol": { "name": "kg/mol" },
    "unit:mL": { "name": "mL" },
    "unit:kPa": { "name": "kPa" },
    "unit:mmHg": { "name": "mmHg" },
    "unit:fraction": { "name": "fracci\u00f3n" },
    "unit:percent": { "name": "%" },
    "unit:L_per_mol": { "name": "L/mol" },
    "unit:g_per_100g": { "name": "g/100 g" },
    "unit:kJ_per_mol": { "name": "kJ/mol" },
    "unit:J_per_mol": { "name": "J/mol" },
    "unit:enum": { "name": "enum" },
    "unit:dimensionless": { "name": "adimensional" },
    "unit:C": { "name": "C" },
    "unit:elementary_charge": { "name": "e" }
  }
}
```

- [ ] **Step 4: Validate data**

Run: `npm run validate:data`
Expected: PASS

- [ ] **Step 5: Commit — new quantity IDs only (architectural)**

```bash
git add data-src/translations/en/quantities_units_ontology.json data-src/translations/pl/quantities_units_ontology.json data-src/translations/es/quantities_units_ontology.json
git commit -m "feat(i18n): add en/pl/es quantity and unit translation overlays

Includes all 22 quantities and 32 units. The 3 new component mass fraction
quantities (q:atom_count_in_composition, q:component_molar_mass_contribution,
q:component_mass_fraction) are the architectural additions from slice 2;
the remaining entries are a backfill for existing quantities that previously
had no en/pl/es overlay."
```

Note: This is intentionally a single commit because the files are new (no pre-existing content to separate from). The commit message clearly marks which entries are new vs backfill. If the reviewer wants to verify only the 3 new entries, grep for `component` or `atom_count_in_composition`.

---

### Task 7: Convert Theory Module Blocks to Rich Text Refs

**Files:**
- Modify: `data-src/theory_modules/calculations.json`
- Modify: `data-src/translations/ru/theory_modules/calculations.json`
- Modify: `data-src/translations/en/theory_modules/calculations.json`
- Modify: `data-src/translations/pl/theory_modules/calculations.json`
- Modify: `data-src/translations/es/theory_modules/calculations.json`

This task converts 7 paragraph blocks to text_block in the base file, then updates all 4 locale overlays to provide `content` arrays with ref segments instead of plain `text`.

- [ ] **Step 1: Convert 7 paragraph blocks in base `calculations.json`**

In `data-src/theory_modules/calculations.json`, change these 7 blocks from `{ "t": "paragraph" }` to `{ "t": "text_block", "content": [] }`:

1. **molar_mass section, block 0** (line 10): `{ "t": "paragraph" }` → `{ "t": "text_block", "content": [] }`
2. **amount section, block 0** (line 36): `{ "t": "paragraph" }` → `{ "t": "text_block", "content": [] }`
3. **mass_fraction_element section, block 0** (line 68): `{ "t": "paragraph" }` → `{ "t": "text_block", "content": [] }`
4. **mass_fraction_element section, block 2** (line 75): `{ "t": "paragraph" }` → `{ "t": "text_block", "content": [] }`
5. **solution_fraction section, block 0** (line 89): `{ "t": "paragraph" }` → `{ "t": "text_block", "content": [] }`
6. **yield section, block 0** (line 131): `{ "t": "paragraph" }` → `{ "t": "text_block", "content": [] }`
7. **yield section, block 3** (line 145): `{ "t": "paragraph" }` → `{ "t": "text_block", "content": [] }`

The remaining paragraph blocks in `solution_fraction` (block 4, line 104) and `stoichiometry` (block 0, line 117) do NOT contain quantity symbols — leave them as `paragraph`.

- [ ] **Step 2: Update ru overlay with content arrays**

In `data-src/translations/ru/theory_modules/calculations.json`, replace `"text"` with `"content"` arrays for these 7 blocks:

**molar_mass block 0:**
```json
{
  "content": [
    { "t": "text", "v": "Молярная масса (" },
    { "t": "ref", "id": "q:molar_mass", "surface": "M" },
    { "t": "text", "v": ") — масса одного моля вещества, измеряется в г/моль." }
  ]
}
```

**amount block 0:**
```json
{
  "content": [
    { "t": "text", "v": "Количество вещества (" },
    { "t": "ref", "id": "q:amount", "surface": "n" },
    { "t": "text", "v": ") — число молей, связывает массу с молярной массой (" },
    { "t": "ref", "id": "q:molar_mass", "surface": "M" },
    { "t": "text", "v": ")." }
  ]
}
```

**mass_fraction_element block 0:**
```json
{
  "content": [
    { "t": "text", "v": "Массовая доля элемента (" },
    { "t": "ref", "id": "q:component_mass_fraction", "surface": "\u03c9" },
    { "t": "text", "v": ") — доля массы данного элемента в общей массе вещества." }
  ]
}
```

**mass_fraction_element block 2:**
```json
{
  "content": [
    { "t": "text", "v": "Где " },
    { "t": "ref", "id": "q:atom_count_in_composition", "surface": "n\u1d62" },
    { "t": "text", "v": " — число атомов элемента в формуле." }
  ]
}
```

**solution_fraction block 0:**
```json
{
  "content": [
    { "t": "text", "v": "Массовая доля растворённого вещества (" },
    { "t": "ref", "id": "q:mass_fraction", "surface": "\u03c9" },
    { "t": "text", "v": ") — отношение массы растворённого вещества к массе раствора." }
  ]
}
```

**yield block 0:**
```json
{
  "content": [
    { "t": "text", "v": "Выход продукта (" },
    { "t": "ref", "id": "q:yield", "surface": "\u03b7" },
    { "t": "text", "v": ") — отношение практически полученной массы продукта к теоретически возможной." }
  ]
}
```

**yield block 3:**
```json
{
  "content": [
    { "t": "text", "v": "Теоретическая масса — рассчитанная по уравнению реакции (" },
    { "t": "ref", "id": "q:yield", "surface": "\u03b7" },
    { "t": "text", "v": " = 100%). На практике выход всегда меньше 100% из-за потерь и побочных реакций." }
  ]
}
```

- [ ] **Step 3: Update en overlay with content arrays**

In `data-src/translations/en/theory_modules/calculations.json`, replace `"text"` with `"content"` arrays for the same 7 blocks:

**molar_mass block 0:**
```json
{
  "content": [
    { "t": "text", "v": "Molar mass (" },
    { "t": "ref", "id": "q:molar_mass", "surface": "M" },
    { "t": "text", "v": ") is the mass of one mole of a substance, measured in g/mol." }
  ]
}
```

**amount block 0:**
```json
{
  "content": [
    { "t": "text", "v": "Amount of substance (" },
    { "t": "ref", "id": "q:amount", "surface": "n" },
    { "t": "text", "v": ") is the number of moles; it relates mass to molar mass (" },
    { "t": "ref", "id": "q:molar_mass", "surface": "M" },
    { "t": "text", "v": ")." }
  ]
}
```

**mass_fraction_element block 0:**
```json
{
  "content": [
    { "t": "text", "v": "Mass fraction of an element (" },
    { "t": "ref", "id": "q:component_mass_fraction", "surface": "\u03c9" },
    { "t": "text", "v": ") is the ratio of the element\u2019s mass to the total mass of the substance." }
  ]
}
```

**mass_fraction_element block 2:**
```json
{
  "content": [
    { "t": "text", "v": "Where " },
    { "t": "ref", "id": "q:atom_count_in_composition", "surface": "n\u1d62" },
    { "t": "text", "v": " is the number of atoms of the element in the formula." }
  ]
}
```

**solution_fraction block 0:**
```json
{
  "content": [
    { "t": "text", "v": "Mass fraction of dissolved substance (" },
    { "t": "ref", "id": "q:mass_fraction", "surface": "\u03c9" },
    { "t": "text", "v": ") is the ratio of the solute mass to the solution mass." }
  ]
}
```

**yield block 0:**
```json
{
  "content": [
    { "t": "text", "v": "Reaction yield (" },
    { "t": "ref", "id": "q:yield", "surface": "\u03b7" },
    { "t": "text", "v": ") is the ratio of the actual mass of product obtained to the theoretically possible mass." }
  ]
}
```

**yield block 3:**
```json
{
  "content": [
    { "t": "text", "v": "Theoretical mass is calculated from the reaction equation (" },
    { "t": "ref", "id": "q:yield", "surface": "\u03b7" },
    { "t": "text", "v": " = 100%). In practice the yield is always less than 100% due to losses and side reactions." }
  ]
}
```

**molar_mass block 2:** This block already uses text_block with ref segment in the ru overlay (`Aᵣ` ref). In en, change:
```json
{ "text": "Where Ar is the relative atomic mass of the element (from the periodic table)." }
```
to:
```json
{
  "content": [
    { "t": "text", "v": "Where " },
    { "t": "ref", "id": "q:relative_atomic_mass", "surface": "A\u1d63" },
    { "t": "text", "v": " is the relative atomic mass of the element (from the periodic table)." }
  ]
}
```

- [ ] **Step 4: Update pl overlay with content arrays**

In `data-src/translations/pl/theory_modules/calculations.json`, apply the same 7-block pattern:

**molar_mass block 0:**
```json
{
  "content": [
    { "t": "text", "v": "Masa molarna (" },
    { "t": "ref", "id": "q:molar_mass", "surface": "M" },
    { "t": "text", "v": ") to masa jednego mola substancji, wyra\u017cona w g/mol." }
  ]
}
```

**amount block 0:**
```json
{
  "content": [
    { "t": "text", "v": "Ilo\u015b\u0107 substancji (" },
    { "t": "ref", "id": "q:amount", "surface": "n" },
    { "t": "text", "v": ") to liczba moli; \u0142\u0105czy mas\u0119 z mas\u0105 molarn\u0105 (" },
    { "t": "ref", "id": "q:molar_mass", "surface": "M" },
    { "t": "text", "v": ")." }
  ]
}
```

**mass_fraction_element block 0:**
```json
{
  "content": [
    { "t": "text", "v": "Udzia\u0142 masowy pierwiastka (" },
    { "t": "ref", "id": "q:component_mass_fraction", "surface": "\u03c9" },
    { "t": "text", "v": ") to stosunek masy pierwiastka do ca\u0142kowitej masy substancji." }
  ]
}
```

**mass_fraction_element block 2:**
```json
{
  "content": [
    { "t": "text", "v": "Gdzie " },
    { "t": "ref", "id": "q:atom_count_in_composition", "surface": "n\u1d62" },
    { "t": "text", "v": " to liczba atom\u00f3w pierwiastka w formule." }
  ]
}
```

**solution_fraction block 0:**
```json
{
  "content": [
    { "t": "text", "v": "Udzia\u0142 masowy substancji rozpuszczonej (" },
    { "t": "ref", "id": "q:mass_fraction", "surface": "\u03c9" },
    { "t": "text", "v": ") to stosunek masy rozpuszczonego do masy roztworu." }
  ]
}
```

**yield block 0:**
```json
{
  "content": [
    { "t": "text", "v": "Wydajno\u015b\u0107 reakcji (" },
    { "t": "ref", "id": "q:yield", "surface": "\u03b7" },
    { "t": "text", "v": ") to stosunek rzeczywi\u015bcie otrzymanej masy produktu do masy teoretycznie mo\u017cliwej." }
  ]
}
```

**yield block 3:**
```json
{
  "content": [
    { "t": "text", "v": "Masa teoretyczna jest obliczona na podstawie r\u00f3wnania reakcji (" },
    { "t": "ref", "id": "q:yield", "surface": "\u03b7" },
    { "t": "text", "v": " = 100%). W praktyce wydajno\u015b\u0107 jest zawsze mniejsza ni\u017c 100% z powodu strat i reakcji ubocznych." }
  ]
}
```

**molar_mass block 2:** Change:
```json
{ "text": "Gdzie Ar to wzgl\u0119dna masa atomowa pierwiastka (z uk\u0142adu okresowego)." }
```
to:
```json
{
  "content": [
    { "t": "text", "v": "Gdzie " },
    { "t": "ref", "id": "q:relative_atomic_mass", "surface": "A\u1d63" },
    { "t": "text", "v": " to wzgl\u0119dna masa atomowa pierwiastka (z uk\u0142adu okresowego)." }
  ]
}
```

- [ ] **Step 5: Update es overlay with content arrays**

In `data-src/translations/es/theory_modules/calculations.json`, apply the same pattern:

**molar_mass block 0:**
```json
{
  "content": [
    { "t": "text", "v": "La masa molar (" },
    { "t": "ref", "id": "q:molar_mass", "surface": "M" },
    { "t": "text", "v": ") es la masa de un mol de sustancia, expresada en g/mol." }
  ]
}
```

**amount block 0:**
```json
{
  "content": [
    { "t": "text", "v": "La cantidad de sustancia (" },
    { "t": "ref", "id": "q:amount", "surface": "n" },
    { "t": "text", "v": ") es el n\u00famero de moles; relaciona la masa con la masa molar (" },
    { "t": "ref", "id": "q:molar_mass", "surface": "M" },
    { "t": "text", "v": ")." }
  ]
}
```

**mass_fraction_element block 0:**
```json
{
  "content": [
    { "t": "text", "v": "La fracci\u00f3n m\u00e1sica de un elemento (" },
    { "t": "ref", "id": "q:component_mass_fraction", "surface": "\u03c9" },
    { "t": "text", "v": ") es la relaci\u00f3n entre la masa del elemento y la masa total de la sustancia." }
  ]
}
```

**mass_fraction_element block 2:**
```json
{
  "content": [
    { "t": "text", "v": "Donde " },
    { "t": "ref", "id": "q:atom_count_in_composition", "surface": "n\u1d62" },
    { "t": "text", "v": " es el n\u00famero de \u00e1tomos del elemento en la f\u00f3rmula." }
  ]
}
```

**solution_fraction block 0:**
```json
{
  "content": [
    { "t": "text", "v": "La fracci\u00f3n m\u00e1sica del soluto (" },
    { "t": "ref", "id": "q:mass_fraction", "surface": "\u03c9" },
    { "t": "text", "v": ") es la relaci\u00f3n entre la masa del soluto y la masa de la soluci\u00f3n." }
  ]
}
```

**yield block 0:**
```json
{
  "content": [
    { "t": "text", "v": "El rendimiento de la reacci\u00f3n (" },
    { "t": "ref", "id": "q:yield", "surface": "\u03b7" },
    { "t": "text", "v": ") es la relaci\u00f3n entre la masa real obtenida del producto y la masa te\u00f3ricamente posible." }
  ]
}
```

**yield block 3:**
```json
{
  "content": [
    { "t": "text", "v": "La masa te\u00f3rica se calcula a partir de la ecuaci\u00f3n de reacci\u00f3n (" },
    { "t": "ref", "id": "q:yield", "surface": "\u03b7" },
    { "t": "text", "v": " = 100%). En la pr\u00e1ctica el rendimiento es siempre menor del 100% por p\u00e9rdidas y reacciones secundarias." }
  ]
}
```

**molar_mass block 2:** Change:
```json
{ "text": "Donde Ar es la masa at\u00f3mica relativa del elemento (de la tabla peri\u00f3dica)." }
```
to:
```json
{
  "content": [
    { "t": "text", "v": "Donde " },
    { "t": "ref", "id": "q:relative_atomic_mass", "surface": "A\u1d63" },
    { "t": "text", "v": " es la masa at\u00f3mica relativa del elemento (de la tabla peri\u00f3dica)." }
  ]
}
```

- [ ] **Step 6: Validate data and build**

Run: `npm run validate:data && npm run build:data`
Expected: PASS

- [ ] **Step 7: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add data-src/theory_modules/calculations.json data-src/translations/ru/theory_modules/calculations.json data-src/translations/en/theory_modules/calculations.json data-src/translations/pl/theory_modules/calculations.json data-src/translations/es/theory_modules/calculations.json
git commit -m "feat(theory): convert quantity symbols to rich text ref segments in calculations module"
```

---

## Chunk 3: Final Verification

### Task 8: Full Build and Manual QA

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All tests pass (existing + 10 new derive-quantity tests)

- [ ] **Step 3: Manual QA checklist**

Start dev server: `npm run dev`

Verify:
- [ ] `/calculations/` — theory panel, molar_mass section: quantity symbol M renders as a colored ref chip (not plain text)
- [ ] `/calculations/` — theory panel, amount section: n and M render as ref chips
- [ ] `/calculations/` — theory panel, mass_fraction_element section: ω renders as ref chip
- [ ] `/calculations/` — theory panel, yield section: η renders as ref chip
- [ ] `/en/calculations/` — same ref chips in English theory text
- [ ] `/pl/obliczenia/` — same ref chips in Polish theory text
- [ ] `/es/calculos/` — same ref chips in Spanish theory text
- [ ] `/calculations/` — theory panel, solution_fraction section: ω ref chip links to `q:mass_fraction` (NOT `q:component_mass_fraction` — solution fraction is a different concept)
- [ ] No console errors on any of the above pages
