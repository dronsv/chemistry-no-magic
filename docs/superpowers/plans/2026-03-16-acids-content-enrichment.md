# Acids Content Enrichment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the Acids concept page with educational content: H⁺ donor definition, acid strength/dissociation, pH & indicators, general chemical properties, and key reactions.

**Architecture:** Concept pages render via `ConceptModuleIsland.tsx`, which currently only shows concept_card reactivity rules. We extend it to also render non-concept_card blocks (heading, paragraph, rule_card, table) from the theory module section. New blocks are added to the core module skeleton, text comes from positional overlay arrays, and `applyTheoryModuleOverlay` merges them. One fix needed: add `heading` overlay support to `applyTheoryModuleOverlay`.

**Tech Stack:** JSON data (theory module + 4 locale overlays + 4 concept descriptions) + TypeScript (ConceptModuleIsland block rendering, heading overlay support, CSS newline fix)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `data-src/theory_modules/classification_inorganic.json` | Modify | Add 8 new blocks to `acids` section (language-neutral skeletons) |
| `data-src/translations/ru/theory_modules/classification_inorganic.json` | Modify | Add `blocks` array with Russian text (positional, 10 entries) |
| `data-src/translations/en/theory_modules/classification_inorganic.json` | Modify | Add `blocks` array with English text |
| `data-src/translations/pl/theory_modules/classification_inorganic.json` | Modify | Add `blocks` array with Polish text |
| `data-src/translations/es/theory_modules/classification_inorganic.json` | Modify | Add `blocks` array with Spanish text |
| `data-src/translations/ru/concepts.json` | Modify | Richer `cls:acid` description |
| `data-src/translations/en/concepts.json` | Modify | Richer `cls:acid` description |
| `data-src/translations/pl/concepts.json` | Modify | Richer `cls:acid` description |
| `data-src/translations/es/concepts.json` | Modify | Richer `cls:acid` description |
| `src/components/TheoryModulePanel.tsx` | Modify | Add `heading` block type to `applyTheoryModuleOverlay` |
| `src/components/theory-module.css` | Modify | Add `white-space: pre-line` to `.theory-module__rule-desc` |
| `src/features/concepts/ConceptModuleIsland.tsx` | Modify | Render non-concept_card blocks from theory section |
| `src/features/concepts/concept-module-island.css` | Modify | Import theory-module.css styles for block rendering |

---

## Content Structure (what the acids section will show)

After enrichment, the acids section renders in this order:

1. **[existing]** concept_card: `cls:acid_oxygen` (oxyacids with examples + reactivity rules)
2. **[existing]** concept_card: `cls:acid_oxygenfree` (binary acids with examples + reactivity rules)
3. **[new]** heading: "What is an acid?" / H⁺ donor definition
4. **[new]** paragraph: Brønsted definition — acids are H⁺ donors in aqueous solution
5. **[new]** heading: "Acid strength"
6. **[new]** rule_card: Strong vs weak — ease of H⁺ dissociation, full vs partial ionization
7. **[new]** heading: "Indicators and pH"
8. **[new]** table: 3 indicators × acid/neutral/base color changes
9. **[new]** heading: "Chemical properties of acids"
10. **[new]** rule_card: 4 reaction types with equations (acid + metal, + base, + basic oxide, + salt)

---

## Overlay Format

The `classification_inorganic` overlay currently uses a **concept-keyed** format specific to `ConceptModuleIsland` (e.g., `sections.acids["cls:acid_oxygen"].reactivity_rules`). We add a **positional `blocks` array** alongside this — the same format `applyTheoryModuleOverlay` already reads.

`applyTheoryModuleOverlay` iterates non-ox_rule blocks by position. concept_card blocks consume overlay positions but fall through unchanged. So the `blocks` array includes empty `{}` entries for the 2 concept_cards at positions 0-1, followed by text entries for positions 2-9.

---

### Task 1: Heading overlay support + CSS newline fix

**Files:**
- Modify: `src/components/TheoryModulePanel.tsx:296-365` — `applyTheoryModuleOverlay`
- Modify: `src/components/theory-module.css` — `.theory-module__rule-desc`

- [ ] **Step 1: Add heading overlay handler**

In `src/components/TheoryModulePanel.tsx`, in function `applyTheoryModuleOverlay`, add heading support before the `return block;` fallback (around line 358):

```typescript
        if (block.t === 'heading' && bo.text) {
          return { ...block, text: bo.text as string };
        }
```

- [ ] **Step 2: Add white-space: pre-line to rule-desc**

In `src/components/theory-module.css`, find `.theory-module__rule-desc` and add:

```css
.theory-module__rule-desc {
  white-space: pre-line;
}
```

