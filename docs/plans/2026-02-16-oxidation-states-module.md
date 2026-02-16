# Oxidation States Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Interactive `/oxidation-states/` page with formula calculator, step-by-step solver, theory panel, and BKT-tracked practice for the `oxidation_states` competency (OGE task types 16 & 17).

**Architecture:** Calculator-centric page following the `/bonds/` pattern — three layers: OxidationCalculator (formula input → computed states + step-by-step explanation), OxidationTheoryPanel (collapsible theory from JSON), PracticeSection (BKT-tracked exercises). Reuses existing `oxidation-state.ts` calculator and `formula-parser.ts`.

**Tech Stack:** Astro 5, React islands (`client:idle`), TypeScript, programmatic SVG, BKT engine.

---

### Task 1: Add `explainOxidationSteps()` to oxidation-state.ts

Extend the existing calculator with a step-by-step explanation function.

**Files:**
- Modify: `src/lib/oxidation-state.ts`

**Implementation:**

Add these types and function after the existing `calcOxidationStates()`:

```typescript
export interface SolveStep {
  symbol: string;
  state: number;
  rule_id: 'fluorine' | 'group1' | 'group2' | 'aluminum' | 'oxygen' | 'oxygen_peroxide' | 'hydrogen' | 'hydrogen_hydride' | 'algebraic' | 'simple_substance';
  equation?: string;
}

export interface ExplainedResult extends OxidationResult {
  steps: SolveStep[];
}
```

`explainOxidationSteps(parsed, elementMap, rawFormula)` follows the same logic as `calcOxidationStates()` but records each rule application as a `SolveStep`. For the algebraic step, format the equation string like `"1×(+1) + 1×x + 4×(−2) = 0 → x = +7"`.

The function should:
1. Simple substance (1 element) → step with `rule_id: 'simple_substance'`, state=0
2. Apply fixed rules in order: F→−1, Group1→+1, Group2→+2, Al→+3, record each step
3. Apply O rule (−2 or −1 for peroxides), record step
4. Apply H rule (+1 or −1 for hydrides), record step
5. If 1 unknown remains, solve algebraically, record step with equation
6. If >1 unknown, return error 'ambiguous'

Return `ExplainedResult` which extends `OxidationResult` with `steps: SolveStep[]`.

**Verify:** `npm run build` passes.

**Commit:** `feat: add explainOxidationSteps() with step-by-step solver`

---

### Task 2: Create oxidation theory JSON and exercise templates

**Files:**
- Create: `data-src/rules/oxidation_theory.json`
- Create: `data-src/exercises/oxidation-exercises.json`

**oxidation_theory.json** structure:

```json
{
  "rules": [
    {
      "id": "simple_substance",
      "order": 0,
      "name_ru": "Простое вещество",
      "rule_ru": "СО элемента в простом веществе = 0",
      "examples": ["Fe⁰", "O₂⁰", "N₂⁰"]
    },
    {
      "id": "fluorine",
      "order": 1,
      "name_ru": "Фтор",
      "rule_ru": "F всегда имеет СО = −1 (самый электроотрицательный элемент)",
      "examples": ["NaF: F⁻¹", "CF₄: F⁻¹"]
    },
    {
      "id": "group1",
      "order": 2,
      "name_ru": "Щелочные металлы (I группа)",
      "rule_ru": "Li, Na, K, Rb, Cs, Fr всегда +1",
      "examples": ["NaCl: Na⁺¹", "K₂O: K⁺¹"]
    },
    {
      "id": "group2",
      "order": 3,
      "name_ru": "Щёлочноземельные металлы (II группа)",
      "rule_ru": "Be, Mg, Ca, Sr, Ba, Ra всегда +2",
      "examples": ["CaO: Ca⁺²", "MgCl₂: Mg⁺²"]
    },
    {
      "id": "aluminum",
      "order": 4,
      "name_ru": "Алюминий",
      "rule_ru": "Al всегда +3",
      "examples": ["Al₂O₃: Al⁺³", "AlCl₃: Al⁺³"]
    },
    {
      "id": "oxygen",
      "order": 5,
      "name_ru": "Кислород",
      "rule_ru": "O обычно −2. Исключение: в пероксидах (H₂O₂, Na₂O₂) → −1",
      "examples": ["H₂O: O⁻²", "CO₂: O⁻²", "H₂O₂: O⁻¹"]
    },
    {
      "id": "hydrogen",
      "order": 6,
      "name_ru": "Водород",
      "rule_ru": "H обычно +1. Исключение: в гидридах металлов (NaH, CaH₂) → −1",
      "examples": ["H₂O: H⁺¹", "HCl: H⁺¹", "NaH: H⁻¹"]
    },
    {
      "id": "algebraic",
      "order": 7,
      "name_ru": "Алгебраический расчёт",
      "rule_ru": "Сумма СО всех атомов в нейтральной молекуле = 0. Зная все СО кроме одного, решаем уравнение.",
      "examples": ["KMnO₄: 1×(+1) + 1×x + 4×(−2) = 0 → Mn = +7"]
    }
  ],
  "redox_concepts": {
    "oxidizer_ru": "Окислитель — атом (элемент), который принимает электроны. Его СО понижается.",
    "reducer_ru": "Восстановитель — атом (элемент), который отдаёт электроны. Его СО повышается.",
    "mnemonic_ru": "ОВ: Окислитель Восстанавливается (принимает e⁻, СО↓), Восстановитель Окисляется (отдаёт e⁻, СО↑)."
  }
}
```

