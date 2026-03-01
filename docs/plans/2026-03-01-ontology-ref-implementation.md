# OntologyRef Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a concept navigation layer with auto-detection in text, concept pages, and RichText AST engine integration.

**Architecture:** Concept registry (structural JSON) + per-locale overlays (names, slugs, grammatical forms, surface_forms). `<OntologyRef>` component renders colored inline links to concept pages. `<SmartText>` detects both formulas and concepts in text. Engine returns `RichText` segment arrays; UI resolves locale/morphology from overlays.

**Tech Stack:** Astro 5, React, TypeScript, Vitest. See `docs/plans/2026-03-01-ontology-ref-design.md` for full design.

---

## Task 1: OntRef Types and Utilities

**Files:**
- Create: `src/types/ontology-ref.ts`
- Create: `src/lib/ontology-ref.ts`
- Test: `src/lib/__tests__/ontology-ref.test.ts`

**Step 1: Write failing tests for parseOntRef and toOntRefStr**

```ts
// src/lib/__tests__/ontology-ref.test.ts
import { describe, it, expect } from 'vitest';
import { parseOntRef, toOntRefStr } from '../ontology-ref';

describe('parseOntRef', () => {
  it('parses substance ref', () => {
    expect(parseOntRef('sub:naoh')).toEqual({ kind: 'substance', id: 'naoh' });
  });
  it('parses element ref', () => {
    expect(parseOntRef('el:Na')).toEqual({ kind: 'element', id: 'Na' });
  });
  it('parses ion ref', () => {
    expect(parseOntRef('ion:Na_plus')).toEqual({ kind: 'ion', id: 'Na_plus' });
  });
  it('parses concept refs', () => {
    expect(parseOntRef('cls:base')).toEqual({ kind: 'substance_class', id: 'base' });
    expect(parseOntRef('grp:alkali_metals')).toEqual({ kind: 'element_group', id: 'alkali_metals' });
    expect(parseOntRef('rxtype:neutralization')).toEqual({ kind: 'reaction_type', id: 'neutralization' });
    expect(parseOntRef('proc:decomposition')).toEqual({ kind: 'process', id: 'decomposition' });
    expect(parseOntRef('prop:electronegativity')).toEqual({ kind: 'property', id: 'electronegativity' });
  });
  it('throws on invalid format', () => {
    expect(() => parseOntRef('invalid')).toThrow();
    expect(() => parseOntRef('xxx:foo')).toThrow();
  });
});

describe('toOntRefStr', () => {
  it('serializes substance ref', () => {
    expect(toOntRefStr({ kind: 'substance', id: 'naoh' })).toBe('sub:naoh');
  });
  it('serializes element ref', () => {
    expect(toOntRefStr({ kind: 'element', id: 'Na' })).toBe('el:Na');
  });
  it('serializes concept refs', () => {
    expect(toOntRefStr({ kind: 'substance_class', id: 'base' })).toBe('cls:base');
    expect(toOntRefStr({ kind: 'element_group', id: 'alkali_metals' })).toBe('grp:alkali_metals');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/lib/__tests__/ontology-ref.test.ts`
Expected: FAIL — module not found

**Step 3: Create types**

```ts
// src/types/ontology-ref.ts

/** All entity kinds in the ontology */
export type OntRefKind =
  | 'element'
  | 'substance'
  | 'ion'
  | 'reaction'
  | 'substance_class'
  | 'element_group'
  | 'reaction_type'
  | 'process'
  | 'property'
  | 'context';

/** Typed entity reference */
export interface OntRef {
  kind: OntRefKind;
  id: string;
}

/** Concept kinds (subset of OntRefKind that has pages) */
export type ConceptKind =
  | 'substance_class'
  | 'element_group'
  | 'reaction_type'
  | 'process'
  | 'property';

/** A concept entry from data-src/concepts.json */
export interface ConceptEntry {
  kind: ConceptKind;
  parent_id: string | null;
  order: number;
  filters: Record<string, string | string[]>;
  examples: OntRef[];
  children_order?: string[];
}

/** Concept registry: conceptId → ConceptEntry */
export type ConceptRegistry = Record<string, ConceptEntry>;

/** Grammatical forms map (e.g. gen_pl → "щелочных металлов") */
export type GramForms = Record<string, string>;

/** Per-concept locale overlay entry */
export interface ConceptOverlayEntry {
  name: string;
  slug: string;
  surface_forms?: string[];
  forms?: GramForms;
}

/** Full locale overlay for concepts */
export type ConceptOverlay = Record<string, ConceptOverlayEntry>;

/** Concept lookup: surface form → concept ID (for text auto-detection) */
export type ConceptLookup = Record<string, string>;

// ── RichText AST ──────────────────────────────────────────────

export type TextSeg =
  | { t: 'text'; v: string }
  | { t: 'ref'; id: string; form?: string; surface?: string }
  | { t: 'formula'; kind: 'substance' | 'ion' | 'element'; id?: string; formula: string }
  | { t: 'br' }
  | { t: 'em'; children: RichText }
  | { t: 'strong'; children: RichText };

export type RichText = TextSeg[];
```

