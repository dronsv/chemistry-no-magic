# Characteristics On-Entity Refactoring Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move characteristics from separate `data-src/characteristics/` files onto entities themselves as `characteristics: { "concept:id": { value, unit?, conditions? } }`. Remove the separate characteristics layer.

**Architecture:** Each entity (element, ion, substance) gains a `characteristics` field — an object keyed by concept ID. Consumers read `entity.characteristics['concept:electronegativity'].value` directly, no separate loader/index needed. Filter evaluator extended for nested field access.

**Tech Stack:** TypeScript, JSON data, Vitest, Node.js build scripts

---

## Task 1: Add CharacteristicEntry type and characteristics field to entity types

**Files:**
- Modify: `src/types/characteristic.ts` — add `CharacteristicEntry`, `EntityCharacteristics`
- Modify: `src/types/element.ts` — add `characteristics?` field
- Modify: `src/types/ion.ts` — add `characteristics?` field
- Modify: `src/types/substance.ts` — add `characteristics?` field
- Modify: `src/types/calculations.ts` — add `characteristics?` field to CalcSubstance

- [ ] **Step 1: Add CharacteristicEntry type**

In `src/types/characteristic.ts`, add (keep existing types for now — they'll be removed later):

```typescript
/** Single characteristic value on an entity */
export interface CharacteristicEntry {
  value: number | string | boolean;
  unit?: string | null;
  conditions?: ConditionContext;
  source?: { kind: ValueSourceKind; ref?: string; derived_from?: string[] };
  explanation_concept_id?: string;
}

/** Characteristics map on an entity: concept_id → entry or array of entries (for multi-step) */
export type EntityCharacteristics = Record<string, CharacteristicEntry | CharacteristicEntry[]>;
```

- [ ] **Step 2: Add characteristics field to entity types**

Add `characteristics?: EntityCharacteristics` to Element, Ion, Substance, CalcSubstance interfaces.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(types): add CharacteristicEntry and characteristics field to entity types"
```

---

## Task 2: Write migration script — merge characteristics onto entities

**Files:**
- Create: `scripts/lib/merge-characteristics-to-entities.mjs`

The script reads the 5 files from `data-src/characteristics/` and merges values back onto their respective entities in `data-src/elements.json`, `data-src/ions.json`, `data-src/substances/*.json`, `data-src/rules/calculations_data.json`.

- [ ] **Step 1: Write the script**

For each characteristic record:
1. Parse `subject_id` to determine entity type (`el:` → elements, `ion:` → ions, `sub:` → substances)
2. Find the entity in the source data
3. Add to `entity.characteristics[concept_id]`:
   - If no conditions or single-step: `{ value, unit?, source?, explanation_concept_id? }`
   - If has `conditions.dissociation_step`: push to array at that concept key

Example output for element Na:
```json
{
  "Z": 11, "symbol": "Na", ...,
  "characteristics": {
    "concept:atomic_mass": { "value": 22.99, "unit": "unit:u" },
    "concept:electronegativity": { "value": 0.93 },
    "concept:melting_point": { "value": 97.79, "unit": "unit:celsius" },
    "concept:boiling_point": { "value": 882.94, "unit": "unit:celsius" },
    "concept:density": { "value": 0.968, "unit": "unit:g_per_cm3" }
  }
}
```

Example for ion H⁺:
```json
{
  "id": "ion:H_plus", "formula": "H⁺", "type": "cation", "tags": ["hydrogen"],
  "characteristics": {
    "concept:ion_charge": { "value": 1, "unit": "unit:elementary_charge" }
  }
}
```

Example for substance H₂SO₄ (multi-step pKa):
```json
{
  "id": "sub:h2so4", ...,
  "characteristics": {
    "concept:pKa": [
      { "value": -3, "conditions": { "dissociation_step": 1, "solvent": "water", "temperature_C": 25 } },
      { "value": 1.99, "conditions": { "dissociation_step": 2, "solvent": "water", "temperature_C": 25 } }
    ]
  }
}
```

- [ ] **Step 2: Run the script**

Run: `node scripts/lib/merge-characteristics-to-entities.mjs`

- [ ] **Step 3: Spot-check results**

Verify elements.json has characteristics, ions.json has characteristics, a substance file has characteristics.

- [ ] **Step 4: Commit**

```bash
git commit -m "data: merge characteristics onto entities (elements, ions, substances)"
```

---

## Task 3: Update characteristics-utils for on-entity format

**Files:**
- Modify: `src/lib/characteristics-utils.ts` — add helpers for on-entity access
- Modify: `src/lib/__tests__/characteristics-utils.test.ts` — add tests for new helpers

- [ ] **Step 1: Add on-entity helpers**

```typescript
import type { CharacteristicEntry, EntityCharacteristics } from '../types/characteristic';

/** Get a single characteristic value from an entity's characteristics map */
export function getEntityCharValue(
  characteristics: EntityCharacteristics | undefined,
  conceptId: string,
  step?: number,
): number | string | boolean | undefined {
  if (!characteristics) return undefined;
  const entry = characteristics[conceptId];
  if (!entry) return undefined;
  if (Array.isArray(entry)) {
    const match = step != null
      ? entry.find(e => e.conditions?.dissociation_step === step)
      : entry[0];
    return match?.value;
  }
  return entry.value;
}

/** Get full characteristic entry from an entity */
export function getEntityCharEntry(
  characteristics: EntityCharacteristics | undefined,
  conceptId: string,
  step?: number,
): CharacteristicEntry | undefined {
  if (!characteristics) return undefined;
  const entry = characteristics[conceptId];
  if (!entry) return undefined;
  if (Array.isArray(entry)) {
    return step != null
      ? entry.find(e => e.conditions?.dissociation_step === step)
      : entry[0];
  }
  return entry;
}
```

- [ ] **Step 2: Add tests**

Test `getEntityCharValue` and `getEntityCharEntry` with single values, arrays, missing keys, step filtering.

- [ ] **Step 3: Run tests**

Run: `npm test`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(utils): add on-entity characteristic helpers"
```

---

## Task 4: Update all consumers to read from entity.characteristics

**Files:** All files that currently use `charsBySubject`, `getCharacteristicValue`, `indexCharacteristicsBySubject`, or `loadCharacteristics()`:
- `src/features/periodic-table/PeriodicTablePage.tsx`
- `src/features/periodic-table/ElementDetails.tsx`
- `src/features/periodic-table/ElementDetailPanel.tsx`
- `src/features/periodic-table/ElementDetailPage.astro`
- `src/features/bonds/BondCalculator.tsx`
- `src/features/substances/SubstanceDetailPage.astro`
- `src/components/IonDetailsProvider.tsx`
- `src/lib/derivation/resolvers.ts`
- `src/lib/task-engine/solvers.ts`
- `src/lib/task-engine/generators.ts`
- `src/features/competency/exercise-adapters.ts`
- `src/components/AcidStrengthScale.tsx`

- [ ] **Step 1: Migrate periodic table components**

Replace:
```typescript
const chars = await loadCharacteristics();
const charsBySubject = indexCharacteristicsBySubject(chars);
const val = getCharacteristicValue(charsBySubject.get('el:Na'), 'concept:electronegativity');
```

With:
```typescript
// element already loaded, has characteristics
const val = getEntityCharValue(element.characteristics, 'concept:electronegativity');
```

Remove `loadCharacteristics()` calls and `charsBySubject` state. Elements already come with characteristics from `loadElements()`.

- [ ] **Step 2: Migrate bond calculator**

`BondCalculator.tsx` builds `ElementLike` objects. Now populate electronegativity from `element.characteristics['concept:electronegativity'].value`.

- [ ] **Step 3: Migrate substance/ion consumers**

- `SubstanceDetailPage.astro` — read from `substance.characteristics`
- `IonDetailsProvider.tsx` — read charge from `ion.characteristics['concept:ion_charge'].value`

- [ ] **Step 4: Migrate task engine**

In `solvers.ts` and `generators.ts`:
- Replace `getCharacteristicValue(charsBySubject.get('el:'+sym), conceptId)` with `getEntityCharValue(el.characteristics, conceptId)`
- Elements and ions are already in OntologyData.core — they now have characteristics on them

- [ ] **Step 5: Migrate AcidStrengthScale**

Replace `loadCharacteristics()` + filter by concept:pKa with:
```typescript
const substances = await loadSubstancesIndex(locale);
const acidsWithPka = substances
  .filter(s => s.characteristics?.['concept:pKa'])
  .map(s => {
    const pkaEntry = s.characteristics!['concept:pKa'];
    const pka = Array.isArray(pkaEntry) ? pkaEntry[0].value : pkaEntry.value;
    return { ...s, pka: pka as number };
  })
  .sort((a, b) => a.pka - b.pka);
```

- [ ] **Step 6: Remove loadCharacteristics() from exercise-adapters.ts**

OntologyData.rules.characteristics no longer needed — data is on entities.

- [ ] **Step 7: Run tests**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git commit -m "refactor: migrate all consumers from separate characteristics to entity.characteristics"
```

---

## Task 5: Update build pipeline

**Files:**
- Modify: `scripts/build-data.mjs` — validate on-entity characteristics instead of separate files
- Modify: `scripts/lib/validate-characteristics.mjs` — rewrite for on-entity format
- Modify: `scripts/lib/generate-manifest.mjs` — remove characteristics entrypoint

- [ ] **Step 1: Rewrite validation**

`validateCharacteristics` now receives entities (elements, ions, substances) and checks:
- Each `characteristics` entry has valid concept_id format (`concept:*`)
- Each entry has a `value` field
- `value` type matches expected (number for numeric concepts)
- No orphan concept references (optional — warn only)

- [ ] **Step 2: Update build-data.mjs**

- Remove: loading from `data-src/characteristics/` directory
- Remove: writing `rules/characteristics.json` to bundle
- Add: validate characteristics on each entity (elements, ions, substances) during existing validation
- The characteristics data is now part of each entity's JSON file, so it gets bundled automatically when entities are bundled

- [ ] **Step 3: Remove characteristics from manifest**

In `generate-manifest.mjs`, remove `characteristics: 'rules/characteristics.json'` from rules.

- [ ] **Step 4: Verify**

Run: `npm run validate:data && npm run build:data`

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(build): validate on-entity characteristics, remove separate bundle"
```

---

## Task 6: Clean up — remove separate characteristics layer

**Files:**
- Delete: `data-src/characteristics/` directory (5 files)
- Delete: `scripts/lib/generate-characteristics.mjs`
- Modify: `src/lib/characteristics-utils.ts` — remove old TypedCharacteristic-based functions (keep only EntityCharacteristics helpers)
- Modify: `src/lib/data-loader.ts` — remove `loadCharacteristics()`
- Modify: `src/lib/task-engine/types.ts` — remove `characteristics?` from OntologyRules
- Modify: `src/types/characteristic.ts` — remove `TypedCharacteristic` type (keep `CharacteristicEntry`, `EntityCharacteristics`)
- Update: `src/lib/__tests__/characteristics-utils.test.ts` — remove old tests, keep new ones

- [ ] **Step 1: Delete files**

```bash
rm -rf data-src/characteristics/
rm scripts/lib/generate-characteristics.mjs
```

- [ ] **Step 2: Clean up types and utils**

Remove `TypedCharacteristic` type, old indexing functions. Keep `CharacteristicEntry`, `EntityCharacteristics`, `getEntityCharValue`, `getEntityCharEntry`.

Remove `loadCharacteristics()` from data-loader.ts.
Remove `characteristics?` from OntologyRules in task engine types.

- [ ] **Step 3: Run all checks**

Run: `npm test && npm run validate:data && npm run build`
Expected: all pass

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor: remove separate characteristics layer (data lives on entities)"
```

---

## Task 7: Extend filter evaluator for nested characteristics access (optional)

**Files:**
- Modify: `src/lib/filter-evaluator.ts`
- Modify: `src/lib/__tests__/filter-evaluator.test.ts` (if exists)

This enables defining `cls:acid_strong` by pKa threshold instead of manual tags:
```json
"cls:acid_strong": {
  "filters": { "pred": { "field": "characteristics.concept:pKa.value", "lt": 0 } }
}
```

- [ ] **Step 1: Add nested field resolution**

In `evaluatePred`, replace `const val = entity[pred.field]` with:
```typescript
function resolveField(entity: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = entity;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  // If array (multi-step characteristics), take first entry
  if (Array.isArray(current)) current = current[0];
  return current;
}

const val = resolveField(entity, pred.field);
```

- [ ] **Step 2: Add tests for nested access**
- [ ] **Step 3: Run tests**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(filter): support nested field access for entity characteristics"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run all tests** — `npm test`
- [ ] **Step 2: Full build** — `npm run build`
- [ ] **Step 3: Visual verification** — `npm run preview`, check periodic table, element details, bonds, acids, calculations
- [ ] **Step 4: Update spec** — note in spec that approach changed from B (separate layer) to on-entity
