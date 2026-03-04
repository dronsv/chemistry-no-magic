# Specs Backlog

Pending architectural specifications — not yet implemented.
All source zip packages have been deleted after this document was created.

---

## 1. OntologyRef Universal Navigation Component

**Source:** ADR-012_OntologyRef_Architecture_Package.zip (2026-03-01)
**Status:** Proposed

### Problem
FormulaChip covers substances and ions, but the ontology now includes elements, reactions, processes, rules, contexts, allotropes, properties. No unified navigation component exists.

### Proposed Solution
```tsx
<OntologyRef ref={{ kind, id }} variant="chip|inline|card" />
```
Internal registry of specialized renderers:
- `ElementRefView`, `MatterRefView` (wraps FormulaChip), `ContextRefView`
- `ProcessRefView`, `RuleRefView`, `ReactionRefView`

### OntRef type
```ts
type OntRef =
  | { kind: "element"; id: string }
  | { kind: "substance"; id: string }
  | { kind: "ion"; id: string }
  | { kind: "variant"; id: string }
  | { kind: "context"; id: string }
  | { kind: "process"; id: string }
  | { kind: "rule"; id: string }
  | { kind: "reaction"; id: string }
  | { kind: "property"; id: string };
```

### Variants
| Variant | Purpose |
|---------|---------|
| chip | compact inline badge |
| inline | expanded inline block |
| card | popover / bottom sheet |

### Notes
- FormulaChip stays as leaf component inside MatterRefView
- Hover → tooltip/card preview; click → navigate to entity page
- Mobile: tap → bottom sheet with summary + related entities

---

## 2. Linguistic Morphology Layer

**Source:** linguistic_morphology_spec_v1_package.zip (2026-03-01)
**Status:** Seed data exists; renderer not built

### Goal
Deterministic grammatical inflection for RU (and other inflected locales) without neural models.

### Renderer API
```ts
renderRef(conceptId: string, { form?: string }): string
// Resolution: forms[form] → surface → canonical name
```

### Grammar tags (RU)
Singular: `nom_sg gen_sg dat_sg acc_sg ins_sg prep_sg`
Plural: `nom_pl gen_pl dat_pl acc_pl ins_pl prep_pl`

### Overlay format
```json
{
  "grp:alkali_metals": {
    "name": "Щелочные металлы",
    "slug": "щелочные-металлы",
    "forms": {
      "nom_pl": "Щелочные металлы",
      "gen_pl": "щелочных металлов",
      "dat_pl": "щелочным металлам",
      "ins_pl": "щелочными металлами",
      "prep_pl": "о щелочных металлах"
    }
  }
}
```

### Template usage
```
"Реакция {ref:grp:alkali_metals|gen_pl} с водой…"
```

### Current state
- `data-src/translations/ru/morphology.json` — 43 elements + 8 properties + directions
- `data-src/translations/pl/morphology.json` — 4 elements + 3 properties + directions + substance_classes + process_vocab + element_groups (all with 7 cases)
- `data-src/translations/es/morphology.json` — 4 elements + 3 properties + directions + substance_classes + process_vocab + element_groups (gender/article)
- `loadMorphology(locale)` — locale-aware, all locales supported
- `MorphEntry` — extended for PL (dat/acc/inst/loc/voc/animate) and ES (article_sg)
- `MorphologyData` — extended with optional substance_classes, process_vocab, element_groups sections
- PL `determine_oxidation_state` template uses genitive via `morph:elements.{element}.gen`
- Missing: element coverage for PL (114 remaining elements × 7 cases), ES (114 remaining elements)

### Phase plan
1. Manual forms for high-frequency concepts + missing-form logging
2. Optional rule-based generator for coverage expansion

---

## 3. Decomposition + Drivers Layer

**Source:** decomposition_drivers_layer_v1_package.zip (2026-02-26)
**Status:** Not implemented

### Concept
Decomposition is a **process type** (`proc:decomposition`).
The initiation mechanism (heat, current, light, reagent) is a **driver**.
A **process rule** binds (process + driver + applicability) → product pattern + examples.

```
proc:decomposition
  driver:thermal   → rule:kclo3_decomposition, rule:base_insoluble_decomposition
  driver:electro   → rule:water_electrolysis
  driver:photo     → ...
  driver:chemical  → ...
```

**Conditions** are UI-friendly tokens that reference drivers:
`cond:heat → driver:thermal`

### Why
- Template-based translations: `{{class:*}}`, `{{sub:*}}`, `{{cond:*}}`
- One process reused with different drivers
- Task generator can ask: "what is the condition?", "complete products", "which equation?"
- Genetic chains can annotate arrows with conditions

### Integration notes
- `class:base_insoluble` derivable from solubility table (already exists)
- `metal_oxide_of_base_cation` derivation needs formula module: `M(OH)n → MxOy + H₂O`
- Electrolysis → model electrolyte role via reaction layer roles (already have `reaction_roles.json`)

### Data schema (proposed)
```json
{
  "id": "proc:decomposition",
  "drivers": ["driver:thermal", "driver:electro", "driver:photo", "driver:chemical"]
}
```
```json
{
  "id": "driver:thermal",
  "label_ru": "нагревание",
  "condition_token": "cond:heat"
}
```
```json
{
  "id": "rule:kclo3_decomposition",
  "process": "proc:decomposition",
  "driver": "driver:thermal",
  "applicability": "sub:KClO3",
  "products_pattern": "sub:KCl + O2",
  "examples": ["2KClO₃ → 2KCl + 3O₂"]
}
```