This ensures `\n` in rule_card descriptions renders as line breaks (needed for numbered reaction lists).

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: all 1240+ tests pass (existing theory-module-overlay tests still pass)

- [ ] **Step 4: Commit**

```bash
git add src/components/TheoryModulePanel.tsx src/components/theory-module.css
git commit -m "fix(theory): add heading overlay support and pre-line for rule descriptions"
```

---

### Task 2: Extend ConceptModuleIsland to render theory blocks

**Files:**
- Modify: `src/features/concepts/ConceptModuleIsland.tsx`
- Modify: `src/features/concepts/concept-module-island.css`

**Context:** `ConceptModuleIsland` already loads the theory module + overlay. Currently it only extracts `reactivity_rules`. We extend it to:
1. Import `applyTheoryModuleOverlay` from TheoryModulePanel
2. Apply overlay to get fully localized blocks
3. Find the section matching the current concept
4. Filter out concept_card blocks
5. Render heading, paragraph, rule_card, table blocks inline

- [ ] **Step 1: Add import**

```typescript
import { applyTheoryModuleOverlay } from '../../components/TheoryModulePanel';
import ChemText from '../../components/ChemText';
import '../../components/theory-module.css';
```

- [ ] **Step 2: Add state for extra blocks**

Add alongside existing state:

```typescript
const [extraBlocks, setExtraBlocks] = useState<TheoryBlock[]>([]);
```

- [ ] **Step 3: Populate extraBlocks in the theory module loading section**

After the existing `if (applicableModule)` block (around line 175), add logic to apply the full overlay and extract non-concept_card blocks:

```typescript
if (applicableModule) {
  const moduleKey = applicableModule.id.includes('classification')
    ? 'classification_inorganic'
    : 'reaction_types';
  const moduleOverlay = await loadTheoryModuleOverlay(moduleKey, loc);

  // Existing: get reactivity rules for this concept's card
  const card = findConceptCard(conceptId, applicableModule);
  if (card?.reactivity_rules) {
    const section = applicableModule.sections.find(s =>
      s.blocks.some(b => b.t === 'concept_card' && b.conceptId === conceptId)
    );
    const rules = section
      ? getLocalizedReactivityRules(conceptId, section, moduleOverlay, card.reactivity_rules)
      : card.reactivity_rules;
    if (!cancelled && rules) setReactivityRules(rules);
  }

  // NEW: get extra theory blocks from the section
  const localizedModule = applyTheoryModuleOverlay(applicableModule, moduleOverlay);
  const section = localizedModule.sections.find(s =>
    s.blocks.some(b => b.t === 'concept_card' && b.conceptId === conceptId)
  );
  if (section && !cancelled) {
    const extras = section.blocks.filter(b => b.t !== 'concept_card');
    setExtraBlocks(extras);
  }
}
```

- [ ] **Step 4: Add a simple block renderer function**

Before the component function, add:

```typescript
function renderSimpleBlock(block: TheoryBlock, locale: string): React.ReactNode {
  switch (block.t) {
    case 'heading':
      if (block.level === 2) return <h2 className="theory-module__h2">{block.text}</h2>;
      if (block.level === 3) return <h3 className="theory-module__h3">{block.text}</h3>;
      return <h4 className="theory-module__h4">{block.text}</h4>;
    case 'paragraph':
      return <p className="theory-module__p"><ChemText text={block.text} /></p>;
    case 'rule_card':
      return (
        <div className="theory-module__rule-card">
          <div className="theory-module__rule-title">{block.title}</div>
          <p className="theory-module__rule-text">{block.rule}</p>
          {block.description && (
            <p className="theory-module__rule-desc"><ChemText text={block.description} /></p>
          )}
        </div>
      );
    case 'table':
      return (
        <div className="theory-module__table-wrapper">
          <table className="theory-module__table">
            <thead>
              <tr>
                {block.columns.map((col, i) => <th key={i}>{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.cells.map((cell, ci) => <td key={ci}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
}
```

- [ ] **Step 5: Render extraBlocks in JSX**

After the matching substances section and before matching reactions, add:

