# Semantic Preview Layer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Universal hover preview for all ontology references — elements, substances, ions, concepts, formula variables. Single resolver pipeline, single UI component.

**Architecture:** `OntInteractiveRef` wraps any entity ref. On hover → `resolveOntPreview(request)` dispatches to per-type adapters → returns `Promise<ResolvedOntPreview>` → rendered by `OntPreviewCard`. Formula variables use derived preview from quantity + binding. Resolver is always async (may resolve instantly from cache).

**Tech Stack:** TypeScript, React, CSS, Vitest. Prefer existing shared loaders/caches where available; do not hard-couple resolver APIs to page-level loader internals.

**Spec:** `docs/superpowers/specs/2026-03-18-semantic-preview-layer.md`

---

## Fallback Policy

All adapters and UI must follow these rules:

| Scenario | Behavior |
|---|---|
| Missing localized label | Use ref ID tail (strip prefix) |
| Missing description | Omit description section |
| Missing canonicalHref | Preview-only, non-navigable. `cursor: default`, no underline |
| Resolver failure | Render entity normally, suppress preview, log warning in dev |
| Missing variable binding | Use `display_symbol` or `symbol` + quantity name if available |
| Missing characteristics | Omit facts that depend on them |
| Missing overlay | Title from ref ID, no description |

---

## Chunk 1: Foundation (Phase 0 + Phase 1a)

### Task 1: Preview types

**Files:**
- Create: `src/types/ont-preview.ts`

- [ ] **Step 1: Create type file**

Types: `PreviewFact`, `PreviewChip`, `PreviewAction`, `OntPreviewData`, `ResolvedOntPreview`, `PreviewContext`, `OntPreviewRequest` (discriminated union: entity | formula | formula_variable).

See spec for exact type definitions.

**Validation rule:** `subjectKind='formula'` is required for formula objects. `subjectKind='entity'` is only for ontological entities (el, sub, ion, concept, cls, rxtype). Resolver must reject incompatible combinations in dev/tests.

- [ ] **Step 2: Verify compiles** — `npx tsc --noEmit`
- [ ] **Step 3: Commit** — `"feat(types): add OntPreviewData, ResolvedOntPreview, OntPreviewRequest types"`

---

### Task 2: Ref/Kind Registry

**Files:**
- Create: `src/lib/ont-ref-registry.ts`
- Create: `src/lib/__tests__/ont-ref-registry.test.ts`

- [ ] **Step 1: Implement `resolveRefKind(ref)` and `extractRefId(ref)`**

Map prefixes: `el:` → element, `sub:` → substance, `ion:` → ion, `concept:` → domain_concept, `cls:` → substance_class, `rxtype:` → reaction_type, `formula:` → formula. Unknown prefix → `'unknown'`.

- [ ] **Step 2: Implement `buildCanonicalHref(ref, locale)`**

- `el:Na` → `/ru/periodic-table/Na/` (via `localizeUrl`)
- `sub:hcl` → `/ru/substances/hcl/`
- `ion:*` → `null` (no per-ion canonical pages in v1)
- `concept:*` → `null` (domain concepts have preview only, no page in v1)
- `cls:*` → `null` (needs slug chain from overlay — not resolvable without data)
- `rxtype:*` → `null`
- `formula:*` → `null`

Do NOT return `/ions/` for individual ions — that's a section page, not a canonical page for `ion:H_plus`.

- [ ] **Step 3: Do NOT implement `resolveRefLabel` in Phase 0** — it requires async overlay loading and is not needed until Phase 2 adapters. Remove from interface.

- [ ] **Step 4: Write tests**

Cover: all 7 prefixes + unknown, extractRefId with colon in id, buildCanonicalHref for each kind. Add comment on domain_concept test: `// v1 policy: concepts have preview-only, no canonical page`.

- [ ] **Step 5: Run tests** — `npm test`
- [ ] **Step 6: Commit** — `"feat: add ont-ref-registry with resolveRefKind and buildCanonicalHref"`

---

### Task 3: Variable binding model + formula type extensions

**Files:**
- Modify: `src/types/formula.ts`

**IMPORTANT: Do NOT use `git stash pop`.** Implement changes directly by reading the current file and making edits. The stash is reference only.

- [ ] **Step 1: Read `src/types/formula.ts` current state**

- [ ] **Step 2: Add `VariableBinding` interface**

```typescript
export interface VariableBinding {
  mode: 'concrete_entity' | 'abstract_class' | 'contextual_role';
  ref: string;
  context_ref?: string;
  step?: number;
}
```

- [ ] **Step 3: Extend `Variable` interface**