**Step 4: Implement parseOntRef / toOntRefStr**

```ts
// src/lib/ontology-ref.ts
import type { OntRef, OntRefKind, RichText } from '../types/ontology-ref';

const PREFIX_TO_KIND: Record<string, OntRefKind> = {
  el: 'element',
  sub: 'substance',
  ion: 'ion',
  rx: 'reaction',
  cls: 'substance_class',
  grp: 'element_group',
  rxtype: 'reaction_type',
  proc: 'process',
  prop: 'property',
  ctx: 'context',
};

const KIND_TO_PREFIX: Record<OntRefKind, string> = Object.fromEntries(
  Object.entries(PREFIX_TO_KIND).map(([k, v]) => [v, k]),
) as Record<OntRefKind, string>;

/** Parse "sub:naoh" → { kind: "substance", id: "naoh" } */
export function parseOntRef(str: string): OntRef {
  const idx = str.indexOf(':');
  if (idx === -1) throw new Error(`Invalid OntRef format: "${str}" (missing ":")`);
  const prefix = str.slice(0, idx);
  const id = str.slice(idx + 1);
  const kind = PREFIX_TO_KIND[prefix];
  if (!kind) throw new Error(`Unknown OntRef prefix: "${prefix}"`);
  return { kind, id };
}

/** Serialize { kind: "substance", id: "naoh" } → "sub:naoh" */
export function toOntRefStr(ref: OntRef): string {
  const prefix = KIND_TO_PREFIX[ref.kind];
  if (!prefix) throw new Error(`Unknown OntRef kind: "${ref.kind}"`);
  return `${prefix}:${ref.id}`;
}

/** Convert RichText AST to plain string (strips refs/formulas to their text) */
export function richTextToPlainString(segments: RichText): string {
  return segments.map(seg => {
    switch (seg.t) {
      case 'text': return seg.v;
      case 'ref': return seg.surface ?? seg.id;
      case 'formula': return seg.formula;
      case 'br': return '\n';
      case 'em': return richTextToPlainString(seg.children);
      case 'strong': return richTextToPlainString(seg.children);
      default: return '';
    }
  }).join('');
}
```

**Step 5: Run tests to verify they pass**

Run: `npm test -- --run src/lib/__tests__/ontology-ref.test.ts`
Expected: PASS

**Step 6: Add richTextToPlainString tests and verify**

Add to same test file:

```ts
import { richTextToPlainString } from '../ontology-ref';
import type { RichText } from '../../types/ontology-ref';

describe('richTextToPlainString', () => {
  it('converts text segments', () => {
    const rich: RichText = [{ t: 'text', v: 'Hello ' }, { t: 'text', v: 'world' }];
    expect(richTextToPlainString(rich)).toBe('Hello world');
  });
  it('uses surface for refs', () => {
    const rich: RichText = [
      { t: 'text', v: 'Реакция ' },
      { t: 'ref', id: 'grp:alkali_metals', form: 'gen_pl', surface: 'щелочных металлов' },
      { t: 'text', v: ' с водой' },
    ];
    expect(richTextToPlainString(rich)).toBe('Реакция щелочных металлов с водой');
  });
  it('falls back to id when no surface', () => {
    const rich: RichText = [{ t: 'ref', id: 'cls:base' }];
    expect(richTextToPlainString(rich)).toBe('cls:base');
  });
  it('handles formula segments', () => {
    const rich: RichText = [{ t: 'formula', kind: 'substance', id: 'naoh', formula: 'NaOH' }];
    expect(richTextToPlainString(rich)).toBe('NaOH');
  });
  it('handles nested em/strong', () => {
    const rich: RichText = [{ t: 'em', children: [{ t: 'text', v: 'важно' }] }];
    expect(richTextToPlainString(rich)).toBe('важно');
  });
});
```

Run: `npm test -- --run src/lib/__tests__/ontology-ref.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add src/types/ontology-ref.ts src/lib/ontology-ref.ts src/lib/__tests__/ontology-ref.test.ts
git commit -m "feat(ontology): OntRef types, parseOntRef, toOntRefStr, richTextToPlainString"
```

---

## Task 2: Concept Registry Data + Build Pipeline

**Files:**
- Create: `data-src/concepts.json`
- Create: `data-src/translations/ru/concepts.json`
- Create: `data-src/translations/en/concepts.json`
- Create: `data-src/translations/es/concepts.json`
- Create: `data-src/translations/pl/concepts.json`
- Modify: `scripts/build-data.mjs` (~line 389)
- Modify: `scripts/lib/generate-manifest.mjs` (line 43, add to rules)
- Create: `scripts/lib/generate-concept-lookup.mjs`

**Step 1: Create concept registry with initial ~20 concepts**

