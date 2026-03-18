# Semantic Preview Layer

**Date:** 2026-03-18
**Status:** Approved

## Goal

Introduce a universal **Semantic Preview Layer** for all ontology references in the UI. Any OntRef-like entity — element, substance, ion, concept, formula variable — gets a consistent hover preview card with human-readable description, key facts, and navigation. Single resolver pipeline, single interactive component, single UX pattern.

## Non-Goals (v1)

- No relations graph traversal
- No editing from preview
- No didactic blocks in preview
- No reaction type previews (too broad for v1)
- No cross-entity comparative preview (one entity at a time)
- No support for all formula AST node types
- No inline preview expansion (always popup/sheet)
- No nested interactive refs inside preview facts (v1: plain display strings)

## Core Abstractions

### 1. OntRef

A reference to an ontology entity. `kind` is **derived from ref prefix** via registry, never stored independently.

```typescript
type OntRef = {
  ref: string;   // "ion:H_plus", "concept:pKa", "el:Na", "sub:hcl"
};
```

Kind resolution: `ref.split(':')[0]` → lookup in ref kind registry:
- `el:` → element
- `sub:` → substance
- `ion:` → ion
- `concept:` → domain_concept
- `cls:` → substance_class
- `rxtype:` → reaction_type
- `formula:` → formula

No separate `kind` field. No risk of desynchronization.

### 2. OntPreviewData

The normalized preview model. Strict limits.

```typescript
interface PreviewFact {
  label: string;       // human-readable, localized
  value: string;       // already formatted display text, non-interactive in v1
  unit?: string;       // display unit
}

interface PreviewChip {
  label: string;
  variant?: 'default' | 'primary' | 'muted';
}

interface PreviewAction {
  label: string;
  href: string;
}

interface OntPreviewData {
  title: string;                    // 1 line
  subtitle?: string;                // 1 line, optional
  description?: string;             // target: 1-2 sentences, hard cap: 220 chars rendered text
  facts?: PreviewFact[];            // max 5
  chips?: PreviewChip[];            // max 3
  primaryAction?: PreviewAction;    // navigation-only in v1, omitted when no canonical page
}
```

**Hard limits enforced by resolver:** max 5 facts, max 3 chips, description capped at 220 chars (truncate with ellipsis). Resolver returns already localized strings. Resolver is responsible for ordering facts. UI never re-sorts or truncates semantic content except visual clipping. UI treats missing sections as absent, not as placeholders.

**Note:** `OntPreviewTarget` is NOT a separate abstraction in v1. Navigation target (`canonicalHref`) and `subjectKind` are embedded in the resolver response:

```typescript
interface ResolvedOntPreview {
  target: {
    ref: string;
    subjectKind: 'entity' | 'formula_variable' | 'formula';
    canonicalHref?: string;
  };
  data: OntPreviewData;
}
```

### 3. OntInteractiveRef

Single UI component wrapping any ontology reference.

```typescript
interface OntInteractiveRefProps {
  entityRef?: string;                 // ontology entity ref (NOT "ref" — reserved in React)
  formulaVariable?: Variable;         // for formula variable preview
  formulaId?: string;                 // for formula preview
  display: React.ReactNode;           // what to render inline
  context?: PreviewContext;           // contextual resolution
  locale: string;
}
```

Behavior:
- **Desktop:** hover (200ms debounce) → preview card popup. Click → navigate to `canonicalHref`.
- **Mobile:** info affordance (context-sensitive visibility policy, see Mobile UX). Tap on ref itself → navigate. Long press → fallback preview trigger.

If `canonicalHref` is null, the ref remains previewable but non-navigable. Visual styling indicates informational, not link, behavior (no underline, `cursor: default`).

All existing components (ConceptRef, FormulaChip, OntEmbed OntRef mode, formula variable tokens) wrap their content in `<OntInteractiveRef>`.

## Preview Resolver

### Unified request type

```typescript
type OntPreviewRequest =
  | { subjectKind: 'entity'; ref: string; locale: string; context?: PreviewContext }
  | { subjectKind: 'formula'; ref: string; locale: string; context?: PreviewContext }
  | { subjectKind: 'formula_variable'; variable: Variable; formulaId: string; locale: string; context?: PreviewContext };

function resolveOntPreview(
  request: OntPreviewRequest,
): ResolvedOntPreview | Promise<ResolvedOntPreview>;
```

Resolver may return synchronously from cached data or asynchronously if fetch needed. Caller handles both via `Promise.resolve(result)`.

### PreviewContext

