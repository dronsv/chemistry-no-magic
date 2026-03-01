# OntologyRef — Ontological Navigation System Design

**Date:** 2026-03-01
**Status:** Approved
**Context:** ADR-012 (OntologyRef Architecture), Linguistic Morphology Spec v1

---

## 1. Goal

Add a universal concept navigation layer to the chemistry platform. Users clicking "щелочные металлы" in theory text navigate to a concept page listing alkali metals with examples. Task engine generates grammatically correct sentences referencing ontology concepts across 4 locales.

---

## 2. Core Decisions

### 2.1 FormulaChip and OntologyRef are siblings

| Component | Responsibility | Renders |
|-----------|---------------|---------|
| **FormulaChip** | Formula typography (charge, stoichiometry, subscripts) | Substance/ion/element formulas |
| **OntologyRef** | Ontology navigation (class, group, reaction type, process, rule) | Concept terms as colored links |

They can reference each other in details (FormulaChip tooltip shows OntologyRef for class; OntologyRef card shows FormulaChip examples) but are not wrappers.

### 2.2 Concept pages at hierarchical URLs

Sub-paths under existing feature routes, not a flat `/concepts/`:

| Domain | Max depth | Example |
|--------|-----------|---------|
| Substance classes | 2-3 | `/substances/bases/insoluble/` |
| Element groups | 1-2 | `/periodic-table/alkali-metals/` |
| Reaction types | 1-2 | `/reactions/neutralization/` |
| Processes | 1-2 | `/processes/decomposition/heat/` |
| Properties | 1 | `/properties/electronegativity/` |

Hard cap: 3 segments after feature root.

### 2.3 Engine returns RichText AST (Variant 2.5)

Engine produces structured segments without resolving locale/morphology. UI resolves display text from overlays.

- Engine knows **what** to insert (ref + grammar tags)
- UI knows **how** to render (forms/name/tooltip/link)

### 2.4 All locales in overlays (including Russian)

Base data is structural only. All localized text (name, slug, surface_forms, grammatical forms) lives in per-locale overlay files. No `_ru` fields in the concept registry.

---

## 3. Data Layer

### 3.1 Concept Registry (`data-src/concepts.json`)

Structural data only — no text, no locale-specific content:

```json
{
  "cls:base": {
    "kind": "substance_class",
    "parent_id": null,
    "order": 1,
    "filters": { "class": "base" },
    "examples": [
      { "kind": "substance", "id": "naoh" },
      { "kind": "substance", "id": "koh" }
    ],
    "children_order": ["cls:base_alkali", "cls:base_insoluble", "cls:base_amphoteric"]
  },
  "cls:base_insoluble": {
    "kind": "substance_class",
    "parent_id": "cls:base",
    "order": 2,
    "filters": { "class": "base", "has_property": ["insoluble_in_water"] },
    "examples": [
      { "kind": "substance", "id": "fe_oh_3" },
      { "kind": "substance", "id": "cu_oh_2" }
    ]
  },
  "grp:alkali_metals": {
    "kind": "element_group",
    "parent_id": null,
    "order": 1,
    "filters": { "group_name": "alkali_metals" },
    "examples": [
      { "kind": "element", "id": "Li" },
      { "kind": "element", "id": "Na" },
      { "kind": "element", "id": "K" }
    ]
  },
  "rxtype:neutralization": {
    "kind": "reaction_type",
    "parent_id": null,
    "order": 1,
    "filters": { "reaction_type": "neutralization" },
    "examples": [
      { "kind": "reaction", "id": "rx_neutr_01" }
    ]
  }
}
```

**Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `kind` | `substance_class \| element_group \| reaction_type \| process \| property` | yes | Determines route template and color |
| `parent_id` | `string \| null` | yes | Hierarchy (builds breadcrumbs + nested URLs) |
| `order` | `number` | yes | Stable UI ordering among siblings |
| `filters` | `object` | yes | Query params for catalog filtering |
| `filters.has_property` | `string[]` | no | Property-based filtering (replaces subclass) |
| `examples` | `OntRef[]` | yes | Typed references for preview FormulaChips |
| `children_order` | `string[]` | no | Explicit child ordering |

**Reserved for Phase 2 (documented in schema, not in data):**

| Field | Type | Description |
|-------|------|-------------|
| `competency_tags` | `string[]` | Links to mastery model |
| `scope` | `string[]` | Exam-specific filtering (`["oge", "ege", "gcse"]`) |

