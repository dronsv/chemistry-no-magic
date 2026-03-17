# Characteristics Layer + Acids Ontology Enrichment — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a universal TypedCharacteristics layer, migrate all flat numeric fields from entities, add domain concepts for acids, OntEmbed block type, and acid-specific enrichment with pKa/Ka data.

**Architecture:** New `data-src/characteristics/` directory holds all typed property values. Build pipeline validates referential integrity. Existing loaders and task engine pre-load characteristics into a sync-accessible map. OntEmbed block type renders concepts in three modes (Ref/Def/Block) in theory modules.

**Tech Stack:** TypeScript (strict), JSON data files, Vitest tests, Astro/React components, Node.js build scripts

**Spec:** `docs/superpowers/specs/2026-03-17-characteristics-layer-and-acids-enrichment.md`

---

## Chunk 1: Characteristics Layer Foundation (non-breaking)

This chunk adds the type system, build pipeline, data loaders, and validation for characteristics WITHOUT removing flat fields yet. Characteristics data is generated from existing flat fields (additive).

---

### Task 1: TypedCharacteristic type definition

**Files:**
- Create: `src/types/characteristic.ts`

- [ ] **Step 1: Create the type file**

```typescript
// src/types/characteristic.ts

export type ValueSourceKind = 'asserted' | 'derived' | 'approximate';

export interface ConditionContext {
  solvent?: string;
  temperature_C?: number;
  pressure_kPa?: number;
  dissociation_step?: number;
  phase?: 'solid' | 'liquid' | 'gas' | 'aqueous';
}

export interface TypedCharacteristic {
  id: string;
  characteristic_concept_id: string;
  subject_id: string;
  value_kind: 'number' | 'string' | 'boolean' | 'enum';
  value: number | string | boolean;
  unit?: string | null;
  conditions?: ConditionContext;
  source?: {
    kind: ValueSourceKind;
    ref?: string;
    derived_from?: string[];
  };
  explanation_concept_id?: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors related to characteristic.ts

- [ ] **Step 3: Commit**

```bash
git add src/types/characteristic.ts
git commit -m "feat(types): add TypedCharacteristic type for characteristics layer"
```

---

### Task 2: Generate characteristics data from existing flat fields

**Files:**
- Create: `scripts/lib/generate-characteristics.mjs`
- Create: `data-src/characteristics/element_properties.json` (generated)
- Create: `data-src/characteristics/substance_properties.json` (generated)
- Create: `data-src/characteristics/ion_properties.json` (generated)
- Create: `data-src/characteristics/thermochemical.json` (generated)

This script reads existing flat fields from elements/substances/ions/calculations and generates TypedCharacteristic records. Run once to bootstrap, then data-src/characteristics/ becomes the source of truth.

- [ ] **Step 1: Write the generator script**

```javascript
// scripts/lib/generate-characteristics.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_SRC = join(__dirname, '..', '..', 'data-src');
const CHAR_DIR = join(DATA_SRC, 'characteristics');

async function loadJson(path) {
  return JSON.parse(await readFile(path, 'utf-8'));
}

function makeChar(id, conceptId, subjectId, value, unit = null, conditions = undefined, explanationConceptId = undefined) {
  const rec = {
    id,
    characteristic_concept_id: conceptId,
    subject_id: subjectId,
    value_kind: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string',
    value,
    source: { kind: 'asserted' },
  };
  if (unit) rec.unit = unit;
  if (conditions) rec.conditions = conditions;
  if (explanationConceptId) rec.explanation_concept_id = explanationConceptId;
  return rec;
}

async function generateElementProperties() {
  const elements = await loadJson(join(DATA_SRC, 'elements.json'));
  const chars = [];
  for (const el of elements) {
    const sym = el.symbol;
    const sid = `el:${sym}`;
    if (el.atomic_mass != null)
      chars.push(makeChar(`char:${sym}_atomic_mass`, 'concept:atomic_mass', sid, el.atomic_mass, 'unit:u'));
    if (el.electronegativity != null)
      chars.push(makeChar(`char:${sym}_electronegativity`, 'concept:electronegativity', sid, el.electronegativity, null, null, 'concept:electronegativity'));
    if (el.melting_point_C != null)
      chars.push(makeChar(`char:${sym}_melting_point`, 'concept:melting_point', sid, el.melting_point_C, 'unit:celsius'));
    if (el.boiling_point_C != null)
      chars.push(makeChar(`char:${sym}_boiling_point`, 'concept:boiling_point', sid, el.boiling_point_C, 'unit:celsius'));
    if (el.density_g_cm3 != null)
      chars.push(makeChar(`char:${sym}_density`, 'concept:density', sid, el.density_g_cm3, 'unit:g_per_cm3'));
  }
  return chars;
}

async function generateSubstanceProperties() {
  const { readdir } = await import('node:fs/promises');
  const subDir = join(DATA_SRC, 'substances');
  const files = (await readdir(subDir)).filter(f => f.endsWith('.json') && f !== 'substance_properties.json');
  const chars = [];
  for (const f of files) {
    const sub = await loadJson(join(subDir, f));
    if (!sub.id) continue;
    const sid = sub.id.startsWith('sub:') ? sub.id : `sub:${sub.id}`;
    const shortId = sub.id.replace(/^sub:/, '');
    if (sub.melting_point_C != null)
      chars.push(makeChar(`char:${shortId}_melting_point`, 'concept:melting_point', sid, sub.melting_point_C, 'unit:celsius'));
    if (sub.boiling_point_C != null)
      chars.push(makeChar(`char:${shortId}_boiling_point`, 'concept:boiling_point', sid, sub.boiling_point_C, 'unit:celsius'));
    if (sub.density_g_cm3 != null)
      chars.push(makeChar(`char:${shortId}_density`, 'concept:density', sid, sub.density_g_cm3, 'unit:g_per_cm3'));
  }
  return chars;
}