```typescript
interface PreviewContext {
  sourceRef?: string;                              // where this ref appeared (page/component)
  formulaRef?: string;                             // formula:acid_dissociation_constant_step2
  substanceRef?: string;                           // sub:h2so4 (current substance in view)
  deprotonationStep?: number;                      // contextual step
  profile?: 'default' | 'acid_base' | 'solubility' | 'redox';  // key facts selection hint
}
```

### Internal dispatch (entity subjects)

```
ref prefix → resolver adapter:
  el:       → ElementPreviewAdapter
  sub:      → SubstancePreviewAdapter
  ion:      → IonPreviewAdapter
  concept:  → ConceptPreviewAdapter
  cls:      → ConceptPreviewAdapter (same adapter, different key facts)
  formula:  → FormulaPreviewAdapter
```

Formula variables use `FormulaVariablePreviewResolver` — dispatched via `subjectKind: 'formula_variable'`, NOT through ref prefix.

### Preview source priority

Each adapter follows a priority chain for text:

**Concept:**
1. Concept overlay `description` (locale-specific)
2. Autogenerated fallback from concept kind + parent

**Substance:**
1. Localized overlay summary
2. Generated from class + formula + characteristics
3. Fallback: formula only

**Element:**
1. Localized overlay name
2. Element symbol + Z

**Ion:**
1. Localized overlay name + parent acid/base
2. Formula + charge

**Formula (as knowledge object):**
1. Formula title from concept_refs overlay
2. Rendered expression via `formulaToDisplayString()`
3. Didactic scope chip

**Formula variable:**
1. `explanation_overrides[locale]`
2. Generated from locale-specific phrase template + localized inflected label (if available)
3. Generic non-inflected fallback: quantity display name + entity name
4. Symbol fallback

Note: v1 does not require full grammatical inflection engine. Resolver may use locale-specific fallback templates when inflected form is unavailable.

### Key facts policy (deterministic)

| Entity type | Facts (ordered) |
|---|---|
| **Element** | symbol, Z, Ar, typical oxidation states |
| **Substance** | formula, class, phase, 1-2 profile-relevant characteristics |
| **Ion** | formula, charge, cation/anion, parent acid/base |
| **Concept** | short definition, parent concept |
| **Formula** | rendered expression, didactic scope, defining concept |
| **Formula variable** | expanded phrase, quantity, bound entity/role, unit |

Profile-relevant selection for substances: resolver checks substance class (or `context.profile`) and picks didactically relevant characteristics:
- `class: 'acid'` / `profile: 'acid_base'` → pKa, basicity
- `class: 'salt'` / `profile: 'solubility'` → solubility
- `class: 'base'` → solubility, alkali/insoluble
- `class: 'oxide'` → subclass (basic/acidic/amphoteric)
- `profile: 'default'` → phase, density (generic)

## Formula Variables — Derived Preview Type

### The problem

`[H⁺]` in Ka formula is NOT just `ion:H_plus`. It is a **composite meaning**:
- quantity: "molar concentration" (from `q:molar_concentration`)
- entity: "hydrogen ions H⁺" (from binding → `ion:H_plus` overlay)
- result: "Molar concentration of hydrogen ions H⁺ in solution"

### Variable binding model

Replaces simple `entity_ref` with structured binding:

```typescript
interface VariableBinding {
  mode: 'concrete_entity' | 'abstract_class' | 'contextual_role';
  ref: string;                    // ion:H_plus | concept:acid_residue | cls:acid
  context_ref?: string;           // for contextual_role: which acid/reaction
  step?: number;                  // for polyprotic: dissociation step
}
```

**Binding mode semantics:**
- `concrete_entity` — a specific entity (ion:H_plus, el:Na)
- `abstract_class` — any abstract ontology type, class, or concept used as a non-concrete semantic binder (concept:acid_residue, cls:acid). Covers both `concept:*` and `cls:*` refs.
- `contextual_role` — role that resolves to a concrete entity only in context of a specific substance/reaction/step

On the Variable type (extends existing `src/types/formula.ts`):

```typescript
interface Variable {
  symbol: string;
  display_symbol?: string;
  quantity: string;              // q:*
  unit: string;                  // unit:*
  role: 'result' | 'input' | 'constant' | 'index';
  semantic_role?: SemanticRole;

  /** Ontology binding for this variable */
  binding?: VariableBinding;

  /** Manual label overrides when auto-generation is awkward */
  explanation_overrides?: Record<string, string>;   // locale → text
}
```

### Binding summary in preview

Resolver normalizes binding into human-readable facts, NOT raw model:

| binding.mode | Preview fact |
|---|---|
| `concrete_entity` ref=ion:H_plus | "ионы водорода H⁺" |
| `abstract_class` ref=concept:acid_residue | "кислотный остаток (анион)" |
| `contextual_role` ref=concept:acid_residue step=2 | "продукт 2-й ступени диссоциации" |