Add after `semantic_role`:
```typescript
  binding?: VariableBinding;
  explanation_overrides?: Record<string, string>;
```

- [ ] **Step 4: Extend `ComputableFormula` interface**

Add after `approximation`:
```typescript
  concept_refs?: string[];
  didactic_scope?: 'generalized' | 'school_simplified' | 'exact';
  generalizes?: string;
  deprotonation_step?: number;
```

- [ ] **Step 5: Add `q:equilibrium_constant` to `data-src/quantities_units_ontology.json`**

Add to quantities array:
```json
{ "id": "q:equilibrium_constant", "display_symbol": "K", "dimension": "1", "recommended_units": ["unit:dimensionless"] }
```

- [ ] **Step 6: Verify compiles** — `npx tsc --noEmit`
- [ ] **Step 7: Validate data** — `npm run validate:data`
- [ ] **Step 8: Commit** — `"feat(types): add VariableBinding, concept_refs, didactic_scope to formula types"`

---

## Chunk 2a: Ka Formula Content (Phase 1b)

### Task 4: Add Ka formula family to ontology

**Files:**
- Modify: `data-src/foundations/formulas.json` — add 3 formulas
- Modify: `data-src/translations/{ru,en,pl,es}/concepts.json` — revert Ka formula text

- [ ] **Step 1: Read `data-src/foundations/formulas.json` to understand current format**

- [ ] **Step 2: Add generalized Ka formula**

```json
{
  "id": "formula:acid_dissociation_constant",
  "kind": "definition",
  "domain": "acid_base",
  "school_grade": [9, 10],
  "concept_refs": ["concept:acid_dissociation_constant", "concept:pKa"],
  "didactic_scope": "generalized",
  "variables": [
    { "symbol": "Ka", "display_symbol": "Ka", "quantity": "q:equilibrium_constant", "unit": "unit:dimensionless", "role": "result" },
    { "symbol": "cH", "display_symbol": "[H⁺]", "quantity": "q:molar_concentration", "unit": "unit:mol_per_L", "role": "input",
      "binding": { "mode": "concrete_entity", "ref": "ion:H_plus" },
      "explanation_overrides": { "ru": "молярная концентрация ионов водорода", "en": "molar concentration of hydrogen ions", "pl": "stężenie molowe jonów wodorowych", "es": "concentración molar de iones hidrógeno" } },
    { "symbol": "cA", "display_symbol": "[A⁻]", "quantity": "q:molar_concentration", "unit": "unit:mol_per_L", "role": "input",
      "binding": { "mode": "abstract_class", "ref": "concept:acid_residue" },
      "explanation_overrides": { "ru": "молярная концентрация кислотного остатка", "en": "molar concentration of the acid residue", "pl": "stężenie molowe reszty kwasowej", "es": "concentración molar del residuo ácido" } },
    { "symbol": "cHA", "display_symbol": "[HA]", "quantity": "q:molar_concentration", "unit": "unit:mol_per_L", "role": "input",
      "binding": { "mode": "abstract_class", "ref": "cls:acid" },
      "explanation_overrides": { "ru": "молярная концентрация недиссоциированной кислоты", "en": "molar concentration of undissociated acid", "pl": "stężenie molowe niezdysocjowanego kwasu", "es": "concentración molar del ácido sin disociar" } }
  ],
  "expression": { "op": "divide", "operands": [{ "op": "multiply", "operands": ["cH", "cA"] }, "cHA"] },
  "result_variable": "Ka",
  "invertible_for": [], "inversions": {},
  "constants_used": [], "prerequisite_formulas": [], "used_by_solvers": []
}
```

- [ ] **Step 3: Add Ka₁ (step 1)**