### 3.2 OntRef — Typed Entity Reference

Two formats, one resolution:

| Context | Format | Example |
|---------|--------|---------|
| Typed object (JSON, TypeScript) | `{ kind, id }` | `{ "kind": "substance", "id": "naoh" }` |
| String reference (markup, URLs) | `kind:id` | `sub:naoh`, `el:Na`, `ion:Na_plus` |

Prefixes: `el:`, `sub:`, `ion:`, `rx:`, `cls:`, `grp:`, `rxtype:`, `proc:`, `prop:`, `ctx:`

```ts
type OntRefKind = 'element' | 'substance' | 'ion' | 'reaction'
  | 'substance_class' | 'element_group' | 'reaction_type'
  | 'process' | 'property' | 'context';

interface OntRef {
  kind: OntRefKind;
  id: string;
}

function parseOntRef(str: string): OntRef;   // "sub:naoh" → { kind: "substance", id: "naoh" }
function toOntRefStr(ref: OntRef): string;    // { kind: "substance", id: "naoh" } → "sub:naoh"
```

### 3.3 Locale Overlays (`translations/{locale}/concepts.json`)

All 4 locales including Russian:

```json
{
  "cls:base": {
    "name": "Основания",
    "slug": "основания",
    "surface_forms": ["основание", "основания", "оснований"],
    "forms": {
      "nom_pl": "Основания",
      "gen_pl": "оснований",
      "dat_pl": "основаниям",
      "ins_pl": "основаниями",
      "prep_pl": "об основаниях"
    }
  },
  "grp:alkali_metals": {
    "name": "Щелочные металлы",
    "slug": "щелочные-металлы",
    "surface_forms": ["щелочной металл", "щелочные металлы", "щелочных металлов"],
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

**Overlay schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | yes | Display name (nominative) |
| `slug` | `string` | yes | URL segment (locale-specific) |
| `surface_forms` | `string[]` | no | Text forms for auto-detection matching |
| `forms` | `Record<string, string>` | no | Grammatical forms for template rendering |

**Grammar tags (Russian):** `nom_sg`, `gen_sg`, `dat_sg`, `acc_sg`, `ins_sg`, `prep_sg`, `nom_pl`, `gen_pl`, `dat_pl`, `acc_pl`, `ins_pl`, `prep_pl`.

For English/Spanish: `forms` is omitted (no grammatical cases). `name` suffices.
For Polish: `forms` uses same case tags (7 cases).

**Build-time optimization:** If `surface_forms` is not set, auto-generate from `forms` values.

### 3.4 Route Config

Single source for URL patterns by concept kind:

```ts
// src/lib/i18n.ts
const CONCEPT_KIND_ROUTES: Record<string, string> = {
  substance_class: '/substances/{slug}/',
  element_group:   '/periodic-table/{slug}/',
  reaction_type:   '/reactions/{slug}/',
  process:         '/processes/{slug}/',
  property:        '/properties/{slug}/',
};
```

Route builder: `conceptId → overlay[locale].slug → CONCEPT_KIND_ROUTES[kind]` → `localizeUrl()`.

For hierarchical concepts: walk `parent_id` chain, concatenate slugs.
Example: `cls:base_insoluble` → parent `cls:base` (slug: "bases") + self (slug: "insoluble") → `/substances/bases/insoluble/`.

### 3.5 Build Pipeline

`concept_lookup.{locale}.json` — generated at build time for text auto-detection:

```json
{
  "щёлочь": "cls:base_alkali",
  "щёлочи": "cls:base_alkali",
  "alkalis": "cls:base_alkali",
  "alkali metals": "grp:alkali_metals"
}
```

Source: all `surface_forms` from locale overlay + all `forms` values.
Strategy: longest match first, formula matches take priority over concept matches.

---

## 4. Component Layer

### 4.1 `<OntologyRef>` — Concept Navigation Component

```tsx
interface OntologyRefProps {
  id: string;                    // concept ID: "cls:base", "grp:alkali_metals"
  form?: string;                 // grammar tag: "gen_pl" → resolve from overlay.forms
  surface?: string;              // override display text (preserves original grammar)
  locale?: SupportedLocale;
}
```

**Label resolution order:**
1. `surface` is set → display = surface
2. `form` + `overlay.forms[form]` exists → display = overlay.forms[form]
3. fallback → display = overlay.name

**Rendering:**
- `display: inline`, subtle colored background + colored text (same technique as FormulaChip)
- Click → navigate to concept page
- Hover (desktop) → tooltip: name + 2-3 example FormulaChips

**Color by kind:**

| kind | Color | Rationale |
|------|-------|-----------|
| `substance_class` | Derived from `filters.class`: base=blue, acid=red, oxide=amber, salt=green | Matches FormulaChip palette |
| `element_group` | Neutral grey (`--color-bg-alt`) | Matches element chips |
| `reaction_type` | Violet (#7c3aed / #ede9fe) | New, distinct from substances |
| `process` | Teal (#0d9488 / #ccfbf1) | New |
| `property` | Slate (#475569 / #f1f5f9) | New |

### 4.2 `<SmartText>` — Unified Text Parser

Merges ChemText + OntologyText into one component:

```tsx
<SmartText text="NaOH — щёлочь" locale="ru" />
// NaOH → FormulaChip (from formula_lookup)
// щёлочь → OntologyRef (from concept_lookup)
```

Parsing strategy:
1. Build combined regex from formula_lookup + concept_lookup
2. Formulas have priority over concepts (NaOH is a formula, not a concept)
3. Longest match first (same as current ChemText)
4. Concept matches render as `<OntologyRef id={conceptId} surface={matchedText} />`

`surface` prop preserves the original grammatical form from text (e.g. "щелочных металлов" stays as-is, not replaced with nominative "Щелочные металлы").

### 4.3 `<RichTextRenderer>` — Engine Segment Renderer

```tsx
<RichTextRenderer segments={task.questionSegments} locale="ru" />
```

Maps `RichText` segments to React:
- `t:"text"` → `<SmartText text={v} />` (auto-detects formulas in plain text segments)
- `t:"ref"` → `<OntologyRef id={id} form={form} surface={surface} />`
- `t:"formula"` → `<FormulaChip formula={formula} ... />`
- `t:"em"` → `<em>` with recursive children
- `t:"strong"` → `<strong>` with recursive children
- `t:"br"` → `<br />`

### 4.4 ConceptProvider (Context)

```tsx
<ConceptProvider locale="ru">       {/* loads concepts.json + locale overlay */}
  <FormulaLookupProvider>            {/* existing */}
    <IonDetailsProvider locale="ru"> {/* existing */}
      {children}
    </IonDetailsProvider>
  </FormulaLookupProvider>
