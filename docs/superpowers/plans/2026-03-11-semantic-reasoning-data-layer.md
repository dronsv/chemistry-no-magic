# Semantic Reasoning Data Layer — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured formula, qualitative relation, trend rule, and constant data as first-class ontology objects to the foundations layer, with TypeScript types, build pipeline registration, validation, and data loaders.

**Architecture:** Four new JSON catalogs in `data-src/foundations/` follow the exact same pattern as existing foundations files (physical_concepts, math_concepts, mechanisms, bridge_explanations): optional loading via `loadJsonOptional()`, ADR-003 validation, conditional copy to bundle, manifest registration with boolean flags, typed loaders with locale overlay support. Existing `periodic_trend_anomalies.json` and `reason_vocab.json` are extended with cross-references to the new layers.

**Tech Stack:** JSON data files, TypeScript types, ESM build scripts (Node.js), Vitest tests.

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `data-src/foundations/constants.json` | 5 physical/chemical constants (N_A, V_m, k, h, R) |
| `data-src/foundations/formulas.json` | 13 computable formulas with expression trees |
| `data-src/foundations/qualitative_relations.json` | 5 directional dependencies (Coulomb, IE, EN, radius, Z_eff) |
| `data-src/foundations/trend_rules.json` | 10 periodic trend rules with reasoning chains |
| `src/types/formula.ts` | TypeScript interfaces: `Constant`, `Variable`, `ExprNode`, `ComputableFormula` |
| `src/types/qualitative-relation.ts` | TypeScript interfaces: `Factor`, `Prediction`, `QualitativeRelation` |
| `src/types/trend-rule.ts` | TypeScript interfaces: `ApplicabilityContext`, `ReasoningStep`, `TrendRule` |
| `src/lib/__tests__/semantic-reasoning-data.test.ts` | Validation + structural integrity tests |

### Modified files

| File | Change |
|------|--------|
| `data-src/rules/periodic_trend_anomalies.json` | Add `overrides_trend` field to all 5 entries |
| `data-src/rules/reason_vocab.json` | Add `mechanism_ref` field to all 3 entries |
| `src/types/storage.ts` | Add `overrides_trend?` to `TrendAnomaly`, `mechanism_ref?` to `AnomalyReason` |
| `src/types/foundations.ts` | Add `grounded_in_relation?` to `Mechanism`, re-export new types |
| `src/types/manifest.ts` | Add `constants?`, `formulas?`, `qualitative_relations?`, `trend_rules?` to foundations |
| `scripts/build-data.mjs` | Load, validate, copy 4 new foundations files |
| `scripts/lib/generate-manifest.mjs` | Register 4 new foundations entries |
| `src/lib/data-loader.ts` | Add 4 loader functions |

---

## Chunk 1: Data Files + Types

### Task 1: Create constants.json

**Files:**
- Create: `data-src/foundations/constants.json`

- [ ] **Step 1: Create the constants data file**

```json
[
  {
    "id": "const:N_A",
    "symbol": "N_A",
    "value": 6.022e23,
    "unit": "unit:per_mol",
    "labels_key": "const.avogadro"
  },
  {
    "id": "const:V_m_stp",
    "symbol": "V_m",
    "value": 22.4,
    "unit": "unit:L_per_mol",
    "quantity": "q:molar_volume",
    "condition_key": "const.stp_condition",
    "labels_key": "const.molar_volume_stp"
  },
  {
    "id": "const:k_coulomb",
    "symbol": "k",
    "value": 8.988e9,
    "unit": "N·m²/C²",
    "labels_key": "const.coulomb_constant"
  },
  {
    "id": "const:h_planck",
    "symbol": "h",
    "value": 6.626e-34,
    "unit": "J·s",
    "labels_key": "const.planck"
  },
  {
    "id": "const:R",
    "symbol": "R",
    "value": 8.314,
    "unit": "J/(mol·K)",
    "labels_key": "const.gas_constant"
  }
]
```

- [ ] **Step 2: Verify file is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('data-src/foundations/constants.json','utf8')); console.log('OK')"`
Expected: `OK`