```json
{
  "id": "formula:acid_dissociation_constant_step1",
  "kind": "definition",
  "domain": "acid_base",
  "school_grade": [10, 11],
  "concept_refs": ["concept:acid_dissociation_constant"],
  "didactic_scope": "exact",
  "generalizes": "formula:acid_dissociation_constant",
  "deprotonation_step": 1,
  "variables": [
    { "symbol": "Ka1", "display_symbol": "Ka₁", "quantity": "q:equilibrium_constant", "unit": "unit:dimensionless", "role": "result" },
    { "symbol": "cH", "display_symbol": "[H⁺]", "quantity": "q:molar_concentration", "unit": "unit:mol_per_L", "role": "input",
      "binding": { "mode": "concrete_entity", "ref": "ion:H_plus" } },
    { "symbol": "cHA", "display_symbol": "[HA⁻]", "quantity": "q:molar_concentration", "unit": "unit:mol_per_L", "role": "input",
      "binding": { "mode": "contextual_role", "ref": "concept:acid_residue", "step": 1 },
      "explanation_overrides": { "ru": "молярная концентрация аниона первой ступени", "en": "molar concentration of the first-step anion", "pl": "stężenie molowe anionu pierwszego stopnia", "es": "concentración molar del anión de primera etapa" } },
    { "symbol": "cH2A", "display_symbol": "[H₂A]", "quantity": "q:molar_concentration", "unit": "unit:mol_per_L", "role": "input",
      "binding": { "mode": "abstract_class", "ref": "cls:acid" },
      "explanation_overrides": { "ru": "молярная концентрация исходной кислоты", "en": "molar concentration of the original acid", "pl": "stężenie molowe kwasu wyjściowego", "es": "concentración molar del ácido original" } }
  ],
  "expression": { "op": "divide", "operands": [{ "op": "multiply", "operands": ["cH", "cHA"] }, "cH2A"] },
  "result_variable": "Ka1",
  "invertible_for": [], "inversions": {},
  "constants_used": [], "prerequisite_formulas": ["formula:acid_dissociation_constant"], "used_by_solvers": []
}
```

- [ ] **Step 4: Add Ka₂ (step 2)**

Same pattern as Ka₁ but:
- id: `formula:acid_dissociation_constant_step2`
- `deprotonation_step: 2`
- display_symbol: `Ka₂`
- Variables: `[H⁺]`, `[A²⁻]` (step 2 anion), `[HA⁻]` (step 1 anion)
- `explanation_overrides` describe "second-step anion" and "first-step anion (intermediate)"

- [ ] **Step 5: Revert Ka formula text from concept descriptions**

In all 4 locale concept overlays, change `concept:acid_dissociation_constant`:
- Remove "(Ka)" from name
- Restore semantic description (not formula):
  - ru: `"Константа равновесия реакции диссоциации кислоты в водном растворе. Чем больше Ka, тем сильнее кислота"`
  - en: `"Equilibrium constant for acid dissociation in aqueous solution. The larger Ka, the stronger the acid"`
  - pl: `"Stała równowagi reakcji dysocjacji kwasu w roztworze wodnym. Im większa Ka, tym mocniejszy kwas"`
  - es: `"Constante de equilibrio de la disociación del ácido en solución acuosa. Cuanto mayor es Ka, más fuerte es el ácido"`

- [ ] **Step 6: Validate** — `npm run validate:data`
- [ ] **Step 7: Run tests** — `npm test`
- [ ] **Step 8: Commit** — `"feat(ontology): add Ka formula family (generalized + step1 + step2) with bindings"`

---

## Chunk 2b: Preview Resolver (Phase 2)

### Task 5: Preview resolver infrastructure

**Files:**
- Create: `src/lib/ont-preview/resolve-ont-preview.ts`
- Create: `src/lib/ont-preview/adapters/element-preview.ts`
- Create: `src/lib/ont-preview/adapters/substance-preview.ts`
- Create: `src/lib/ont-preview/adapters/ion-preview.ts`
- Create: `src/lib/ont-preview/adapters/concept-preview.ts`
- Create: `src/lib/ont-preview/adapters/formula-preview.ts`
- Create: `src/lib/ont-preview/adapters/formula-variable-preview.ts`
- Create: `src/lib/__tests__/ont-preview-resolver.test.ts`

**Resolver contract:**

```typescript
async function resolveOntPreview(request: OntPreviewRequest): Promise<ResolvedOntPreview>
```

Always async. May resolve instantly from cached data but external contract is always `Promise<ResolvedOntPreview>`.

**Data loading policy:** Adapters use shared loader helpers (`loadElements`, `loadConceptOverlay`, `loadSubstancesIndex`, etc.) — NOT raw JSON file reads. Missing data degrades gracefully per fallback policy.

**Cache keys:**
- Entity: `entity:${ref}:${locale}:${profile}`
- Formula: `formula:${ref}:${locale}`
- Formula variable: `fvar:${formulaId}:${variable.symbol}:${locale}:${contextHash}`

- [ ] **Step 1: Create resolver dispatcher** (`resolve-ont-preview.ts`)

Dispatch by `request.subjectKind`:
- `'entity'` → dispatch by ref prefix to element/substance/ion/concept adapter
- `'formula'` → formula adapter
- `'formula_variable'` → formula variable resolver

Validate: reject `subjectKind='entity'` with `formula:*` ref (throw in dev).

- [ ] **Step 2: Element adapter**