async function generateIonProperties() {
  const ions = await loadJson(join(DATA_SRC, 'ions.json'));
  return ions.map(ion => makeChar(
    `char:${ion.id.replace('ion:', '')}_charge`,
    'concept:ion_charge',
    ion.id,
    ion.charge,
    'unit:elementary_charge',
  ));
}

async function generateThermochemical() {
  const calcData = await loadJson(join(DATA_SRC, 'rules', 'calculations_data.json'));
  const chars = [];
  for (const sub of calcData.substances || []) {
    const formula = sub.formula.replace(/[₂₃₄₅₆₇₈₉]/g, '').replace(/\s/g, '_').toLowerCase();
    const sid = `sub:${formula}`;
    if (sub.M != null)
      chars.push(makeChar(`char:${formula}_molar_mass`, 'concept:molar_mass', sid, sub.M, 'unit:g_per_mol'));
    if (sub.delta_Hf_kJmol != null)
      chars.push(makeChar(`char:${formula}_enthalpy_f`, 'concept:enthalpy_of_formation', sid, sub.delta_Hf_kJmol, 'unit:kJ_per_mol'));
    if (sub.S_JmolK != null)
      chars.push(makeChar(`char:${formula}_entropy`, 'concept:standard_entropy', sid, sub.S_JmolK, 'unit:J_per_mol_K'));
  }
  return chars;
}

