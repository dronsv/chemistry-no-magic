# Characteristics Layer + Acids Ontology Enrichment

**Date:** 2026-03-17
**Status:** Approved
**Approach:** B — clean Characteristics layer (separate `data-src/characteristics/`)

## Goal

Introduce a universal **Typed Characteristics** layer that replaces all flat numeric fields on entities (elements, substances, ions, calc data) with ontologically typed records. Each record links to a domain concept, carries conditions and provenance. Use this layer to enrich the acids topic with pKa/Ka data, new domain concepts, reaction types, OntEmbed block type, and integrity validation.

## Architecture

### 4 Layers

1. **Domain Layer** — concepts, substances, reactions, relations (`data-src/concepts.json`, `data-src/relations/`)
2. **Characteristics Layer** — typed property values on entities (`data-src/characteristics/`)
3. **Embedding Layer** — `OntEmbed` block type in theory modules (OntRef / OntDef / OntBlock)
4. **Integrity Layer** — build-time validation of referential integrity across all layers

### Design Principles

- **Ontology discovery heuristic**: If a noun/entity/category appears in text, it must be found in or added to the ontology
- **Explainability policy**: Every displayed characteristic must be typed, linked to its concept, and explainable
- **No mute numbers**: A value without concept ref, unit, and conditions is a build error
- **Single source of truth**: Characteristic values live only in `data-src/characteristics/`, never as flat fields on entities

## 1. Domain Concepts

### New `kind: "domain_concept"` in `data-src/concepts.json`

Property concepts (migrated from flat fields):
```
concept:atomic_mass
concept:electronegativity
concept:melting_point
concept:boiling_point
concept:density
concept:ion_charge
concept:molar_mass
concept:enthalpy_of_formation
concept:standard_entropy
```

Acid-specific concepts:
```
concept:pKa
concept:acid_dissociation_constant    (Ka)
concept:acid_strength
concept:acid_basicity
concept:acid_dissociation
concept:conjugate_base
concept:acid_residue
concept:indicator
concept:bond_strength                 (H–A bond)
```

### New substance_class concepts

```
cls:acid_strong    parent_id: cls:acid    filter: { pred: { field: "tags", has: "strong_acid" } }
cls:acid_weak      parent_id: cls:acid    filter: { pred: { field: "tags", has: "weak_acid" } }
```

`cls:acid.children_order` updated: `["cls:acid_oxygen", "cls:acid_oxygenfree", "cls:acid_strong", "cls:acid_weak"]`

### New reaction_type concepts

```
rxtype:acid_metal          filter: { pred: { field: "type_tags", has: "acid_metal" } }
rxtype:acid_base_oxide     filter: { pred: { field: "type_tags", has: "acid_base_oxide" } }
rxtype:acid_carbonate      filter: { pred: { field: "type_tags", has: "acid_carbonate" } }
```

Existing reactions get additional `type_tags`:
- `rx_redox_01_zn_hcl`, `rx_redox_02_fe_h2so4`, `rx_redox_03_mg_hcl` → add `"acid_metal"`
- `rx_exchange_03_cao_hcl`, `rx_exchange_01_cuo_hcl` → add `"acid_base_oxide"`
- `rx_carbonate_01_caco3_hcl`, `rx_carbonate_02_na2co3_h2so4` → add `"acid_carbonate"`

### Locale overlays

All new concepts get entries in `data-src/translations/{ru,en,pl,es}/concepts.json` with `name`, `slug`, `description`, `surface_forms`.

## 2. Characteristics Layer

### Directory structure

```
data-src/characteristics/
  element_properties.json       — 118 elements × 5 properties = ~590 records
  substance_properties.json     — 80 substances × 3 properties = ~240 records
  ion_properties.json           — 31 ions × charge = ~31 records
  thermochemical.json           — 24 calc substances × 3 properties = ~72 records
  acid_dissociation.json        — 17 acids × pKa/Ka × steps = ~30 records
```

Total: ~960 TypedCharacteristic records.

### TypedCharacteristic schema

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
  characteristic_concept_id: string;   // → concept in concepts.json
  subject_id: string;                  // → element/substance/ion ID
  value_kind: 'number' | 'string' | 'boolean' | 'enum';
  value: number | string | boolean;
  unit?: string;                       // → unit from quantities_units_ontology.json
  conditions?: ConditionContext;
  source?: {
    kind: ValueSourceKind;
    ref?: string;
    derived_from?: string[];
  };
  explanation_concept_id?: string;     // → concept that explains this characteristic
}
```

### Example records

```json
{
  "id": "char:Na_electronegativity",
  "characteristic_concept_id": "concept:electronegativity",
  "subject_id": "el:Na",
  "value_kind": "number",
  "value": 0.93,
  "source": { "kind": "asserted" },
  "explanation_concept_id": "concept:electronegativity"
}