</ConceptProvider>
```

Loads concept registry + locale overlay once. All `<OntologyRef>` and `<SmartText>` read from context.

---

## 5. Engine Integration (Variant 2.5)

### 5.1 RichText AST Type

```ts
type TextSeg =
  | { t: "text"; v: string }
  | { t: "ref"; id: string; form?: string; surface?: string }
  | { t: "formula"; kind: "substance" | "ion" | "element"; id?: string; formula: string }
  | { t: "br" }
  | { t: "em"; children: RichText }
  | { t: "strong"; children: RichText };

type RichText = TextSeg[];
```

Key: `ref` segment carries concept ID + grammar tag but **not** resolved text. UI resolves from overlay.

### 5.2 SlotValue

```ts
type SlotValue = string | number | RichText | TextSeg;
```

Slot resolver returns SlotValue. RichTextComposer concatenates into final RichText.

### 5.3 Dual-Mode Renderer

```ts
// New (returns AST)
renderToRichText(template: string, ctx: Context): RichText

// Legacy (returns plain string, strips refs)
renderToString(template: string, ctx: Context): string

// Helper for legacy components
richTextToPlainString(rich: RichText): string
```

### 5.4 TemplateParser

Recognizes two token types in template strings:
- `{slot_name}` → resolved by SlotResolver (existing)
- `{ref:concept_id|form}` → parsed into `{ t: "ref", id, form }` segment

### 5.5 Pipeline

```
Template string
  ↓ TemplateParser
      {ref:grp:alkali_metals|gen_pl} → { t: "ref", id: "grp:alkali_metals", form: "gen_pl" }
      {substance_formula}            → SlotResolver → SlotValue
  ↓ RichTextComposer (concatenation → RichText)
  ↓ UI: <RichTextRenderer segments={rich} locale="ru" />