---

## 4. Relations Layer (Typed Edges)

**Source:** relations_layer_v1_package.zip (2026-02-26)
**Status:** Not implemented

### Problem
Knowledge stored only "inside entities" makes it hard to:
- Search by relationship ("allotropes of carbon?")
- Generate tasks by pattern ("which metals passivate in air?")
- Link processes to consequences formally
- Maintain multilingual consistency (text like "покрывается оксидной плёнкой" is not queryable)

### Solution
Typed edges: `subject – predicate – object` + optional `conditions` + `evidence`.

### Core predicates (≤20 stable vocabulary)
**Taxonomy:** `is_instance_of`, `is_subclass_of`, `member_of_group`
**Composition/structure:** `has_component`, `has_allotrope` / `allotrope_of`
**Properties:** `has_property`, `has_numeric_property`
**Processes/reactions:** `participates_in_process`, `has_surface_layer`, `reacts_with`,
  `produces` / `produced_by`, `requires_condition`, `blocks_reaction_family`, `inhibits` / `inhibited_by`
**Context:** `phase_of`, `solution_of`, `mixture_of`, `melt_of`

### Key design principles
- Forward edges only; inverses (`produced_by`, `inhibited_by`, `has_member`) derived at build time
- Numeric properties preferred over pairwise comparisons (EN > EN computed, not stored)
- Conditions for context-dependent chemistry

### Example edge (passivation)
```json
{
  "subject": "sub:Al",
  "predicate": "has_surface_layer",
  "object": "sub:Al2O3",
  "conditions": { "environment": "air", "temperature": "ambient" },
  "evidence": ["proc:passivation", "rule:passivation.metals.in_air.v1"]
}
```

### Integration path
- Build: index inverse edges, expose as `/data/{hash}/relations.json`
- Loader: `loadRelations()` in data-loader.ts
- Query: graph traversal helpers in `src/lib/relations.ts`
- Task engine: new generator `pick_by_relation` using predicate + subject/object constraints

---

## 5. Language Frames (Ontology → Natural Language)

**Source:** ontology_language_frames_initial_package.zip (2026-03-03, newest)
**Status:** Block type defined; renderer not built

### Goal
Generate grammatically correct chemistry sentences from ontology objects
using language-neutral semantic frames + per-locale message catalogs.

### Current state
- `frame` block type exists in `src/types/theory-module.ts` (TheoryBlock union)
- No `FrameBlock` renderer in `TheoryModulePanel.tsx`

### Concept
A **frame** is a language-neutral semantic template:
```json
{
  "type": "frame",
  "frame_id": "subst_reacts_with_water",
  "slots": { "subject": "sub:Na", "product": "sub:NaOH" }
}
```
Per-locale catalog resolves `frame_id` to a localized sentence pattern with slot interpolation and morphological inflection (see spec #2 above).

### Integration path
1. Define `frame_catalog.{locale}.json` in `data-src/engine/`
2. Build: include in manifest under `engine.frame_catalogs`
3. Loader: `loadFrameCatalog(locale)` in data-loader.ts
4. Renderer: `FrameBlock` case in `TheoryModulePanel.tsx` → calls `renderRef()` (spec #2)
5. Depends on Linguistic Morphology Layer (spec #2) for inflection

---

## 6. Aggregate States + Phase Markers in Reactions

**Source:** phase_gas_precipitate_thermo_analysis.zip
**Status:** Partially implemented (2026-03-04)

**Implemented:**
- `phase_standard?: 'g'|'l'|'s'|'aq'` on `Substance` type; 21 substance files annotated
- `delta_Hf_kJmol?`, `S_JmolK?` on `CalcSubstance`; `delta_H_kJmol?` on `CalcReaction`
- Thermodynamic data for 14 substances and 5 reactions
- Phase markers ↑/↓ in ReactionCards.tsx Molecular tab
- `solver.heat_of_reaction` + `gen.pick_thermo_reaction` in task engine
- Task template `tmpl.calc.heat_of_reaction.v1` (EGE, numeric input, 4 locales)

**Deferred:**
- ΔG/ΔS calculation tasks (EGE-level, needs more data)
- Per-participant phase overrides in reaction display

### Problem
Reaction equations currently lack aggregate state markers (s/l/g/aq).
Gas evolution (↑) and precipitation (↓) markers are inconsistently used.
Without aggregate states, ΔS and ΔG calculations are impossible.

### Proposed additions

**Data: `phase` field on substances**
```json
[
  { "id": "sub:H2", "formula": "H₂", "phase": "g" },
  { "id": "sub:NaCl", "formula": "NaCl", "phase": "s" }
]
```
Standard states: `s` (solid), `l` (liquid), `g` (gas), `aq` (aqueous solution)

**Data: reaction participant phase overrides**
Some participants appear in different phases depending on context (e.g., water can be `l` or `g`).

**Data: thermodynamic data**
`ΔHf°`, `S°` per substance for ΔH/ΔS/ΔG calculation tasks.

**UI: phase markers in reaction display**
- `(g)` / `↑` for gas products
- `(s)` / `↓` for insoluble precipitates
- `(aq)` for dissolved ions

### Integration path
1. Add `phase: "s"|"l"|"g"|"aq"` to substance schema
2. Add `delta_Hf_kJ_mol` and `S_J_mol_K` fields to calc substances
3. Update reaction participant display to show phase markers
4. Add new task generators: identify gas/precipitate products, calculate ΔH/ΔS/ΔG

---

*Last updated: 2026-03-04*
