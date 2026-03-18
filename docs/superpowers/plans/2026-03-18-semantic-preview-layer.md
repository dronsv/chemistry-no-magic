# Semantic Preview Layer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Universal hover preview for all ontology references — elements, substances, ions, concepts, formula variables. Single resolver pipeline, single UI component.

**Architecture:** `OntInteractiveRef` wraps any entity ref. On hover → `resolveOntPreview(request)` dispatches to per-type adapters → returns `ResolvedOntPreview` → rendered by `OntPreviewCard`. Formula variables use derived preview from quantity + binding.

**Tech Stack:** TypeScript, React, CSS, Vitest, existing data-loader.ts caching

**Spec:** `docs/superpowers/specs/2026-03-18-semantic-preview-layer.md`

---

## Chunk 1: Foundation (Phase 0 + Phase 1a)

### Task 1: Preview types

**Files:**
- Create: `src/types/ont-preview.ts`

- [ ] **Step 1: Create type file**

```typescript
// src/types/ont-preview.ts

export interface PreviewFact {
  label: string;
  value: string;
  unit?: string;
}

export interface PreviewChip {
  label: string;
  variant?: 'default' | 'primary' | 'muted';
}

export interface PreviewAction {
  label: string;
  href: string;
}

export interface OntPreviewData {
  title: string;
  subtitle?: string;
  description?: string;        // max 220 chars
  facts?: PreviewFact[];       // max 5
  chips?: PreviewChip[];       // max 3
  primaryAction?: PreviewAction;
}

export interface ResolvedOntPreview {
  target: {
    ref: string;
    subjectKind: 'entity' | 'formula_variable' | 'formula';
    canonicalHref?: string;
  };
  data: OntPreviewData;
}

export interface PreviewContext {
  sourceRef?: string;
  formulaRef?: string;
  substanceRef?: string;
  deprotonationStep?: number;
  profile?: 'default' | 'acid_base' | 'solubility' | 'redox';
}

export type OntPreviewRequest =
  | { subjectKind: 'entity'; ref: string; locale: string; context?: PreviewContext }
  | { subjectKind: 'formula'; ref: string; locale: string; context?: PreviewContext }
  | { subjectKind: 'formula_variable'; variable: import('./formula').Variable; formulaId: string; locale: string; context?: PreviewContext };
```

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/types/ont-preview.ts
git commit -m "feat(types): add OntPreviewData, ResolvedOntPreview, OntPreviewRequest types"
```

---

### Task 2: Ref/Kind Registry

**Files:**
- Create: `src/lib/ont-ref-registry.ts`
- Create: `src/lib/__tests__/ont-ref-registry.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect } from 'vitest';
import { resolveRefKind, buildCanonicalHref } from '../ont-ref-registry';

describe('resolveRefKind', () => {
  it('resolves element refs', () => {
    expect(resolveRefKind('el:Na')).toBe('element');
  });
  it('resolves substance refs', () => {
    expect(resolveRefKind('sub:hcl')).toBe('substance');
  });
  it('resolves ion refs', () => {
    expect(resolveRefKind('ion:H_plus')).toBe('ion');
  });
  it('resolves concept refs', () => {
    expect(resolveRefKind('concept:pKa')).toBe('domain_concept');
  });
  it('resolves class refs', () => {
    expect(resolveRefKind('cls:acid')).toBe('substance_class');
  });
  it('resolves reaction type refs', () => {
    expect(resolveRefKind('rxtype:acid_metal')).toBe('reaction_type');
  });
  it('resolves formula refs', () => {
    expect(resolveRefKind('formula:molar_mass')).toBe('formula');
  });
  it('returns unknown for unrecognized prefix', () => {
    expect(resolveRefKind('xyz:foo')).toBe('unknown');
  });
});