---

### Task 2: Create TypeScript types for formulas, relations, trends, constants

**Files:**
- Create: `src/types/formula.ts`
- Create: `src/types/qualitative-relation.ts`
- Create: `src/types/trend-rule.ts`

- [ ] **Step 1: Create `src/types/formula.ts`**

```typescript
/** A node in a formula expression tree. */
export type ExprNode =
  | { op: 'add' | 'subtract' | 'multiply' | 'divide'; operands: (string | number | ExprNode)[] }
  | { op: 'power'; operands: [string | ExprNode, number] }
  | { op: 'sum'; over: string; index_set: string; term: ExprNode }
  | { op: 'literal'; value: number }
  | { op: 'const'; ref: string };

export interface Variable {
  symbol: string;
  quantity: string;        // ref to q:* in quantities_units_ontology
  unit: string;            // ref to unit:*
  role: 'result' | 'input' | 'constant' | 'index';
}

export interface ComputableFormula {
  id: string;              // namespace formula:
  kind: 'definition' | 'law';
  domain: string;          // stoichiometry | solutions | thermochemistry | atomic_structure | gas_laws
  school_grade: number[];
  variables: Variable[];
  expression: ExprNode;
  result_variable: string;
  invertible_for: string[];
  inversions: Record<string, ExprNode>;
  constants_used: string[];          // ref to const:*
  prerequisite_formulas: string[];   // ref to formula:*
  used_by_solvers: string[];         // for migration tracking
}

export interface PhysicalConstant {
  id: string;              // namespace const:
  symbol: string;
  value: number;
  unit: string;
  quantity?: string;       // optional ref to q:*
  condition_key?: string;  // ref to locale label for condition (e.g. STP)
  labels_key: string;      // ref to locale label for name
  // Overlay fields
  name?: string;
  condition?: string;
}
```

- [ ] **Step 2: Create `src/types/qualitative-relation.ts`**

```typescript
export interface Factor {
  variable: string;
  position: 'numerator' | 'denominator' | 'exponent';
  power?: number;
  effect_on_result: 'direct' | 'inverse';
}

export interface QualPrediction {
  if_change: string;
  direction: 'increase' | 'decrease';
  then: string;
  direction_result: 'increase' | 'decrease';
}

export interface QualitativeRelation {
  id: string;              // namespace qrel:
  kind: 'qualitative_relation';
  domain: string;
  statement: string;       // human-readable, for debugging only
  factors: Factor[];
  result_variable: string;
  grounded_in?: string;    // optional ref to formula:* or another qrel:*
  predictions: QualPrediction[];
  school_grade: number[];
}
```

- [ ] **Step 3: Create `src/types/trend-rule.ts`**

```typescript
export interface ApplicabilityContext {
  scope: string;
  same: 'period' | 'group';
  exclude?: string[];
}

export interface ReasoningStep {
  step: number;
  relation: string;        // ref to qrel:*
  conclusion: string;      // machine-readable conclusion key
}

export interface TrendRule {
  id: string;              // namespace trend:
  kind: 'trend_rule';
  property: string;
  direction: 'increases' | 'decreases';
  context: 'across_period' | 'down_group';
  applicability: ApplicabilityContext;
  reasoning_chain: ReasoningStep[];
  exception_rule_ids: string[];   // ref to exception IDs in periodic_trend_anomalies
  // Overlay fields
  school_note?: string;
}
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit src/types/formula.ts src/types/qualitative-relation.ts src/types/trend-rule.ts 2>&1 | head -20`
Expected: No errors (or only errors from missing imports if tsc needs full project)

- [ ] **Step 5: Commit**

```bash
git add data-src/foundations/constants.json src/types/formula.ts src/types/qualitative-relation.ts src/types/trend-rule.ts
git commit -m "feat(reasoning): add TypeScript types for formulas, relations, trends, constants"
```

---

### Task 3: Create formulas.json (13 computable formulas)

**Files:**
- Create: `data-src/foundations/formulas.json`

- [ ] **Step 1: Create formulas data file with all 13 formulas**