```json
// data-src/concepts.json
{
  "cls:oxide": {
    "kind": "substance_class",
    "parent_id": null,
    "order": 1,
    "filters": { "class": "oxide" },
    "examples": [
      { "kind": "substance", "id": "na2o" },
      { "kind": "substance", "id": "co2" },
      { "kind": "substance", "id": "al2o3" }
    ],
    "children_order": ["cls:oxide_basic", "cls:oxide_acidic", "cls:oxide_amphoteric"]
  },
  "cls:oxide_basic": {
    "kind": "substance_class",
    "parent_id": "cls:oxide",
    "order": 1,
    "filters": { "class": "oxide", "has_property": ["basic"] },
    "examples": [
      { "kind": "substance", "id": "na2o" },
      { "kind": "substance", "id": "cao" }
    ]
  },
  "cls:oxide_acidic": {
    "kind": "substance_class",
    "parent_id": "cls:oxide",
    "order": 2,
    "filters": { "class": "oxide", "has_property": ["acidic"] },
    "examples": [
      { "kind": "substance", "id": "co2" },
      { "kind": "substance", "id": "so3" }
    ]
  },
  "cls:oxide_amphoteric": {
    "kind": "substance_class",
    "parent_id": "cls:oxide",
    "order": 3,
    "filters": { "class": "oxide", "has_property": ["amphoteric"] },
    "examples": [
      { "kind": "substance", "id": "al2o3" },
      { "kind": "substance", "id": "zno" }
    ]
  },
  "cls:acid": {
    "kind": "substance_class",
    "parent_id": null,
    "order": 2,
    "filters": { "class": "acid" },
    "examples": [
      { "kind": "substance", "id": "hcl" },
      { "kind": "substance", "id": "h2so4" }
    ],
    "children_order": ["cls:acid_oxygen", "cls:acid_oxygenfree"]
  },
  "cls:acid_oxygen": {
    "kind": "substance_class",
    "parent_id": "cls:acid",
    "order": 1,
    "filters": { "class": "acid", "has_property": ["oxygen_containing"] },
    "examples": [
      { "kind": "substance", "id": "h2so4" },
      { "kind": "substance", "id": "hno3" }
    ]
  },
  "cls:acid_oxygenfree": {
    "kind": "substance_class",
    "parent_id": "cls:acid",
    "order": 2,
    "filters": { "class": "acid", "has_property": ["oxygen_free"] },
    "examples": [
      { "kind": "substance", "id": "hcl" },
      { "kind": "substance", "id": "hf" }
    ]
  },
  "cls:base": {
    "kind": "substance_class",
    "parent_id": null,
    "order": 3,
    "filters": { "class": "base" },
    "examples": [
      { "kind": "substance", "id": "naoh" },
      { "kind": "substance", "id": "fe_oh_3" }
    ],
    "children_order": ["cls:base_alkali", "cls:base_insoluble", "cls:base_amphoteric"]
  },
  "cls:base_alkali": {
    "kind": "substance_class",
    "parent_id": "cls:base",
    "order": 1,
    "filters": { "class": "base", "has_property": ["soluble_in_water"] },
    "examples": [
      { "kind": "substance", "id": "naoh" },
      { "kind": "substance", "id": "koh" }
    ]
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
  "cls:base_amphoteric": {
    "kind": "substance_class",
    "parent_id": "cls:base",
    "order": 3,
    "filters": { "class": "base", "has_property": ["amphoteric"] },
    "examples": [
      { "kind": "substance", "id": "al_oh_3" },
      { "kind": "substance", "id": "zn_oh_2" }
    ]
  },
  "cls:salt": {
    "kind": "substance_class",
    "parent_id": null,
    "order": 4,
    "filters": { "class": "salt" },
    "examples": [
      { "kind": "substance", "id": "nacl" },
      { "kind": "substance", "id": "caco3" }
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
  "grp:halogens": {
    "kind": "element_group",
    "parent_id": null,
    "order": 2,
    "filters": { "group_name": "halogens" },
    "examples": [
      { "kind": "element", "id": "F" },
      { "kind": "element", "id": "Cl" },
      { "kind": "element", "id": "Br" }
    ]
  },
  "grp:noble_gases": {
    "kind": "element_group",
    "parent_id": null,
    "order": 3,
    "filters": { "group_name": "noble_gases" },
    "examples": [
      { "kind": "element", "id": "He" },
      { "kind": "element", "id": "Ne" },
      { "kind": "element", "id": "Ar" }
    ]
  },
  "grp:alkaline_earth": {
    "kind": "element_group",
    "parent_id": null,
    "order": 4,
    "filters": { "group_name": "alkaline_earth_metals" },
    "examples": [
      { "kind": "element", "id": "Mg" },
      { "kind": "element", "id": "Ca" },
      { "kind": "element", "id": "Ba" }
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
  },
  "rxtype:decomposition": {
    "kind": "reaction_type",
    "parent_id": null,
    "order": 2,
    "filters": { "reaction_type": "decomposition" },
    "examples": [
      { "kind": "reaction", "id": "rx_decomp_01" }
    ]
  },
  "rxtype:exchange": {
    "kind": "reaction_type",
    "parent_id": null,
    "order": 3,
    "filters": { "reaction_type": "exchange" },
    "examples": [
      { "kind": "reaction", "id": "rx_precip_01_baso4" }
    ]
  },
  "rxtype:redox": {
    "kind": "reaction_type",
    "parent_id": null,
    "order": 4,
    "filters": { "reaction_type": "redox" },
    "examples": [
      { "kind": "reaction", "id": "rx_redox_01_zn_hcl" }
    ]
  }
}
```