Load elements + overlay. Find element by symbol (from `extractRefId`). Build:
- title: localized name
- subtitle: symbol
- facts: [Z, Ar (from characteristics), typical oxidation states]
- canonicalHref: via `buildCanonicalHref`

- [ ] **Step 3: Substance adapter**

Load substance index + overlay. Build:
- title: localized name or formula
- subtitle: formula
- facts by profile:
  - acid → pKa (from characteristics), basicity
  - salt → solubility
  - base → solubility, alkali/insoluble
  - oxide → subclass
  - default → phase, density
- canonicalHref: via `buildCanonicalHref`

- [ ] **Step 4: Ion adapter**

Load ions + overlay. Build:
- title: localized name or formula
- facts: [formula, charge (from characteristics), type (cation/anion), parent acid if available]
- canonicalHref: `null` (no per-ion page in v1)

- [ ] **Step 5: Concept adapter**

Load concept registry + overlay. Build:
- title: localized name
- description: from overlay (capped at 220 chars)
- chips: [parent concept name] if exists
- canonicalHref: `null` for domain_concept, built from slug chain for substance_class

- [ ] **Step 6: Formula adapter**

Load formulas + concept overlay for `concept_refs[0]`. Build:
- title: concept name or formula ID
- description: rendered expression via `formulaToDisplayString()`
- chips: [didactic_scope] if not 'generalized'
- canonicalHref: `null`

- [ ] **Step 7: Formula variable resolver**

Takes Variable from request. Priority:
1. `explanation_overrides[locale]` → use as description
2. Generate phrase: load quantity display name + load entity name from overlay via `binding.ref` → compose "{quantity} {entity genitive}"
3. Fallback: `display_symbol` or `symbol` + quantity name

Build:
- title: display_symbol or symbol
- description: generated phrase
- facts: [quantity name, bound entity/class description, unit]
- canonicalHref: `null`

**Missing binding behavior:** title = `display_symbol` || `symbol`. Facts include quantity if available. No crash, no raw JSON in UI.

- [ ] **Step 8: Write tests**

Minimum required test cases:
- element with full overlay → complete preview
- substance acid with pKa → profile-relevant facts
- concept without description → title only
- formula with concept_refs → rendered expression in preview
- variable with explanation_override → override used
- variable with generated phrase (binding + quantity) → composed text
- variable without binding → symbol + quantity fallback
- unknown ref kind → graceful degradation
- subjectKind/ref mismatch → error in dev

- [ ] **Step 9: Run tests** — `npm test`
- [ ] **Step 10: Commit** — `"feat: add preview resolver with 6 entity adapters + formula variable resolver"`

---

## Chunk 3: UI + Integrations (Phase 3 + Phase 4)

### Task 6: OntPreviewCard component

**Files:**
- Create: `src/components/OntPreviewCard.tsx`
- Create: `src/components/ont-preview-card.css`

- [ ] **Step 1: Create card renderer**

Props: `data: OntPreviewData`, `onClose?: () => void`.

Renders: title, subtitle, description (truncated at 220 chars with ellipsis), facts as `label: value [unit]` rows (max 5), chips inline (max 3), primary action as link button. Missing sections are omitted (no placeholders).

- [ ] **Step 2: CSS**

Compact card: max-width 320px, `border-radius: 0.5rem`, `box-shadow`, `background: var(--color-bg)`. Facts as dl/dt/dd or simple flex rows. Responsive.

- [ ] **Step 3: Commit** — `"feat(ui): add OntPreviewCard component"`

---

### Task 7: OntInteractiveRef component

**Files:**
- Create: `src/components/OntInteractiveRef.tsx`
- Create: `src/components/ont-interactive-ref.css`

- [ ] **Step 1: Create interactive wrapper**

Props: `entityRef?`, `formulaVariable?`, `formulaId?`, `display: ReactNode`, `context?: PreviewContext`, `locale: string`.

Build `OntPreviewRequest` from props, call `resolveOntPreview()`.

- [ ] **Step 2: Desktop interaction (fine pointer)**

- `onMouseEnter` → start 200ms debounce timer
- On debounce complete → resolve preview → show `OntPreviewCard` in positioned popup
- Popup remains open while pointer is inside **either** trigger **or** popup
- Close on: pointer leaves both trigger and popup, Escape key, outside click
- Click on trigger → navigate to `canonicalHref` (if exists)
- Simple v1 positioning: prefer below trigger, flip above if near viewport bottom. Don't over-engineer collision math.

- [ ] **Step 3: Mobile interaction (coarse pointer)**