The file must be a JSON array of `ComputableFormula` objects. Each formula has: id, kind, domain, school_grade, variables (with quantity + unit refs), expression (ExprNode tree), result_variable, invertible_for, inversions, constants_used, prerequisite_formulas, used_by_solvers.

The 13 formulas are:

1. `formula:molar_mass_from_composition` — M = Σ(Ar_i × n_i)
2. `formula:amount_from_mass` — n = m / M
3. `formula:particle_count` — N = n × N_A
4. `formula:gas_volume_stp` — V = n × V_m
5. `formula:mass_fraction_element` — ω = (Ar × n_atom) / M × 100
6. `formula:density` — ρ = m / V
7. `formula:yield` — η = m_actual / m_theoretical × 100
8. `formula:stoichiometry_ratio` — n₁/ν₁ = n₂/ν₂
9. `formula:mass_fraction_solution` — w = m_solute / m_solution
10. `formula:molar_concentration` — C = n / V
11. `formula:hess_law` — ΔH = Σν·ΔHf(prod) − Σν·ΔHf(react)
12. `formula:effective_nuclear_charge` — Z_eff = Z − σ
13. `formula:photon_energy` — E = h × ν

Each formula follows the ExprNode schema from `src/types/formula.ts`. Expression trees use string operand names matching variable symbols. Constants use `{ "op": "const", "ref": "const:N_A" }`.

- [ ] **Step 2: Verify file is valid JSON**

Run: `node -e "const d=JSON.parse(require('fs').readFileSync('data-src/foundations/formulas.json','utf8')); console.log(d.length + ' formulas')"`
Expected: `13 formulas`

- [ ] **Step 3: Verify all IDs use `formula:` namespace**

Run: `node -e "const d=JSON.parse(require('fs').readFileSync('data-src/foundations/formulas.json','utf8')); const bad=d.filter(f=>!f.id.startsWith('formula:')); console.log(bad.length ? 'BAD: '+bad.map(f=>f.id) : 'OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add data-src/foundations/formulas.json
git commit -m "feat(reasoning): add 13 computable formulas to foundations"
```

---

### Task 4: Create qualitative_relations.json (5 relations)

**Files:**
- Create: `data-src/foundations/qualitative_relations.json`

- [ ] **Step 1: Create qualitative relations data file**

5 relations:
1. `qrel:coulomb_attraction` — F ∝ Z_eff / r², grounded_in: null (fundamental)
2. `qrel:ionization_energy_factors` — IE ∝ Z_eff / r, grounded_in: `qrel:coulomb_attraction`
3. `qrel:electronegativity_factors` — EN ∝ Z_eff / r, grounded_in: `qrel:coulomb_attraction`
4. `qrel:atomic_radius_factors` — r ∝ n² / Z_eff
5. `qrel:zeff_in_period` — Z_eff ≈ Z − σ_inner, grounded_in: `formula:effective_nuclear_charge`

Each has: `factors` array (variable, position, effect_on_result), `predictions` array (if_change → then direction_result).

- [ ] **Step 2: Verify valid JSON and count**

Run: `node -e "const d=JSON.parse(require('fs').readFileSync('data-src/foundations/qualitative_relations.json','utf8')); console.log(d.length + ' relations')"`
Expected: `5 relations`

- [ ] **Step 3: Commit**

```bash
git add data-src/foundations/qualitative_relations.json
git commit -m "feat(reasoning): add 5 qualitative relations to foundations"
```

---

### Task 5: Create trend_rules.json (10 trends)

**Files:**
- Create: `data-src/foundations/trend_rules.json`

- [ ] **Step 1: Create trend rules data file**

10 rules — 5 properties × 2 contexts (across_period + down_group):
- ionization_energy: increases across_period, decreases down_group
- electronegativity: increases across_period, decreases down_group
- atomic_radius: decreases across_period, increases down_group
- metallic_character: decreases across_period, increases down_group
- electron_affinity: increases across_period, decreases down_group

