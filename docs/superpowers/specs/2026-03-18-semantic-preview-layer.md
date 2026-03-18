# Semantic Preview Layer

**Date:** 2026-03-18
**Status:** Draft

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

### 2. OntPreviewTarget

Where the ref leads. Separates "what to show" from "where to navigate."

```typescript
type OntPreviewTarget = {
  ref: string;
  previewKind: 'entity' | 'formula_variable' | 'formula';
  canonicalHref?: string;     // null for domain_concepts without pages
};
```

A single entity may have preview but no page (domain_concept), or page but no preview (unlikely but possible).

### 3. OntPreviewData

The normalized preview model. Strict limits.

```typescript
interface PreviewFact {
  label: string;       // human-readable, localized
  value: string;       // formatted value
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
  description?: string;             // 1-2 sentences max
  facts?: PreviewFact[];            // max 5
  chips?: PreviewChip[];            // max 3
  primaryAction?: PreviewAction;    // "Open full page"
}
```

**Hard limits enforced by resolver:** max 5 facts, max 3 chips, max 2 sentences in description.

### 4. OntInteractiveRef

Single UI component wrapping any ontology reference.

```typescript
interface OntInteractiveRefProps {
  ref: string;                      // ontology ref
  display: React.ReactNode;         // what to render inline (chip, text, formula token)
  previewKind?: 'entity' | 'formula_variable' | 'formula';  // default: 'entity'
  context?: PreviewContext;         // for formula variable contextual resolution
  locale: string;
}
```

Behavior:
- **Desktop:** hover (200ms debounce) → preview card popup. Click → navigate to `canonicalHref`.
- **Mobile:** dedicated info affordance icon (ⓘ) → bottom sheet. Tap on ref itself → navigate. No double-tap ambiguity.

All existing components (ConceptRef, FormulaChip, OntEmbed OntRef mode, formula variable tokens) wrap their content in `<OntInteractiveRef>`.

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
  mode: 'concrete_entity' | 'entity_class' | 'contextual_role';
  ref: string;                    // ion:H_plus | concept:acid_residue | cls:acid
  context_ref?: string;           // for contextual_role: which acid/reaction
  step?: number;                  // for polyprotic: dissociation step
}
```

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

### Preview resolution for formula variables

`FormulaVariablePreviewResolver` — separate from entity resolver:

1. Check `explanation_overrides[locale]` → use if present (highest priority)
2. Generate phrase from `quantity` + `binding`:
   - Load quantity display name from `quantities_units_ontology.json`
   - Load entity name from overlay (by `binding.ref`)
   - Compose: "{quantity_name} {entity_name_genitive}"
   - For `contextual_role`: add context description ("product of step N dissociation")
3. Fallback: symbol + quantity name

Priority: override → generated phrase → raw fallback.

### Binding summary in preview

Resolver normalizes binding into human-readable facts, NOT raw model:

| binding.mode | Preview fact |
|---|---|
| `concrete_entity` ref=ion:H_plus | "ионы водорода H⁺" |
| `entity_class` ref=concept:acid_residue | "кислотный остаток (анион)" |
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

## Preview Resolver

### Interface

```typescript
function resolveOntPreview(
  ref: string,
  locale: string,
  context?: PreviewContext,
): OntPreviewData | Promise<OntPreviewData>;
```

Resolver may return synchronously from cached data or asynchronously if fetch needed. Caller handles both.

### Internal dispatch

```
ref prefix → resolver adapter:
  el:       → ElementPreviewAdapter
  sub:      → SubstancePreviewAdapter
  ion:      → IonPreviewAdapter
  concept:  → ConceptPreviewAdapter
  cls:      → ConceptPreviewAdapter (same, different key facts)
  formula:  → FormulaPreviewAdapter