**Step 2: Create Russian locale overlay**

Create `data-src/translations/ru/concepts.json` with names, slugs, surface_forms, and grammatical forms for all ~20 concepts. Include at minimum `name`, `slug`, and `surface_forms`. Add `forms` (gen_pl, dat_pl, ins_pl, prep_pl) for high-frequency terms.

**Step 3: Create en/es/pl locale overlays**

Same structure, no `forms` needed for en/es. Polish needs `forms` for cases.

**Step 4: Create concept lookup generator**

```js
// scripts/lib/generate-concept-lookup.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Generate concept_lookup.{locale}.json — maps surface forms to concept IDs.
 * Used by SmartText to detect concept terms in text.
 *
 * @param {object} concepts - concept registry (data-src/concepts.json)
 * @param {string} translationsDir - data-src/translations/
 * @param {string} outDir - bundle output directory
 * @param {string[]} locales - ['ru', 'en', 'pl', 'es']
 * @returns {Record<string, number>} locale → entry count
 */
export async function generateConceptLookups(concepts, translationsDir, outDir, locales) {
  const counts = {};
  for (const locale of locales) {
    const lookup = {};
    let overlay;
    try {
      const raw = await readFile(join(translationsDir, locale, 'concepts.json'), 'utf-8');
      overlay = JSON.parse(raw);
    } catch {
      counts[locale] = 0;
      continue;
    }

    for (const conceptId of Object.keys(concepts)) {
      const ov = overlay[conceptId];
      if (!ov) continue;

      // Add surface_forms
      if (ov.surface_forms) {
        for (const form of ov.surface_forms) {
          lookup[form.toLowerCase()] = conceptId;
        }
      }

      // Add all grammatical forms as surface forms too
      if (ov.forms) {
        for (const text of Object.values(ov.forms)) {
          lookup[text.toLowerCase()] = conceptId;
        }
      }
    }

    await writeFile(
      join(outDir, `concept_lookup.${locale}.json`),
      JSON.stringify(lookup, null, 0),
    );
    counts[locale] = Object.keys(lookup).length;
  }
  return counts;
}
```

**Step 5: Register in build pipeline**

In `scripts/build-data.mjs`, add:
1. Load concepts.json (~line 170):
   ```js
   const concepts = JSON.parse(await readFile(join(DATA_SRC, 'concepts.json'), 'utf-8'));
   ```
2. Copy to bundle dir (~line 350):
   ```js
   await writeFile(join(bundleDir, 'concepts.json'), JSON.stringify(concepts));
   ```
3. Generate concept lookups (~line 390, after formula lookup):
   ```js
   const conceptCounts = await generateConceptLookups(
     concepts, join(DATA_SRC, 'translations'), bundleDir, ['ru', 'en', 'pl', 'es']
   );
   ```

In `scripts/lib/generate-manifest.mjs`, add to `entrypoints` (line 43):
```js
concepts: 'concepts.json',
```

**Step 6: Run build to verify**

Run: `npm run build:data`
Expected: No errors. `public/data/{hash}/concepts.json` and `concept_lookup.*.json` generated.

**Step 7: Commit**

```bash
git add data-src/concepts.json data-src/translations/*/concepts.json \
  scripts/lib/generate-concept-lookup.mjs scripts/build-data.mjs \
  scripts/lib/generate-manifest.mjs
git commit -m "feat(ontology): concept registry + locale overlays + concept lookup build pipeline"
```

---

## Task 3: Data Loader for Concepts

**Files:**
- Modify: `src/types/manifest.ts` (add `concepts` to entrypoints)
- Modify: `src/lib/data-loader.ts` (add `loadConcepts`, `loadConceptOverlay`, `loadConceptLookup`)

**Step 1: Update manifest types**

In `src/types/manifest.ts`, add `concepts: string;` to `ManifestEntrypoints` alongside existing fields like `elements`, `ions`.

**Step 2: Add loaders to data-loader.ts**

Follow existing patterns (`loadFormulaLookup`, `loadTranslationOverlay`):

```ts
import type { ConceptRegistry, ConceptOverlay, ConceptLookup } from '../types/ontology-ref';

export async function loadConcepts(): Promise<ConceptRegistry> {
  return loadDataFile<ConceptRegistry>('concepts.json');
}

export async function loadConceptOverlay(locale: SupportedLocale): Promise<ConceptOverlay | null> {
  const overlay = await loadTranslationOverlay(locale, 'concepts', true);
  return overlay as ConceptOverlay | null;
}

export async function loadConceptLookup(locale: SupportedLocale): Promise<ConceptLookup> {
  return loadDataFile<ConceptLookup>(`concept_lookup.${locale}.json`);
}
```