Each has:
- `applicability`: `{ scope: "main_group_elements", same: "period"|"group", exclude: ["lanthanide", "actinide"] }`
- `reasoning_chain`: array of `{ step, relation: "qrel:*", conclusion }` — 2-3 steps tracing through qualitative relations
- `exception_rule_ids`: refs to anomaly IDs (e.g. `"exc:ie_be_b"`) — empty for trends without known school-level exceptions

- [ ] **Step 2: Verify valid JSON and count**

Run: `node -e "const d=JSON.parse(require('fs').readFileSync('data-src/foundations/trend_rules.json','utf8')); console.log(d.length + ' trends')"`
Expected: `10 trends`

- [ ] **Step 3: Verify all reasoning_chain references exist in qualitative_relations**

Run: `node -e "const qr=JSON.parse(require('fs').readFileSync('data-src/foundations/qualitative_relations.json','utf8')); const tr=JSON.parse(require('fs').readFileSync('data-src/foundations/trend_rules.json','utf8')); const ids=new Set(qr.map(r=>r.id)); const bad=[]; tr.forEach(t=>t.reasoning_chain.forEach(s=>{if(!ids.has(s.relation))bad.push(t.id+':'+s.relation)})); console.log(bad.length ? 'BAD: '+bad : 'OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add data-src/foundations/trend_rules.json
git commit -m "feat(reasoning): add 10 trend rules to foundations"
```

---

### Task 6: Extend existing anomalies and reason vocab

**Files:**
- Modify: `data-src/rules/periodic_trend_anomalies.json`
- Modify: `data-src/rules/reason_vocab.json`
- Modify: `src/types/storage.ts`
- Modify: `src/types/foundations.ts`

- [ ] **Step 1: Add `overrides_trend` to each anomaly in `periodic_trend_anomalies.json`**

Add the field to all 5 entries:
- Be→B (IE, period) → `"overrides_trend": "trend:ie_across_period"`
- N→O (IE, period) → `"overrides_trend": "trend:ie_across_period"`
- N→O (EA, period) → `"overrides_trend": "trend:ea_across_period"`
- Be→B (EA, period) → `"overrides_trend": "trend:ea_across_period"`
- F→Cl (EA, group) → `"overrides_trend": "trend:ea_down_group"`

- [ ] **Step 2: Add `mechanism_ref` to each reason in `reason_vocab.json`**

- `filled_s_subshell` → `"mechanism_ref": "exchange_stabilization"`
- `half_filled_p_subshell` → `"mechanism_ref": "exchange_stabilization"`
- `small_atomic_radius_repulsion` → `"mechanism_ref": null`

- [ ] **Step 3: Update `TrendAnomaly` type in `src/types/storage.ts`**

Add optional field:
```typescript
export interface TrendAnomaly {
  property: string;
  from: string;
  to: string;
  reason: string;
  direction: 'period' | 'group';
  note?: string;
  overrides_trend?: string;  // ADD: ref to trend:* in trend_rules
}

export interface AnomalyReason {
  id: string;
  labels: { ru: string; en: string; pl: string; es: string; [locale: string]: string };
  mechanism_ref?: string;   // ADD: ref to mechanism ID in mechanisms.json
}
```

- [ ] **Step 4: Add `grounded_in_relation?` to `Mechanism` in `src/types/foundations.ts`**

Add one optional field to the existing interface:
```typescript
export interface Mechanism {
  // ... existing fields ...
  grounded_in_relation?: string;  // ADD: ref to qrel:* or formula:*
}
```

- [ ] **Step 5: Commit**

```bash
git add data-src/rules/periodic_trend_anomalies.json data-src/rules/reason_vocab.json src/types/storage.ts src/types/foundations.ts
git commit -m "feat(reasoning): extend anomalies with trend refs, reasons with mechanism refs"
```

---

## Chunk 2: Build Pipeline + Loaders + Tests

### Task 7: Register in build pipeline

**Files:**
- Modify: `scripts/build-data.mjs` (~lines 203-207 for loading, ~354-358 for validation, ~513-529 for copying)
- Modify: `scripts/lib/generate-manifest.mjs` (~lines 117-123 for entrypoints, ~843-849 for flags)
- Modify: `src/types/manifest.ts` (~lines 53-59)