UI never sees `mode`, `ref`, `step` directly.

## Formula Families (Ka)

### Levels

```
formula:acid_dissociation_constant              didactic_scope: 'generalized'
  Ka = [H⁺]·[A⁻] / [HA]

formula:acid_dissociation_constant_step1        didactic_scope: 'exact', step: 1
  Ka₁ = [H⁺]·[HA⁻] / [H₂A]

formula:acid_dissociation_constant_step2        didactic_scope: 'exact', step: 2
  Ka₂ = [H⁺]·[A²⁻] / [HA⁻]
```

On ComputableFormula:

```typescript
interface ComputableFormula {
  // ... existing fields
  concept_refs?: string[];                        // concepts this formula defines
  didactic_scope?: 'generalized' | 'school_simplified' | 'exact';
  generalizes?: string;                           // formula:acid_dissociation_constant (parent)
  deprotonation_step?: number;                    // for step-specific formulas
}
```

Concept page / OntBlock can show: generalized form first, then step-specific forms below.

## Fallback Behavior

| Scenario | Behavior |
|---|---|
| Missing description | Preview shows title only, no description block |
| Missing localized label | Fall back to ref ID with `concept:` prefix stripped |
| Missing canonical page | Ref is previewable but non-navigable; primaryAction omitted; cursor: default |
| Preview resolver failure | Entity still renders normally; navigation still works if href exists; preview shows title only; error logged in dev |
| Missing quantity/entity overlay for formula variable | Use symbol + raw quantity ID as fallback |
| Missing explanation_override + missing inflected form | Use non-inflected generic template |

## Phase 0: Ref/Kind Registry Normalization

Before the preview layer, normalize the foundational infrastructure:

```typescript
// src/lib/ont-ref-registry.ts

type OntRefKind = 'element' | 'substance' | 'ion' | 'domain_concept' |
  'substance_class' | 'reaction_type' | 'formula';

function resolveRefKind(ref: string): OntRefKind;
function buildCanonicalHref(ref: string, locale: string): string | null;
function resolveRefLabel(ref: string, locale: string): Promise<string>;
```

Single source of truth for: "given a ref string, what kind is it, where does it link, what is it called."

## Mobile UX

**Explicit affordance, context-sensitive visibility:**

- Inline ref (FormulaChip, ConceptRef) = **navigation target** (tap → page)
- Info affordance visibility policy:
  - Always visible for chips/cards
  - Visible on focus/hover for desktop inline refs
  - Long-press fallback for dense inline text (no visible ⓘ)
  - Dedicated preview affordance for touch-dense contexts (formula variables)
- Long press = **fallback preview trigger** (for refs without visible info icon)

No "first tap = preview, second tap = navigate" — this is fragile and confusing. No ⓘ spam in dense paragraphs or formulas.

## Accessibility

- Keyboard: Tab to ref → Enter/Space to navigate. Adjacent preview trigger button → Enter/Space to open preview.
- Preview card with actions: `role="dialog"` semantics (not tooltip)
- Simple hover bubble without actions: `role="tooltip"`, `aria-describedby`
- Escape closes preview
- No hover-only critical information (preview is supplementary)
- Focus trap inside preview card if it contains interactive elements

## Performance

- **Hover debounce:** 200ms — masks any async loading
- **Data source:** Resolver should preferentially use already loaded page data and shared data caches when available. Asynchronous loading is allowed when required.
- **Lazy resolution:** preview data computed only on hover trigger, not on mount
- **Session cache keys:**
  - Entity preview: `entity:${ref}:${locale}`
  - Formula preview: `formula:${ref}:${locale}`
  - Formula variable: `fvar:${formulaId}:${symbol}:${locale}:${contextHash}`

## Implementation Phases

### Phase 0: Ref/Kind Registry
- `ont-ref-registry.ts`: `resolveRefKind()`, `buildCanonicalHref()`, `resolveRefLabel()`
- Canonical href builder (consolidates scattered URL building logic)
- Tests

### Phase 1a: Data Model
- `binding` on Variable (replaces `entity_ref` in stash)
- `explanation_overrides` on Variable
- `concept_refs`, `didactic_scope`, `generalizes`, `deprotonation_step` on ComputableFormula
- `OntPreviewData`, `ResolvedOntPreview`, `OntPreviewRequest`, `PreviewContext` types

### Phase 1b: Ontology Content
- `q:equilibrium_constant` in quantities ontology
- Ka formula family (generalized + step1 + step2) with bindings
- Revert Ka formula text from concept descriptions (formula now in ontology)