Note: `loadTranslationOverlay` with `allowRu=true` since all locales including Russian have overlays.

**Step 3: Run build + existing tests to verify nothing breaks**

Run: `npm test -- --run`
Expected: All existing tests pass.

**Step 4: Commit**

```bash
git add src/types/manifest.ts src/lib/data-loader.ts
git commit -m "feat(ontology): concept data loaders (loadConcepts, loadConceptOverlay, loadConceptLookup)"
```

---

## Task 4: ConceptProvider Context

**Files:**
- Create: `src/components/ConceptProvider.tsx`

**Step 1: Create context provider**

Follow `FormulaLookupProvider` pattern from `ChemText.tsx:10-28`:

```tsx
// src/components/ConceptProvider.tsx
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { ConceptRegistry, ConceptOverlay, ConceptLookup } from '../types/ontology-ref';

export interface ConceptContextValue {
  registry: ConceptRegistry;
  overlay: ConceptOverlay;
  lookup: ConceptLookup;
}

const ConceptCtx = createContext<ConceptContextValue | null>(null);

export function ConceptProvider({
  value,
  children,
}: {
  value: ConceptContextValue | null;
  children: ReactNode;
}) {
  return <ConceptCtx.Provider value={value}>{children}</ConceptCtx.Provider>;
}

export function useConcepts(): ConceptContextValue | null {
  return useContext(ConceptCtx);
}
```

**Step 2: Commit**

```bash
git add src/components/ConceptProvider.tsx
git commit -m "feat(ontology): ConceptProvider context for OntologyRef + SmartText"
```

---

## Task 5: OntologyRef Component

**Files:**
- Create: `src/components/OntologyRef.tsx`
- Create: `src/components/ontology-ref.css`

**Step 1: Create CSS with kind-based colors**

```css
/* src/components/ontology-ref.css */
.ont-ref {
  display: inline;
  padding: 0.1rem 0.35rem;
  border-radius: 0.2rem;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: filter 0.15s;
  white-space: nowrap;
}

.ont-ref:hover {
  filter: brightness(0.92);
  text-decoration: underline;
}

/* Substance class colors — match FormulaChip palette */
.ont-ref--oxide { background: #fef3c7; color: #92400e; }
.ont-ref--acid { background: #fee2e2; color: #991b1b; }
.ont-ref--base { background: #dbeafe; color: #1e40af; }
.ont-ref--salt { background: #d1fae5; color: #065f46; }

/* Element group */
.ont-ref--element_group { background: var(--color-bg-alt, #f1f5f9); color: var(--color-text-muted, #475569); }

/* Reaction type */
.ont-ref--reaction_type { background: #ede9fe; color: #7c3aed; }

/* Process */
.ont-ref--process { background: #ccfbf1; color: #0d9488; }

/* Property */
.ont-ref--property { background: #f1f5f9; color: #475569; }

/* Tooltip (same pattern as FormulaChip) */
.ont-ref__tooltip {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  background: var(--color-text, #1e293b);
  color: var(--color-bg, #fff);
  font-size: 0.6875rem;
  font-weight: 400;
  padding: 0.3rem 0.5rem;
  border-radius: 0.25rem;
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
  opacity: 0;
  transition: opacity 0.15s;
}

.ont-ref:hover .ont-ref__tooltip {
  opacity: 1;
}
```

**Step 2: Create OntologyRef component**