**oxidation-exercises.json** — array of exercise template descriptors (the actual generation is code-based, so this is a metadata file for the build pipeline):

```json
[
  {
    "id": "determine_ox_state",
    "type": "multiple_choice",
    "competency_primary": "oxidation_states",
    "description_ru": "Определите СО элемента в соединении"
  },
  {
    "id": "select_compound_by_ox_state",
    "type": "multiple_choice",
    "competency_primary": "oxidation_states",
    "description_ru": "В каком соединении элемент имеет заданную СО"
  },
  {
    "id": "identify_oxidizer_reducer",
    "type": "multiple_choice",
    "competency_primary": "oxidation_states",
    "description_ru": "Определите окислитель/восстановитель"
  },
  {
    "id": "max_min_ox_state",
    "type": "multiple_choice",
    "competency_primary": "oxidation_states",
    "description_ru": "Максимальная/минимальная СО элемента по положению в таблице"
  }
]
```

**Verify:** Files are valid JSON (e.g. `node -e "JSON.parse(require('fs').readFileSync('data-src/rules/oxidation_theory.json','utf8'))"`)

**Commit:** `feat: add oxidation theory and exercise template data`

---

### Task 3: Pipeline integration (build + manifest + data-loader)

Wire the new data files into the existing data pipeline.

**Files:**
- Modify: `scripts/build-data.mjs` (~lines 83-91 for loading, ~lines 179-182 for copying)
- Modify: `scripts/lib/generate-manifest.mjs` (~lines 28-31 for rules, ~lines 42-44 for exercises)
- Modify: `src/lib/data-loader.ts` (add `loadOxidationTheory()`)
- Modify: `src/types/manifest.ts` (no change needed — `rules` and `exercises` are already `Record<string, string>`)

**Changes in `scripts/build-data.mjs`:**

After line 84 (`const bondsExercises = ...`), add:
```javascript
const oxidationTheory = await loadJson(join(DATA_SRC, 'rules', 'oxidation_theory.json'));
const oxidationExercises = await loadJson(join(DATA_SRC, 'exercises', 'oxidation-exercises.json'));
```

In the console.log section (~line 91), add a line:
```javascript
console.log(`  ${oxidationTheory.rules.length} oxidation rules, ${oxidationExercises.length} oxidation exercises`);
```

In the copy section, after `bonds-exercises.json` write (~line 182), add:
```javascript
await writeFile(join(bundleDir, 'rules', 'oxidation_theory.json'), JSON.stringify(oxidationTheory));
await writeFile(join(bundleDir, 'exercises', 'oxidation-exercises.json'), JSON.stringify(oxidationExercises));
```

**Changes in `scripts/lib/generate-manifest.mjs`:**

In `entrypoints.rules` (after `bond_theory` line 30), add:
```javascript
oxidation_theory: 'rules/oxidation_theory.json',
```

In `entrypoints.exercises` (after `bonds` line 43), add:
```javascript
oxidation: 'exercises/oxidation-exercises.json',
```

**Changes in `src/lib/data-loader.ts`:**

Add type import at top and loader function (follow `loadBondTheory()` pattern):
```typescript
import type { OxidationTheory } from '../types/oxidation';

/** Load oxidation state theory content. */
export async function loadOxidationTheory(): Promise<OxidationTheory> {
  return loadRule('oxidation_theory') as Promise<OxidationTheory>;
}
```

**Types file** — Create `src/types/oxidation.ts`:
```typescript
export interface OxidationRule {
  id: string;
  order: number;
  name_ru: string;
  rule_ru: string;
  examples: string[];
}

export interface RedoxConcepts {
  oxidizer_ru: string;
  reducer_ru: string;
  mnemonic_ru: string;
}

export interface OxidationTheory {
  rules: OxidationRule[];
  redox_concepts: RedoxConcepts;
}
```

**Verify:** `npm run build:data` passes, inspect `public/data/latest/manifest.json` for new entries.