### Phase 2: Preview Resolver
- `resolveOntPreview()` with discriminated request dispatch
- Adapter directory structure:
  - `src/lib/ont-preview/resolve-ont-preview.ts`
  - `src/lib/ont-preview/adapters/element-preview.ts`
  - `src/lib/ont-preview/adapters/substance-preview.ts`
  - `src/lib/ont-preview/adapters/ion-preview.ts`
  - `src/lib/ont-preview/adapters/concept-preview.ts`
  - `src/lib/ont-preview/adapters/formula-preview.ts`
  - `src/lib/ont-preview/adapters/formula-variable-preview.ts`
- Key facts selection policy per entity type
- Fallback behavior for all failure modes
- Tests for each adapter

### Phase 3: OntInteractiveRef UI
- `<OntInteractiveRef>` component
- `<OntPreviewCard>` renderer
- Desktop: hover preview card (positioned popup)
- Mobile: bottom sheet + context-sensitive info affordance
- CSS for preview card
- Debounce, positioning, escape-to-close
- Accessibility (keyboard, aria, role="dialog" vs role="tooltip")

### Phase 4: Integrations
- Wrap `ConceptRef` in `OntInteractiveRef`
- Wrap `FormulaChip` in `OntInteractiveRef`
- Wrap `OntEmbed` OntRef mode
- Formula renderer: wrap variable tokens
- Deprecate old hardcoded tooltip path in `IonDetailsProvider`; migrate ion preview UI to OntInteractiveRef; keep provider temporarily if still needed for shared popup infra

### Phase 5: Polish
- Session caching with proper cache keys
- Analytics (which previews are opened most)
- Richer preview cards (if data supports it)
- Review preview content quality per locale

## File Inventory

### New files
- `src/lib/ont-ref-registry.ts` — ref kind resolver, canonical href, label resolver
- `src/lib/ont-preview/resolve-ont-preview.ts` — unified resolver with dispatch
- `src/lib/ont-preview/adapters/element-preview.ts`
- `src/lib/ont-preview/adapters/substance-preview.ts`
- `src/lib/ont-preview/adapters/ion-preview.ts`
- `src/lib/ont-preview/adapters/concept-preview.ts`
- `src/lib/ont-preview/adapters/formula-preview.ts`
- `src/lib/ont-preview/adapters/formula-variable-preview.ts`
- `src/types/ont-preview.ts` — OntPreviewData, ResolvedOntPreview, OntPreviewRequest, PreviewContext, PreviewFact, PreviewChip, PreviewAction
- `src/components/OntInteractiveRef.tsx` — unified interactive wrapper
- `src/components/OntPreviewCard.tsx` — preview card renderer
- `src/components/ont-interactive-ref.css` — styles for preview card + mobile sheet
- `src/lib/__tests__/ont-ref-registry.test.ts`
- `src/lib/__tests__/ont-preview-resolver.test.ts`

### Modified files
- `src/types/formula.ts` — add `concept_refs`, `didactic_scope`, `generalizes`, `deprotonation_step`; add `binding`, `explanation_overrides` to Variable
- `data-src/foundations/formulas.json` — add Ka formula family (3 formulas)
- `data-src/quantities_units_ontology.json` — add `q:equilibrium_constant`
- `src/components/ConceptRef.tsx` — wrap in OntInteractiveRef
- `src/components/FormulaChip.tsx` — wrap in OntInteractiveRef
- `src/components/OntEmbedBlock.tsx` — OntRef mode uses OntInteractiveRef
- `src/components/TheoryModulePanel.tsx` — formula variable tokens wrapped
- `src/components/IonDetailsProvider.tsx` — deprecate hardcoded popup, migrate to OntInteractiveRef
- `data-src/translations/{ru,en,pl,es}/concepts.json` — revert Ka formula text from descriptions

Note: integration file list is initial, not exhaustive. Additional integration points (tables, glossary, search suggestions, breadcrumbs) may emerge.

## Testing Matrix

- Concept ref in paragraph text
- Formula variable hover in inline formula (quantity + binding preview)
- FormulaChip hover in substance card
- Formula as knowledge object preview (rendered expression + concept)
- Entity without description (fallback: title only)
- Entity without canonical page (previewable, non-navigable)
- Preview resolver failure (entity renders, navigation works, preview degraded)
- Mobile tap behavior (info affordance → sheet, ref → navigate)
- Missing localized overlay (fallback to ref ID)
- Contextual role variable `[A⁻]` (abstract_class binding)
- Polyprotic Ka₂ variable bindings
- Keyboard navigation (Tab → Enter navigate, preview trigger → Enter/Space open)
- Escape closes preview
- Missing explanation_override + missing inflected form (generic template fallback)