```tsx
// src/components/OntologyRef.tsx
import { useState } from 'react';
import { useConcepts } from './ConceptProvider';
import { localizeUrl } from '../lib/i18n';
import type { SupportedLocale } from '../types/i18n';
import type { ConceptKind } from '../types/ontology-ref';
import './ontology-ref.css';

/** Route templates per concept kind */
const KIND_ROUTES: Record<ConceptKind, string> = {
  substance_class: '/substances/',
  element_group: '/periodic-table/',
  reaction_type: '/reactions/',
  process: '/processes/',
  property: '/properties/',
};

/** For substance_class, derive color from filters.class */
function getCssClass(kind: ConceptKind, filters: Record<string, string | string[]>): string {
  if (kind === 'substance_class' && typeof filters.class === 'string') {
    return `ont-ref--${filters.class}`;
  }
  return `ont-ref--${kind}`;
}

/** Build concept page URL by walking parent_id chain for slug hierarchy */
function buildConceptUrl(
  conceptId: string,
  ctx: { registry: Record<string, { kind: ConceptKind; parent_id: string | null }>, overlay: Record<string, { slug: string }> },
  locale?: SupportedLocale,
): string {
  const entry = ctx.registry[conceptId];
  if (!entry) return '#';
  const ov = ctx.overlay[conceptId];
  if (!ov) return '#';

  // Build slug path by walking parent chain
  const slugs: string[] = [];
  let current: string | null = conceptId;
  while (current) {
    const curOv = ctx.overlay[current];
    if (curOv) slugs.unshift(curOv.slug);
    current = ctx.registry[current]?.parent_id ?? null;
  }

  const base = KIND_ROUTES[entry.kind] ?? '/';
  const path = base + slugs.join('/') + '/';
  return locale ? localizeUrl(path, locale) : path;
}

interface OntologyRefProps {
  id: string;
  form?: string;
  surface?: string;
  locale?: SupportedLocale;
}

export default function OntologyRef({ id, form, surface, locale }: OntologyRefProps) {
  const ctx = useConcepts();
  const [hovered, setHovered] = useState(false);

  if (!ctx) {
    // No provider — render plain text fallback
    return <span>{surface ?? id}</span>;
  }

  const entry = ctx.registry[id];
  const ov = ctx.overlay[id];
  if (!entry || !ov) {
    return <span>{surface ?? id}</span>;
  }

  // Resolve display label: surface → forms[form] → name
  let label = ov.name;
  if (surface) {
    label = surface;
  } else if (form && ov.forms?.[form]) {
    label = ov.forms[form];
  }

  const href = buildConceptUrl(id, ctx, locale);
  const cssClass = `ont-ref ${getCssClass(entry.kind, entry.filters)}`;

  return (
    <a
      className={cssClass}
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative' }}
    >
      {label}
      {hovered && (
        <span className="ont-ref__tooltip">
          {ov.name}
        </span>
      )}
    </a>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/OntologyRef.tsx src/components/ontology-ref.css
git commit -m "feat(ontology): OntologyRef component with kind-based colors + slug routing"
```

---

## Task 6: SmartText Component

**Files:**
- Create: `src/components/SmartText.tsx`

**Step 1: Create SmartText — unified formula + concept text parser**

Follow `ChemText.tsx` pattern (lines 30-166). SmartText does both formula AND concept detection in one pass:

```tsx
// src/components/SmartText.tsx
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import FormulaChip from './FormulaChip';
import OntologyRef from './OntologyRef';
import { useFormulaLookup } from './ChemText';
import { useConcepts } from './ConceptProvider';
import type { FormulaLookupEntry } from '../types/formula-lookup';
import type { SupportedLocale } from '../types/i18n';

interface SmartTextProps {
  text: string;
  locale?: SupportedLocale;
}

type Match = {
  type: 'formula';
  entry: FormulaLookupEntry;
  matched: string;
} | {
  type: 'concept';
  conceptId: string;
  matched: string;
};

export default function SmartText({ text, locale }: SmartTextProps) {
  const formulaLookup = useFormulaLookup();
  const concepts = useConcepts();

  // Build combined lookup: surface form → Match
  // Formula matches have priority over concept matches
  const combinedLookup = useMemo(() => {
    const map = new Map<string, Match>();

    // Concepts first (lower priority — formulas override)
    if (concepts?.lookup) {
      for (const [form, conceptId] of Object.entries(concepts.lookup)) {
        map.set(form.toLowerCase(), { type: 'concept', conceptId, matched: form });
      }
    }

    // Formulas override (higher priority)
    if (formulaLookup) {
      for (const [formula, entry] of Object.entries(formulaLookup)) {
        map.set(formula.toLowerCase(), { type: 'formula', entry, matched: formula });
      }
    }

    return map;
  }, [formulaLookup, concepts?.lookup]);

  // Build regex from all keys, sorted longest first
  const regex = useMemo(() => {
    if (combinedLookup.size === 0) return null;
    const keys = Array.from(combinedLookup.keys());
    keys.sort((a, b) => b.length - a.length);
    const escaped = keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`(${escaped.join('|')})(?![a-zа-яё])`, 'gi');
  }, [combinedLookup]);

  if (!regex) return <>{text}</>;

  // Parse text into segments
  const result: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex
  regex.lastIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    const matchedText = match[0];
    const start = match.index;

    // Lookbehind check: skip if preceded by a letter
    if (start > 0) {
      const prev = text[start - 1];
      if (/[a-zA-Zа-яёА-ЯЁ]/.test(prev)) continue;
    }

    // Add text before match
    if (start > lastIndex) {
      result.push(text.slice(lastIndex, start));
    }

    const info = combinedLookup.get(matchedText.toLowerCase());
    if (info?.type === 'formula') {
      const e = info.entry;
      result.push(
        <FormulaChip
          key={`f-${start}`}
          formula={matchedText}
          substanceId={e.type === 'substance' ? e.id : undefined}
          substanceClass={e.type === 'substance' ? e.cls : e.type === 'element' ? 'simple' : undefined}
          ionId={e.type === 'ion' ? e.id : undefined}
          ionType={e.type === 'ion' ? e.ionType : undefined}
          locale={locale}
        />
      );
    } else if (info?.type === 'concept') {
      result.push(
        <OntologyRef
          key={`c-${start}`}
          id={info.conceptId}
          surface={matchedText}
          locale={locale}
        />
      );
    }

    lastIndex = start + matchedText.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return <>{result}</>;
}
```