- [ ] **Step 1: Add loading in `scripts/build-data.mjs`**

After existing foundations loading block (~line 207), add 4 lines following the same pattern:
```javascript
const constants = await loadJsonOptional(join(FOUNDATIONS_DIR, 'constants.json'));
const formulas = await loadJsonOptional(join(FOUNDATIONS_DIR, 'formulas.json'));
const qualitativeRelations = await loadJsonOptional(join(FOUNDATIONS_DIR, 'qualitative_relations.json'));
const trendRules = await loadJsonOptional(join(FOUNDATIONS_DIR, 'trend_rules.json'));
```

- [ ] **Step 2: Add validation in `scripts/build-data.mjs`**

After existing foundations validation block (~line 358), add:
```javascript
...(constants ? validateExplanatoryCatalogLocaleNeutral(constants, 'foundations/constants.json') : []),
...(formulas ? validateExplanatoryCatalogLocaleNeutral(formulas, 'foundations/formulas.json') : []),
...(qualitativeRelations ? validateExplanatoryCatalogLocaleNeutral(qualitativeRelations, 'foundations/qualitative_relations.json') : []),
...(trendRules ? validateExplanatoryCatalogLocaleNeutral(trendRules, 'foundations/trend_rules.json') : []),
```

- [ ] **Step 3: Add copy-to-bundle in `scripts/build-data.mjs`**

Inside the existing `if (physicalConcepts || mathConcepts || ...)` block (~line 513), add after bridge_explanations copy:
```javascript
if (constants) await writeFile(join(bundleDir, 'foundations', 'constants.json'), JSON.stringify(constants));
if (formulas) await writeFile(join(bundleDir, 'foundations', 'formulas.json'), JSON.stringify(formulas));
if (qualitativeRelations) await writeFile(join(bundleDir, 'foundations', 'qualitative_relations.json'), JSON.stringify(qualitativeRelations));
if (trendRules) await writeFile(join(bundleDir, 'foundations', 'trend_rules.json'), JSON.stringify(trendRules));
```

Also update the condition of the outer `if` to include the new files:
```javascript
if (physicalConcepts || mathConcepts || mechanisms || bridgeExplanations || constants || formulas || qualitativeRelations || trendRules) {
```

- [ ] **Step 4: Update manifest flags in `scripts/build-data.mjs`**

In the `foundations: { ... }` block passed to `generateManifest()` (~line 843), add:
```javascript
constants: !!constants,
formulas: !!formulas,
qualitative_relations: !!qualitativeRelations,
trend_rules: !!trendRules,
```

- [ ] **Step 5: Update entrypoints in `scripts/lib/generate-manifest.mjs`**

In the `foundations:` block (~line 117), add after bridge_explanations/indices entries:
```javascript
...(foundations.constants ? { constants: 'foundations/constants.json' } : {}),
...(foundations.formulas ? { formulas: 'foundations/formulas.json' } : {}),
...(foundations.qualitative_relations ? { qualitative_relations: 'foundations/qualitative_relations.json' } : {}),
...(foundations.trend_rules ? { trend_rules: 'foundations/trend_rules.json' } : {}),
```

- [ ] **Step 6: Update manifest TypeScript type**

In `src/types/manifest.ts`, add to the `foundations?` object:
```typescript
foundations?: {
  physical_concepts?: string;
  math_concepts?: string;
  mechanisms?: string;
  bridge_explanations?: string;
  indices?: string;
  constants?: string;           // ADD
  formulas?: string;            // ADD
  qualitative_relations?: string; // ADD
  trend_rules?: string;         // ADD
};
```

- [ ] **Step 7: Run build:data to verify pipeline**

Run: `npm run build:data`
Expected: No errors. New files appear in `public/data/{hash}/foundations/`.

- [ ] **Step 8: Commit**

```bash
git add scripts/build-data.mjs scripts/lib/generate-manifest.mjs src/types/manifest.ts
git commit -m "feat(reasoning): register formulas, relations, trends, constants in build pipeline"
```

---

### Task 8: Add data loaders