async function main() {
  await mkdir(CHAR_DIR, { recursive: true });

  const elementProps = await generateElementProperties();
  await writeFile(join(CHAR_DIR, 'element_properties.json'), JSON.stringify(elementProps, null, 2));
  console.log(`element_properties.json: ${elementProps.length} records`);

  const substanceProps = await generateSubstanceProperties();
  await writeFile(join(CHAR_DIR, 'substance_properties.json'), JSON.stringify(substanceProps, null, 2));
  console.log(`substance_properties.json: ${substanceProps.length} records`);

  const ionProps = await generateIonProperties();
  await writeFile(join(CHAR_DIR, 'ion_properties.json'), JSON.stringify(ionProps, null, 2));
  console.log(`ion_properties.json: ${ionProps.length} records`);

  const thermoProps = await generateThermochemical();
  await writeFile(join(CHAR_DIR, 'thermochemical.json'), JSON.stringify(thermoProps, null, 2));
  console.log(`thermochemical.json: ${thermoProps.length} records`);

  const total = elementProps.length + substanceProps.length + ionProps.length + thermoProps.length;
  console.log(`\nTotal: ${total} characteristics generated`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run the generator**

Run: `node scripts/lib/generate-characteristics.mjs`
Expected: Creates 4 JSON files in `data-src/characteristics/`, prints record counts (~930 total)

- [ ] **Step 3: Verify generated data**

Spot-check: `data-src/characteristics/element_properties.json` should have records like:
```json
{ "id": "char:Na_electronegativity", "characteristic_concept_id": "concept:electronegativity", "subject_id": "el:Na", "value_kind": "number", "value": 0.93 }
```

Spot-check: `data-src/characteristics/ion_properties.json` should have records like:
```json
{ "id": "char:H_plus_charge", "characteristic_concept_id": "concept:ion_charge", "subject_id": "ion:H_plus", "value_kind": "number", "value": 1, "unit": "unit:elementary_charge" }
```

- [ ] **Step 4: Commit**

```bash
git add scripts/lib/generate-characteristics.mjs data-src/characteristics/
git commit -m "data: generate characteristics from existing flat fields (~930 records)"
```

---

### Task 3: Build pipeline — load, validate, and bundle characteristics

**Files:**
- Modify: `scripts/build-data.mjs` — add characteristics loading and bundling
- Modify: `scripts/lib/generate-manifest.mjs` — add characteristics entrypoint
- Create: `scripts/lib/validate-characteristics.mjs` — integrity validation

- [ ] **Step 1: Write validation function**

Create `scripts/lib/validate-characteristics.mjs`:

```javascript
// scripts/lib/validate-characteristics.mjs

/**
 * Validate characteristics referential integrity.
 * @param {Array} characteristics - all TypedCharacteristic records
 * @param {Set<string>} validSubjectIds - set of el:*, sub:*, ion:* IDs
 * @param {Set<string>} validConceptIds - set of concept IDs from concepts.json
 * @returns {string[]} array of error messages
 */
export function validateCharacteristics(characteristics, validSubjectIds, validConceptIds) {
  const errors = [];
  const seenIds = new Set();

  for (const c of characteristics) {
    // Duplicate ID check
    if (seenIds.has(c.id)) {
      errors.push(`Duplicate characteristic ID: ${c.id}`);
    }
    seenIds.add(c.id);

    // Required fields
    if (!c.id) errors.push(`Characteristic missing id`);
    if (!c.characteristic_concept_id) errors.push(`${c.id}: missing characteristic_concept_id`);
    if (!c.subject_id) errors.push(`${c.id}: missing subject_id`);
    if (c.value == null) errors.push(`${c.id}: missing value`);

    // Referential integrity
    if (c.subject_id && !validSubjectIds.has(c.subject_id)) {
      errors.push(`${c.id}: subject_id "${c.subject_id}" not found in elements/substances/ions`);
    }
    if (c.characteristic_concept_id && !validConceptIds.has(c.characteristic_concept_id)) {
      // Warn but don't error — concepts may be added in a later commit
      // For now, just validate format
      if (!c.characteristic_concept_id.startsWith('concept:')) {
        errors.push(`${c.id}: characteristic_concept_id "${c.characteristic_concept_id}" must start with "concept:"`);
      }
    }
    if (c.explanation_concept_id && !c.explanation_concept_id.startsWith('concept:')) {
      errors.push(`${c.id}: explanation_concept_id "${c.explanation_concept_id}" must start with "concept:"`);
    }

    // Value kind consistency
    if (c.value_kind === 'number' && typeof c.value !== 'number') {
      errors.push(`${c.id}: value_kind is "number" but value is ${typeof c.value}`);
    }
  }

  return errors;
}
```

- [ ] **Step 2: Add characteristics loading to build pipeline**

In `scripts/build-data.mjs`, add after the existing data loading section:

1. Import the validator at the top
2. Load all characteristics files from `data-src/characteristics/`
3. Validate them
4. Write to bundle

The exact modifications depend on the current file structure — read `scripts/build-data.mjs` to find the right insertion points:
- After loading other data sources (around line 280): load characteristics
- In the validation block (around line 350): validate characteristics
- In the output block (around line 500): write characteristics bundle

- [ ] **Step 3: Add characteristics to manifest**

In `scripts/lib/generate-manifest.mjs`, add in the `rules` object:
```javascript
characteristics: 'rules/characteristics.json',
```

- [ ] **Step 4: Run validate:data**

Run: `npm run validate:data`
Expected: passes (characteristics loaded and validated)

- [ ] **Step 5: Run build:data**

Run: `npm run build:data`
Expected: `public/data/{hash}/rules/characteristics.json` exists in the output bundle

- [ ] **Step 6: Commit**

```bash
git add scripts/build-data.mjs scripts/lib/generate-manifest.mjs scripts/lib/validate-characteristics.mjs
git commit -m "feat(build): add characteristics to build pipeline with integrity validation"
```

---

### Task 4: Data loader for characteristics

**Files:**
- Modify: `src/lib/data-loader.ts` — add loadCharacteristics(), loadCharacteristicsByConcept()
- Create: `src/lib/__tests__/characteristics-loader.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/lib/__tests__/characteristics-loader.test.ts
import { describe, it, expect } from 'vitest';
import type { TypedCharacteristic } from '../../types/characteristic';

// We'll test the indexing utility function, not the async loader (which needs fetch mock)
import { indexCharacteristicsBySubject, indexCharacteristicsByConcept } from '../characteristics-utils';

const sampleChars: TypedCharacteristic[] = [
  {
    id: 'char:Na_electronegativity',
    characteristic_concept_id: 'concept:electronegativity',
    subject_id: 'el:Na',
    value_kind: 'number',
    value: 0.93,
    source: { kind: 'asserted' },
  },
  {
    id: 'char:Na_atomic_mass',
    characteristic_concept_id: 'concept:atomic_mass',
    subject_id: 'el:Na',
    value_kind: 'number',
    value: 22.99,
    unit: 'unit:u',
    source: { kind: 'asserted' },
  },
  {
    id: 'char:Cl_electronegativity',
    characteristic_concept_id: 'concept:electronegativity',
    subject_id: 'el:Cl',
    value_kind: 'number',
    value: 3.16,
    source: { kind: 'asserted' },
  },
];

describe('indexCharacteristicsBySubject', () => {
  it('groups characteristics by subject_id', () => {
    const map = indexCharacteristicsBySubject(sampleChars);
    expect(map.get('el:Na')).toHaveLength(2);
    expect(map.get('el:Cl')).toHaveLength(1);
    expect(map.get('el:Fe')).toBeUndefined();
  });
});

describe('indexCharacteristicsByConcept', () => {
  it('groups characteristics by concept_id', () => {
    const map = indexCharacteristicsByConcept(sampleChars);
    expect(map.get('concept:electronegativity')).toHaveLength(2);
    expect(map.get('concept:atomic_mass')).toHaveLength(1);
  });
});

describe('getCharacteristicValue', () => {
  it('returns value for known subject+concept', () => {
    const map = indexCharacteristicsBySubject(sampleChars);
    const naChars = map.get('el:Na') ?? [];
    const en = naChars.find(c => c.characteristic_concept_id === 'concept:electronegativity');
    expect(en?.value).toBe(0.93);
  });

  it('returns undefined for unknown subject', () => {
    const map = indexCharacteristicsBySubject(sampleChars);
    expect(map.get('el:Fe')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/characteristics-loader.test.ts`
Expected: FAIL — `characteristics-utils` module not found

- [ ] **Step 3: Create the utility module**

```typescript
// src/lib/characteristics-utils.ts
import type { TypedCharacteristic } from '../types/characteristic';

export function indexCharacteristicsBySubject(
  chars: TypedCharacteristic[],
): Map<string, TypedCharacteristic[]> {
  const map = new Map<string, TypedCharacteristic[]>();
  for (const c of chars) {
    const list = map.get(c.subject_id);
    if (list) list.push(c);
    else map.set(c.subject_id, [c]);
  }
  return map;
}

export function indexCharacteristicsByConcept(
  chars: TypedCharacteristic[],
): Map<string, TypedCharacteristic[]> {
  const map = new Map<string, TypedCharacteristic[]>();
  for (const c of chars) {
    const list = map.get(c.characteristic_concept_id);
    if (list) list.push(c);
    else map.set(c.characteristic_concept_id, [c]);
  }
  return map;
}

export function getCharacteristicValue(
  subjectChars: TypedCharacteristic[] | undefined,
  conceptId: string,
  step?: number,
): number | string | boolean | undefined {
  if (!subjectChars) return undefined;
  const match = subjectChars.find(c =>
    c.characteristic_concept_id === conceptId &&
    (step == null || c.conditions?.dissociation_step === step)
  );
  return match?.value;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/characteristics-loader.test.ts`
Expected: PASS (3 test suites)

- [ ] **Step 5: Add async loaders to data-loader.ts**

In `src/lib/data-loader.ts`, add:

```typescript
import type { TypedCharacteristic } from '../types/characteristic';

export async function loadCharacteristics(): Promise<TypedCharacteristic[]> {
  return loadRule('characteristics') as Promise<TypedCharacteristic[]>;
}
```

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: all tests pass (1234+)

- [ ] **Step 7: Commit**

```bash
git add src/types/characteristic.ts src/lib/characteristics-utils.ts src/lib/__tests__/characteristics-loader.test.ts src/lib/data-loader.ts
git commit -m "feat(data): add characteristics loader and indexing utilities"
```

---

### Task 5: Wire characteristics into OntologyData for task engine

**Files:**
- Modify: `src/lib/task-engine/types.ts` — add characteristics to OntologyData
- Modify: `src/lib/task-engine/index.ts` or wherever OntologyData is populated — load characteristics at init

- [ ] **Step 1: Extend OntologyData type**

In `src/lib/task-engine/types.ts`, add to `OntologyRules`:

```typescript
import type { TypedCharacteristic } from '../../types/characteristic';

// In OntologyRules interface:
characteristics?: TypedCharacteristic[];
```

- [ ] **Step 2: Find where OntologyData is populated and add characteristics loading**

Read `src/features/competency/exercise-adapters.ts` (or wherever `loadEngineAdapter` builds OntologyData) and add:

```typescript
const characteristics = await loadCharacteristics();
// Add to ontologyData.rules:
rules: { ...existingRules, characteristics },
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/task-engine/types.ts src/features/competency/exercise-adapters.ts
git commit -m "feat(engine): wire characteristics into OntologyData"
```

---

## Chunk 2: Domain Concepts + OntEmbed

This chunk adds new domain concepts, reaction types, relations, and the OntEmbed block type with renderers.

---

### Task 6: Add `domain_concept` to ConceptKind + new concepts

**Files:**
- Modify: `src/types/ontology-ref.ts` — add `'domain_concept'` to ConceptKind
- Modify: `data-src/concepts.json` — add ~23 new concepts
- Modify: `data-src/translations/{ru,en,pl,es}/concepts.json` — locale overlays for all new concepts

- [ ] **Step 1: Update ConceptKind type**

In `src/types/ontology-ref.ts`, find the `ConceptKind` type and add `'domain_concept'`:

```typescript
export type ConceptKind =
  | 'substance_class' | 'element_group' | 'reaction_type'
  | 'reaction_facet' | 'process' | 'property'
  | 'domain_concept';
```

- [ ] **Step 2: Add new concepts to concepts.json**

Add to `data-src/concepts.json`:

**Property domain concepts** (for characteristics layer):
```json
"concept:atomic_mass": { "kind": "domain_concept", "parent_id": null, "order": 100, "filters": {}, "examples": [] },
"concept:electronegativity": { "kind": "domain_concept", "parent_id": null, "order": 101, "filters": {}, "examples": [] },
"concept:melting_point": { "kind": "domain_concept", "parent_id": null, "order": 102, "filters": {}, "examples": [] },
"concept:boiling_point": { "kind": "domain_concept", "parent_id": null, "order": 103, "filters": {}, "examples": [] },
"concept:density": { "kind": "domain_concept", "parent_id": null, "order": 104, "filters": {}, "examples": [] },
"concept:ion_charge": { "kind": "domain_concept", "parent_id": null, "order": 105, "filters": {}, "examples": [] },
"concept:molar_mass": { "kind": "domain_concept", "parent_id": null, "order": 106, "filters": {}, "examples": [] },
"concept:enthalpy_of_formation": { "kind": "domain_concept", "parent_id": null, "order": 107, "filters": {}, "examples": [] },
"concept:standard_entropy": { "kind": "domain_concept", "parent_id": null, "order": 108, "filters": {}, "examples": [] }
```

**Acid-specific domain concepts:**
```json
"concept:pKa": { "kind": "domain_concept", "parent_id": null, "order": 110, "filters": {}, "examples": [] },
"concept:acid_dissociation_constant": { "kind": "domain_concept", "parent_id": null, "order": 111, "filters": {}, "examples": [] },
"concept:acid_strength": { "kind": "domain_concept", "parent_id": null, "order": 112, "filters": {}, "examples": [] },
"concept:acid_basicity": { "kind": "domain_concept", "parent_id": null, "order": 113, "filters": {}, "examples": [] },
"concept:acid_dissociation": { "kind": "domain_concept", "parent_id": null, "order": 114, "filters": {}, "examples": [] },
"concept:conjugate_base": { "kind": "domain_concept", "parent_id": null, "order": 115, "filters": {}, "examples": [] },
"concept:acid_residue": { "kind": "domain_concept", "parent_id": null, "order": 116, "filters": {}, "examples": [] },
"concept:indicator": { "kind": "domain_concept", "parent_id": null, "order": 117, "filters": {}, "examples": [] },
"concept:bond_strength": { "kind": "domain_concept", "parent_id": null, "order": 118, "filters": {}, "examples": [] }
```

**Substance class concepts:**
```json
"cls:acid_strong": {
  "kind": "substance_class", "parent_id": "cls:acid", "order": 3,
  "filters": { "all": [{ "pred": { "field": "class", "eq": "acid" } }, { "pred": { "field": "tags", "has": "strong_acid" } }] },
  "examples": [{ "kind": "substance", "id": "hcl" }, { "kind": "substance", "id": "h2so4" }, { "kind": "substance", "id": "hno3" }]
},
"cls:acid_weak": {
  "kind": "substance_class", "parent_id": "cls:acid", "order": 4,
  "filters": { "all": [{ "pred": { "field": "class", "eq": "acid" } }, { "pred": { "field": "tags", "has": "weak_acid" } }] },
  "examples": [{ "kind": "substance", "id": "hf" }, { "kind": "substance", "id": "h2co3" }, { "kind": "substance", "id": "ch3cooh" }]
}
```

Update `cls:acid.children_order`: `["cls:acid_oxygen", "cls:acid_oxygenfree", "cls:acid_strong", "cls:acid_weak"]`

**Reaction type concepts:**
```json
"rxtype:acid_metal": {
  "kind": "reaction_type", "parent_id": null, "order": 20,
  "filters": { "pred": { "field": "type_tags", "has": "acid_metal" } },
  "examples": [{ "kind": "reaction", "id": "rx_redox_01_zn_hcl" }]
},
"rxtype:acid_base_oxide": {
  "kind": "reaction_type", "parent_id": null, "order": 21,
  "filters": { "pred": { "field": "type_tags", "has": "acid_base_oxide" } },
  "examples": [{ "kind": "reaction", "id": "rx_exchange_03_cao_hcl" }]
},
"rxtype:acid_carbonate": {
  "kind": "reaction_type", "parent_id": null, "order": 22,
  "filters": { "pred": { "field": "type_tags", "has": "acid_carbonate" } },
  "examples": [{ "kind": "reaction", "id": "rx_carbonate_01_caco3_hcl" }]
}
```

- [ ] **Step 3: Add locale overlays for all new concepts (atomically with children_order changes)**

Each locale file gets entries for all new concepts. Example for Russian (`data-src/translations/ru/concepts.json`):

```json
"concept:atomic_mass": { "name": "Атомная масса", "slug": "атомная-масса", "description": "Масса атома, выраженная в атомных единицах массы (а.е.м.)" },
"concept:electronegativity": { "name": "Электроотрицательность", "slug": "электроотрицательность", "description": "Способность атома притягивать электронную плотность в химической связи" },
"concept:pKa": { "name": "pKa", "slug": "pka", "description": "Отрицательный десятичный логарифм константы кислотной диссоциации Ka" },
"concept:acid_strength": { "name": "Сила кислоты", "slug": "сила-кислоты", "description": "Способность кислоты отдавать протон, определяемая константой диссоциации Ka" },
"cls:acid_strong": { "name": "Сильные кислоты", "slug": "сильные", "description": "Кислоты, полностью диссоциирующие в водном растворе (pKa < 0)" },
"cls:acid_weak": { "name": "Слабые кислоты", "slug": "слабые", "description": "Кислоты, частично диссоциирующие в водном растворе (pKa > 0)" },
"rxtype:acid_metal": { "name": "Кислота + металл", "slug": "кислота-металл", "description": "Реакция кислоты с металлом, стоящим до водорода в ряду активности" },
```

(Similarly for en, pl, es — the plan executor will need to write all 4 locale files with appropriate translations.)

- [ ] **Step 4: Add type_tags to existing reactions**

In `data-src/reactions/reactions.json`, add `type_tags` to acid-related reactions:
- `rx_redox_01_zn_hcl`, `rx_redox_02_fe_h2so4`, `rx_redox_03_mg_hcl` → add `"acid_metal"` to type_tags
- `rx_exchange_03_cao_hcl`, `rx_exchange_01_cuo_hcl` → add `"acid_base_oxide"` to type_tags
- `rx_carbonate_01_caco3_hcl`, `rx_carbonate_02_na2co3_h2so4` → add `"acid_carbonate"` to type_tags

- [ ] **Step 5: Add acid concept relations**

Create `data-src/relations/acid_concept_relations.json` with the 13 triples from the spec.

- [ ] **Step 6: Validate**

Run: `npm run validate:data`
Expected: passes

- [ ] **Step 7: Run tests**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add src/types/ontology-ref.ts data-src/concepts.json data-src/translations/ data-src/reactions/ data-src/relations/acid_concept_relations.json
git commit -m "feat(ontology): add domain concepts, acid classes, reaction types, and relations"
```

---

### Task 7: OntEmbed block type + renderers

**Files:**
- Modify: `src/types/theory-module.ts` — add `ont_embed` to TheoryBlock union
- Modify: `src/components/TheoryModulePanel.tsx` — render `ont_embed` blocks
- Modify: `src/features/concepts/ConceptModuleIsland.tsx` — render `ont_embed` in extraBlocks

- [ ] **Step 1: Add ont_embed to TheoryBlock type**

In `src/types/theory-module.ts`, add to the TheoryBlock union:

```typescript
  // Embedded ontology concept
  | { t: 'ont_embed'; concept_id: string; mode: 'OntRef' | 'OntDef' | 'OntBlock';
      didactic_level?: 'basic' | 'core' | 'advanced';
      include?: { examples?: boolean; characteristics?: boolean; rabbit_hole?: boolean } }
```

- [ ] **Step 2: Add ont_embed overlay support in TheoryModulePanel.tsx**

In `applyTheoryModuleOverlay`, add before the `return block` fallback:

```typescript
        if (block.t === 'ont_embed') {
          return block; // ont_embed blocks are language-neutral, no overlay needed
        }
```

- [ ] **Step 3: Add ont_embed rendering in TheoryModulePanel.tsx**

In the `renderBlock` function, add a case for `ont_embed`:

```typescript
      case 'ont_embed':
        return <OntEmbedBlock key={idx} block={block} locale={locale} />;
```

Create a simple `OntEmbedBlock` component within TheoryModulePanel.tsx (or as a separate file) that:
- For `OntRef` mode: renders `<ConceptRef>` chip
- For `OntDef` mode: renders a card with name + description from concept overlay
- For `OntBlock` mode: renders full block with definition, examples, and characteristics

The exact implementation will depend on the available imports and existing component patterns. Start with a minimal version that renders `OntRef` and `OntDef`, then extend to `OntBlock` in Task 11 (Acids Enrichment).

- [ ] **Step 4: Update renderSimpleBlock in ConceptModuleIsland.tsx**

Add `ont_embed` case to the `renderSimpleBlock` function:

```typescript
    case 'ont_embed':
      // Delegate to the same OntEmbedBlock component used in TheoryModulePanel
      return <OntEmbedBlock block={block} locale={locale} />;
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/types/theory-module.ts src/components/TheoryModulePanel.tsx src/features/concepts/ConceptModuleIsland.tsx
git commit -m "feat(theory): add OntEmbed block type with Ref/Def/Block rendering modes"
```

---

## Chunk 3: Flat Field Migration

This chunk removes flat numeric fields from entities and updates all consumers to use the characteristics layer. This is the breaking-change chunk.

---

### Task 8: Update properties.json with concept_ref

**Files:**
- Modify: `data-src/rules/properties.json` — add `concept_ref` to existing entries, add new entries

- [ ] **Step 1: Update existing entries**

Add `concept_ref` to each existing property:
- `electronegativity` → `"concept_ref": "concept:electronegativity"`
- `atomic_mass` → `"concept_ref": "concept:atomic_mass"`
- `melting_point` → `"concept_ref": "concept:melting_point"`
- `boiling_point` → `"concept_ref": "concept:boiling_point"`
- `density` → `"concept_ref": "concept:density"`

Add new entries for pKa, Ka, molar_mass, enthalpy_of_formation, standard_entropy, ion_charge (as specified in the spec).

- [ ] **Step 2: Validate**

Run: `npm run validate:data`
Expected: passes

- [ ] **Step 3: Commit**

```bash
git add data-src/rules/properties.json
git commit -m "data: add concept_ref to properties registry, add pKa/Ka/molar_mass entries"
```

---

### Task 9: Migrate task engine to use characteristics

**Files:**
- Modify: `src/lib/task-engine/solvers.ts` — replace `getElementValue()` with characteristics lookup
- Modify: `src/lib/task-engine/generators.ts` — replace flat field reads
- Modify: `src/features/competency/exercise-adapters.ts` — pre-load characteristics into OntologyData

This is the most complex task. The executor should:

1. Read `solvers.ts` to find all `el.atomic_mass`, `el.electronegativity`, etc. references
2. Read `generators.ts` to find all flat field reads on elements/substances
3. Replace each with `getCharacteristicValue()` from the pre-loaded characteristics map
4. Ensure OntologyData.rules.characteristics is populated at init

The exact code changes depend on current call patterns — the executor must read each file and make targeted replacements.

- [ ] **Step 1: Update exercise-adapters.ts to pre-load characteristics**
- [ ] **Step 2: Update solvers.ts — replace flat field reads with characteristics**
- [ ] **Step 3: Update generators.ts — replace flat field reads with characteristics**
- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all tests pass (existing tests use mock data, so they may need mock characteristics added)

- [ ] **Step 5: Commit**

```bash
git add src/lib/task-engine/ src/features/competency/exercise-adapters.ts
git commit -m "refactor(engine): migrate task engine to characteristics layer"
```

---

### Task 10: Migrate remaining consumers

**Files:**
- Modify: `src/lib/bond-calculator.ts` — callers provide electronegativity from characteristics
- Modify: `src/lib/derive-quantity.ts` — resolvers use characteristics
- Modify: periodic table components — load from characteristics
- Modify: element detail components — load from characteristics
- Modify: substance card components — load from characteristics
- Modify: calculations components — load M and thermo from characteristics
- Modify: `src/components/IonDetailsProvider.tsx` — load charge from characteristics

The executor should search for all references to removed fields:
```bash
grep -rn 'atomic_mass\|electronegativity\|melting_point_C\|boiling_point_C\|density_g_cm3\|\.charge\b\|\.M\b\|delta_Hf\|S_JmolK' src/
```

And migrate each to load from characteristics.

- [ ] **Step 1: Migrate bond-calculator.ts callers**
- [ ] **Step 2: Migrate derive-quantity.ts resolvers**
- [ ] **Step 3: Migrate periodic table components**
- [ ] **Step 4: Migrate element detail components**
- [ ] **Step 5: Migrate substance/calculation components**
- [ ] **Step 6: Migrate IonDetailsProvider**
- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add src/
git commit -m "refactor: migrate all consumers from flat fields to characteristics layer"
```

---

### Task 11: Remove flat fields from entities

**Files:**
- Modify: `data-src/elements.json` — remove 5 flat numeric fields
- Modify: `data-src/substances/*.json` — remove 3 flat numeric fields (80 files)
- Modify: `data-src/ions.json` — remove `charge`
- Modify: `data-src/rules/calculations_data.json` — remove `M`, `delta_Hf_kJmol`, `S_JmolK`
- Modify: `src/types/element.ts` — remove fields from Element type
- Modify: `src/types/substance.ts` — remove fields from Substance type
- Modify: `src/types/ion.ts` — remove `charge` from Ion type
- Modify: `src/types/calculations.ts` — remove `M`, thermo fields from CalcSubstance type

Write a migration script to strip the fields from the JSON files.

- [ ] **Step 1: Write field-removal script**

```javascript
// scripts/lib/strip-flat-fields.mjs
// Strips migrated flat fields from entity JSON files
```

- [ ] **Step 2: Run the script**
- [ ] **Step 3: Update TypeScript types**
- [ ] **Step 4: Run validate:data**
- [ ] **Step 5: Run npm test**
- [ ] **Step 6: Run npm run build**

Expected: full build succeeds with no type errors and all tests pass

- [ ] **Step 7: Commit**

```bash
git add data-src/ src/types/
git commit -m "refactor: remove flat numeric fields from entities (migrated to characteristics)"
```

---

## Chunk 4: Acids Enrichment

This chunk adds acid-specific pKa/Ka data, the AcidStrengthScale component, CharacteristicValue component, and wires the acids section in the theory module.

---

### Task 12: Add pKa/Ka characteristics for acids

**Files:**
- Create: `data-src/characteristics/acid_dissociation.json`

- [ ] **Step 1: Create acid dissociation characteristics**

Add pKa values for all 17 acids. For polyprotic acids, add one record per dissociation step:

```json
[
  { "id": "char:hcl_pka1", "characteristic_concept_id": "concept:pKa", "subject_id": "sub:hcl", "value_kind": "number", "value": -7, "conditions": { "dissociation_step": 1, "solvent": "water", "temperature_C": 25 }, "source": { "kind": "asserted" }, "explanation_concept_id": "concept:acid_dissociation_constant" },
  { "id": "char:hbr_pka1", "characteristic_concept_id": "concept:pKa", "subject_id": "sub:hbr", "value_kind": "number", "value": -9, "conditions": { "dissociation_step": 1 }, "source": { "kind": "asserted" }, "explanation_concept_id": "concept:acid_dissociation_constant" },
  { "id": "char:hi_pka1", "characteristic_concept_id": "concept:pKa", "subject_id": "sub:hi", "value_kind": "number", "value": -10, "conditions": { "dissociation_step": 1 }, "source": { "kind": "asserted" }, "explanation_concept_id": "concept:acid_dissociation_constant" },
  { "id": "char:h2so4_pka1", "characteristic_concept_id": "concept:pKa", "subject_id": "sub:h2so4", "value_kind": "number", "value": -3, "conditions": { "dissociation_step": 1 }, "source": { "kind": "asserted" }, "explanation_concept_id": "concept:acid_dissociation_constant" },
  { "id": "char:h2so4_pka2", "characteristic_concept_id": "concept:pKa", "subject_id": "sub:h2so4", "value_kind": "number", "value": 1.99, "conditions": { "dissociation_step": 2 }, "source": { "kind": "asserted" }, "explanation_concept_id": "concept:acid_dissociation_constant" },
  { "id": "char:hno3_pka1", "characteristic_concept_id": "concept:pKa", "subject_id": "sub:hno3", "value_kind": "number", "value": -1.4, "conditions": { "dissociation_step": 1 }, "source": { "kind": "asserted" }, "explanation_concept_id": "concept:acid_dissociation_constant" },
  { "id": "char:hclo4_pka1", "characteristic_concept_id": "concept:pKa", "subject_id": "sub:hclo4", "value_kind": "number", "value": -10, "conditions": { "dissociation_step": 1 }, "source": { "kind": "asserted" }, "explanation_concept_id": "concept:acid_dissociation_constant" },
  { "id": "char:hf_pka1", "characteristic_concept_id": "concept:pKa", "subject_id": "sub:hf", "value_kind": "number", "value": 3.17, "conditions": { "dissociation_step": 1, "solvent": "water", "temperature_C": 25 }, "source": { "kind": "asserted" }, "explanation_concept_id": "concept:acid_dissociation_constant" },
  { "id": "char:h2co3_pka1", "characteristic_concept_id": "concept:pKa", "subject_id": "sub:h2co3", "value_kind": "number", "value": 6.35, "conditions": { "dissociation_step": 1 }, "source": { "kind": "asserted" }, "explanation_concept_id": "concept:acid_dissociation_constant" },
  { "id": "char:h2co3_pka2", "characteristic_concept_id": "concept:pKa", "subject_id": "sub:h2co3", "value_kind": "number", "value": 10.33, "conditions": { "dissociation_step": 2 }, "source": { "kind": "asserted" }, "explanation_concept_id": "concept:acid_dissociation_constant" },
  { "id": "char:h2s_pka1", "characteristic_concept_id": "concept:pKa", "subject_id": "sub:h2s", "value_kind": "number", "value": 7.0, "conditions": { "dissociation_step": 1 }, "source": { "kind": "asserted" }, "explanation_concept_id": "concept:acid_dissociation_constant" },
  { "id": "char:h2s_pka2", "characteristic_concept_id": "concept:pKa", "subject_id": "sub:h2s", "value_kind": "number", "value": 14.0, "conditions": { "dissociation_step": 2 }, "source": { "kind": "asserted" }, "explanation_concept_id": "concept:acid_dissociation_constant" },
  { "id": "char:ch3cooh_pka1", "characteristic_concept_id": "concept:pKa", "subject_id": "sub:ch3cooh", "value_kind": "number", "value": 4.76, "conditions": { "dissociation_step": 1, "solvent": "water", "temperature_C": 25 }, "source": { "kind": "asserted" }, "explanation_concept_id": "concept:acid_dissociation_constant" },
  { "id": "char:hno2_pka1", "characteristic_concept_id": "concept:pKa", "subject_id": "sub:hno2", "value_kind": "number", "value": 3.3, "conditions": { "dissociation_step": 1 }, "source": { "kind": "asserted" }, "explanation_concept_id": "concept:acid_dissociation_constant" },
  { "id": "char:h2so3_pka1", "characteristic_concept_id": "concept:pKa", "subject_id": "sub:h2so3", "value_kind": "number", "value": 1.81, "conditions": { "dissociation_step": 1 }, "source": { "kind": "asserted" }, "explanation_concept_id": "concept:acid_dissociation_constant" },
  { "id": "char:h2so3_pka2", "characteristic_concept_id": "concept:pKa", "subject_id": "sub:h2so3", "value_kind": "number", "value": 6.91, "conditions": { "dissociation_step": 2 }, "source": { "kind": "asserted" }, "explanation_concept_id": "concept:acid_dissociation_constant" },
  { "id": "char:h2sio3_pka1", "characteristic_concept_id": "concept:pKa", "subject_id": "sub:h2sio3", "value_kind": "number", "value": 9.9, "conditions": { "dissociation_step": 1 }, "source": { "kind": "asserted" }, "explanation_concept_id": "concept:acid_dissociation_constant" },
  { "id": "char:hclo_pka1", "characteristic_concept_id": "concept:pKa", "subject_id": "sub:hclo", "value_kind": "number", "value": 7.53, "conditions": { "dissociation_step": 1 }, "source": { "kind": "asserted" }, "explanation_concept_id": "concept:acid_dissociation_constant" }
]
```

- [ ] **Step 2: Validate**

Run: `npm run validate:data`
Expected: passes

- [ ] **Step 3: Commit**

```bash
git add data-src/characteristics/acid_dissociation.json
git commit -m "data(acids): add pKa characteristics for 17 acids (~20 records)"
```

---

### Task 13: CharacteristicValue and AcidStrengthScale components

**Files:**
- Create: `src/components/CharacteristicValue.tsx`
- Create: `src/components/AcidStrengthScale.tsx`

- [ ] **Step 1: Create CharacteristicValue component**

A simple component that renders: `[concept name] = value unit (conditions)`

```typescript
// src/components/CharacteristicValue.tsx
import type { TypedCharacteristic } from '../types/characteristic';
import ConceptRef from './ConceptRef';

interface Props {
  characteristic: TypedCharacteristic;
  locale: string;
}

export default function CharacteristicValue({ characteristic, locale }: Props) {
  // Render: [ConceptRef chip] = value unit (conditions)
  // The exact rendering depends on the concept overlay for the name
  // and the conditions formatting
}
```

- [ ] **Step 2: Create AcidStrengthScale component**

A horizontal scale showing acids sorted by pKa with FormulaChip for each:

```typescript
// src/components/AcidStrengthScale.tsx
import type { TypedCharacteristic } from '../types/characteristic';
import FormulaChip from './FormulaChip';

interface Props {
  pkaCharacteristics: TypedCharacteristic[];
  locale: string;
}

export default function AcidStrengthScale({ pkaCharacteristics, locale }: Props) {
  // Sort by pKa value
  // Split into strong (pKa < 0) and weak (pKa > 0)
  // Render FormulaChip for each substance with pKa label below
}
```

- [ ] **Step 3: Run tests and build**

Run: `npm test && npm run build`
Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add src/components/CharacteristicValue.tsx src/components/AcidStrengthScale.tsx
git commit -m "feat(components): add CharacteristicValue and AcidStrengthScale"
```

---

### Task 14: Wire acids section in theory module

**Files:**
- Modify: `data-src/theory_modules/classification_inorganic.json` — add blocks to acids section

- [ ] **Step 1: Update acids section blocks**

Add concept_card blocks for `cls:acid_strong` and `cls:acid_weak`, plus ont_embed blocks for acid concepts (as specified in the spec Section 3).

NOTE: OntEmbed renderer must already be deployed (Task 7) before this JSON change.

- [ ] **Step 2: Validate and build**

Run: `npm run build`
Expected: full build succeeds

- [ ] **Step 3: Commit**

```bash
git add data-src/theory_modules/classification_inorganic.json
git commit -m "feat(acids): wire acid concept cards and OntEmbed blocks in theory module"
```

---

### Task 15: Final verification

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: build succeeds, all pages generated

- [ ] **Step 3: Visual verification**

Run: `npm run preview`

Check:
1. `/substances/кислоты/` — acid page shows strong/weak subcategories, OntEmbed blocks
2. `/en/substances/acids/` — English version
3. Periodic table still works (element properties load from characteristics)
4. Calculations page still works (molar mass from characteristics)
5. Element detail pages show properties

- [ ] **Step 4: E2E tests**

Run: `npm run test:e2e`
Expected: all 33 tests pass