```

Formula variables use `FormulaVariablePreviewResolver` — NOT dispatched through ref prefix (they don't have ontology refs, they ARE variables within a formula).

### Preview source priority

Each adapter follows a priority chain for text:

**Concept:**
1. Concept overlay `description` (locale-specific)
2. Autogenerated fallback from concept kind + parent

**Substance:**
1. Localized overlay summary
2. Generated from class + formula + characteristics
3. Fallback: formula only

**Formula variable:**
1. `explanation_overrides[locale]`
2. Generated from quantity name + binding entity name
3. Symbol fallback

### Key facts policy (deterministic)

| Entity type | Facts (ordered) |
|---|---|
| **Element** | symbol, Z, Ar, typical oxidation states |
| **Substance** | formula, class, phase, 1-2 profile-relevant characteristics (acid → pKa, not melting point) |
| **Ion** | formula, charge, cation/anion, parent acid/base |
| **Concept** | short definition, parent concept |
| **Formula variable** | expanded phrase, quantity, bound entity/role, unit |

Profile-relevant selection for substances: resolver checks substance class and picks didactically relevant characteristics:
- `class: 'acid'` → pKa, basicity
- `class: 'salt'` → solubility
- `class: 'base'` → solubility, alkali/insoluble
- `class: 'oxide'` → subclass (basic/acidic/amphoteric)

## Phase 0: Ref/Kind Registry Normalization

Before the preview layer, normalize the foundational infrastructure:

### Ref kind resolver

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

**Explicit affordance, no ambiguity:**

- Inline ref (FormulaChip, ConceptRef) = **navigation target** (tap → page)
- Dedicated info icon (ⓘ) next to ref = **preview trigger** (tap → bottom sheet)
- Long press = **fallback preview trigger** (for refs without info icon)

No "first tap = preview, second tap = navigate" — this is fragile and confusing.

## Accessibility

- Keyboard: Tab to ref → Enter to navigate, Shift+Enter or ? to open preview
- `aria-describedby` links ref to preview content
- Escape closes preview
- No hover-only critical information (preview is supplementary)
- Screen reader: preview content announced as tooltip

## Performance

- **Hover debounce:** 200ms — masks any async loading
- **Data source:** resolver uses already-cached data from data-loader.ts (overlay, characteristics loaded by page components). In most cases: **synchronous from cache**.
- **Lazy resolution:** preview data computed only on hover trigger, not on mount
- **Session cache:** resolved OntPreviewData cached by `ref + locale` key

## Implementation Phases

### Phase 0: Ref/Kind Registry
- `ont-ref-registry.ts`: `resolveRefKind()`, `buildCanonicalHref()`, `resolveRefLabel()`
- Canonical href builder (consolidates scattered URL building logic)
- Tests

### Phase 1: Data Contract
- `concept_refs` on ComputableFormula
- `binding` on Variable (replaces `entity_ref` in stash)
- `didactic_scope`, `generalizes`, `deprotonation_step` on ComputableFormula
- `explanation_overrides` on Variable
- Ka formula family (generalized + step1 + step2)
- `q:equilibrium_constant` in quantities ontology
- Locale overlays for formulas (if needed)

### Phase 2: Preview Resolver
- `OntPreviewData` type
- `resolveOntPreview()` with adapter dispatch
- Element, Substance, Ion, Concept adapters
- FormulaVariablePreviewResolver (derived preview)
- FormulaPreviewAdapter
- Key facts selection policy per entity type
- Tests for each adapter

### Phase 3: OntInteractiveRef UI
- `<OntInteractiveRef>` component
- Desktop: hover preview card (positioned popup)
- Mobile: bottom sheet + info affordance
- CSS for preview card
- Debounce, positioning, escape-to-close
- Accessibility (keyboard, aria)

### Phase 4: Integrations
- Wrap `ConceptRef` in `OntInteractiveRef`
- Wrap `FormulaChip` in `OntInteractiveRef`
- Wrap `OntEmbed` OntRef mode
- Formula renderer: wrap variable tokens
- Remove hardcoded tooltip logic from `IonDetailsProvider` (migrate to OntInteractiveRef)

### Phase 5: Polish
- Session caching
- Analytics (which previews are opened most)
- Richer preview cards (if data supports it)
- Review preview content quality per locale

## File Inventory

### New files
- `src/lib/ont-ref-registry.ts` — ref kind resolver, canonical href, label resolver
- `src/lib/ont-preview-resolver.ts` — `resolveOntPreview()` + adapters
- `src/lib/formula-variable-preview.ts` — FormulaVariablePreviewResolver
- `src/types/ont-preview.ts` — OntPreviewData, PreviewFact, PreviewChip, PreviewAction, OntPreviewTarget
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
- `src/components/IonDetailsProvider.tsx` — migrate popup to OntInteractiveRef
- `data-src/translations/{ru,en,pl,es}/concepts.json` — revert Ka formula text from descriptions (formula now in ontology)

## Testing Matrix

- Concept ref in paragraph text
- Formula variable hover in inline formula (quantity + binding preview)
- FormulaChip hover in substance card
- Entity without description (fallback rendering)
- Entity without canonical page (no navigation, preview only)
- Mobile tap behavior (info icon → sheet, ref → navigate)
- Missing localized overlay (fallback to ref ID)
- Contextual role variable `[A⁻]` (entity_class binding)
- Polyprotic Ka₂ variable bindings
- Keyboard navigation (Tab, Enter, Escape)
