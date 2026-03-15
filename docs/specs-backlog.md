# Specs Backlog

Unimplemented or partially implemented architectural specifications.

*Last updated: 2026-03-15*

---

## 1. Linguistic Morphology — Coverage Expansion

**Status:** Core implemented; coverage gaps remain

### Implemented
- `src/lib/decline.ts` — rule-based Russian declension (10 noun classes)
- `resolveForm()` — 3-step fallback (explicit → rule-based → lemma)
- `data-src/translations/ru/morphology.json` — 43 elements + 8 properties + directions
- `data-src/translations/pl/morphology.json` — 4 elements + substance_classes + process_vocab + element_groups (7 cases)
- `data-src/translations/es/morphology.json` — 4 elements + substance_classes + process_vocab + element_groups (gender/article)
- `loadMorphology(locale)` — locale-aware loader
- Task engine `slot-resolver.ts` uses `resolveForm()` for grammatical inflection in prompts

### Remaining
- PL: 114 elements missing (× 7 cases each)
- ES: 114 elements missing
- Optional: rule-based generator for coverage expansion (avoid manual data entry)
- `frame` block type defined in `TheoryBlock` but no renderer built

---

## 2. Decomposition + Drivers Layer

**Status:** Not implemented

### Concept
Decomposition as a **process type** (`proc:decomposition`) with drivers (thermal, electro, photo, chemical). A **process rule** binds (process + driver + applicability) → product pattern + examples.

### Why
- Template-based translations: `{{class:*}}`, `{{sub:*}}`, `{{cond:*}}`
- Task generator can ask: "what is the condition?", "complete products", "which equation?"
- Genetic chains can annotate arrows with conditions

### Data schema (proposed)
```json
{ "id": "proc:decomposition", "drivers": ["driver:thermal", "driver:electro", "driver:photo", "driver:chemical"] }
{ "id": "driver:thermal", "condition_token": "cond:heat" }
{ "id": "rule:kclo3_decomposition", "process": "proc:decomposition", "driver": "driver:thermal", "applicability": "sub:KClO3", "products_pattern": "sub:KCl + O2" }
```

---

## 3. Relations Layer — Full Graph

**Status:** Partially implemented

### Implemented
- `acid_base_relations.json` — 40 triples (acid↔base↔salt↔oxide)
- `ion_roles.json` — 26 triples (ion↔role in reactions)
- `loadRelations<T>(key)` in data-loader.ts

### Remaining
- Full predicate vocabulary (≤20 predicates: `is_instance_of`, `has_component`, `has_allotrope`, `has_surface_layer`, `reacts_with`, etc.)
- Build-time inverse edge derivation
- Graph traversal helpers in `src/lib/relations.ts`
- Task generator `pick_by_relation` using predicate constraints

---

## 4. Aggregate States — Remaining Items

**Status:** Partially implemented (2026-03-04)

### Implemented
- `phase_standard` on Substance; 21 files annotated
- Thermodynamic fields on CalcSubstance/CalcReaction
- Phase markers ↑/↓ in ReactionCards.tsx
- `solver.heat_of_reaction` + `gen.pick_thermo_reaction` + template

### Remaining
- ΔG/ΔS calculation tasks (EGE-level, needs more thermodynamic data)
- Per-participant phase overrides in reaction display

---

## 5. Task Content Model v2 (RichTextDoc + Layout + AnswerSchema)

**Status:** Not implemented

### Model
- **`blocks: RichTextDoc[]`** — editable content fragments with stable `blockId`
- **`layout: TaskNode[]`** — declarative screen assembly (`render`, `mcq`, `input`, `reveal`)
- **`answer: AnswerSchema`** — formal validation (MCQ, numeric, formula, matching, ordering)

### Why
- Single renderer: theory + tasks share same RichTextRenderer + OntologyRef stack
- i18n: translate `blocks` only; `layout` + `answer` are locale-neutral
- Generation: generator returns AST + answer + trace, no string template

---