**Files:**
- Modify: `src/lib/data-loader.ts`

- [ ] **Step 1: Add 4 loader functions**

Follow the exact pattern of `loadPhysicalConcepts()` (lines ~1168-1180). Add at the end of the file:

```typescript
export async function loadConstants(
  locale?: SupportedLocale,
): Promise<import('../types/formula').PhysicalConstant[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.foundations?.constants;
  if (!path) return [];
  const data = await loadDataFile<import('../types/formula').PhysicalConstant[]>(path);
  if (!locale) return data;
  const overlay = await loadTranslationOverlay(locale, 'foundations/constants');
  return applyOverlay(data, overlay, c => c.id);
}

export async function loadFormulas(): Promise<import('../types/formula').ComputableFormula[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.foundations?.formulas;
  if (!path) return [];
  return loadDataFile<import('../types/formula').ComputableFormula[]>(path);
}

export async function loadQualitativeRelations(): Promise<import('../types/qualitative-relation').QualitativeRelation[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.foundations?.qualitative_relations;
  if (!path) return [];
  return loadDataFile<import('../types/qualitative-relation').QualitativeRelation[]>(path);
}

export async function loadTrendRules(
  locale?: SupportedLocale,
): Promise<import('../types/trend-rule').TrendRule[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.foundations?.trend_rules;
  if (!path) return [];
  const data = await loadDataFile<import('../types/trend-rule').TrendRule[]>(path);
  if (!locale) return data;
  const overlay = await loadTranslationOverlay(locale, 'foundations/trend_rules');
  return applyOverlay(data, overlay, t => t.id);
}
```

Note: `loadFormulas` and `loadQualitativeRelations` don't need locale overlay — formulas and relations are language-neutral (no text fields). `loadConstants` and `loadTrendRules` do because they have overlay-able fields (`name`, `condition`, `school_note`).

- [ ] **Step 2: Commit**

```bash
git add src/lib/data-loader.ts
git commit -m "feat(reasoning): add loaders for constants, formulas, qualitative relations, trend rules"
```

---

### Task 9: Write structural integrity tests

**Files:**
- Create: `src/lib/__tests__/semantic-reasoning-data.test.ts`

- [ ] **Step 1: Write tests that validate data structure against types**

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const FOUNDATIONS = join(__dirname, '../../../data-src/foundations');
const RULES = join(__dirname, '../../../data-src/rules');

function loadJson<T>(filename: string): T {
  return JSON.parse(readFileSync(filename, 'utf8')) as T;
}

describe('constants.json', () => {
  const data = loadJson<Array<Record<string, unknown>>>(join(FOUNDATIONS, 'constants.json'));

  it('is a non-empty array', () => {
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(5);
  });

  it('all entries have required fields', () => {
    for (const c of data) {
      expect(c.id).toMatch(/^const:/);
      expect(typeof c.symbol).toBe('string');
      expect(typeof c.value).toBe('number');
      expect(typeof c.unit).toBe('string');
      expect(typeof c.labels_key).toBe('string');
    }
  });

  it('has no locale-suffixed fields (ADR-003)', () => {
    for (const c of data) {
      for (const key of Object.keys(c)) {
        expect(key).not.toMatch(/_(ru|en|pl|es)$/);
      }
    }
  });
});

