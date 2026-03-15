# Page Templates & Content Blocks

> Synthesized from: chemistry_seo_ai_package.zip + chemistry_ontology_seo_graph.zip + chemistry_taskgen_seo_ai_architecture.zip
> Status: **Architecture invariant** for static shell + islands rule

## Core Rule

Every indexable page = **static semantic shell + optional interactive islands**

### Indexable Page Minimum (Sitemap Admission Gate)

**A page must contain ≥4 meaningful semantic content blocks** in server-rendered HTML.
Pages with fewer blocks are thin content — do not add to sitemap.

### Static Shell Must Contain

- title / meta description
- H1/H2 structure
- **≥4 semantic content blocks** (real HTML, not JS-rendered)
- related links (ontology-derived, 3–8 per related group)
- JSON-LD schema
- canonical summaries

### Islands Contain (hydrate lazily with `client:idle` or `client:visible`)

- тренажёры (task engine UI)
- drag-and-drop
- dynamic calculators
- adaptive learning widgets

---

## Element Page Template (Tier A) ✓ Current

```
/periodic-table/{symbol}/
```

| # | Block | Source | Required |
|---|-------|--------|---------|
| 1 | Overview (symbol, name, mass, group/period, class) | `elements.json` | Yes |
| 2 | Atomic structure (electron config, subshells) | `elements.json` | Yes |
| 3 | Properties (electronegativity, radius, melting point, phases) | `elements.json` | Yes |
| 4 | Common oxidation states (with rule references) | `oxidation_rules.json` | Yes |
| 5 | Common compounds | `substances.json` | Recommended |
| 6 | Typical reactions | `reactions.json` | Recommended |
| 7 | Related elements (group/period siblings, 3–8 links) | `elements.json` (derived) | Recommended |
| — | Practice this topic [island] | task engine | Optional |

**Incoming links:** periodic table index, group pages (Tier C), substance pages, reaction pages

---

## Theory Section Page Template (Tier A) ✓ Current — enhance with schema

```
/bonds/, /oxidation-states/, /calculations/, /reactions/
```

Already has: theory module blocks, practice island, BreadcrumbList schema.

Still needed:
- `Course` JSON-LD → add (see `03-schema-strategy.md`)
- Related links section (structured, pointing to related sections and element pages)

---

## Ion Page Template (Tier B) — Phase 2

```
/ions/{ionId}/
```

**Admission criteria:** only if unique search intent exists + template complete.

| # | Block | Source | Required |
|---|-------|--------|---------|
| 1 | Ion overview (formula, charge, type: cation/anion) | `ions.json` | Yes |
| 2 | Parent element page link | `elements.json` | Yes |
| 3 | Common salts (from solubility table) | `solubility_rules.json` | Yes |
| 4 | Typical reactions (at least 2) | `reactions.json` | Yes |
| 5 | Related ions (same charge group, 3–6 links) | `ions.json` (derived) | Recommended |

---

## Reaction Page Template (Tier B) — Phase 2

```
/reactions/{reactionId}/
```

**Before mass promotion to indexed:** this template must be complete. Required blocks:

| # | Block | Required |
|---|-------|---------|
| 1 | Equation (balanced, with phase markers ↑/↓ where appropriate) | Yes |
| 2 | Reactants + products with links to substance/element pages | Yes |
| 3 | Reaction type + process/driving force | Yes |
| 4 | Conditions (temperature, catalyst, pressure) | Yes |
| 5 | Observable signs (precipitate, gas, color change) | Yes |
| 6 | Related concepts (linked to theory section) | Recommended |
| 7 | Net ionic equation (for exchange reactions) | Recommended |
| 8 | Links to reactant/product pages (internal links) | Yes — for sitemap admission |

Until all 8 blocks are implemented, `/reactions/{id}` pages are **Tier B deferred** (not indexed).

---

## Substance Page Template (Tier B) — Phase 2+

```
/substances/{substanceId}/
```

| # | Block | Required |
|---|-------|---------|
| 1 | Formula, name, substance class | Yes |
| 2 | Properties (solubility, state, color) | Yes |
| 3 | Composition: elements with links | Yes |
| 4 | Typical reactions involving this substance | Yes |
| — | Related substances (same class, 3–6 links) | Recommended |

---

## Concept Page Template (Tier B) — Phase 2, max 5 initially

```
/concepts/{concept}/
```

Start with: oxidation-states, chemical-bond, neutralization, electrolyte, catalyst.
Do NOT mass-generate — each page needs unique intent and real content.

| # | Block | Required |
|---|-------|---------|
| 1 | Definition | Yes |
| 2 | 2–4 worked examples | Yes |
| 3 | Related rules / theory module section | Yes |
| 4 | Related elements/substances/reactions | Yes |
| — | Practice [island] | Optional |

---

## What NOT to Index

- Every filter combination
- Every tiny derivation
- Pages with <4 semantic blocks
- Pages that only restate one JSON row without context
- Empty skeleton pages (structure without content)
- Locale pages without actual translated content

Example weak candidates to exclude: `/periodic-table/group/16/` with only an element list → Tier C noindex.
