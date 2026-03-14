# Stoichiometry & Yield (Slice 3) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `deriveQuantity()` with stoichiometry/yield chains and migrate `solver.stoichiometry` + `solver.reaction_yield` to use it.

**Architecture:** Five small helper units (`deriveAmountForRole`, `deriveStoichiometricAmount`, `deriveMassForRole`, `applyYield`, `deriveYield`) compose into chains selected by signature detection. Helpers call `evaluateFormula`/`solveFor` directly — the planner/executor are untouched.

**Tech Stack:** TypeScript, Vitest, existing formula evaluator (`evaluateFormula`, `solveFor`)

**Spec:** `docs/superpowers/specs/2026-03-14-stoichiometry-slice3-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/derivation/molar-mass-resolver.ts` | CREATE | Extracted `deriveMolarMass()` — breaks circular import between derive-quantity ↔ stoichiometry-helpers |
| `src/lib/derivation/stoichiometry-helpers.ts` | CREATE | 5 helper units + `hasStoichiometricKnowns` + `deriveStoichiometryChain` |
| `src/lib/derivation/derive-quantity.ts` | MODIFY | Import `deriveMolarMass` from molar-mass-resolver; add stoichiometry branch before line 78 |
| `src/lib/task-engine/solvers.ts` | MODIFY | Replace `solveStoichiometry`/`solveReactionYield` bodies (Step 2) |
| `src/lib/__tests__/derive-stoichiometry.test.ts` | CREATE | Unit + integration + parity tests |

**Why extract `deriveMolarMass`:** `stoichiometry-helpers.ts` needs `deriveMolarMass` for M auto-derivation, and `derive-quantity.ts` needs `hasStoichiometricKnowns`/`deriveStoichiometryChain`. Extracting `deriveMolarMass` to its own file breaks the circular runtime import cleanly. The function is ~50 lines and has no dependencies on `derive-quantity.ts`.

**Why a new file for helpers:** `derive-quantity.ts` is 287 lines already. The 5 helpers + orchestrator + signature detector add ~200 lines. Splitting keeps both files under ~150 lines of logic. The new file imports `deriveMolarMass` from `molar-mass-resolver` and `evaluateFormula`/`solveFor`.

**Read-only dependencies (no changes):**
- `src/lib/formula-evaluator.ts` — `evaluateFormula()` (line 232), `solveFor()` (line 276)
- `src/types/derivation.ts` — `QRef`, `ReasonStep`, `BoundContext`
- `src/types/formula.ts` — `SemanticRole`, `ComputableFormula`
- `src/lib/derivation/qref.ts` — `qrefKey()`
- `src/lib/derivation/resolvers.ts` — `OntologyAccess`
- `data-src/foundations/formulas.json` — formula definitions (read by tests)

---

## Chunk 1: Helpers + Integration

### Task 1: Extract `deriveMolarMass` to molar-mass-resolver.ts

The stoichiometry helpers need `deriveMolarMass()` for auto-deriving M from substance composition. It's currently a private function at line 150 of `derive-quantity.ts`. Extracting it to its own file prevents a circular runtime import (derive-quantity ↔ stoichiometry-helpers).

**Files:**
- Create: `src/lib/derivation/molar-mass-resolver.ts`
- Modify: `src/lib/derivation/derive-quantity.ts:150`

- [ ] **Step 1: Create `src/lib/derivation/molar-mass-resolver.ts`**

Cut the `deriveMolarMass` function (lines 142-197 in `derive-quantity.ts`) into a new file:

```typescript
import type { ComputableFormula } from '../../types/formula';
import type { ConstantsDict, IndexedBindings } from '../../types/eval-trace';
import type { ReasonStep } from '../../types/derivation';
import type { OntologyAccess } from './resolvers';
import { resolveLookup, resolveDecompose } from './resolvers';
import { evaluateFormula } from '../formula-evaluator';

/**
 * Derive molar mass for a substance via decompose + lookup + indexed formula.
 *
 * MVP orchestration shortcut: manually wires decompose → lookup → evaluateFormula
 * rather than going through a generalized mixed-rule executor. This is intentional
 * for the first vertical slice — the decompose/lookup steps are not yet modeled as
 * DerivationRules in the planner graph.
 */
export function deriveMolarMass(
  entityRef: string,
  formulas: ComputableFormula[],
  constants: ConstantsDict,
  ontology: OntologyAccess,
  trace: ReasonStep[],
): number {
  // 1. Decompose substance into elements + counts (structural only)
  const decomp = resolveDecompose(entityRef, ontology);
  if (!decomp) throw new Error(`Cannot decompose ${entityRef}`);
  trace.push(decomp.step);

  // 2. Lookup Ar for each element (separate provenance from decomposition)
  const arValues: Array<{ element: string; count: number; Ar: number }> = [];
  for (const item of decomp.items) {
    const lr = resolveLookup(item.arQRef, ontology);
    if (!lr) throw new Error(`Lookup failed for Ar of ${item.element}`);
    trace.push(lr.step);
    arValues.push({ element: item.element, count: item.count, Ar: lr.value });
  }

  // 3. Build indexed bindings and evaluate formula:molar_mass_from_composition
  const formula = formulas.find(f => f.id === 'formula:molar_mass_from_composition');
  if (!formula) throw new Error('formula:molar_mass_from_composition not found');

  const indexed: IndexedBindings = {
    composition_elements: arValues.map(item => ({
      Ar_i: item.Ar,
      count_i: item.count,
    })),
  };

  trace.push({
    type: 'formula_select',
    formulaId: formula.id,
    target: { quantity: 'q:molar_mass', context: { system_type: 'substance', entity_ref: entityRef } },
  });

  const evalTrace = evaluateFormula(formula, {}, constants, indexed);
  trace.push({ type: 'compute', formulaId: formula.id, result: evalTrace.result });

  return evalTrace.result;
}
```

- [ ] **Step 2: Update derive-quantity.ts — replace the function body with an import**

In `src/lib/derivation/derive-quantity.ts`:

1. Add import at top (after existing imports):
```typescript
import { deriveMolarMass } from './molar-mass-resolver';
```

2. Delete the `deriveMolarMass` function (lines 142-197) — the JSDoc comment + function body.

3. Remove the now-unused imports that were only needed by `deriveMolarMass`: check if `resolveLookup`, `resolveDecompose`, `evaluateFormula` are still used by other functions in the file. They ARE used by `deriveComponentContribution` and `deriveMassFractionOfComponent`, so keep them.

- [ ] **Step 3: Run existing tests to verify nothing breaks**

Run: `npx vitest run src/lib/__tests__/derive-quantity.test.ts`
Expected: All 24 tests pass (no behavior change, just moved function).

- [ ] **Step 4: Commit**

