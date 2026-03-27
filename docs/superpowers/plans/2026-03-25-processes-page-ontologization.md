# Processes Page Ontologization + UX Upgrade

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the processes reference page from plain-text vocabulary into an ontology-connected, visually rich experience with concept refs, formula chips, and effect-category coloring.

**Architecture:** Keep the existing `process_vocab.json` + `effects_vocab.json` as source of truth but enrich descriptions with RichText (explicit refs to substances, concepts, quantities). Add `concept_ref` fields to link processes and effects to ontology. Upgrade the React component to use FormulaLookupProvider + ConceptProvider for ref resolution. Improve visual design with category-colored borders, better card layout, and clickable ontology chips.

**Tech Stack:** React, TypeScript, CSS modules, existing data-loader pattern, RichText/OntologyRef system

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `data-src/process_vocab.json` | Modify | Add `concept_ref` to entries |
| `data-src/effects_vocab.json` | Modify | Add `concept_ref` to entries |
| `data-src/translations/ru/process_vocab.json` | Modify | Convert descriptions to RichText with refs |
| `data-src/translations/ru/effects_vocab.json` | Modify | Convert descriptions to RichText with refs |
| `src/types/process-vocab.ts` | Modify | Add `concept_ref`, `description` as `string \| RichText` |
| `src/features/processes/ProcessesPage.tsx` | Modify | Add providers, render RichText, visual upgrade |
| `src/features/processes/processes.css` | Modify | Category colors, card redesign |
| `scripts/lib/validate-ontology.mjs` | Modify | Validate process concept_refs |
| `src/lib/__tests__/process-ontology.test.ts` | Create | Validate concept_ref integrity |

---

### Task 1: Add concept_ref to process_vocab + effects_vocab types

**Files:**
- Modify: `src/types/process-vocab.ts`
- Test: `src/lib/__tests__/process-ontology.test.ts`

- [ ] **Step 1: Write failing test — concept_ref type exists**

```typescript
// src/lib/__tests__/process-ontology.test.ts
import { describe, it, expect } from 'vitest';
import type { ProcessVocabEntry, EffectsVocabEntry } from '../../types/process-vocab';

describe('process-vocab types', () => {
  it('ProcessVocabEntry supports concept_ref', () => {
    const entry: ProcessVocabEntry = {
      id: 'test', kind: 'chemical', name: 'test', description: 'test',
      concept_ref: 'concept:chemical_reaction',
    };
    expect(entry.concept_ref).toBe('concept:chemical_reaction');
  });

  it('EffectsVocabEntry supports concept_ref', () => {
    const entry: EffectsVocabEntry = {
      id: 'test', category: 'kinetic', name: 'test', description: 'test',
      concept_ref: 'concept:speed_increase',
    };
    expect(entry.concept_ref).toBe('concept:speed_increase');
  });

  it('description can be RichText array', () => {
    const entry: ProcessVocabEntry = {
      id: 'test', kind: 'chemical', name: 'test',
      description: [{ t: 'text', v: 'A reaction with ' }, { t: 'ref', id: 'concept:metals' }],
    };
    expect(Array.isArray(entry.description)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/process-ontology.test.ts`
Expected: FAIL — `concept_ref` not in type

- [ ] **Step 3: Update types**

```typescript
// src/types/process-vocab.ts
import type { RichText } from './ontology-ref';

export type ProcessKind = 'chemical' | 'physical' | 'driving_force' | 'operation' | 'constraint';
export type EffectCategory = 'kinetic' | 'thermodynamic' | 'mass_transfer' | 'phase';

export interface EffectsVocabEntry {
  id: string;
  category: EffectCategory;
  name: string;
  description: string | RichText;
  concept_ref?: string;
}

export type EffectRef = string | { id: string; when: string };

export interface ProcessVocabEntry {
  id: string;
  kind: ProcessKind;
  name: string;
  description: string | RichText;
  params?: string[];
  effects?: EffectRef[];
  parent?: string;
  concept_ref?: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/process-ontology.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```