describe('buildCanonicalHref', () => {
  it('builds element href', () => {
    expect(buildCanonicalHref('el:Na', 'ru')).toBe('/ru/periodic-table/Na/');
  });
  it('returns null for domain_concept (no page)', () => {
    expect(buildCanonicalHref('concept:pKa', 'ru')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- src/lib/__tests__/ont-ref-registry.test.ts`

- [ ] **Step 3: Implement registry**

```typescript
// src/lib/ont-ref-registry.ts
import type { SupportedLocale } from '../types/i18n';
import { localizeUrl } from './i18n';

export type OntRefKind = 'element' | 'substance' | 'ion' | 'domain_concept' |
  'substance_class' | 'reaction_type' | 'formula' | 'unknown';

const PREFIX_MAP: Record<string, OntRefKind> = {
  el: 'element',
  sub: 'substance',
  ion: 'ion',
  concept: 'domain_concept',
  cls: 'substance_class',
  rxtype: 'reaction_type',
  formula: 'formula',
};

export function resolveRefKind(ref: string): OntRefKind {
  const prefix = ref.split(':')[0];
  return PREFIX_MAP[prefix] ?? 'unknown';
}

export function buildCanonicalHref(ref: string, locale: string): string | null {
  const kind = resolveRefKind(ref);
  const id = ref.slice(ref.indexOf(':') + 1);
  switch (kind) {
    case 'element':
      return localizeUrl(`/periodic-table/${id}/`, locale as SupportedLocale);
    case 'substance':
      return localizeUrl(`/substances/${id}/`, locale as SupportedLocale);
    case 'ion':
      return localizeUrl(`/ions/`, locale as SupportedLocale);
    // substance_class and reaction_type need slug resolution from overlay — return null for now
    // domain_concept has no page
    default:
      return null;
  }
}
```

Note: `buildCanonicalHref` for substance_class/reaction_type requires overlay data (slug chain). For now returns null — will be enhanced when overlays are available in the resolver context.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- src/lib/__tests__/ont-ref-registry.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/ont-ref-registry.ts src/lib/__tests__/ont-ref-registry.test.ts
git commit -m "feat: add ont-ref-registry with resolveRefKind and buildCanonicalHref"
```

---

### Task 3: Variable binding model + formula type extensions

**Files:**
- Modify: `src/types/formula.ts` — add `binding`, `explanation_overrides` to Variable; add `concept_refs`, `didactic_scope`, `generalizes`, `deprotonation_step` to ComputableFormula

- [ ] **Step 1: Apply stashed changes and extend**

```bash
git stash pop
```

This restores the WIP changes (entity_ref on Variable, concept_refs on ComputableFormula, q:equilibrium_constant). Then refine:

- Replace `entity_ref?: string` with the full `binding?: VariableBinding` model
- Add `explanation_overrides?: Record<string, string>` to Variable
- Add `didactic_scope`, `generalizes`, `deprotonation_step` to ComputableFormula
- Define `VariableBinding` interface

```typescript
export interface VariableBinding {
  mode: 'concrete_entity' | 'abstract_class' | 'contextual_role';
  ref: string;
  context_ref?: string;
  step?: number;
}
```

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/types/formula.ts data-src/quantities_units_ontology.json
git commit -m "feat(types): add VariableBinding, concept_refs, didactic_scope to formula types"
```

---

## Chunk 2: Ka Formulas + Resolver (Phase 1b + Phase 2)

### Task 4: Add Ka formula family to ontology

**Files:**
- Modify: `data-src/foundations/formulas.json` — add 3 Ka formulas
- Modify: `data-src/translations/{ru,en,pl,es}/concepts.json` — revert Ka formula text from descriptions

- [ ] **Step 1: Add generalized Ka formula**

Append to `data-src/foundations/formulas.json`:

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
      "explanation_overrides": { "ru": "молярная концентрация ионов водорода", "en": "molar concentration of hydrogen ions", "pl": "stężenie molowe jonów wodorowych", "es": "concentración molar de iones hidrógeno" }
    },
    { "symbol": "cA", "display_symbol": "[A⁻]", "quantity": "q:molar_concentration", "unit": "unit:mol_per_L", "role": "input",
      "binding": { "mode": "abstract_class", "ref": "concept:acid_residue" },
      "explanation_overrides": { "ru": "молярная концентрация кислотного остатка", "en": "molar concentration of the acid residue", "pl": "stężenie molowe reszty kwasowej", "es": "concentración molar del residuo ácido" }
    },
    { "symbol": "cHA", "display_symbol": "[HA]", "quantity": "q:molar_concentration", "unit": "unit:mol_per_L", "role": "input",
      "binding": { "mode": "abstract_class", "ref": "cls:acid" },
      "explanation_overrides": { "ru": "молярная концентрация недиссоциированной кислоты", "en": "molar concentration of undissociated acid", "pl": "stężenie molowe niezdysocjowanego kwasu", "es": "concentración molar del ácido sin disociar" }
    }
  ],
  "expression": { "op": "divide", "operands": [{ "op": "multiply", "operands": ["cH", "cA"] }, "cHA"] },
  "result_variable": "Ka",
  "invertible_for": [],
  "inversions": {},
  "constants_used": [],
  "prerequisite_formulas": [],
  "used_by_solvers": []
}
```

- [ ] **Step 2: Revert Ka formula text from concept descriptions**

In all 4 locale concept overlays, change `concept:acid_dissociation_constant` description back to a semantic description (not the formula):
- ru: `"Константа равновесия реакции диссоциации кислоты в водном растворе. Чем больше Ka, тем сильнее кислота"`
- en: `"Equilibrium constant for acid dissociation in aqueous solution. The larger Ka, the stronger the acid"`
- pl: `"Stała równowagi reakcji dysocjacji kwasu w roztworze wodnym. Im większa Ka, tym mocniejszy kwas"`
- es: `"Constante de equilibrio de la disociación del ácido en solución acuosa. Cuanto mayor es Ka, más fuerte es el ácido"`

Remove "(Ka)" from the name — it's now linked via `concept_refs` on the formula.

- [ ] **Step 3: Validate and test**

Run: `npm run validate:data && npm test`

- [ ] **Step 4: Commit**

```bash
git add data-src/foundations/formulas.json data-src/translations/
git commit -m "feat(ontology): add Ka formula to ontology, revert formula text from descriptions"
```

---

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

- [ ] **Step 1: Create resolver dispatcher**

`resolve-ont-preview.ts`: takes `OntPreviewRequest`, dispatches by `subjectKind` and ref prefix to the appropriate adapter. Returns `ResolvedOntPreview | Promise<ResolvedOntPreview>`.

- [ ] **Step 2: Create element adapter**

Loads element overlay, builds preview: title=name, facts=[symbol, Z, Ar, oxidation states]. Uses `getEntityCharValue` for Ar. Builds href via `buildCanonicalHref`.

- [ ] **Step 3: Create substance adapter**

Loads substance overlay + characteristics, builds preview: title=name, subtitle=formula, facts by profile (acid→pKa, salt→solubility, etc.).

- [ ] **Step 4: Create ion adapter**

Loads ion overlay, charge from characteristics, parent acid/base. Facts=[formula, charge, type].

- [ ] **Step 5: Create concept adapter**

Loads concept overlay, returns title=name, description from overlay. Parent concept as chip if exists.

- [ ] **Step 6: Create formula preview adapter**

Loads formula + concept overlay for concept_refs. Shows rendered expression, didactic scope chip, defining concept.

- [ ] **Step 7: Create formula variable preview resolver**

Takes Variable from request. Priority: explanation_overrides → generated from quantity+binding → symbol fallback. Composes human-readable phrase from two layers.

- [ ] **Step 8: Write tests**

Test each adapter with mock data. Test dispatcher routing. Test fallbacks (missing overlay, missing characteristics, missing binding).

- [ ] **Step 9: Run tests**

Run: `npm test`

- [ ] **Step 10: Commit**

```bash
git add src/lib/ont-preview/ src/lib/__tests__/ont-preview-resolver.test.ts
git commit -m "feat: add preview resolver with 6 adapters + formula variable resolver"
```

---

## Chunk 3: UI + Integrations (Phase 3 + Phase 4)

### Task 6: OntPreviewCard component

**Files:**
- Create: `src/components/OntPreviewCard.tsx`
- Create: `src/components/ont-preview-card.css`

- [ ] **Step 1: Create preview card renderer**

Receives `OntPreviewData`, renders: title, subtitle, description, facts list, chips, primary action button. Follows hard limits. Compact card design.

- [ ] **Step 2: Add CSS**

Card with max-width, shadow, border-radius. Responsive. Facts as label:value pairs. Chips inline.

- [ ] **Step 3: Commit**

```bash
git add src/components/OntPreviewCard.tsx src/components/ont-preview-card.css
git commit -m "feat(ui): add OntPreviewCard component"
```

---

### Task 7: OntInteractiveRef component

**Files:**
- Create: `src/components/OntInteractiveRef.tsx`
- Create: `src/components/ont-interactive-ref.css`

- [ ] **Step 1: Create the interactive wrapper**

Props: `entityRef?`, `formulaVariable?`, `formulaId?`, `display`, `context?`, `locale`.

Logic:
- On mouse enter (desktop): start 200ms debounce timer
- On debounce complete: call `resolveOntPreview(request)`, show `OntPreviewCard` in positioned popup
- On mouse leave: dismiss popup
- On click: navigate to `canonicalHref` if exists
- On Escape: dismiss popup
- Positioning: prefer below-right, flip if near viewport edge

- [ ] **Step 2: Add CSS for popup positioning + mobile sheet**

Desktop: absolute positioned popup with shadow.
Mobile: `@media (pointer: coarse)` → bottom sheet style.

- [ ] **Step 3: Commit**

```bash
git add src/components/OntInteractiveRef.tsx src/components/ont-interactive-ref.css
git commit -m "feat(ui): add OntInteractiveRef with hover preview and click navigation"
```

---

### Task 8: Integrate into existing components

**Files:**
- Modify: `src/components/FormulaChip.tsx` — wrap in OntInteractiveRef
- Modify: `src/components/ConceptRef.tsx` — wrap in OntInteractiveRef
- Modify: `src/components/OntEmbedBlock.tsx` — OntRef mode uses OntInteractiveRef

- [ ] **Step 1: Wrap FormulaChip**

FormulaChip already has `substanceId`, `elementId`, `ionId` props. Use the appropriate one as `entityRef` for OntInteractiveRef. Wrap the chip content.

- [ ] **Step 2: Wrap ConceptRef**

ConceptRef renders concept name as link. Wrap in OntInteractiveRef with concept ref.

- [ ] **Step 3: Wrap OntEmbed OntRef mode**

In OntEmbedBlock, the OntRef mode currently renders a plain link. Wrap in OntInteractiveRef.

- [ ] **Step 4: Run tests and build**

Run: `npm test && npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/components/FormulaChip.tsx src/components/ConceptRef.tsx src/components/OntEmbedBlock.tsx
git commit -m "feat: integrate OntInteractiveRef into FormulaChip, ConceptRef, OntEmbedBlock"
```

---

### Task 9: Final verification

- [ ] **Step 1: Run all tests**

Run: `npm test`

- [ ] **Step 2: Full build**

Run: `npm run build`

- [ ] **Step 3: Visual verification**

Run: `npm run preview`

Check:
1. Hover over FormulaChip (e.g., HCl on acids page) → preview card with pKa, class, phase
2. Hover over ConceptRef → preview card with definition
3. Hover over OntEmbed OntRef → preview card
4. Click navigates to correct page
5. Check all 4 locales
6. Check mobile layout (responsive preview card)

- [ ] **Step 4: Commit any fixes**