**Step 2: Commit**

```bash
git add src/components/SmartText.tsx
git commit -m "feat(ontology): SmartText component — unified formula + concept auto-detection"
```

---

## Task 7: RichTextRenderer Component

**Files:**
- Create: `src/components/RichTextRenderer.tsx`

**Step 1: Create renderer for engine RichText segments**

```tsx
// src/components/RichTextRenderer.tsx
import type { ReactNode } from 'react';
import type { RichText, TextSeg } from '../types/ontology-ref';
import type { SupportedLocale } from '../types/i18n';
import FormulaChip from './FormulaChip';
import OntologyRef from './OntologyRef';
import SmartText from './SmartText';

interface RichTextRendererProps {
  segments: RichText;
  locale?: SupportedLocale;
}

function renderSeg(seg: TextSeg, idx: number, locale?: SupportedLocale): ReactNode {
  switch (seg.t) {
    case 'text':
      // Run SmartText on plain text segments to detect remaining formulas/concepts
      return <SmartText key={idx} text={seg.v} locale={locale} />;
    case 'ref':
      return (
        <OntologyRef
          key={idx}
          id={seg.id}
          form={seg.form}
          surface={seg.surface}
          locale={locale}
        />
      );
    case 'formula':
      return (
        <FormulaChip
          key={idx}
          formula={seg.formula}
          substanceId={seg.kind === 'substance' ? seg.id : undefined}
          substanceClass={seg.kind === 'substance' ? undefined : seg.kind === 'element' ? 'simple' : undefined}
          ionId={seg.kind === 'ion' ? seg.id : undefined}
          locale={locale}
        />
      );
    case 'br':
      return <br key={idx} />;
    case 'em':
      return <em key={idx}>{renderSegments(seg.children, locale)}</em>;
    case 'strong':
      return <strong key={idx}>{renderSegments(seg.children, locale)}</strong>;
    default:
      return null;
  }
}

function renderSegments(segments: RichText, locale?: SupportedLocale): ReactNode[] {
  return segments.map((seg, i) => renderSeg(seg, i, locale));
}

export default function RichTextRenderer({ segments, locale }: RichTextRendererProps) {
  return <>{renderSegments(segments, locale)}</>;
}
```

**Step 2: Commit**

```bash
git add src/components/RichTextRenderer.tsx
git commit -m "feat(ontology): RichTextRenderer — renders engine RichText AST segments"
```

---

## Task 8: Concept Route Config + i18n

**Files:**
- Modify: `src/lib/i18n.ts` (add concept routes to SLUG_MAP)

**Step 1: Add concept route entries**

Add slug map entries for concept page routes. These are the base routes — dynamic slugs are appended at build time.

Check current `SLUG_MAP` structure in `src/lib/i18n.ts` and add entries for `/substances/{class}/`, `/periodic-table/{group}/`, `/reactions/{type}/`. Use the same pattern as existing routes.

Since concept pages are sub-paths of existing features, check that `localizeUrl()` handles them correctly (it should — the function maps known prefixes).

**Step 2: Add CONCEPT_KIND_ROUTES export**

```ts
export const CONCEPT_KIND_ROUTES: Record<string, string> = {
  substance_class: '/substances/',
  element_group: '/periodic-table/',
  reaction_type: '/reactions/',
  process: '/processes/',
  property: '/properties/',
};
```

**Step 3: Run existing tests**

Run: `npm test -- --run`
Expected: All pass.

**Step 4: Commit**

```bash
git add src/lib/i18n.ts
git commit -m "feat(ontology): concept route config in i18n module"
```

---

## Task 9: Concept Pages (Astro)

**Files:**
- Create: `src/features/concepts/concept-detail-paths.ts`
- Create: `src/features/concepts/ConceptDetailPage.astro`
- Create: `src/pages/substances/[...conceptSlug].astro` (catch-all for substance class concepts)
- Create localized variants: `src/pages/en/substances/[...conceptSlug].astro`, etc.

**Step 1: Create concept detail path generator**

Follow `substance-detail-paths.ts` pattern. Read `data-src/concepts.json` + locale overlays at build time. Generate paths for all concept entries, building hierarchical slugs from parent_id chains.

**Step 2: Create ConceptDetailPage.astro**

Render: breadcrumbs, name, examples (FormulaChips), children (OntologyRefs), "Show all" link to filtered catalog.

**Step 3: Create page files**

Start with substance_class concepts only (most populated). Create catch-all routes for each locale. Add element_group, reaction_type, etc. in separate sub-tasks if needed.

**Step 4: Run build**

Run: `npm run build`
Expected: Concept pages generated. Check `/substances/bases/` and `/substances/bases/insoluble/` in build output.

**Step 5: Commit**