{
  "id": "char:h2so4_pka1",
  "characteristic_concept_id": "concept:pKa",
  "subject_id": "sub:h2so4",
  "value_kind": "number",
  "value": -3,
  "conditions": { "dissociation_step": 1, "solvent": "water", "temperature_C": 25 },
  "source": { "kind": "asserted" },
  "explanation_concept_id": "concept:acid_dissociation_constant"
}

{
  "id": "char:h2so4_pka2",
  "characteristic_concept_id": "concept:pKa",
  "subject_id": "sub:h2so4",
  "value_kind": "number",
  "value": 1.99,
  "conditions": { "dissociation_step": 2, "solvent": "water", "temperature_C": 25 },
  "source": { "kind": "asserted" },
  "explanation_concept_id": "concept:acid_dissociation_constant"
}
```

### Flat field removal

After migration, these fields are **removed** from source entities:

| Source file | Removed fields |
|---|---|
| `data-src/elements.json` | `atomic_mass`, `electronegativity`, `melting_point_C`, `boiling_point_C`, `density_g_cm3` |
| `data-src/substances/*.json` | `melting_point_C`, `boiling_point_C`, `density_g_cm3` |
| `data-src/ions.json` | `charge` |
| `data-src/rules/calculations_data.json` | `M`, `delta_Hf_kJmol`, `S_JmolK` |

Corresponding TypeScript types are updated to remove these fields. All code reading them switches to `loadCharacteristics()`.

### Subject ID conventions

- Elements: `el:{symbol}` (e.g., `el:Na`, `el:Cl`)
- Substances: `sub:{id}` (e.g., `sub:hcl`, `sub:h2so4`)
- Ions: `ion:{id}` (e.g., `ion:H_plus`, `ion:SO4_2minus`)

## 3. OntEmbed Block Type

### Type definition

Added to `src/types/theory-module.ts`:

```typescript
| { t: 'ont_embed';
    concept_id: string;
    mode: 'OntRef' | 'OntDef' | 'OntBlock';
    didactic_level?: 'basic' | 'core' | 'advanced';
    include?: {
      examples?: boolean;
      characteristics?: boolean;
      rabbit_hole?: boolean;
    };
  }
```

### Rendering modes

- **OntRef** — inline `<ConceptRef>` chip (already exists). Single line.
- **OntDef** — card: name + description from overlay + example FormulaChips. 3-5 lines.
- **OntBlock** — full block: definition + examples + characteristics from Characteristics layer + child concepts + reaction type refs. Rabbit hole links.

### Acids section in `classification_inorganic.json`

```json
{
  "id": "acids",
  "title_ref": "cls:acid",
  "blocks": [
    { "t": "concept_card", "conceptId": "cls:acid_oxygen", "examples": { "mode": "filter" } },
    { "t": "concept_card", "conceptId": "cls:acid_oxygenfree", "examples": { "mode": "filter" } },
    { "t": "concept_card", "conceptId": "cls:acid_strong", "examples": { "mode": "filter" } },
    { "t": "concept_card", "conceptId": "cls:acid_weak", "examples": { "mode": "filter" } },
    { "t": "ont_embed", "concept_id": "concept:acid_strength", "mode": "OntBlock",
      "include": { "characteristics": true, "examples": true } },
    { "t": "ont_embed", "concept_id": "concept:acid_basicity", "mode": "OntDef",
      "include": { "examples": true } },
    { "t": "ont_embed", "concept_id": "concept:indicator", "mode": "OntDef",
      "include": { "characteristics": true } },
    { "t": "ont_embed", "concept_id": "concept:acid_dissociation_constant", "mode": "OntBlock",
      "include": { "characteristics": true, "rabbit_hole": true } }
  ]
}
```

## 4. Relations

### New file: `data-src/relations/acid_concept_relations.json`

```json
[
  { "subject": "cls:acid", "predicate": "described_by", "object": "concept:acid_strength" },
  { "subject": "cls:acid", "predicate": "has_property", "object": "concept:acid_basicity" },
  { "subject": "cls:acid", "predicate": "participates_in", "object": "concept:acid_dissociation" },
  { "subject": "concept:acid_dissociation", "predicate": "described_by", "object": "concept:acid_dissociation_constant" },
  { "subject": "concept:acid_dissociation_constant", "predicate": "related_to", "object": "concept:pKa" },
  { "subject": "concept:acid_strength", "predicate": "depends_on", "object": "concept:bond_strength" },
  { "subject": "concept:acid_strength", "predicate": "depends_on", "object": "concept:conjugate_base" },
  { "subject": "cls:acid", "predicate": "reacts_via", "object": "rxtype:acid_metal" },
  { "subject": "cls:acid", "predicate": "reacts_via", "object": "rxtype:acid_base_oxide" },
  { "subject": "cls:acid", "predicate": "reacts_via", "object": "rxtype:acid_carbonate" },
  { "subject": "cls:acid", "predicate": "reacts_via", "object": "rxtype:neutralization" },
  { "subject": "cls:acid", "predicate": "forms", "object": "concept:acid_residue" },
  { "subject": "cls:acid", "predicate": "detected_by", "object": "concept:indicator" }
]
```

## 5. Properties Registry (extension)

`data-src/rules/properties.json` gets new fields on existing entries and new entries:

New fields on every entry:
- `concept_ref` — links to domain concept (e.g., `"concept:electronegativity"`)
- `explanation_concept_ref` — optional, for characteristics that need deeper explanation

New entries:
```json
{ "id": "pKa", "object": "substance", "unit": null,
  "concept_ref": "concept:pKa",
  "explanation_concept_ref": "concept:acid_dissociation_constant",
  "conditions_schema": ["dissociation_step", "solvent", "temperature_C"] },
{ "id": "Ka", "object": "substance", "unit": null,
  "concept_ref": "concept:acid_dissociation_constant",
  "conditions_schema": ["dissociation_step", "solvent", "temperature_C"] },
{ "id": "molar_mass", "object": "substance", "unit": "g/mol",
  "concept_ref": "concept:molar_mass" },
{ "id": "enthalpy_of_formation", "object": "substance", "unit": "kJ/mol",
  "concept_ref": "concept:enthalpy_of_formation" },
{ "id": "standard_entropy", "object": "substance", "unit": "J/(mol·K)",
  "concept_ref": "concept:standard_entropy" },
{ "id": "ion_charge", "object": "ion", "unit": null,
  "concept_ref": "concept:ion_charge" }
```

## 6. Integrity Validation (build-time)

### Errors (block build)

| Check | Description |
|---|---|
| `characteristic.subject_id` not found in elements/substances/ions | Orphan characteristic |
| `characteristic.characteristic_concept_id` not found in concepts.json | Missing concept |
| `characteristic.explanation_concept_id` not found in concepts.json | Missing explanation concept |
| Ka `derived_from` pKa but `value ≠ 10^(-pKa)` within tolerance | Derived value inconsistency |
| Flat numeric field on entity after migration | Legacy field not migrated |
| `ont_embed.concept_id` not found in concepts.json | Invalid OntEmbed reference |
| Relation subject/object not found in concepts/substances/ions | Orphan relation |

### Warnings

| Check | Description |
|---|---|
| Concept in concepts.json has no characteristics referencing it | Unused concept |
| Substance tagged `strong_acid` but no `concept:pKa` characteristic | Missing coverage |
| `domain_concept` without locale overlay in any locale | Missing translation |

## 7. New Components

### `<CharacteristicValue>` (`src/components/CharacteristicValue.tsx`)

Renders a single typed characteristic:
```
[concept:pKa] = -7  (aq, 25°C, step 1)
```
- Concept name as ConceptRef link
- Value with unit
- Conditions in muted text
- Click concept → concept page (rabbit hole)

### `<AcidStrengthScale>` (`src/components/AcidStrengthScale.tsx`)

Horizontal scale visualization of acid strength by pKa:
```
HClO₄  HI  HBr  HCl  H₂SO₄  HNO₃  ┃  HF  HNO₂  CH₃COOH  H₂CO₃  H₂S
──────────── strong ──────────────── ┃ ──────────── weak ─────────────────
pKa: -10  -10  -9   -7    -3    -1   ┃  3.2  3.3    4.76     6.3    7.0
```
- Each formula is FormulaChip with substanceId (clickable)
- Boundary at pKa ≈ 0
- Data-driven from characteristics (sorted by pKa value)
- pKa label is ConceptRef link to `concept:pKa`

## 8. Data Loader Changes

### New loaders in `src/lib/data-loader.ts`

```typescript
/** Load all characteristics for a given subject */
export async function loadCharacteristics(subjectId: string): Promise<TypedCharacteristic[]>;