describe('formulas.json', () => {
  const data = loadJson<Array<Record<string, unknown>>>(join(FOUNDATIONS, 'formulas.json'));

  it('has 13 formulas', () => {
    expect(data.length).toBe(13);
  });

  it('all IDs use formula: namespace', () => {
    for (const f of data) {
      expect(f.id).toMatch(/^formula:/);
    }
  });

  it('all have expression, result_variable, variables', () => {
    for (const f of data) {
      expect(f.expression).toBeDefined();
      expect(typeof f.result_variable).toBe('string');
      expect(Array.isArray(f.variables)).toBe(true);
      expect((f.variables as Array<unknown>).length).toBeGreaterThan(0);
    }
  });

  it('result_variable matches one of the variable symbols', () => {
    for (const f of data) {
      const symbols = (f.variables as Array<{ symbol: string }>).map(v => v.symbol);
      expect(symbols).toContain(f.result_variable);
    }
  });

  it('invertible_for entries match variable symbols', () => {
    for (const f of data) {
      const symbols = (f.variables as Array<{ symbol: string }>).map(v => v.symbol);
      for (const inv of (f.invertible_for as string[]) ?? []) {
        expect(symbols).toContain(inv);
      }
    }
  });

  it('inversions keys match invertible_for', () => {
    for (const f of data) {
      const invFor = new Set((f.invertible_for as string[]) ?? []);
      const invKeys = new Set(Object.keys((f.inversions as Record<string, unknown>) ?? {}));
      expect(invKeys).toEqual(invFor);
    }
  });

  it('prerequisite_formulas reference existing formula IDs', () => {
    const ids = new Set(data.map(f => f.id as string));
    for (const f of data) {
      for (const pre of (f.prerequisite_formulas as string[]) ?? []) {
        expect(ids.has(pre)).toBe(true);
      }
    }
  });

  it('constants_used reference existing constant IDs', () => {
    const constants = loadJson<Array<{ id: string }>>(join(FOUNDATIONS, 'constants.json'));
    const constIds = new Set(constants.map(c => c.id));
    for (const f of data) {
      for (const c of (f.constants_used as string[]) ?? []) {
        expect(constIds.has(c)).toBe(true);
      }
    }
  });

  it('has no locale-suffixed fields (ADR-003)', () => {
    for (const f of data) {
      for (const key of Object.keys(f)) {
        expect(key).not.toMatch(/_(ru|en|pl|es)$/);
      }
    }
  });
});

describe('qualitative_relations.json', () => {
  const data = loadJson<Array<Record<string, unknown>>>(join(FOUNDATIONS, 'qualitative_relations.json'));

  it('has 5 relations', () => {
    expect(data.length).toBe(5);
  });

  it('all IDs use qrel: namespace', () => {
    for (const r of data) {
      expect(r.id).toMatch(/^qrel:/);
    }
  });

  it('all have factors and predictions', () => {
    for (const r of data) {
      expect(Array.isArray(r.factors)).toBe(true);
      expect(Array.isArray(r.predictions)).toBe(true);
    }
  });

  it('grounded_in references valid formulas or relations', () => {
    const formulaIds = new Set(loadJson<Array<{ id: string }>>(join(FOUNDATIONS, 'formulas.json')).map(f => f.id));
    const relIds = new Set(data.map(r => r.id as string));
    for (const r of data) {
      if (r.grounded_in) {
        const ref = r.grounded_in as string;
        expect(formulaIds.has(ref) || relIds.has(ref)).toBe(true);
      }
    }
  });
});

describe('trend_rules.json', () => {
  const data = loadJson<Array<Record<string, unknown>>>(join(FOUNDATIONS, 'trend_rules.json'));

  it('has 10 trends', () => {
    expect(data.length).toBe(10);
  });

  it('all IDs use trend: namespace', () => {
    for (const t of data) {
      expect(t.id).toMatch(/^trend:/);
    }
  });

  it('each trend has applicability, reasoning_chain, exception_rule_ids', () => {
    for (const t of data) {
      expect(t.applicability).toBeDefined();
      expect(Array.isArray(t.reasoning_chain)).toBe(true);
      expect(Array.isArray(t.exception_rule_ids)).toBe(true);
    }
  });

  it('reasoning_chain references valid qualitative relations', () => {
    const relIds = new Set(loadJson<Array<{ id: string }>>(join(FOUNDATIONS, 'qualitative_relations.json')).map(r => r.id));
    for (const t of data) {
      for (const step of t.reasoning_chain as Array<{ relation: string }>) {
        expect(relIds.has(step.relation)).toBe(true);
      }
    }
  });

  it('covers all 5 properties × 2 contexts', () => {
    const pairs = data.map(t => `${t.property}:${t.context}`);
    const expected = [
      'ionization_energy:across_period', 'ionization_energy:down_group',
      'electronegativity:across_period', 'electronegativity:down_group',
      'atomic_radius:across_period', 'atomic_radius:down_group',
      'metallic_character:across_period', 'metallic_character:down_group',
      'electron_affinity:across_period', 'electron_affinity:down_group',
    ];
    expect(new Set(pairs)).toEqual(new Set(expected));
  });
});