- Main ref tap → navigate (if canonicalHref exists)
- Dedicated preview trigger button (small ⓘ icon) → shown for chips/cards, hidden for dense inline text
- Preview trigger tap → opens preview as bottom-positioned card (not full bottom sheet in v1)
- Long press on ref → fallback preview trigger (for refs without visible ⓘ)
- `@media (pointer: coarse)` for styling, but use pointer detection for behavior decisions
- SSR-safe: default to desktop mode, detect pointer on mount

- [ ] **Step 4: Non-navigable refs**

When `canonicalHref` is null: `cursor: default`, no underline, click does nothing. Preview still works.

- [ ] **Step 5: Accessibility**

- Tab to ref → Enter/Space navigates
- Adjacent preview trigger button → Enter/Space opens preview
- Preview card without action: `role="tooltip"`, `aria-describedby`
- Preview card with primaryAction: `role="dialog"`, focus management
- Escape closes preview

- [ ] **Step 6: CSS**

Desktop popup: absolute positioned, shadow, z-index above content.
Mobile: fixed bottom card or inline positioned.

- [ ] **Step 7: Run tests** — `npm test`
- [ ] **Step 8: Commit** — `"feat(ui): add OntInteractiveRef with hover preview and click navigation"`

---

### Task 8a: Integrate into FormulaChip, ConceptRef, OntEmbed

**Files:**
- Modify: `src/components/FormulaChip.tsx`
- Modify: `src/components/ConceptRef.tsx`
- Modify: `src/components/OntEmbedBlock.tsx`

**IMPORTANT:** Before wrapping, read each component to understand existing click/hover/link behavior. Preserve styling and href semantics. Remove duplicated hover logic only after verifying parity.

- [ ] **Step 1: Audit existing behavior**

Read FormulaChip, ConceptRef, OntEmbedBlock. Note:
- What happens on click? (navigation? popup?)
- What happens on hover? (title attribute? custom tooltip?)
- What props carry entity refs?

- [ ] **Step 2: Wrap FormulaChip**

FormulaChip has `substanceId`, `elementId`, `ionId` props. Use the populated one as `entityRef`. Wrap the chip's rendered output in `<OntInteractiveRef>`. Preserve existing click-to-navigate behavior.

- [ ] **Step 3: Wrap ConceptRef**

ConceptRef renders concept name as a link. Wrap in `<OntInteractiveRef entityRef={conceptId}>`. Preserve link styling and navigation.

- [ ] **Step 4: Wrap OntEmbed OntRef mode**

In OntEmbedBlock, OntRef mode renders a link/chip. Wrap in `<OntInteractiveRef entityRef={block.concept_id}>`.

- [ ] **Step 5: Run tests and build** — `npm test && npm run build`
- [ ] **Step 6: Commit** — `"feat: integrate OntInteractiveRef into FormulaChip, ConceptRef, OntEmbedBlock"`

---

### Task 8b: Integrate formula variable tokens

**Files:**
- Modify: `src/components/TheoryModulePanel.tsx` (or wherever formula expressions are rendered as tokens)

- [ ] **Step 1: Identify formula rendering code**

Read TheoryModulePanel.tsx — find where formula expressions are rendered (equation blocks, formula variables). Find the component/function that renders individual variable tokens.

- [ ] **Step 2: Wrap variable tokens with OntInteractiveRef**

For each rendered variable token that has a `binding`:
```tsx
<OntInteractiveRef
  formulaVariable={variable}
  formulaId={formula.id}
  display={<span>{variable.display_symbol}</span>}
  context={{ formulaRef: formula.id }}
  locale={locale}
/>
```

- [ ] **Step 3: Run tests and build** — `npm test && npm run build`
- [ ] **Step 4: Commit** — `"feat: integrate OntInteractiveRef for formula variable tokens"`

---

### Task 9: Final verification

- [ ] **Step 1: Run all tests** — `npm test`
- [ ] **Step 2: Full build** — `npm run build`
- [ ] **Step 3: Visual verification**

Run: `npm run preview`

Mandatory checks (ru + en):
1. Hover over FormulaChip (e.g., HCl on acids page) → preview card shows: name, formula, class, pKa
2. Hover over ConceptRef (e.g., "кислоты" link) → preview card shows: name, description
3. Hover over OntEmbed OntRef → preview card
4. Click on FormulaChip → navigates to substance page
5. Click on non-navigable concept → no navigation, preview still works
6. Preview card dismisses on mouse leave / Escape

Smoke check (pl + es):
7. Verify no missing label breakage (fallback renders ref ID, not crash)

- [ ] **Step 4: Commit any fixes**