```bash
git add src/lib/derivation/molar-mass-resolver.ts src/lib/derivation/derive-quantity.ts
git commit -m "refactor(derivation): extract deriveMolarMass to molar-mass-resolver.ts"
```

---

### Task 2: Create stoichiometry-helpers.ts with 5 helper units

**Files:**
- Create: `src/lib/derivation/stoichiometry-helpers.ts`

**Key reference info for the implementer:**

Formula variable names (from `data-src/foundations/formulas.json`):
- `formula:amount_from_mass`: variables `m` (q:mass), `M` (q:molar_mass), `n` (q:amount, result). `invertible_for: ["m", "M"]`. Inversion for `m`: `n * M`.
- `formula:stoichiometry_ratio`: variables `n_1` (q:amount, reactant), `nu_1` (q:stoich_coeff, reactant), `n_2` (q:amount, product, result), `nu_2` (q:stoich_coeff, product). `invertible_for: ["n_1"]`. Inversion for `n_1`: `(n_2 / nu_2) * nu_1`.
- `formula:yield`: variables `eta` (q:yield, result), `m_actual` (q:mass, actual), `m_theoretical` (q:mass, theoretical). `invertible_for: ["m_actual", "m_theoretical"]`. Inversion for `m_actual`: `(eta / 100) * m_theoretical`.

`evaluateFormula(formula, bindings, constants)` — evaluates forward, returns `EvalTrace` with `.result`.
`solveFor(formula, targetSymbol, bindings, constants)` — evaluates inversion, returns `EvalTrace` with `.result`.

`SemanticRole` type (from `src/types/formula.ts`): `'actual' | 'theoretical' | 'solute' | 'solution' | 'reactant' | 'product' | 'initial' | 'final'`

Spec design principle: `QRef.role` carries only participant roles (`reactant`/`product`). `actual`/`theoretical` is NOT on `QRef.role` — it is handled inside helpers and marked in trace.

- [ ] **Step 1: Write the failing tests for helper units**

Create `src/lib/__tests__/derive-stoichiometry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { toConstantsDict } from '../formula-evaluator';
import { parseFormula } from '../formula-parser';
import type { ComputableFormula, PhysicalConstant } from '../../types/formula';
import type { Element } from '../../types/element';
import type { QRef, ReasonStep } from '../../types/derivation';
import type { OntologyAccess } from '../derivation/resolvers';

// ── Data setup (same pattern as derive-quantity.test.ts) ─────────

const DATA_DIR = join(import.meta.dirname, '../../../data-src');
const formulas: ComputableFormula[] = JSON.parse(
  readFileSync(join(DATA_DIR, 'foundations/formulas.json'), 'utf8'),
);
const constants = toConstantsDict(
  JSON.parse(readFileSync(join(DATA_DIR, 'foundations/constants.json'), 'utf8')) as PhysicalConstant[],
);
const elements: Element[] = JSON.parse(
  readFileSync(join(DATA_DIR, 'elements.json'), 'utf8'),
);

const entityFormulas = new Map<string, string>([
  ['substance:H2SO4', 'H2SO4'],
  ['substance:H2O', 'H2O'],
  ['substance:NaCl', 'NaCl'],
  ['substance:BaSO4', 'BaSO4'],
  ['substance:BaCl2', 'BaCl2'],
  ['substance:HCl', 'HCl'],
]);

const ontology: OntologyAccess = { elements, parseFormula, entityFormulas };

function traceStepsOfType<T extends ReasonStep['type']>(
  trace: ReasonStep[],
  type: T,
): Array<Extract<ReasonStep, { type: T }>> {
  return trace.filter((s): s is Extract<ReasonStep, { type: T }> => s.type === type);
}

// ── Helper unit tests ────────────────────────────────────────────

import {
  deriveAmountForRole,
  deriveStoichiometricAmount,
  deriveMassForRole,
  applyYield,
  deriveYield,
} from '../derivation/stoichiometry-helpers';

describe('stoichiometry helper units', () => {
  describe('deriveAmountForRole', () => {
    it('n = m/M for reactant', () => {
      const trace: ReasonStep[] = [];
      const result = deriveAmountForRole({
        role: 'reactant',
        mass: 9.8,
        M: 98,
        formulas,
        constants,
        ontology,
        trace,
      });
      expect(result.value).toBeCloseTo(0.1, 5);
      expect(result.qref.quantity).toBe('q:amount');
      expect(result.qref.role).toBe('reactant');
    });

    it('n = m/M for product', () => {
      const trace: ReasonStep[] = [];
      const result = deriveAmountForRole({
        role: 'product',
        mass: 233,
        M: 233,
        formulas,
        constants,
        ontology,
        trace,
      });
      expect(result.value).toBeCloseTo(1.0, 5);
      expect(result.qref.role).toBe('product');
    });

    it('auto-derives M from entity_ref when M not provided', () => {
      const trace: ReasonStep[] = [];
      const result = deriveAmountForRole({
        role: 'reactant',
        mass: 98.08,
        entityRef: 'substance:H2SO4',
        formulas,
        constants,
        ontology,
        trace,
      });
      expect(result.value).toBeCloseTo(1.0, 1);
      // Trace should contain decompose + lookup steps from M derivation
      expect(trace.some(s => s.type === 'decompose')).toBe(true);
      expect(trace.some(s => s.type === 'lookup')).toBe(true);
    });
  });

  describe('deriveStoichiometricAmount', () => {
    it('forward: reactant → product (n₂ = n₁ × ν₂/ν₁)', () => {
      const trace: ReasonStep[] = [];
      const result = deriveStoichiometricAmount({
        n_from: 0.1,
        nu_from: 1,
        nu_to: 2,
        fromRole: 'reactant',
        toRole: 'product',
        formulas,
        constants,
        trace,
      });
      expect(result.value).toBeCloseTo(0.2, 5);
      expect(result.qref.quantity).toBe('q:amount');
      expect(result.qref.role).toBe('product');
    });

    it('reverse: product → reactant (n₁ via inversion)', () => {
      const trace: ReasonStep[] = [];
      const result = deriveStoichiometricAmount({
        n_from: 0.2,
        nu_from: 2,
        nu_to: 1,
        fromRole: 'product',
        toRole: 'reactant',
        formulas,
        constants,
        trace,
      });
      expect(result.value).toBeCloseTo(0.1, 5);
      expect(result.qref.role).toBe('reactant');
    });
  });

  describe('deriveMassForRole', () => {
    it('m = n × M for product', () => {
      const trace: ReasonStep[] = [];
      const result = deriveMassForRole({
        role: 'product',
        n: 0.05,
        M: 233.39,
        formulas,
        constants,
        ontology,
        trace,
      });
      expect(result.value).toBeCloseTo(11.67, 1);
      expect(result.qref.quantity).toBe('q:mass');
      expect(result.qref.role).toBe('product');
    });

    it('auto-derives M from entity_ref when M not provided', () => {
      const trace: ReasonStep[] = [];
      const result = deriveMassForRole({
        role: 'product',
        n: 1.0,
        entityRef: 'substance:H2O',
        formulas,
        constants,
        ontology,
        trace,
      });
      expect(result.value).toBeCloseTo(18.015, 0);
    });
  });

  describe('applyYield', () => {
    it('m_actual = (η/100) × m_theoretical', () => {
      const trace: ReasonStep[] = [];
      const result = applyYield({
        m_theoretical: 46.6,
        eta: 85,
        formulas,
        constants,
        trace,
      });
      expect(result.value).toBeCloseTo(39.61, 1);
      expect(result.qref.quantity).toBe('q:mass');
      expect(result.qref.role).toBe('product');
    });

    it('appends formula_select + substitution + compute to trace', () => {
      const trace: ReasonStep[] = [];
      applyYield({
        m_theoretical: 100,
        eta: 80,
        formulas,
        constants,
        trace,
      });
      expect(trace.some(s => s.type === 'formula_select')).toBe(true);
      expect(trace.some(s => s.type === 'compute')).toBe(true);
    });
  });

  describe('deriveYield', () => {
    it('η = (m_actual / m_theoretical) × 100', () => {
      const trace: ReasonStep[] = [];
      const result = deriveYield({
        m_actual: 39.61,
        m_theoretical: 46.6,
        formulas,
        constants,
        trace,
      });
      expect(result.value).toBeCloseTo(85, 0);
      expect(result.qref.quantity).toBe('q:yield');
      expect(result.qref.role).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/derive-stoichiometry.test.ts`