```bash
git add src/features/concepts/ src/pages/substances/\[...conceptSlug\].astro \
  src/pages/en/substances/\[...conceptSlug\].astro \
  src/pages/es/sustancias/\[...conceptSlug\].astro \
  src/pages/pl/substancje/\[...conceptSlug\].astro
git commit -m "feat(ontology): concept pages for substance classes with breadcrumbs + examples"
```

---

## Task 10: Engine renderToRichText

**Files:**
- Modify: `src/lib/task-engine/types.ts` (add RichText re-export, update SlotValues)
- Modify: `src/lib/task-engine/prompt-renderer.ts` (add renderToRichText)
- Test: `src/lib/task-engine/__tests__/prompt-renderer.test.ts`

**Step 1: Write failing test for renderToRichText**

```ts
import { describe, it, expect } from 'vitest';
import { renderToRichText } from '../prompt-renderer';

describe('renderToRichText', () => {
  it('returns text-only segments for templates without refs', () => {
    const ctx = {
      promptTemplates: {
        'test.v1': { question: 'Какой тип связи в {formula}?', slots: { formula: 'direct' } },
      },
      properties: [],
      morphology: null,
    };
    const result = renderToRichText('test.v1', { formula: 'NaCl' }, ctx);
    expect(result).toEqual([{ t: 'text', v: 'Какой тип связи в NaCl?' }]);
  });

  it('parses {ref:id|form} tokens into ref segments', () => {
    const ctx = {
      promptTemplates: {
        'test.v2': {
          question: 'Реакция {ref:grp:alkali_metals|gen_pl} с водой',
          slots: {},
        },
      },
      properties: [],
      morphology: null,
    };
    const result = renderToRichText('test.v2', {}, ctx);
    expect(result).toEqual([
      { t: 'text', v: 'Реакция ' },
      { t: 'ref', id: 'grp:alkali_metals', form: 'gen_pl' },
      { t: 'text', v: ' с водой' },
    ]);
  });

  it('handles mixed slots and refs', () => {
    const ctx = {
      promptTemplates: {
        'test.v3': {
          question: '{substance_name} относится к {ref:cls:base|dat_pl}',
          slots: { substance_name: 'direct' },
        },
      },
      properties: [],
      morphology: null,
    };
    const result = renderToRichText('test.v3', { substance_name: 'NaOH' }, ctx);
    expect(result).toEqual([
      { t: 'text', v: 'NaOH относится к ' },
      { t: 'ref', id: 'cls:base', form: 'dat_pl' },
    ]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/task-engine/__tests__/prompt-renderer.test.ts`
Expected: FAIL — renderToRichText not found

**Step 3: Implement renderToRichText**

Add to `src/lib/task-engine/prompt-renderer.ts`:

```ts
import type { RichText, TextSeg } from '../../types/ontology-ref';

const REF_PATTERN = /\{ref:([^|}]+)(?:\|([^}]+))?\}/g;

export function renderToRichText(
  promptTemplateId: string,
  slotValues: SlotValues,
  ctx: RenderContext,
): RichText {
  // First resolve slots as before (produces string with {ref:...} intact)
  const resolved = renderPrompt(promptTemplateId, slotValues, ctx);

  // Then parse ref tokens into segments
  const segments: RichText = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  REF_PATTERN.lastIndex = 0;
  while ((match = REF_PATTERN.exec(resolved)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ t: 'text', v: resolved.slice(lastIndex, match.index) });
    }
    const seg: TextSeg = { t: 'ref', id: match[1] };
    if (match[2]) (seg as { t: 'ref'; id: string; form?: string }).form = match[2];
    segments.push(seg);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < resolved.length) {
    segments.push({ t: 'text', v: resolved.slice(lastIndex) });
  }

  // If no refs found, return single text segment
  if (segments.length === 0) {
    segments.push({ t: 'text', v: resolved });
  }

  return segments;
}
```

Note: this requires that `renderPrompt` does NOT replace `{ref:...}` tokens — it only replaces `{slot}` tokens. Check that the current `replaceAll` loop skips ref tokens (it should, since ref tokens use `{ref:id|form}` not `{slotName}`).

**Step 4: Run tests**

Run: `npm test -- --run src/lib/task-engine/__tests__/prompt-renderer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/task-engine/prompt-renderer.ts src/lib/task-engine/__tests__/prompt-renderer.test.ts
git commit -m "feat(ontology): renderToRichText — engine produces RichText AST with ref segments"
```

---

## Task 11: Full Build + E2E Verification

**Step 1: Run full build**

Run: `npm run build`
Expected: All pages build (944+ existing + new concept pages).

**Step 2: Run all tests**

Run: `npm test -- --run`
Expected: All tests pass (540+ existing + new ontology-ref tests).

**Step 3: Spot-check concept pages**

Run: `npm run preview`
- Check `/substances/bases/` → shows "Основания" concept page
- Check `/en/substances/bases/` → shows "Bases" concept page
- Check `/substances/bases/insoluble/` → breadcrumbs: Substances → Bases → Insoluble Bases

**Step 4: Commit if any fixes needed**

```bash
git commit -m "fix(ontology): [describe fix]"
```