/** Load all subjects with a given characteristic concept */
export async function loadCharacteristicsByConcept(conceptId: string): Promise<TypedCharacteristic[]>;
```

### Updated existing loaders

All loaders that currently return entities with flat numeric fields must be updated:
- `loadElements()` — Element type loses numeric fields; consumers call `loadCharacteristics('el:Na')` separately
- `loadSubstancesIndex()` — Substance type loses numeric fields
- `loadIons()` — Ion type loses `charge`; consumers load from characteristics
- `loadCalculationsData()` — CalcSubstance loses `M`, thermo fields

### Caching strategy

Characteristics are loaded per-file (element_properties, substance_properties, etc.) and cached. Index by `subject_id` built client-side on first load.

## 9. Build Pipeline Changes

### `scripts/build-data.mjs`

1. Read `data-src/characteristics/*.json`
2. Validate all references (subject_id, concept_id, explanation_concept_id)
3. Validate derived values (Ka from pKa)
4. Check no legacy flat numeric fields remain on entities
5. Build subject-indexed bundle: `public/data/{hash}/characteristics.json`
6. Add `characteristics` to manifest entrypoints

### `src/types/manifest.ts`

Add `characteristics` to `ManifestEntrypoints`.

## 10. Consumer Migration (major affected areas)

| Consumer | Current | After |
|---|---|---|
| Periodic table (element cards) | reads `element.atomic_mass` | `loadCharacteristics('el:'+symbol)` → find `concept:atomic_mass` |
| Element detail page | reads flat fields | loads characteristics for element |
| Substance cards | reads `substance.density_g_cm3` etc. | loads characteristics for substance |
| Calculations page | reads `calcSubstance.M` | loads `concept:molar_mass` from characteristics |
| Task engine solvers | reads flat fields | loads characteristics |
| Task engine generators | reads flat fields for comparisons | loads `loadCharacteristicsByConcept()` |
| BKT/diagnostics | minimal impact | unchanged |

## 11. Reference Documents

The following specification packages inform this design:
- `docs/acid_topic_package.zip` — didactic specification, ontology map, embedding rules, explainability policy, authoring checklist
- `docs/acid_topic_formal_package.zip` — formal architecture, TypeScript types, JSON schema examples, inference notes, authoring rules

## 12. File Inventory

### New files
- `data-src/characteristics/element_properties.json`
- `data-src/characteristics/substance_properties.json`
- `data-src/characteristics/ion_properties.json`
- `data-src/characteristics/thermochemical.json`
- `data-src/characteristics/acid_dissociation.json`
- `data-src/relations/acid_concept_relations.json`
- `src/types/characteristic.ts`
- `src/components/CharacteristicValue.tsx`
- `src/components/CharacteristicValue.css`
- `src/components/AcidStrengthScale.tsx`
- `src/components/AcidStrengthScale.css`

### Modified files
- `data-src/concepts.json` — +18 domain concepts, +2 substance classes, +3 reaction types
- `data-src/translations/{ru,en,pl,es}/concepts.json` — overlays for all new concepts
- `data-src/elements.json` — remove 5 flat numeric fields
- `data-src/substances/*.json` — remove 3 flat numeric fields (80 files)
- `data-src/ions.json` — remove `charge` field
- `data-src/rules/calculations_data.json` — remove `M`, `delta_Hf_kJmol`, `S_JmolK`
- `data-src/rules/properties.json` — add `concept_ref`, new entries
- `data-src/reactions/reactions.json` — add type_tags to existing reactions
- `data-src/theory_modules/classification_inorganic.json` — acids section blocks
- `src/types/theory-module.ts` — add `ont_embed` block type
- `src/types/element.ts` — remove flat numeric fields
- `src/types/substance.ts` — remove flat numeric fields
- `src/types/ion.ts` — remove `charge`
- `src/types/calculations.ts` — remove `M`, thermo fields
- `src/types/manifest.ts` — add `characteristics` entrypoint
- `src/components/TheoryModulePanel.tsx` — render `ont_embed` blocks
- `src/features/concepts/ConceptModuleIsland.tsx` — render `ont_embed` in extraBlocks
- `src/lib/data-loader.ts` — add `loadCharacteristics()`, `loadCharacteristicsByConcept()`
- `scripts/build-data.mjs` — characteristics pipeline + integrity validation
- `scripts/lib/generate-manifest.mjs` — characteristics in manifest
- All consumers of flat numeric fields (periodic table, element detail, substance cards, calculations, task engine)