Expected: FAIL — module `../derivation/stoichiometry-helpers` not found.

- [ ] **Step 3: Implement the 5 helper units**

Create `src/lib/derivation/stoichiometry-helpers.ts`:

```typescript
import type { ComputableFormula, SemanticRole } from '../../types/formula';
import type { ConstantsDict } from '../../types/eval-trace';
import type { QRef, ReasonStep } from '../../types/derivation';
import type { OntologyAccess } from './resolvers';
import { evaluateFormula, solveFor } from '../formula-evaluator';
import { deriveMolarMass } from './molar-mass-resolver';

// ── Types ────────────────────────────────────────────────────────

export interface QRefValue {
  qref: QRef;
  value: number;
}

interface FormulaContext {
  formulas: ComputableFormula[];
  constants: ConstantsDict;
}

function findFormula(formulas: ComputableFormula[], id: string): ComputableFormula {
  const f = formulas.find(f => f.id === id);
  if (!f) throw new Error(`Formula not found: ${id}`);
  return f;
}

// ── deriveAmountForRole ──────────────────────────────────────────

export function deriveAmountForRole(opts: {
  role: SemanticRole;
  mass: number;
  M?: number;
  entityRef?: string;
  formulas: ComputableFormula[];
  constants: ConstantsDict;
  ontology: OntologyAccess;
  trace: ReasonStep[];
}): QRefValue {
  const { role, mass, formulas, constants, ontology, trace } = opts;

  // Resolve M: explicit or auto-derived from substance composition
  let M = opts.M;
  if (M == null) {
    if (!opts.entityRef) {
      throw new Error(`deriveAmountForRole: M not provided and no entityRef for auto-derivation`);
    }
    M = deriveMolarMass(opts.entityRef, formulas, constants, ontology, trace);
  }

  const formula = findFormula(formulas, 'formula:amount_from_mass');
  const bindings = { m: mass, M };

  trace.push({ type: 'formula_select', formulaId: formula.id, target: { quantity: 'q:amount', role } });
  trace.push({ type: 'substitution', formulaId: formula.id, bindings });

  const result = evaluateFormula(formula, bindings, constants).result;
  trace.push({ type: 'compute', formulaId: formula.id, result });

  return { qref: { quantity: 'q:amount', role }, value: result };
}

// ── deriveStoichiometricAmount ───────────────────────────────────

export function deriveStoichiometricAmount(opts: {
  n_from: number;
  nu_from: number;
  nu_to: number;
  fromRole: SemanticRole;
  toRole: SemanticRole;
  formulas: ComputableFormula[];
  constants: ConstantsDict;
  trace: ReasonStep[];
}): QRefValue {
  const { n_from, nu_from, nu_to, fromRole, toRole, formulas, constants, trace } = opts;
  const formula = findFormula(formulas, 'formula:stoichiometry_ratio');

  let result: number;

  if (fromRole === 'reactant') {
    // Forward: n_1 (reactant) → n_2 (product)
    const bindings = { n_1: n_from, nu_1: nu_from, nu_2: nu_to };
    trace.push({ type: 'formula_select', formulaId: formula.id, target: { quantity: 'q:amount', role: toRole } });
    trace.push({ type: 'substitution', formulaId: formula.id, bindings });
    result = evaluateFormula(formula, bindings, constants).result;
  } else {
    // Reverse: n_2 (product) → n_1 (reactant) via inversion
    const bindings = { n_2: n_from, nu_2: nu_from, nu_1: nu_to };
    trace.push({ type: 'formula_select', formulaId: formula.id, target: { quantity: 'q:amount', role: toRole } });
    trace.push({ type: 'substitution', formulaId: formula.id, bindings });
    result = solveFor(formula, 'n_1', bindings, constants).result;
  }

  trace.push({ type: 'compute', formulaId: formula.id, result });
  return { qref: { quantity: 'q:amount', role: toRole }, value: result };
}

// ── deriveMassForRole ────────────────────────────────────────────

export function deriveMassForRole(opts: {
  role: SemanticRole;
  n: number;
  M?: number;
  entityRef?: string;
  formulas: ComputableFormula[];
  constants: ConstantsDict;
  ontology: OntologyAccess;
  trace: ReasonStep[];
}): QRefValue {
  const { role, n, formulas, constants, ontology, trace } = opts;

  // Resolve M: explicit or auto-derived
  let M = opts.M;
  if (M == null) {
    if (!opts.entityRef) {
      throw new Error(`deriveMassForRole: M not provided and no entityRef for auto-derivation`);
    }
    M = deriveMolarMass(opts.entityRef, formulas, constants, ontology, trace);
  }

  const formula = findFormula(formulas, 'formula:amount_from_mass');
  const bindings = { n, M };

  trace.push({ type: 'formula_select', formulaId: formula.id, target: { quantity: 'q:mass', role } });
  trace.push({ type: 'substitution', formulaId: formula.id, bindings });

  const result = solveFor(formula, 'm', bindings, constants).result;
  trace.push({ type: 'compute', formulaId: formula.id, result });

  return { qref: { quantity: 'q:mass', role }, value: result };
}

// ── applyYield ───────────────────────────────────────────────────

export function applyYield(opts: {
  m_theoretical: number;
  eta: number;
  formulas: ComputableFormula[];
  constants: ConstantsDict;
  trace: ReasonStep[];
}): QRefValue {
  const { m_theoretical, eta, formulas, constants, trace } = opts;
  const formula = findFormula(formulas, 'formula:yield');
  const bindings = { eta, m_theoretical };

  trace.push({ type: 'formula_select', formulaId: formula.id, target: { quantity: 'q:mass', role: 'product' } });
  trace.push({ type: 'substitution', formulaId: formula.id, bindings });

  const result = solveFor(formula, 'm_actual', bindings, constants).result;
  trace.push({ type: 'compute', formulaId: formula.id, result });

  return { qref: { quantity: 'q:mass', role: 'product' }, value: result };
}

// ── deriveYield ──────────────────────────────────────────────────

export function deriveYield(opts: {
  m_actual: number;
  m_theoretical: number;
  formulas: ComputableFormula[];
  constants: ConstantsDict;
  trace: ReasonStep[];
}): QRefValue {
  const { m_actual, m_theoretical, formulas, constants, trace } = opts;
  const formula = findFormula(formulas, 'formula:yield');
  const bindings = { m_actual, m_theoretical };

  trace.push({ type: 'formula_select', formulaId: formula.id, target: { quantity: 'q:yield' } });
  trace.push({ type: 'substitution', formulaId: formula.id, bindings });

  const result = evaluateFormula(formula, bindings, constants).result;
  trace.push({ type: 'compute', formulaId: formula.id, result });

  return { qref: { quantity: 'q:yield' }, value: result };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/derive-stoichiometry.test.ts`