**Commit:** `feat: integrate oxidation theory and exercises into data pipeline`

---

### Task 4: FormulaWithOxStates SVG diagram

Programmatic SVG React component that renders a formula with oxidation state numbers above each element.

**Files:**
- Create: `src/features/oxidation-states/diagrams/FormulaWithOxStates.tsx`

**Props:**
```typescript
interface Props {
  assignments: Array<{ symbol: string; state: number }>;
  counts: Record<string, number>;  // from parseFormula
}
```

**Rendering logic:**
- Horizontal layout, each element group occupies a column
- Bottom row: element symbol + subscript count (if >1)
- Top row: oxidation state (e.g. +7, −2, 0)
- Color: positive states → `#dc2626` (red), negative → `#2563eb` (blue), zero → `#6b7280` (gray)
- SVG with viewBox, scales responsively
- Each element group: symbol text (large, ~24px), state text above (smaller, ~14px), subscript below-right (smaller, ~14px)

Iterate assignments in order. For each, render a group with x offset based on index × column width.

**Verify:** `npm run build` passes.

**Commit:** `feat: add FormulaWithOxStates SVG diagram component`

---

### Task 5: OxidationCalculator component

Main interactive calculator with formula input, result display, and step-by-step solver.

**Files:**
- Create: `src/features/oxidation-states/OxidationCalculator.tsx`

**Architecture:** Follows `src/features/bonds/BondCalculator.tsx` pattern.

**State:**
- `elements: Element[]` — loaded on mount
- `formulaInput: string` — debounced 400ms
- `result: ExplainedResult | null` — from `explainOxidationSteps()`
- `showSteps: boolean` — toggle for step-by-step view

**Flow:**
1. Load elements on mount via `loadElements()`
2. Build `elementInfoMap: Map<string, ElementInfo>` from elements (group + metal_type)
3. On formula change (debounced): `parseFormula(input)` → `explainOxidationSteps(parsed, elementInfoMap, input)` → set result
4. Display: FormulaWithOxStates SVG + "Показать решение" button
5. When steps expanded: render each SolveStep as a card with rule name, symbol, state, and equation if algebraic

**Step card rendering:**
Russian labels for each rule_id:
```typescript
const RULE_LABELS: Record<string, string> = {
  simple_substance: 'Простое вещество → СО = 0',
  fluorine: 'Фтор → всегда −1',
  group1: 'Щелочной металл (I группа) → +1',
  group2: 'Щёлочноземельный металл (II группа) → +2',
  aluminum: 'Алюминий → +3',
  oxygen: 'Кислород → −2',
  oxygen_peroxide: 'Кислород в пероксиде → −1',
  hydrogen: 'Водород → +1',
  hydrogen_hydride: 'Водород в гидриде → −1',
  algebraic: 'Алгебраический расчёт',
};
```

Each step shows: element symbol badge + rule label + resulting state. For algebraic step, also show the equation string.

**Verify:** `npm run build` passes.

**Commit:** `feat: add oxidation state calculator with step-by-step solver`

---

### Task 6: OxidationTheoryPanel component

Collapsible theory panel, lazy-loads data on first expand.

**Files:**
- Create: `src/features/oxidation-states/OxidationTheoryPanel.tsx`

**Architecture:** Follow `src/features/bonds/BondTheoryPanel.tsx` exactly.

- Main trigger button "Теория ▸/▾"
- On first expand: `loadOxidationTheory()` → display content
- Content sections:
  1. **Правила определения СО** — render each rule from `theory.rules[]` as a CollapsibleSection with `name_ru`, `rule_ru`, examples list
  2. **Окислитель и восстановитель** — render `theory.redox_concepts` (oxidizer, reducer, mnemonic) as a single block

Reuse the `CollapsibleSection` pattern from BondTheoryPanel (inline helper component).

**Verify:** `npm run build` passes.

**Commit:** `feat: add oxidation states theory panel`

---

### Task 7: Exercise generator and PracticeSection

Code-based exercise generation + BKT-tracked practice UI.

**Files:**
- Create: `src/features/oxidation-states/practice/generate-exercises.ts`
- Create: `src/features/oxidation-states/practice/PracticeSection.tsx`

**Exercise generator** — follow pattern from `src/features/bonds/practice/generate-exercises.ts`.

Preset examples array `OX_EXAMPLES`:
```typescript
interface OxExample {
  formula: string;
  element: string;    // target element for the question
  state: number;      // correct oxidation state
}
```