```

### 5.6 Testing Strategy

- **Engine tests**: Verify AST structure — correct segment types, ref IDs, form tags
- **UI tests**: Verify form resolution from overlay — correct display text per locale
- **Integration tests**: Full pipeline template → AST → rendered HTML

---

## 6. Concept Pages

### 6.1 Page Generation

Static Astro pages generated from concepts.json at build time:

```
src/pages/substances/[...slug].astro     → substance_class concepts
src/pages/periodic-table/[...slug].astro → element_group concepts
src/pages/reactions/[...slug].astro      → reaction_type concepts
src/pages/processes/[...slug].astro      → process concepts
src/pages/properties/[slug].astro        → property concepts
```

Localized variants under `src/pages/{en,es,pl}/`.

### 6.2 Page Content

1. **Name** + **breadcrumbs** (from `parent_id` chain via OntologyRef)
2. **Description** (from overlay, Phase 2 — initially auto-generated from filters)
3. **Examples** (FormulaChips from `examples` array)
4. **Children** (OntologyRefs from `children_order`)
5. **Filtered catalog link** ("Все основания →" linking to substances catalog with filters)
6. **SEO**: JSON-LD, hreflang via existing `getAlternateUrls()`

### 6.3 Breadcrumbs

Auto-generated from parent_id chain:

```
/substances/bases/insoluble/
→ Substances → Bases → Insoluble Bases
→ [home]     → [OntologyRef cls:base] → [OntologyRef cls:base_insoluble]
```

---

## 7. Implementation Phases

### Phase 0: Foundation
- Types: `OntRef`, `RichText`, `TextSeg`, `ConceptEntry`
- `parseOntRef()` / `toOntRefStr()` utility
- `data-src/concepts.json` — initial ~20 concepts (5 substance classes, 5 element groups, 5 reaction types, 5 properties)
- Locale overlays for all 4 locales (ru, en, es, pl) with name, slug, surface_forms, forms (ru/pl)
- Build pipeline: register concepts in manifest, generate `concept_lookup.{locale}.json`
- Data loader: `loadConcepts(locale?)`, `loadConceptLookup(locale)`
- `richTextToPlainString()` helper

### Phase 1: Components
- `<OntologyRef>` component + CSS
- `ConceptProvider` context
- `<SmartText>` — merged ChemText + concept detection
- `<RichTextRenderer>` for engine segments
- Concept pages (Astro) — static generation from registry

### Phase 2: Engine Integration
- `renderToRichText()` in prompt-renderer
- TemplateParser: `{ref:...}` token support
- RichTextComposer
- Pilot: 2-3 task templates with `{ref:...}` tokens
- Wire `<RichTextRenderer>` into task display components

### Phase 3: Migration
- Migrate remaining task templates to use `{ref:...}` where appropriate
- Replace ChemText with SmartText across theory panels
- Add concept descriptions to overlays
- Expand concept registry (target: ~50-100 concepts)
- Phase out heuristic formula parsing in favor of explicit segments

---

## 8. Key Files

| File | Action |
|------|--------|
| `src/types/ontology-ref.ts` | Create — OntRef, RichText, TextSeg, ConceptEntry types |
| `data-src/concepts.json` | Create — concept registry |
| `data-src/translations/{ru,en,es,pl}/concepts.json` | Create — locale overlays |
| `src/lib/ontology-ref.ts` | Create — parseOntRef, toOntRefStr, richTextToPlainString |
| `src/lib/data-loader.ts` | Modify — loadConcepts(), loadConceptLookup() |
| `src/components/OntologyRef.tsx` | Create — concept navigation component |
| `src/components/ontology-ref.css` | Create — kind-based colors |
| `src/components/ConceptProvider.tsx` | Create — context provider |
| `src/components/SmartText.tsx` | Create — unified formula + concept text parser |
| `src/components/RichTextRenderer.tsx` | Create — engine segment renderer |
| `src/lib/i18n.ts` | Modify — add CONCEPT_KIND_ROUTES |
| `src/lib/task-engine/prompt-renderer.ts` | Modify — renderToRichText() |
| `src/lib/task-engine/types.ts` | Modify — RichText, SlotValue types |
| `src/pages/substances/[...slug].astro` | Create — concept pages |
| `scripts/lib/generate-concept-lookup.mjs` | Create — build-time concept lookup |
| `scripts/build-data.mjs` | Modify — register concepts + concept_lookup |