Expected: All 10 helper unit tests pass.

- [ ] **Step 5: Run all existing tests to verify no regressions**

Run: `npx vitest run`
Expected: 1197 + 10 = 1207 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/derivation/stoichiometry-helpers.ts src/lib/__tests__/derive-stoichiometry.test.ts
git commit -m "feat(derivation): add 5 stoichiometry/yield helper units with tests"
```

---

### Task 3: Add signature detection + chain orchestrator + integration tests

**Files:**
- Modify: `src/lib/derivation/stoichiometry-helpers.ts` (add `hasStoichiometricKnowns` + `deriveStoichiometryChain`)
- Modify: `src/lib/derivation/derive-quantity.ts` (add branch)
- Modify: `src/lib/__tests__/derive-stoichiometry.test.ts` (add integration tests)

**Key context for the implementer:**

The stoichiometry branch must be inserted **before** the existing `q:mass`/`q:amount` substance branch (line 78 in `derive-quantity.ts`). The existing branch checks `target.context?.system_type === 'substance'`. The new branch checks knowns for `q:stoich_coeff` presence — the target has `role` but no `context`.

`hasStoichiometricKnowns()` must check three conditions (from spec):
1. Two `q:stoich_coeff` knowns with different roles (one `reactant`, one `product`)
2. At least one source-side quantity: `q:mass` or `q:amount` with a role
3. Target-side info: either `q:molar_mass` with context or some other completeness signal

`qrefKey()` (from `src/lib/derivation/qref.ts`) builds keys like `q:mass|reactant`, `q:stoich_coeff|reactant`, `q:molar_mass@substance:substance:H2SO4`.

- [ ] **Step 1: Write failing integration tests**

Append to `src/lib/__tests__/derive-stoichiometry.test.ts`:

```typescript
import { deriveQuantity } from '../derivation/derive-quantity';

// ── Integration tests via deriveQuantity() ───────────────────────

