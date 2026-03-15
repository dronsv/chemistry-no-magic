# Internal Link Graph (Ontology-Driven)

> Synthesized from: chemistry_seo_ai_package.zip + chemistry_ontology_seo_graph.zip

## Why This Matters

**Семантические кластеры** — самый сильный сигнал для Google в области crawl priority.

Search engines reward tightly connected topical clusters:

```
Periodic table
→ element pages
→ reactions involving elements
→ ions
→ oxidation state theory
```

Эти страницы взаимно усиливают друг друга через ссылки.

---

## Link Generation Rules

Links should be **derived from ontology data**, not written by hand.

### Element Page Links

Example: element Oxygen (`/periodic-table/O/`)

```ts
// Auto-generated related links:
elements.filter(e => e.group === current.group).slice(0, 8)   // Group 16 elements
elements.filter(e => e.period === current.period).slice(0, 8) // Period 2 elements
reactions.filter(r => r.reactants.includes(current.id))       // Reactions involving O
ions.filter(i => i.elements.includes(current.symbol))          // Ions of this element
```

Links to generate:
- Group N elements (group family)
- Period N elements (period family)
- Common ions (O²⁻, OH⁻)
- Common compounds (H₂O, CO₂, Fe₂O₃)
- Typical reactions (combustion, oxidation)

### Ion Page Links

Ion pages link to:
- Parent element page
- Compounds containing the ion
- Reactions producing the ion

Example: `SO₄²⁻` page links to → H₂SO₄, Na₂SO₄, BaSO₄

### Reaction Page Links

Each reaction links to:
- Reactant substance pages
- Product substance pages
- Reaction type concept page
- Driving force concept page

Example: Neutralization `HCl + NaOH → NaCl + H₂O` links to:
→ HCl page, NaOH page, NaCl page, H₂O page, Acid-Base concept

---

## Semantic Cluster Map (for chemistry.svistunov.online)

```
/periodic-table/              ← Hub
  ↓
/periodic-table/{element}     ← 118 spokes
  ↓
/ions/{ion}                   ← ion children
/substances/{substance}       ← compound children
/reactions/{reaction}         ← reaction children
  ↑
/bonds/                       ← theory hub
/oxidation-states/            ← theory hub
/calculations/                ← theory hub
```

---

---

## Link Count Rules (Quality Guard)

To prevent page overload and keep UI clean:

| Related block | Min links | Max links |
|---------------|-----------|-----------|
| Group/period siblings | 3 | 8 |
| Reactions involving element | 1 | 5 |
| Common compounds | 2 | 6 |
| Related ions | 1 | 4 |

**Layout rule:** Maximum 2 related-link blocks above the fold. All others below.

---

## Implementation Priority

| Action | Phase | Impact | Effort |
|--------|-------|--------|--------|
| Auto-link element pages to group/period siblings | 2 | High | Medium |
| Link element pages to reactions they appear in | 2 | High | Low (use existing reactions data) |
| Link substance pages to element pages | 2 | Medium | Low |
| Link ion pages to parent elements | 2 | High | Low |
| Add breadcrumb nav (already done) | Done | — | — |