describe('periodic_trend_anomalies.json (extended)', () => {
  const data = loadJson<Array<Record<string, unknown>>>(join(RULES, 'periodic_trend_anomalies.json'));

  it('all 5 entries have overrides_trend', () => {
    for (const a of data) {
      expect(typeof a.overrides_trend).toBe('string');
      expect(a.overrides_trend).toMatch(/^trend:/);
    }
  });

  it('overrides_trend references valid trend IDs', () => {
    const trendIds = new Set(loadJson<Array<{ id: string }>>(join(FOUNDATIONS, 'trend_rules.json')).map(t => t.id));
    for (const a of data) {
      expect(trendIds.has(a.overrides_trend as string)).toBe(true);
    }
  });
});

describe('reason_vocab.json (extended)', () => {
  const data = loadJson<Array<Record<string, unknown>>>(join(RULES, 'reason_vocab.json'));
  const mechIds = new Set(loadJson<Array<{ id: string }>>(join(FOUNDATIONS, 'mechanisms.json')).map(m => m.id));

  it('all entries have mechanism_ref (string or null)', () => {
    for (const r of data) {
      expect('mechanism_ref' in r).toBe(true);
    }
  });

  it('non-null mechanism_ref references valid mechanism IDs', () => {
    for (const r of data) {
      if (r.mechanism_ref !== null) {
        expect(mechIds.has(r.mechanism_ref as string)).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run tests — expect failures (data files not yet complete)**

Run: `npx vitest run src/lib/__tests__/semantic-reasoning-data.test.ts`

At this point, constants.json exists but formulas.json, qualitative_relations.json, trend_rules.json may not exist yet or anomalies may not be extended. Tests will confirm what's missing.

- [ ] **Step 3: Create/complete any remaining data files until all tests pass**

Iterate: fix data → run tests → fix data until green.

Run: `npx vitest run src/lib/__tests__/semantic-reasoning-data.test.ts`
Expected: All tests pass.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: 700+ tests pass (existing + new).

- [ ] **Step 5: Run full build**

Run: `npm run build`
Expected: Build succeeds. Page count unchanged (1424+).

- [ ] **Step 6: Commit**

```bash
git add src/lib/__tests__/semantic-reasoning-data.test.ts
git commit -m "test(reasoning): add structural integrity tests for formulas, relations, trends"
```

---

### Task 10: Final verification

- [ ] **Step 1: Verify manifest includes new entries**

Run: `node -e "const m=JSON.parse(require('fs').readFileSync('public/data/latest/manifest.json','utf8')); console.log(JSON.stringify(m.entrypoints.foundations, null, 2))"`
Expected: Shows all 9 entries (existing 5 + new 4: constants, formulas, qualitative_relations, trend_rules).

- [ ] **Step 2: Verify bundle files exist**

Run: `ls public/data/*/foundations/`
Expected: Lists: physical_concepts.json, math_concepts.json, mechanisms.json, bridge_explanations.json, indices.json, constants.json, formulas.json, qualitative_relations.json, trend_rules.json

- [ ] **Step 3: Run validate:data**

Run: `npm run validate:data`
Expected: No errors.

- [ ] **Step 4: Final commit with all remaining changes**

```bash
git add -A
git status
# Verify only expected files
git commit -m "feat(reasoning): complete Stage 1 — semantic reasoning data layer

Add 4 new foundations catalogs:
- constants.json (5 physical/chemical constants)
- formulas.json (13 computable formulas with expression trees)
- qualitative_relations.json (5 directional dependencies)
- trend_rules.json (10 periodic trend rules with reasoning chains)

Extend existing data:
- periodic_trend_anomalies: add overrides_trend refs
- reason_vocab: add mechanism_ref links

Build pipeline: load, validate (ADR-003), copy, manifest, loaders.
Tests: 7 structural integrity test suites."
```