Examples (20+):
- KMnO₄: Mn=+7, K=+1, O=−2
- H₂SO₄: S=+6, H=+1, O=−2
- HNO₃: N=+5
- Fe₂O₃: Fe=+3
- CuSO₄: Cu=+2, S=+6
- NaH: H=−1, Na=+1
- H₂O₂: O=−1, H=+1
- NH₃: N=−3
- CO₂: C=+4
- Na₂O: Na=+1, O=−2
- CaCl₂: Ca=+2, Cl=−1
- Al₂O₃: Al=+3
- P₂O₅: P=+5
- SO₃: S=+6
- Cr₂O₃: Cr=+3
- K₂Cr₂O₇: Cr=+6
- MnO₂: Mn=+4
- FeCl₃: Fe=+3, Cl=−1
- CuO: Cu=+2
- N₂O₅: N=+5

Generator functions (same `Exercise` interface as bonds):
1. **determine_ox_state**: "Определите СО [element] в [formula]" → 4 options (correct + 3 distractor states)
2. **select_compound_by_ox_state**: "В каком соединении [element] имеет СО [state]?" → 4 formula options
3. **max_min_ox_state**: "Какова максимальная/минимальная СО [element]?" → uses element's `typical_oxidation_states`
4. **identify_oxidizer_reducer**: "Какой элемент является окислителем/восстановителем?" → given two elements with their state changes

All return `competencyMap: { oxidation_states: 'P' }`.

**PracticeSection** — follow `src/features/bonds/practice/PracticeSection.tsx` pattern exactly.

- Single competency: `oxidation_states`
- Load elements, bktParams, competencies on mount
- Generate exercises via `generateExercise(elements)`
- BKT update on answer
- Progress bar + mastery message at P(L) ≥ 0.8
- Reuse `MultipleChoiceExercise` from `src/features/substances/practice/MultipleChoiceExercise`

**Verify:** `npm run build` passes.

**Commit:** `feat: add oxidation states practice exercises with BKT tracking`

---

### Task 8: Page assembly + CSS + navigation

Wire everything together into the Astro page.

**Files:**
- Create: `src/features/oxidation-states/OxidationStatesPage.tsx`
- Create: `src/features/oxidation-states/oxidation-states.css`
- Create: `src/pages/oxidation-states/index.astro`
- Modify: `src/components/Nav.astro` (line 11, add link)
- Modify: `data-src/rules/competencies.json` (set link for oxidation_states)

**OxidationStatesPage.tsx:**
```tsx
import OxidationCalculator from './OxidationCalculator';
import OxidationTheoryPanel from './OxidationTheoryPanel';
import PracticeSection from './practice/PracticeSection';
import './oxidation-states.css';

export default function OxidationStatesPage() {
  return (
    <div className="oxidation-page">
      <OxidationCalculator />
      <OxidationTheoryPanel />
      <PracticeSection />
    </div>
  );
}
```

**index.astro:**
```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import OxidationStatesPage from '../../features/oxidation-states/OxidationStatesPage';
---

<BaseLayout title="Степени окисления" description="Определение степеней окисления элементов в химических соединениях. Калькулятор с пошаговым решением, теория и практика для ОГЭ.">
  <OxidationStatesPage client:idle />
</BaseLayout>
```

**Nav.astro** — add after the "Связи" link (line 11):
```javascript
{ href: '/oxidation-states/', label: 'СО' },
```

**competencies.json** — change `oxidation_states` entry: `"link": "/oxidation-states/"`

**CSS** — follow `src/features/bonds/bonds.css` pattern with BEM naming:
- `.oxidation-page` — page wrapper, max-width 960px
- `.ox-calc` — calculator section
- `.ox-calc__input` — formula input
- `.ox-result` — result card with border
- `.ox-result__formula-svg` — SVG container
- `.ox-steps` — step-by-step section
- `.ox-step` — individual step card (left border color by rule type)
- `.ox-step__badge` — element symbol badge
- `.ox-step__rule` — rule label text
- `.ox-step__equation` — algebraic equation (monospace)
- Theory panel and practice section reuse existing class patterns from bonds

**Verify:** `npm run build` passes, page count incremented.

**Commit:** `feat: add /oxidation-states/ page with calculator, theory, practice, and navigation`

---

### Task 9: Visual verification

Open the page in browser and verify all features work:

1. Navigate to `/oxidation-states/`
2. Type `KMnO4` → verify K=+1, Mn=+7, O=−2 shown in SVG
3. Click "Показать решение" → verify step-by-step (K group1 → +1, O → −2, Mn algebraic → +7)
4. Type `NaH` → verify H=−1 (hydride case), Na=+1
5. Type `H2O2` → verify O=−1 (peroxide case)
6. Type `Fe` → verify Fe=0 (simple substance)
7. Expand theory panel → verify 7 rules + redox concepts displayed
8. Answer practice exercises → verify BKT updates
9. Check mobile layout (375px viewport)
10. Check console for errors (should be 0)