feat(processes): add concept_ref + RichText description to process/effect types
```

---

### Task 2: Add concept_ref to process_vocab.json entries

**Files:**
- Modify: `data-src/process_vocab.json`

Add `concept_ref` to entries that have matching concepts. For entries without existing concepts, leave `concept_ref` absent (they can be added later via ontology-enrichment agent).

Known matches from concepts.json:
- `melting` → `concept:melting_point` (approximate — melting is a process, melting_point is a property)
- `boiling` → `concept:boiling` (if exists)

For most entries: use `proc:{id}` convention (future concept creation), but do NOT add to concepts.json yet — that's architect-level. Only add `concept_ref` where a concept already exists.

- [ ] **Step 1: Add concept_ref where concepts exist**

For entries where a matching `concept:*` or `proc:*` already exists in concepts.json, add the ref. For others, skip.

- [ ] **Step 2: Validate**

Run: `npm run validate:data`
Expected: All checks passed

- [ ] **Step 3: Commit**

```
feat(processes): add concept_ref to process_vocab entries
```

---

### Task 3: Convert Russian process descriptions to RichText with refs

**Files:**
- Modify: `data-src/translations/ru/process_vocab.json`

Convert the 35 Russian descriptions from plain strings to RichText arrays, adding `ref` segments for:
- Substance formulas mentioned (AgCl, Cl₂, NaOH, etc.) → `{ t: "formula", kind: "substance", formula: "AgCl" }`
- Concept refs (кислота → `cls:acid`, основание → `cls:base`, соль → `cls:salt`, etc.)
- Quantity refs (температура → `concept:melting_point`, скорость реакции, etc.)
- Process cross-refs (кристаллизация → link to crystallization entry)

Keep plain `{ t: "text", v: "..." }` for educational prose.

- [ ] **Step 1: Convert first 5 entries (chemical kind) as pilot**

Example for `neutralization`:
```json
"neutralization": {
  "name": "нейтрализация",
  "description": [
    { "t": "text", "v": "Реакция " },
    { "t": "ref", "id": "cls:acid", "form": "gen" },
    { "t": "text", "v": " с " },
    { "t": "ref", "id": "cls:base", "form": "ins" },
    { "t": "text", "v": " с образованием " },
    { "t": "ref", "id": "cls:salt", "form": "gen" },
    { "t": "text", "v": " и воды. Экзотермична. Движущая сила — образование слабого электролита (" },
    { "t": "formula", "kind": "substance", "formula": "H₂O" },
    { "t": "text", "v": ")." }
  ]
}
```

- [ ] **Step 2: Convert remaining 30 entries**

Prioritize entries with formula mentions and concept cross-references.

- [ ] **Step 3: Effects vocab descriptions — keep as plain strings**

Effects vocab descriptions (13 entries) are short labels ("Повышение скорости реакции") without formula mentions or concept cross-references. Keep them as plain strings for now. Convert only if needed later.

- [ ] **Step 4: Validate**

Run: `npm run validate:data`

- [ ] **Step 5: Commit**

```
feat(processes): convert Russian descriptions to RichText with ontology refs
```

---

### Task 4: Add build-time validation for process concept_refs

**Files:**
- Modify: `scripts/lib/validate-ontology.mjs`

- [ ] **Step 1: Add validateVocabRefs function inside validate-ontology.mjs**

This function goes inside `validate-ontology.mjs` (same file as `extractRichTextRefs` and `validateRefId`, which are private helpers — no export needed for them). It validates both process_vocab AND effects_vocab entries.

```javascript
export function validateVocabRefs(processEntries, effectEntries, concepts, entityIds) {
  const errors = [];
  const conceptIds = new Set(Object.keys(concepts));

  for (const entry of processEntries) {
    const prefix = `process_vocab["${entry.id}"]`;
    if (entry.concept_ref && !conceptIds.has(entry.concept_ref)) {
      errors.push(`${prefix}: concept_ref "${entry.concept_ref}" not found`);
    }
    if (Array.isArray(entry.description)) {
      for (const refId of extractRichTextRefs(entry.description)) {
        validateRefId(refId, `${prefix}.description`, conceptIds, entityIds, errors);
      }
    }
  }
  for (const entry of effectEntries) {
    const prefix = `effects_vocab["${entry.id}"]`;
    if (entry.concept_ref && !conceptIds.has(entry.concept_ref)) {
      errors.push(`${prefix}: concept_ref "${entry.concept_ref}" not found`);
    }
  }
  return errors;
}
```

- [ ] **Step 2: Wire into build-data.mjs validation**

Import `validateVocabRefs` from `validate-ontology.mjs` and add to the ontology validation block. The variable name for process vocab in build-data.mjs is `processVocab` (array), and effects is `effectsVocab` (array):
```javascript
...validateVocabRefs(processVocab, effectsVocab, concepts, { ionIds, substanceIds, elementSymbols }),
```

- [ ] **Step 3: Validate**

Run: `npm run validate:data`
Expected: All checks passed

- [ ] **Step 4: Commit**

```
feat(processes): add build-time validation for process concept_refs and RichText refs
```

---

### Task 5: Upgrade ProcessesPage component — providers + RichText rendering

**Files:**
- Modify: `src/features/processes/ProcessesPage.tsx`

- [ ] **Step 1: Add FormulaLookupProvider + ConceptProvider**

Add imports:
```typescript
import ChemText, { FormulaLookupProvider, useFormulaLookup } from '../../components/ChemText';
import { ConceptProvider, type ConceptContextValue } from '../../components/ConceptProvider';
import { loadFormulaLookup, loadConcepts, loadConceptOverlay, loadConceptLookup } from '../../lib/data-loader';
import RichTextRenderer from '../../components/RichTextRenderer';
import type { RichText } from '../../types/ontology-ref';
import type { FormulaLookup } from '../../types/formula-lookup';
```

Add state:
```typescript
const [formulaLookup, setFormulaLookup] = useState<FormulaLookup | null>(null);
const [conceptCtx, setConceptCtx] = useState<ConceptContextValue | null>(null);
```

Expand the existing `useEffect` to also load formula lookup + concept data:
```typescript
useEffect(() => {
  Promise.all([
    loadProcessVocab(locale),
    loadEffectsVocab(locale),
    loadFormulaLookup(),
    loadConcepts(),
    loadConceptOverlay(locale),
    loadConceptLookup(locale).catch(() => ({})),
  ]).then(([vocab, effects, fl, registry, overlay, lookup]) => {
    setEntries(vocab);
    setEffectsMap(new Map(effects.map(e => [e.id, e])));
    setFormulaLookup(fl);
    if (registry && overlay) {
      setConceptCtx({ registry, overlay, lookup: lookup ?? {} });
    }
    setLoading(false);
  });
}, [locale]);
```

Wrap return JSX in providers:
```tsx
return (
  <ConceptProvider value={conceptCtx}>
    <FormulaLookupProvider value={formulaLookup}>
      <div className="proc-page">...</div>
    </FormulaLookupProvider>
  </ConceptProvider>
);
```

- [ ] **Step 2: Fix search filter for RichText descriptions (CRITICAL)**

The current search filter calls `e.description.toLowerCase()` which will crash on RichText arrays. Add a helper:

```typescript
function searchableText(desc: string | RichText): string {
  if (typeof desc === 'string') return desc;
  return desc.filter(s => s.t === 'text').map(s => (s as { v: string }).v).join('');
}
```

Update the `filtered` memo:
```typescript
const filtered = useMemo(() => {
  if (!search.trim()) return entries;
  const q = search.trim().toLowerCase();
  return entries.filter(
    e => e.name.toLowerCase().includes(q) || searchableText(e.description).toLowerCase().includes(q),
  );
}, [entries, search]);
```

- [ ] **Step 3: Render description as RichText when it's an array**

```typescript
function renderDescription(desc: string | RichText, locale: SupportedLocale) {
  if (Array.isArray(desc)) {
    return <RichTextRenderer segments={desc} locale={locale} />;
  }
  return <ChemText text={desc} />;
}
```

Replace `{entry.description}` with `renderDescription(entry.description, locale)`.

- [ ] **Step 3: Run tests + dev server check**

Run: `npm test`
Run: `npm run dev` → check `/ru/processes/`

- [ ] **Step 4: Commit**

```
feat(processes): add ConceptProvider + RichText rendering to ProcessesPage
```

---

### Task 6: Visual UX upgrade — category colors, card redesign

**Files:**
- Modify: `src/features/processes/processes.css`
- Modify: `src/features/processes/ProcessesPage.tsx`

- [ ] **Step 1: Add category-specific border colors**

Replace single `--color-primary` left border with kind-specific colors:

```css
.proc-page__entry--chemical { border-left-color: #dc2626; }   /* red */
.proc-page__entry--driving_force { border-left-color: #2563eb; } /* blue */
.proc-page__entry--physical { border-left-color: #7c3aed; }   /* purple */
.proc-page__entry--operation { border-left-color: #059669; }   /* green */
.proc-page__entry--constraint { border-left-color: #d97706; }  /* amber */
```

Apply in component: `className={`proc-page__entry proc-page__entry--${entry.kind}`}`

- [ ] **Step 2: Add effect category colors**

Map effect badge colors to categories instead of simple/conditional:
```css
.proc-page__effect--kinetic { background: #fef2f2; border-color: #fca5a5; color: #991b1b; }
.proc-page__effect--thermodynamic { background: #eff6ff; border-color: #bfdbfe; color: #1e40af; }
.proc-page__effect--mass_transfer { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
.proc-page__effect--phase { background: #faf5ff; border-color: #d8b4fe; color: #6b21a8; }
```

- [ ] **Step 3: Improve card layout — name as header, description below, metadata row**

Restructure card: process name (bold, larger) + kind badge → description → effects + params row.

- [ ] **Step 4: Add parent process breadcrumb with clickable link**

Replace `← parentName` with a styled breadcrumb: `‹ parentName` that scrolls to parent entry.

- [ ] **Step 5: Run tests + visual check**

Run: `npm test`
Visual check: `/ru/processes/` — verify colors, layout

- [ ] **Step 6: Commit**

```
feat(processes): category-colored cards, effect badges, improved layout
```

---

### Task 7: Full test suite + build verification

**Files:**
- Test: all modified files

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass (1299+)

- [ ] **Step 2: Run data validation**

Run: `npm run validate:data`
Expected: All checks passed

- [ ] **Step 3: Run full build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Visual check all 4 locales**

Check: `/ru/processes/`, `/en/processes/`, `/pl/procesy/`, `/es/procesos/`

- [ ] **Step 5: Commit any remaining fixes**

---

## Key References

- Process vocab data: `data-src/process_vocab.json` (35 entries, 5 kinds)
- Effects vocab data: `data-src/effects_vocab.json` (13 entries, 4 categories)
- Russian overlays: `data-src/translations/ru/process_vocab.json`, `data-src/translations/ru/effects_vocab.json`
- Types: `src/types/process-vocab.ts`
- Component: `src/features/processes/ProcessesPage.tsx`
- Styles: `src/features/processes/processes.css`
- Existing concept refs: `concept:melting_point`, `concept:boiling` (only 2 of 35 processes have matches)
- RichText types: `src/types/ontology-ref.ts` — `TextSeg`, `RichText`
- ConceptProvider pattern: `src/components/TheoryModulePanel.tsx:510-520` (semantic layer loading)
- Validation pattern: `scripts/lib/validate-ontology.mjs` — `validateDidacticRefs`, `extractRichTextRefs`, `validateRefId`
- Presentation layer spec: `docs/universal_presentation_layer_spec_ru.md`