describe('deriveQuantity stoichiometry', () => {
  // H₂SO₄ + BaCl₂ → BaSO₄ + 2HCl  (coefficients: 1,1,1,2)
  // M(H2SO4) ≈ 98.08, M(BaSO4) ≈ 233.39

  function stoichKnowns(overrides?: Record<string, unknown>) {
    const givenEntityRef = 'substance:H2SO4';
    const findEntityRef = 'substance:BaSO4';
    const defaults: Array<{ qref: QRef; value: number }> = [
      { qref: { quantity: 'q:mass', role: 'reactant' }, value: 9.8 },
      { qref: { quantity: 'q:stoich_coeff', role: 'reactant' }, value: 1 },
      { qref: { quantity: 'q:molar_mass', role: 'reactant', context: { system_type: 'substance', entity_ref: givenEntityRef } }, value: 98.08 },
      { qref: { quantity: 'q:stoich_coeff', role: 'product' }, value: 1 },
      { qref: { quantity: 'q:molar_mass', role: 'product', context: { system_type: 'substance', entity_ref: findEntityRef } }, value: 233.39 },
    ];
    return defaults;
  }

  it('S1: mass→mass (reactant → product)', () => {
    const result = deriveQuantity({
      target: { quantity: 'q:mass', role: 'product' },
      knowns: stoichKnowns(),
      formulas, constants, ontology,
    });
    // n = 9.8/98.08 ≈ 0.0999, m = 0.0999 * 233.39 ≈ 23.32
    expect(result.value).toBeCloseTo(23.32, 0);
  });

  it('S1 reverse: mass→mass (product → reactant)', () => {
    const findEntityRef = 'substance:BaSO4';
    const givenEntityRef = 'substance:H2SO4';
    const result = deriveQuantity({
      target: { quantity: 'q:mass', role: 'reactant' },
      knowns: [
        { qref: { quantity: 'q:mass', role: 'product' }, value: 23.34 },
        { qref: { quantity: 'q:stoich_coeff', role: 'product' }, value: 1 },
        { qref: { quantity: 'q:molar_mass', role: 'product', context: { system_type: 'substance', entity_ref: findEntityRef } }, value: 233.39 },
        { qref: { quantity: 'q:stoich_coeff', role: 'reactant' }, value: 1 },
        { qref: { quantity: 'q:molar_mass', role: 'reactant', context: { system_type: 'substance', entity_ref: givenEntityRef } }, value: 98.08 },
      ],
      formulas, constants, ontology,
    });
    // n_product = 23.34/233.39 ≈ 0.1, n_reactant = 0.1, m = 0.1 * 98.08 ≈ 9.8
    expect(result.value).toBeCloseTo(9.8, 0);
  });

  it('S2: amount→mass', () => {
    const findEntityRef = 'substance:BaSO4';
    const result = deriveQuantity({
      target: { quantity: 'q:mass', role: 'product' },
      knowns: [
        { qref: { quantity: 'q:amount', role: 'reactant' }, value: 0.1 },
        { qref: { quantity: 'q:stoich_coeff', role: 'reactant' }, value: 1 },
        { qref: { quantity: 'q:stoich_coeff', role: 'product' }, value: 1 },
        { qref: { quantity: 'q:molar_mass', role: 'product', context: { system_type: 'substance', entity_ref: findEntityRef } }, value: 233.39 },
      ],
      formulas, constants, ontology,
    });
    expect(result.value).toBeCloseTo(23.34, 0);
  });

  it('S2r: mass→amount', () => {
    const givenEntityRef = 'substance:H2SO4';
    const result = deriveQuantity({
      target: { quantity: 'q:amount', role: 'product' },
      knowns: [
        { qref: { quantity: 'q:mass', role: 'reactant' }, value: 9.8 },
        { qref: { quantity: 'q:stoich_coeff', role: 'reactant' }, value: 1 },
        { qref: { quantity: 'q:molar_mass', role: 'reactant', context: { system_type: 'substance', entity_ref: givenEntityRef } }, value: 98.08 },
        { qref: { quantity: 'q:stoich_coeff', role: 'product' }, value: 1 },
      ],
      formulas, constants, ontology,
    });
    // n = 9.8/98.08 * 1/1 ≈ 0.0999
    expect(result.value).toBeCloseTo(0.1, 1);
  });

  it('S3: mass→mass with yield', () => {
    const result = deriveQuantity({
      target: { quantity: 'q:mass', role: 'product' },
      knowns: [
        ...stoichKnowns(),
        { qref: { quantity: 'q:yield' }, value: 85 },
      ],
      formulas, constants, ontology,
    });
    // theoretical ≈ 23.32, actual = 23.32 * 85/100 ≈ 19.82
    expect(result.value).toBeCloseTo(19.82, 0);
  });

  it('S3r: find yield (uses generic planner, not stoichiometry chain)', () => {
    // S3r has no stoich coefficients — hasStoichiometricKnowns returns false.
    // It falls through to the generic planner fallback, which handles formula:yield
    // via semantic_role: 'actual'/'theoretical' on the formula variables.
    // The 'actual'/'theoretical' roles here are formula-derived, not participant roles.
    const result = deriveQuantity({
      target: { quantity: 'q:yield' },
      knowns: [
        { qref: { quantity: 'q:mass', role: 'actual' }, value: 19.82 },
        { qref: { quantity: 'q:mass', role: 'theoretical' }, value: 23.32 },
      ],
      formulas, constants, ontology,
    });
    expect(result.value).toBeCloseTo(85, 0);
  });

  it('trace for S1 contains expected step types', () => {
    const result = deriveQuantity({
      target: { quantity: 'q:mass', role: 'product' },
      knowns: stoichKnowns(),
      formulas, constants, ontology,
    });
    const types = result.trace.map(s => s.type);
    // given steps first, then formula chains, then conclusion
    expect(types).toContain('given');
    expect(types).toContain('formula_select');
    expect(types).toContain('substitution');
    expect(types).toContain('compute');
    expect(types).toContain('conclusion');
    // Should reference both amount_from_mass and stoichiometry_ratio
    const selects = traceStepsOfType(result.trace, 'formula_select');
    const formulaIds = selects.map(s => s.formulaId);
    expect(formulaIds).toContain('formula:amount_from_mass');
    expect(formulaIds).toContain('formula:stoichiometry_ratio');
  });

  it('throws on incomplete stoichiometric signature', () => {
    expect(() =>
      deriveQuantity({
        target: { quantity: 'q:mass', role: 'product' },
        knowns: [
          // Only one coefficient — not enough
          { qref: { quantity: 'q:stoich_coeff', role: 'reactant' }, value: 1 },
          { qref: { quantity: 'q:mass', role: 'reactant' }, value: 9.8 },
        ],
        formulas, constants, ontology,
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify integration tests fail**

Run: `npx vitest run src/lib/__tests__/derive-stoichiometry.test.ts`
Expected: Helper unit tests (10) pass, integration tests (8) fail.

- [ ] **Step 3: Implement signature detection and chain orchestrator**

Add to the **bottom** of `src/lib/derivation/stoichiometry-helpers.ts`:

```typescript
import type { DeriveQuantityResult } from './derive-quantity';
import { qrefKey } from './qref';

// ── Signature detection ──────────────────────────────────────────

function findKnown(
  knowns: Array<{ qref: QRef; value: number }>,
  quantity: string,
  role?: SemanticRole,
): { qref: QRef; value: number } | undefined {
  return knowns.find(k =>
    k.qref.quantity === quantity && (role == null || k.qref.role === role),
  );
}

export function hasStoichiometricKnowns(
  knowns: Array<{ qref: QRef; value: number }>,
): boolean {
  // Condition 1: Two stoichiometric coefficients with different roles
  const nuReactant = findKnown(knowns, 'q:stoich_coeff', 'reactant');
  const nuProduct = findKnown(knowns, 'q:stoich_coeff', 'product');
  if (!nuReactant || !nuProduct) return false;

  // Condition 2: At least one source-side quantity (mass or amount with a role)
  const hasSourceAmount = knowns.some(k => k.qref.quantity === 'q:amount' && k.qref.role != null);
  const hasSourceMass = knowns.some(k => k.qref.quantity === 'q:mass' && k.qref.role != null);
  if (!hasSourceMass && !hasSourceAmount) return false;

  // Condition 3: If source is mass (not amount), need at least one M for conversion
  if (hasSourceMass && !hasSourceAmount) {
    const hasM = knowns.some(k => k.qref.quantity === 'q:molar_mass');
    if (!hasM) return false;
  }

  return true;
}

// ── Chain orchestrator ───────────────────────────────────────────

export function deriveStoichiometryChain(
  target: QRef,
  knowns: Array<{ qref: QRef; value: number }>,
  formulas: ComputableFormula[],
  constants: ConstantsDict,
  ontology: OntologyAccess,
  trace: ReasonStep[],
): DeriveQuantityResult {
  // Detect yield: if q:yield is in knowns, apply after stoichiometric chain.
  // Note: S3r (find yield from actual + theoretical masses) does NOT pass through here —
  // it has no stoich coefficients, so hasStoichiometricKnowns returns false,
  // and it falls through to the generic planner in deriveQuantity().
  const yieldKnown = findKnown(knowns, 'q:yield');

  // Determine direction: which role has mass/amount known?
  const nuReactant = findKnown(knowns, 'q:stoich_coeff', 'reactant')!;
  const nuProduct = findKnown(knowns, 'q:stoich_coeff', 'product')!;

  const massReactant = findKnown(knowns, 'q:mass', 'reactant');
  const amountReactant = findKnown(knowns, 'q:amount', 'reactant');
  const massProduct = findKnown(knowns, 'q:mass', 'product');
  const amountProduct = findKnown(knowns, 'q:amount', 'product');

  let fromRole: SemanticRole;
  let toRole: SemanticRole;

  if (massReactant || amountReactant) {
    fromRole = 'reactant';
    toRole = 'product';
  } else if (massProduct || amountProduct) {
    fromRole = 'product';
    toRole = 'reactant';
  } else {
    throw new Error('deriveStoichiometryChain: no source mass or amount found');
  }

  const nu_from = fromRole === 'reactant' ? nuReactant.value : nuProduct.value;
  const nu_to = fromRole === 'reactant' ? nuProduct.value : nuReactant.value;

  // Find M by role — M knowns carry role in stoichiometry context
  function findMByRole(role: SemanticRole): number | undefined {
    const mk = knowns.find(k => k.qref.quantity === 'q:molar_mass' && k.qref.role === role);
    return mk?.value;
  }

  // Step 1: Get source amount (n_from)
  let n_from: number;
  const sourceMass = fromRole === 'reactant' ? massReactant : massProduct;
  const sourceAmount = fromRole === 'reactant' ? amountReactant : amountProduct;

  if (sourceAmount) {
    n_from = sourceAmount.value;
  } else if (sourceMass) {
    // Need M for source side — match by role, or auto-derive from entity_ref
    const sourceM = findMByRole(fromRole);
    const sourceMKnown = knowns.find(k => k.qref.quantity === 'q:molar_mass' && k.qref.role === fromRole);
    const sourceEntityRef = sourceMKnown?.qref.context?.entity_ref;

    const amountResult = deriveAmountForRole({
      role: fromRole,
      mass: sourceMass.value,
      M: sourceM,
      entityRef: sourceM == null ? sourceEntityRef : undefined,
      formulas, constants, ontology, trace,
    });
    n_from = amountResult.value;
  } else {
    throw new Error(`deriveStoichiometryChain: no mass or amount for ${fromRole}`);
  }

  // Step 2: Cross-role stoichiometric ratio
  const n_to_result = deriveStoichiometricAmount({
    n_from, nu_from, nu_to, fromRole, toRole, formulas, constants, trace,
  });

  // Step 3: Determine what the target wants
  if (target.quantity === 'q:amount') {
    // S2r: mass→amount — we already have n_to
    trace.push({ type: 'conclusion', target, value: n_to_result.value });
    return { value: n_to_result.value, trace, isApproximate: false };
  }

  // Step 4: Convert amount to mass for target side
  // Find M for target side — match by role
  const targetM = findMByRole(toRole);
  const targetMKnown = knowns.find(k => k.qref.quantity === 'q:molar_mass' && k.qref.role === toRole);
  const targetEntityRef = targetMKnown?.qref.context?.entity_ref;

  const massResult = deriveMassForRole({
    role: toRole,
    n: n_to_result.value,
    M: targetM,
    entityRef: targetM == null ? targetEntityRef : undefined,
    formulas, constants, ontology, trace,
  });

  // Step 5: If yield is present, apply it
  if (yieldKnown) {
    const yieldResult = applyYield({
      m_theoretical: massResult.value,
      eta: yieldKnown.value,
      formulas, constants, trace,
    });
    trace.push({ type: 'conclusion', target, value: yieldResult.value });
    return { value: yieldResult.value, trace, isApproximate: false };
  }

  trace.push({ type: 'conclusion', target, value: massResult.value });
  return { value: massResult.value, trace, isApproximate: false };
}
```

**Import graph (no cycles):** `stoichiometry-helpers.ts` imports `deriveMolarMass` from `molar-mass-resolver.ts` (extracted in Task 1) and `DeriveQuantityResult` type from `derive-quantity.ts` (type-only, erased at compile time). `derive-quantity.ts` imports `hasStoichiometricKnowns`/`deriveStoichiometryChain` from `stoichiometry-helpers.ts`. No circular runtime dependency.

- [ ] **Step 4: Add the stoichiometry branch to derive-quantity.ts**

In `src/lib/derivation/derive-quantity.ts`, add these imports at the top (after existing imports):

```typescript
import { hasStoichiometricKnowns, deriveStoichiometryChain } from './stoichiometry-helpers';
```

Then insert the new branch **before** line 78 (`// Mass/amount of substance`). Add it after the component mass fraction branch (after line 76):

```typescript
  // Stoichiometry/yield: detected by presence of stoichiometric coefficient knowns.
  // Must be checked BEFORE the single-substance q:mass/q:amount branch because
  // stoichiometry targets have role but no context, while single-substance targets
  // have context.system_type === 'substance'.
  if (hasStoichiometricKnowns(knowns)) {
    return deriveStoichiometryChain(target, knowns, formulas, constants, ontology, trace);
  }
```

- [ ] **Step 5: Run all tests**

Run: `npx vitest run src/lib/__tests__/derive-stoichiometry.test.ts`
Expected: All 18 tests pass (10 helper + 8 integration).

Run: `npx vitest run`
Expected: All existing 1197 + 18 new = 1215 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/derivation/stoichiometry-helpers.ts src/lib/derivation/derive-quantity.ts src/lib/__tests__/derive-stoichiometry.test.ts
git commit -m "feat(derivation): add stoichiometry/yield chains to deriveQuantity with signature detection"
```

---

## Chunk 2: Solver Migration + Cleanup

### Task 4: Wire solvers to use deriveQuantity() with parity tests

**Files:**
- Modify: `src/lib/task-engine/solvers.ts:546-593`
- Modify: `src/lib/__tests__/derive-stoichiometry.test.ts` (add parity tests)

**Key context for the implementer:**

Current `solveStoichiometry` (lines 546-567) does:
1. Reads slots: `given_mass`, `given_coeff`, `given_M`, `find_coeff`, `find_M`
2. Chain: `evaluateFormula(amount_from_mass, {m, M})` → `evaluateFormula(stoichiometry_ratio, {n_1, nu_1, nu_2})` → `formulaSolveFor(amount_from_mass, 'm', {n, M})`
3. Returns `Math.round(result * 100) / 100`

Current `solveReactionYield` (lines 569-593) extends this with:
4. Reads `yield_percent` slot
5. Additional step: `formulaSolveFor(yield, 'm_actual', {eta, m_theoretical})`

Generator `gen.pick_calc_reaction` (line 693) produces these slots:
- `given_formula` (string, e.g. "H2SO4"), `given_coeff` (number), `given_M` (number), `given_mass` (number)
- `find_formula` (string), `find_coeff` (number), `find_M` (number), `find_mass` (number, pre-computed)
- `yield_percent` (number, 60-95)
- `equation` (string)

The new solvers need to:
1. Build entity refs: `'substance:' + slots.given_formula`
2. Map slots to QRef knowns (see spec for exact mapping)
3. Call `deriveQuantity()` with the right target
4. Round the result at the boundary: `Math.round(result.value * 100) / 100`

Needed import in `solvers.ts`:
```typescript
import { deriveQuantity } from '../derivation/derive-quantity';
import type { OntologyAccess } from '../derivation/resolvers';
```

`OntologyAccess` requires `elements`, `parseFormula`, `entityFormulas`. The solver has access to `data: OntologyData` which contains `data.core.elements`. Since M is always provided in the slots, the helpers will never auto-derive M — the `ontology` parameter is only used by `deriveMolarMass`, which is only called when `M` is not provided. We pass a minimal ontology with a throwing `parseFormula` stub to make this invariant explicit.

**Spec deviation note:** The spec says "q:molar_mass — always role-less". This plan intentionally adds `role: 'reactant'`/`'product'` to M knowns in stoichiometry context for non-fragile orchestrator matching (vs. positional or entity_ref-based matching). This is a pragmatic deviation — role-based M lookup is simpler and sufficient for single-source stoichiometry. When multi-reactant scenarios arrive (limiting reagent), this convention may need revisiting in favor of entity_ref-based matching. The spec should be updated to reflect this decision.

- [ ] **Step 1: Write parity tests**

Append to `src/lib/__tests__/derive-stoichiometry.test.ts`:

```typescript
import { evaluateFormula, solveFor as formulaSolveFor } from '../formula-evaluator';

// ── Parity tests: old solver output vs deriveQuantity ────────────

describe('solver migration parity', () => {
  // Reproduce exact old solver logic for comparison
  function oldSolveStoichiometry(
    givenMass: number, givenCoeff: number, givenM: number,
    findCoeff: number, findM: number,
  ): number {
    const fAmount = formulas.find(f => f.id === 'formula:amount_from_mass')!;
    const fStoich = formulas.find(f => f.id === 'formula:stoichiometry_ratio')!;
    const nGiven = evaluateFormula(fAmount, { m: givenMass, M: givenM }, constants).result;
    const nFind = evaluateFormula(fStoich, { n_1: nGiven, nu_1: givenCoeff, nu_2: findCoeff }, constants).result;
    const mFind = formulaSolveFor(fAmount, 'm', { n: nFind, M: findM }, constants).result;
    return Math.round(mFind * 100) / 100;
  }

  function oldSolveReactionYield(
    givenMass: number, givenCoeff: number, givenM: number,
    findCoeff: number, findM: number, yieldPercent: number,
  ): number {
    const fAmount = formulas.find(f => f.id === 'formula:amount_from_mass')!;
    const fStoich = formulas.find(f => f.id === 'formula:stoichiometry_ratio')!;
    const fYield = formulas.find(f => f.id === 'formula:yield')!;
    const nGiven = evaluateFormula(fAmount, { m: givenMass, M: givenM }, constants).result;
    const nFind = evaluateFormula(fStoich, { n_1: nGiven, nu_1: givenCoeff, nu_2: findCoeff }, constants).result;
    const mTheoretical = formulaSolveFor(fAmount, 'm', { n: nFind, M: findM }, constants).result;
    const mActual = formulaSolveFor(fYield, 'm_actual', { eta: yieldPercent, m_theoretical: mTheoretical }, constants).result;
    return Math.round(mActual * 100) / 100;
  }

  function newSolveStoichiometry(
    givenMass: number, givenCoeff: number, givenM: number,
    findCoeff: number, findM: number,
    givenFormula: string, findFormula: string,
  ): number {
    const givenEntityRef = 'substance:' + givenFormula;
    const findEntityRef = 'substance:' + findFormula;
    const result = deriveQuantity({
      target: { quantity: 'q:mass', role: 'product' },
      knowns: [
        { qref: { quantity: 'q:mass', role: 'reactant' }, value: givenMass },
        { qref: { quantity: 'q:stoich_coeff', role: 'reactant' }, value: givenCoeff },
        { qref: { quantity: 'q:molar_mass', role: 'reactant', context: { system_type: 'substance', entity_ref: givenEntityRef } }, value: givenM },
        { qref: { quantity: 'q:stoich_coeff', role: 'product' }, value: findCoeff },
        { qref: { quantity: 'q:molar_mass', role: 'product', context: { system_type: 'substance', entity_ref: findEntityRef } }, value: findM },
      ],
      formulas, constants, ontology,
    });
    return Math.round(result.value * 100) / 100;
  }

  function newSolveReactionYield(
    givenMass: number, givenCoeff: number, givenM: number,
    findCoeff: number, findM: number, yieldPercent: number,
    givenFormula: string, findFormula: string,
  ): number {
    const givenEntityRef = 'substance:' + givenFormula;
    const findEntityRef = 'substance:' + findFormula;
    const result = deriveQuantity({
      target: { quantity: 'q:mass', role: 'product' },
      knowns: [
        { qref: { quantity: 'q:mass', role: 'reactant' }, value: givenMass },
        { qref: { quantity: 'q:stoich_coeff', role: 'reactant' }, value: givenCoeff },
        { qref: { quantity: 'q:molar_mass', role: 'reactant', context: { system_type: 'substance', entity_ref: givenEntityRef } }, value: givenM },
        { qref: { quantity: 'q:stoich_coeff', role: 'product' }, value: findCoeff },
        { qref: { quantity: 'q:molar_mass', role: 'product', context: { system_type: 'substance', entity_ref: findEntityRef } }, value: findM },
        { qref: { quantity: 'q:yield' }, value: yieldPercent },
      ],
      formulas, constants, ontology,
    });
    return Math.round(result.value * 100) / 100;
  }

  // Test cases from representative reactions in calc_reactions
  // H₂SO₄ + BaCl₂ → BaSO₄↓ + 2HCl: coeffs 1,1; M(H2SO4)=98.08, M(BaSO4)=233.39

  it('stoichiometry parity: H2SO4→BaSO4 with 49g', () => {
    const old = oldSolveStoichiometry(49, 1, 98.08, 1, 233.39);
    const now = newSolveStoichiometry(49, 1, 98.08, 1, 233.39, 'H2SO4', 'BaSO4');
    expect(now).toBeCloseTo(old, 2);
  });

  it('stoichiometry parity: H2SO4→BaSO4 with 19.6g', () => {
    const old = oldSolveStoichiometry(19.6, 1, 98.08, 1, 233.39);
    const now = newSolveStoichiometry(19.6, 1, 98.08, 1, 233.39, 'H2SO4', 'BaSO4');
    expect(now).toBeCloseTo(old, 2);
  });

  it('stoichiometry parity: 2:1 coefficient ratio', () => {
    // 2HCl + ... → ... (using arbitrary M values)
    const old = oldSolveStoichiometry(36.5, 2, 36.46, 1, 233.39);
    const now = newSolveStoichiometry(36.5, 2, 36.46, 1, 233.39, 'HCl', 'BaSO4');
    expect(now).toBeCloseTo(old, 2);
  });

  it('yield parity: H2SO4→BaSO4 with 80% yield', () => {
    const old = oldSolveReactionYield(49, 1, 98.08, 1, 233.39, 80);
    const now = newSolveReactionYield(49, 1, 98.08, 1, 233.39, 80, 'H2SO4', 'BaSO4');
    expect(now).toBeCloseTo(old, 2);
  });

  it('yield parity: H2SO4→BaSO4 with 65% yield', () => {
    const old = oldSolveReactionYield(49, 1, 98.08, 1, 233.39, 65);
    const now = newSolveReactionYield(49, 1, 98.08, 1, 233.39, 65, 'H2SO4', 'BaSO4');
    expect(now).toBeCloseTo(old, 2);
  });

  it('yield parity: 2:1 coefficient ratio with 90% yield', () => {
    const old = oldSolveReactionYield(36.5, 2, 36.46, 1, 233.39, 90);
    const now = newSolveReactionYield(36.5, 2, 36.46, 1, 233.39, 90, 'HCl', 'BaSO4');
    expect(now).toBeCloseTo(old, 2);
  });
});
```

- [ ] **Step 2: Run parity tests to verify they pass (they test old vs new, new already works)**

Run: `npx vitest run src/lib/__tests__/derive-stoichiometry.test.ts`
Expected: All 24 tests pass (10 helper + 8 integration + 6 parity).

- [ ] **Step 3: Replace solveStoichiometry body in solvers.ts**

In `src/lib/task-engine/solvers.ts`, add these imports at the top (after existing imports around line 13):

```typescript
import { deriveQuantity } from '../derivation/derive-quantity';
import type { SemanticRole } from '../../types/formula';
```

Then replace the body of `solveStoichiometry` (lines 546-567) with:

```typescript
function solveStoichiometry(
  params: Record<string, unknown>,
  slots: SlotValues,
  data: OntologyData,
): SolverResult {
  void params;
  const { formulas, constantsDict } = getFoundations(data);

  const givenEntityRef = 'substance:' + String(slots.given_formula);
  const findEntityRef = 'substance:' + String(slots.find_formula);

  // Minimal ontology — M is always pre-resolved, so entityFormulas is only for provenance
  const ontology = { elements: data.core.elements ?? [], parseFormula: () => { throw new Error('M must be pre-resolved in solver context'); }, entityFormulas: new Map<string, string>() };

  const result = deriveQuantity({
    target: { quantity: 'q:mass', role: 'product' as SemanticRole },
    knowns: [
      { qref: { quantity: 'q:mass', role: 'reactant' as SemanticRole }, value: Number(slots.given_mass) },
      { qref: { quantity: 'q:stoich_coeff', role: 'reactant' as SemanticRole }, value: Number(slots.given_coeff) },
      { qref: { quantity: 'q:molar_mass', role: 'reactant' as SemanticRole, context: { system_type: 'substance', entity_ref: givenEntityRef } }, value: Number(slots.given_M) },
      { qref: { quantity: 'q:stoich_coeff', role: 'product' as SemanticRole }, value: Number(slots.find_coeff) },
      { qref: { quantity: 'q:molar_mass', role: 'product' as SemanticRole, context: { system_type: 'substance', entity_ref: findEntityRef } }, value: Number(slots.find_M) },
    ],
    formulas,
    constants: constantsDict,
    ontology,
  });

  return { answer: Math.round(result.value * 100) / 100 };
}
```

- [ ] **Step 4: Replace solveReactionYield body in solvers.ts**

Replace the body of `solveReactionYield` (lines 569-593) with:

```typescript
function solveReactionYield(
  params: Record<string, unknown>,
  slots: SlotValues,
  data: OntologyData,
): SolverResult {
  void params;
  const { formulas, constantsDict } = getFoundations(data);

  const givenEntityRef = 'substance:' + String(slots.given_formula);
  const findEntityRef = 'substance:' + String(slots.find_formula);

  const ontology = { elements: data.core.elements ?? [], parseFormula: () => { throw new Error('M must be pre-resolved in solver context'); }, entityFormulas: new Map<string, string>() };

  const result = deriveQuantity({
    target: { quantity: 'q:mass', role: 'product' as SemanticRole },
    knowns: [
      { qref: { quantity: 'q:mass', role: 'reactant' as SemanticRole }, value: Number(slots.given_mass) },
      { qref: { quantity: 'q:stoich_coeff', role: 'reactant' as SemanticRole }, value: Number(slots.given_coeff) },
      { qref: { quantity: 'q:molar_mass', role: 'reactant' as SemanticRole, context: { system_type: 'substance', entity_ref: givenEntityRef } }, value: Number(slots.given_M) },
      { qref: { quantity: 'q:stoich_coeff', role: 'product' as SemanticRole }, value: Number(slots.find_coeff) },
      { qref: { quantity: 'q:molar_mass', role: 'product' as SemanticRole, context: { system_type: 'substance', entity_ref: findEntityRef } }, value: Number(slots.find_M) },
      { qref: { quantity: 'q:yield' }, value: Number(slots.yield_percent) },
    ],
    formulas,
    constants: constantsDict,
    ontology,
  });

  return { answer: Math.round(result.value * 100) / 100 };
}
```

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (1215+ total). Pay special attention to any existing solver tests in `src/lib/__tests__/`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/task-engine/solvers.ts src/lib/__tests__/derive-stoichiometry.test.ts
git commit -m "feat(solvers): migrate stoichiometry + reaction_yield to deriveQuantity with parity tests"
```

---

### Task 5: Cleanup unused imports in solvers.ts

After migration, `solveStoichiometry` and `solveReactionYield` no longer directly use `evaluateFormula` or `formulaSolveFor` from their own bodies. However, **other solver functions still use them** (e.g., `solveMolarMass`, `solveMassFraction`, `solveAmountCalc`, `solveConcentration`). So the imports stay.

**Files:**
- Modify: `src/lib/task-engine/solvers.ts` (only if unused imports remain after review)

- [ ] **Step 1: Verify no unused imports**

Check if `evaluateFormula` and `formulaSolveFor` are still used by other functions in `solvers.ts`. They are (by `solveMolarMass`, `solveMassFraction`, `solveAmountCalc`, `solveConcentration`). No cleanup needed for these.

Check if the old formula-finding helpers `findFormulaById` are still used by other functions. If `findFormulaById` was only used by the replaced solvers, it can be cleaned up. Otherwise leave it.

- [ ] **Step 2: Run all tests one final time**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 3: Commit (only if cleanup was needed)**

```bash
git add src/lib/task-engine/solvers.ts
git commit -m "chore: remove unused imports after stoichiometry solver migration"
```