```tsx
{/* Extra theory blocks from theory module section */}
{extraBlocks.length > 0 && (
  <section className="concept-theory-blocks">
    {extraBlocks.map((block, i) => (
      <div key={i}>{renderSimpleBlock(block, locale)}</div>
    ))}
  </section>
)}
```

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/features/concepts/ConceptModuleIsland.tsx src/features/concepts/concept-module-island.css
git commit -m "feat(concepts): render extra theory blocks on concept detail pages"
```

---

### Task 3: Add block skeletons to core theory module

**Files:**
- Modify: `data-src/theory_modules/classification_inorganic.json` — `sections[1].blocks` (the `acids` section)

- [ ] **Step 1: Add 8 new blocks after the two existing concept_cards**

In `classification_inorganic.json`, replace the `acids` section with:

```json
{
  "id": "acids",
  "title_ref": "cls:acid",
  "blocks": [
    {
      "t": "concept_card",
      "conceptId": "cls:acid_oxygen",
      "examples": { "mode": "filter" }
    },
    {
      "t": "concept_card",
      "conceptId": "cls:acid_oxygenfree",
      "examples": { "mode": "filter" }
    },
    { "t": "heading", "level": 3 },
    { "t": "paragraph" },
    { "t": "heading", "level": 3 },
    { "t": "rule_card" },
    { "t": "heading", "level": 3 },
    { "t": "table" },
    { "t": "heading", "level": 3 },
    { "t": "rule_card" }
  ]
}
```

- [ ] **Step 2: Validate data**

Run: `npm run validate:data`
Expected: passes

- [ ] **Step 3: Commit**

```bash
git add data-src/theory_modules/classification_inorganic.json
git commit -m "data(acids): add theory block skeletons to classification module"
```

---

### Task 4: Add overlay text for all 4 locales + update concept descriptions

**Files:**
- Modify: `data-src/translations/{ru,en,pl,es}/theory_modules/classification_inorganic.json`
- Modify: `data-src/translations/{ru,en,pl,es}/concepts.json`

**Overlay format:** Each locale's `classification_inorganic.json` gets a `blocks` array inside `sections.acids`. The array is positional — index 0-1 are empty `{}` for concept_cards, index 2-9 contain text for the new blocks. This coexists with the existing concept-keyed entries (`cls:acid_oxygen`, etc.) which are read separately by `ConceptModuleIsland.getLocalizedReactivityRules()`.

- [ ] **Step 1: Russian overlay + concept description**

In `data-src/translations/ru/concepts.json`, change `cls:acid.description` to:
```
"Сложные вещества — доноры H⁺ в растворе. Состоят из атомов водорода и кислотного остатка. Изменяют окраску индикаторов, реагируют с металлами, основаниями и основными оксидами"
```

In `data-src/translations/ru/theory_modules/classification_inorganic.json`, add `"blocks"` key to `sections.acids`:

```json
"blocks": [
  {},
  {},
  { "text": "Что такое кислота?" },
  { "text": "По теории Брёнстеда, кислота — вещество, способное отдавать протон (H⁺) другой частице. В водном растворе кислоты диссоциируют: HA → H⁺ + A⁻. Именно ионы H⁺ (точнее, H₃O⁺) определяют кислый вкус, способность разъедать металлы и изменять цвет индикаторов." },
  { "text": "Сила кислоты" },
  {
    "title": "Сильные и слабые кислоты",
    "rule": "Сила кислоты определяется лёгкостью отрыва H⁺ от молекулы",
    "description": "Сильные кислоты (HCl, HNO₃, H₂SO₄) диссоциируют полностью: каждая молекула отдаёт H⁺. pH раствора < 1.\nСлабые кислоты (H₂CO₃, H₂S, CH₃COOH) диссоциируют частично: в растворе остаются целые молекулы HA наряду с ионами. pH раствора 3–6.\nЧем легче кислота отдаёт H⁺, тем она сильнее."
  },
  { "text": "Индикаторы и pH" },
  {
    "columns": ["Индикатор", "Кислая среда", "Нейтральная", "Щелочная среда"],
    "rows": [
      ["Лакмус", "Красный", "Фиолетовый", "Синий"],
      ["Фенолфталеин", "Бесцветный", "Бесцветный", "Малиновый"],
      ["Метилоранж", "Красный (розовый)", "Оранжевый", "Жёлтый"]
    ]
  },
  { "text": "Химические свойства кислот" },
  {
    "title": "Общие реакции кислот",
    "rule": "Кислоты реагируют с металлами, основаниями, основными оксидами и солями",
    "description": "1. Кислота + металл (до H₂ в ряду активности) → соль + H₂↑\n   Zn + 2HCl → ZnCl₂ + H₂↑\n2. Кислота + основание → соль + вода (нейтрализация)\n   HCl + NaOH → NaCl + H₂O\n3. Кислота + основный оксид → соль + вода\n   2HCl + CaO → CaCl₂ + H₂O\n4. Кислота + соль → новая кислота + новая соль (если ↑ газ, ↓ осадок или слабый электролит)\n   H₂SO₄ + BaCl₂ → BaSO₄↓ + 2HCl"
  }
]
```

- [ ] **Step 2: English overlay + concept description**

Change `cls:acid.description` to:
```
"H⁺ donors in solution. Composed of hydrogen atoms and an acid residue. Change indicator colours, react with metals, bases, and basic oxides"
```

Add `"blocks"` to `sections.acids` (same 10-element positional array, English text):
- `[2]`: `{ "text": "What is an acid?" }`
- `[3]`: `{ "text": "According to the Brønsted–Lowry theory, an acid is a substance that can donate a proton (H⁺) to another particle. In aqueous solution, acids dissociate: HA → H⁺ + A⁻. The H⁺ ions (more precisely, H₃O⁺) are responsible for the sour taste, the ability to corrode metals, and indicator colour changes." }`
- `[4]`: `{ "text": "Acid strength" }`
- `[5]`: `{ "title": "Strong vs. weak acids", "rule": "Acid strength is determined by how easily H⁺ detaches from the molecule", "description": "Strong acids (HCl, HNO₃, H₂SO₄) dissociate completely: every molecule releases H⁺. Solution pH < 1.\nWeak acids (H₂CO₃, H₂S, CH₃COOH) dissociate partially: intact HA molecules coexist with ions in solution. Solution pH 3–6.\nThe easier an acid releases H⁺, the stronger it is." }`
- `[6]`: `{ "text": "Indicators and pH" }`
- `[7]`: `{ "columns": ["Indicator", "Acidic", "Neutral", "Alkaline"], "rows": [["Litmus", "Red", "Violet", "Blue"], ["Phenolphthalein", "Colourless", "Colourless", "Crimson"], ["Methyl orange", "Red (pink)", "Orange", "Yellow"]] }`
- `[8]`: `{ "text": "Chemical properties of acids" }`
- `[9]`: `{ "title": "General acid reactions", "rule": "Acids react with metals, bases, basic oxides, and salts", "description": "1. Acid + metal (before H₂ in the activity series) → salt + H₂↑\n   Zn + 2HCl → ZnCl₂ + H₂↑\n2. Acid + base → salt + water (neutralisation)\n   HCl + NaOH → NaCl + H₂O\n3. Acid + basic oxide → salt + water\n   2HCl + CaO → CaCl₂ + H₂O\n4. Acid + salt → new acid + new salt (if gas↑, precipitate↓, or weak electrolyte forms)\n   H₂SO₄ + BaCl₂ → BaSO₄↓ + 2HCl" }`

- [ ] **Step 3: Polish overlay + concept description**

Change `cls:acid.description` to:
```
"Donory H⁺ w roztworze. Złożone z atomów wodoru i reszty kwasowej. Zmieniają barwę wskaźników, reagują z metalami, zasadami i tlenkami zasadowymi"
```

Add `"blocks"` to `sections.acids` (same structure, Polish text).

- [ ] **Step 4: Spanish overlay + concept description**

Change `cls:acid.description` to:
```
"Donadores de H⁺ en solución. Compuestos por átomos de hidrógeno y un residuo ácido. Cambian el color de indicadores, reaccionan con metales, bases y óxidos básicos"
```

Add `"blocks"` to `sections.acids` (same structure, Spanish text).

- [ ] **Step 5: Validate data**

Run: `npm run validate:data`
Expected: passes

- [ ] **Step 6: Commit**

```bash
git add data-src/theory_modules/classification_inorganic.json \
  data-src/translations/ru/theory_modules/classification_inorganic.json \
  data-src/translations/en/theory_modules/classification_inorganic.json \
  data-src/translations/pl/theory_modules/classification_inorganic.json \
  data-src/translations/es/theory_modules/classification_inorganic.json \
  data-src/translations/ru/concepts.json \
  data-src/translations/en/concepts.json \
  data-src/translations/pl/concepts.json \
  data-src/translations/es/concepts.json
git commit -m "data(acids): add theory content — H⁺ definition, strength, indicators, properties (4 locales)"
```

---

### Task 5: Build, test, verify

**Files:** none (verification only)

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: builds successfully, 1458 pages

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: all 1240+ tests pass

- [ ] **Step 3: Visual verification**

Run: `npm run preview`

Open `http://localhost:4322/ru/substances/кислоты/` and verify:
1. Concept description is richer (mentions H⁺ donors, indicators, reactions)
2. After the reactivity rules, children cards, and substance grid, 4 new sections appear:
   - "Что такое кислота?" with Brønsted paragraph
   - "Сила кислоты" with strong/weak rule card (numbered lines render correctly)
   - "Индикаторы и pH" with 3-row indicator table
   - "Химические свойства кислот" with 4 reaction types
3. Check `/en/substances/acids/` — English version renders correctly
4. Check `/pl/substancje/kwasy/` — Polish renders correctly
5. Check `/es/sustancias/acidos/` — Spanish renders correctly

- [ ] **Step 4: Commit and push**

```bash
git push origin master
```
