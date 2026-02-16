# Block B: Chemical Bonds Module — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `/bonds/` page with interactive bond-type calculator, SVG bond diagrams, theory panel, and BKT-tracked practice exercises covering `bond_type` and `crystal_structure_type` competencies.

**Architecture:** Calculator-centric page following the three-layer pattern (Calculator → TheoryPanel → PracticeSection). Bond type computed algorithmically from Δχ and metal_type using existing element data. SVG diagrams rendered programmatically by React components.

**Tech Stack:** Astro 5 + React islands, TypeScript, programmatic SVG, BKT engine

---

### Task 1: Bond Calculator Algorithm

**Files:**
- Create: `src/lib/bond-calculator.ts`

Pure functions, no React dependency. Reuses `parseFormula` from `src/lib/formula-parser.ts` and element data from `elements.json`.

**Types:**

```typescript
export type BondType = 'ionic' | 'covalent_polar' | 'covalent_nonpolar' | 'metallic';
export type CrystalStructure = 'ionic' | 'molecular' | 'atomic' | 'metallic';

export interface BondAnalysis {
  elementA: string;     // symbol
  elementB: string;     // symbol (same as A for simple substances)
  chiA: number | null;
  chiB: number | null;
  deltaChi: number | null;
  bondType: BondType;
  crystalStructure: CrystalStructure;
}

export interface FormulaAnalysis {
  formula: string;
  bonds: BondAnalysis[];
  crystalStructure: CrystalStructure;
}
```

**Core algorithm — `determineBondType`:**

```typescript
import type { Element, MetalType } from '../types/element';

/** Elements with atomic crystal structure (OGE-relevant hardcoded list). */
const ATOMIC_CRYSTAL_SUBSTANCES = new Set([
  'C', 'Si', 'B', 'Ge',         // simple atomic crystals
]);
const ATOMIC_CRYSTAL_COMPOUNDS = new Set([
  'SiO2', 'B2O3', 'SiC', 'Al2O3',  // compound atomic crystals
]);

export function determineBondType(
  elA: { symbol: string; electronegativity: number | null; metal_type: MetalType },
  elB: { symbol: string; electronegativity: number | null; metal_type: MetalType },
): BondType {
  const bothMetal = elA.metal_type === 'metal' && elB.metal_type === 'metal';
  const bothNonmetal = elA.metal_type !== 'metal' && elB.metal_type !== 'metal';
  const sameElement = elA.symbol === elB.symbol;

  // Simple substance of one metal → metallic
  if (sameElement && elA.metal_type === 'metal') return 'metallic';
  // Simple substance of one nonmetal → covalent nonpolar
  if (sameElement) return 'covalent_nonpolar';
  // Both metals → metallic (alloy)
  if (bothMetal) return 'metallic';

  // Use Δχ when available
  if (elA.electronegativity != null && elB.electronegativity != null) {
    const delta = Math.abs(elA.electronegativity - elB.electronegativity);
    if (delta >= 1.7) return 'ionic';
    if (delta > 0.4) return 'covalent_polar';
    return 'covalent_nonpolar';
  }

  // Fallback: metal + nonmetal → ionic
  if (!bothMetal && !bothNonmetal) return 'ionic';
  return 'covalent_nonpolar';
}

export function determineCrystalStructure(
  bondType: BondType,
  formula: string,
  elements: string[], // element symbols in the formula
): CrystalStructure {
  if (bondType === 'ionic') return 'ionic';
  if (bondType === 'metallic') return 'metallic';
  // Atomic crystals
  if (elements.length === 1 && ATOMIC_CRYSTAL_SUBSTANCES.has(elements[0])) return 'atomic';
  if (ATOMIC_CRYSTAL_COMPOUNDS.has(formula)) return 'atomic';
  return 'molecular';
}
```

**Main entry — `analyzeFormula`:**

```typescript
import { parseFormula } from './formula-parser';

export function analyzeFormula(
  formula: string,
  elementMap: Map<string, Element>,
): FormulaAnalysis {
  const parsed = parseFormula(formula);
  const symbols = Object.keys(parsed);

  if (symbols.length === 0) {
    throw new Error(`Cannot parse formula: ${formula}`);
  }

  // For single element → bond with itself
  if (symbols.length === 1) {
    const el = elementMap.get(symbols[0]);
    if (!el) throw new Error(`Unknown element: ${symbols[0]}`);
    const bond = determineBondType(el, el);
    return {
      formula,
      bonds: [{ elementA: el.symbol, elementB: el.symbol, chiA: el.electronegativity, chiB: el.electronegativity, deltaChi: 0, bondType: bond }],
      crystalStructure: determineCrystalStructure(bond, formula, symbols),
    };
  }

  // For compounds → determine bond for the most different pair
  // (simplified: use the pair with max Δχ, which drives the bond type)
  const els = symbols.map(s => elementMap.get(s)).filter(Boolean) as Element[];
  let maxDelta = 0;
  let bestPair: [Element, Element] = [els[0], els[els.length - 1]];
  for (let i = 0; i < els.length; i++) {
    for (let j = i + 1; j < els.length; j++) {
      const d = Math.abs((els[i].electronegativity ?? 0) - (els[j].electronegativity ?? 0));
      if (d > maxDelta) { maxDelta = d; bestPair = [els[i], els[j]]; }
    }
  }

  const bondType = determineBondType(bestPair[0], bestPair[1]);
  const deltaChi = (bestPair[0].electronegativity != null && bestPair[1].electronegativity != null)
    ? Math.abs(bestPair[0].electronegativity - bestPair[1].electronegativity)
    : null;

  const bonds: BondAnalysis[] = [{
    elementA: bestPair[0].symbol,
    elementB: bestPair[1].symbol,
    chiA: bestPair[0].electronegativity,
    chiB: bestPair[1].electronegativity,
    deltaChi,
    bondType,
  }];

  return {
    formula,
    bonds,
    crystalStructure: determineCrystalStructure(bondType, formula, symbols),
  };
}
```

**Commit:** `feat: add bond calculator algorithm (bond type + crystal structure)`

---

### Task 2: Bond Theory Data

**Files:**
- Create: `data-src/rules/bond_theory.json`
- Modify: `scripts/build-data.mjs` — add bond_theory to pipeline
- Modify: `scripts/lib/generate-manifest.mjs` — add to rules entrypoints
- Modify: `src/lib/data-loader.ts` — add `loadBondTheory()`

**bond_theory.json structure:**

```json
{
  "bond_types": [
    {
      "id": "ionic",
      "name_ru": "Ионная связь",
      "description_ru": "Связь между металлом и неметаллом за счёт переноса электронов. Образуются ионы: катион (+) и анион (−).",
      "rule_ru": "Δχ ≥ 1,7 или металл + неметалл с высокой разностью электроотрицательностей",
      "examples": ["NaCl", "KBr", "CaO", "MgF2"],
      "properties_ru": "Высокие температуры плавления, хрупкие, проводят ток в расплаве и растворе"
    },
    {
      "id": "covalent_polar",
      "name_ru": "Ковалентная полярная связь",
      "description_ru": "Связь между разными неметаллами за счёт общих электронных пар. Электронная плотность смещена к более электроотрицательному атому (δ+, δ−).",
      "rule_ru": "0,4 < Δχ < 1,7 (оба — неметаллы)",
      "examples": ["HCl", "H2O", "NH3", "CO2"],
      "properties_ru": "Различные т.пл., часто жидкости или газы, не проводят ток"
    },
    {
      "id": "covalent_nonpolar",
      "name_ru": "Ковалентная неполярная связь",
      "description_ru": "Связь между одинаковыми неметаллами за счёт общих электронных пар. Электронная плотность распределена симметрично.",
      "rule_ru": "Δχ ≤ 0,4 (одинаковые или очень близкие неметаллы)",
      "examples": ["H2", "O2", "N2", "Cl2", "F2"],
      "properties_ru": "Низкие т.пл., газы или легкокипящие жидкости, не проводят ток"
    },
    {
      "id": "metallic",
      "name_ru": "Металлическая связь",
      "description_ru": "Связь в металлах: атомы отдают валентные электроны в общее «электронное облако», которое удерживает положительные ионы в решётке.",
      "rule_ru": "Простое вещество металла или сплав (оба — металлы)",
      "examples": ["Fe", "Cu", "Na", "Al"],
      "properties_ru": "Электро- и теплопроводность, пластичность, металлический блеск"
    }
  ],
  "crystal_structures": [
    {
      "id": "ionic",
      "name_ru": "Ионная решётка",
      "bond_type": "ionic",
      "description_ru": "В узлах — чередующиеся катионы и анионы, удерживаемые электростатическим притяжением.",
      "properties": {
        "melting_point_ru": "Высокая (800–3000 °C)",
        "hardness_ru": "Твёрдые, хрупкие",
        "conductivity_ru": "В расплаве и растворе",
        "solubility_ru": "Часто растворимы в воде"
      },
      "examples": ["NaCl", "KBr", "CaO"]
    },
    {
      "id": "molecular",
      "name_ru": "Молекулярная решётка",
      "bond_type": "covalent_polar",
      "description_ru": "В узлах — молекулы, связанные слабыми межмолекулярными силами (Ван-дер-Ваальса, водородные связи).",
      "properties": {
        "melting_point_ru": "Низкая (< 300 °C)",
        "hardness_ru": "Мягкие",
        "conductivity_ru": "Не проводят ток",
        "solubility_ru": "По-разному"
      },
      "examples": ["H2O (лёд)", "CO2 (сухой лёд)", "I2", "сахар"]
    },
    {
      "id": "atomic",
      "name_ru": "Атомная решётка",
      "bond_type": "covalent_nonpolar",
      "description_ru": "В узлах — атомы, связанные прочными ковалентными связями по всему кристаллу.",
      "properties": {
        "melting_point_ru": "Очень высокая (> 1500 °C)",
        "hardness_ru": "Очень твёрдые",
        "conductivity_ru": "Не проводят (кроме графита)",
        "solubility_ru": "Нерастворимы"
      },
      "examples": ["Алмаз (C)", "Кремний (Si)", "Кварц (SiO₂)"]
    },
    {
      "id": "metallic",
      "name_ru": "Металлическая решётка",
      "bond_type": "metallic",
      "description_ru": "В узлах — ионы металла, между ними — свободные электроны (электронный газ).",
      "properties": {
        "melting_point_ru": "Разная (от −39 °C у Hg до 3422 °C у W)",
        "hardness_ru": "Разная (Na мягкий, W твёрдый)",
        "conductivity_ru": "Высокая",
        "solubility_ru": "Нерастворимы"
      },
      "examples": ["Fe", "Cu", "Al", "Au"]
    }
  ]
}
```

**Data loader addition** (follow existing pattern in `src/lib/data-loader.ts`):

```typescript
import type { BondTheory } from '../types/bond';

/** Load bond theory content (bond types + crystal structures). */
export async function loadBondTheory(): Promise<BondTheory> {
  return loadRule('bond_theory') as Promise<BondTheory>;
}
```

**Type** — create `src/types/bond.ts`:

```typescript
export interface BondTypeInfo {
  id: string;
  name_ru: string;
  description_ru: string;
  rule_ru: string;
  examples: string[];
  properties_ru: string;
}

export interface CrystalStructureInfo {
  id: string;
  name_ru: string;
  bond_type: string;
  description_ru: string;
  properties: {
    melting_point_ru: string;
    hardness_ru: string;
    conductivity_ru: string;
    solubility_ru: string;
  };
  examples: string[];
}

export interface BondTheory {
  bond_types: BondTypeInfo[];
  crystal_structures: CrystalStructureInfo[];
}
```

**Pipeline changes** — add to `scripts/build-data.mjs` (follow pattern of existing rules like `solubility_rules_light`):
- Load `data-src/rules/bond_theory.json`
- Copy to `bundleDir/rules/bond_theory.json`

**Manifest** — add to `scripts/lib/generate-manifest.mjs` in `rules` section:
```javascript
bond_theory: 'rules/bond_theory.json',
```

**Commit:** `feat: add bond theory data, types, and data loader`

---

### Task 3: Bond Exercise Templates

**Files:**
- Create: `data-src/exercises/bonds-exercises.json`
- Modify: `scripts/build-data.mjs` — load bonds exercises
- Modify: `scripts/lib/generate-manifest.mjs` — add to exercises entrypoints

**bonds-exercises.json:**

```json
[
  {
    "id": "identify_bond_type",
    "name_ru": "Определи тип связи",
    "competencies": { "bond_type": "P", "periodic_table": "S" },
    "description_ru": "Дана формула вещества — определить тип химической связи",
    "format": "multiple_choice",
    "distractor_strategy": "other_bond_types"
  },
  {
    "id": "identify_crystal_structure",
    "name_ru": "Определи тип решётки",
    "competencies": { "crystal_structure_type": "P", "bond_type": "S" },
    "description_ru": "Дана формула — определить тип кристаллической решётки",
    "format": "multiple_choice",
    "distractor_strategy": "other_crystal_types"
  },
  {
    "id": "select_substance_by_bond",
    "name_ru": "Выбери вещество с заданным типом связи",
    "competencies": { "bond_type": "P" },
    "description_ru": "Дан тип связи — выбрать вещество, в котором такая связь",
    "format": "multiple_choice",
    "distractor_strategy": "substances_with_other_bonds"
  },
  {
    "id": "predict_property_by_structure",
    "name_ru": "Предскажи свойство по решётке",
    "competencies": { "crystal_structure_type": "P" },
    "description_ru": "Дано вещество и его решётка — предсказать физическое свойство",
    "format": "multiple_choice",
    "distractor_strategy": "properties_of_other_structures"
  },
  {
    "id": "compare_melting_points",
    "name_ru": "Сравни температуры плавления",
    "competencies": { "crystal_structure_type": "P", "bond_type": "S" },
    "description_ru": "Даны два вещества — определить, у какого выше т.пл. на основе типа решётки",
    "format": "multiple_choice",
    "distractor_strategy": "wrong_comparison"
  },
  {
    "id": "bond_from_delta_chi",
    "name_ru": "Тип связи по Δχ",
    "competencies": { "bond_type": "P", "periodic_table": "S" },
    "description_ru": "Даны два элемента и их χ — определить тип связи по разности",
    "format": "multiple_choice",
    "distractor_strategy": "other_bond_types"
  }
]
```

**Manifest exercises entry:**
```javascript
bonds: 'exercises/bonds-exercises.json',
```

**Commit:** `feat: add bond exercise templates to data pipeline`

---

### Task 4: SVG Bond Diagrams

**Files:**
- Create: `src/features/bonds/diagrams/BondDiagramIonic.tsx`
- Create: `src/features/bonds/diagrams/BondDiagramCovalent.tsx`
- Create: `src/features/bonds/diagrams/BondDiagramMetallic.tsx`
- Create: `src/features/bonds/diagrams/ElectronegativityBar.tsx`

All are pure React SVG components — no external dependencies.

**BondDiagramIonic** — two circle-atoms, arrow showing e⁻ transfer, resulting charges:
```tsx
interface Props {
  symbolA: string;  // e.g. "Na"
  symbolB: string;  // e.g. "Cl"
  chiA: number | null;
  chiB: number | null;
}
```
SVG: left circle (metal, blue-ish) → arrow labeled "e⁻" → right circle (nonmetal, red-ish). Below: Na⁺ and Cl⁻ ions with + and − signs. Width ~300, height ~140.

**BondDiagramCovalent** — two circle-atoms with shared electron pairs between them:
```tsx
interface Props {
  symbolA: string;
  symbolB: string;
  polar: boolean;    // show δ+/δ− labels
  chiA: number | null;
  chiB: number | null;
}
```
SVG: left circle + right circle, overlapping region with dots (electron pairs). If polar, add δ+ over less electronegative atom, δ− over more electronegative. Width ~300, height ~140.

**BondDiagramMetallic** — grid of metal atoms with electron cloud:
```tsx
interface Props {
  symbol: string;
}
```
SVG: 3×2 grid of circles (atoms) with a semi-transparent blue area filling gaps (electron cloud / "electron gas"). Width ~300, height ~140.

**ElectronegativityBar** — horizontal scale showing two elements and Δχ:
```tsx
interface Props {
  symbolA: string;
  symbolB: string;
  chiA: number;
  chiB: number;
}
```
SVG: horizontal line 0→4, two markers for χ values, bracket showing Δχ with label. Width ~300, height ~60.

**Commit:** `feat: add SVG bond diagram components`

---

### Task 5: BondCalculator Component

**Files:**
- Create: `src/features/bonds/BondCalculator.tsx`

Main interactive component. Two input modes:

**Formula mode:** text input → `parseFormula` + `analyzeFormula` → result card.

**Element pair mode:** two `<select>` dropdowns (searchable, sorted by symbol) → `determineBondType` → result card.

**State:**
```typescript
const [mode, setMode] = useState<'formula' | 'pair'>('formula');
const [formulaInput, setFormulaInput] = useState('');
const [elA, setElA] = useState<string>('');  // symbol
const [elB, setElB] = useState<string>('');  // symbol
const [result, setResult] = useState<FormulaAnalysis | null>(null);
const [elements, setElements] = useState<Element[]>([]);
```

**Result card layout:**
- Formula + name (if matched in substances index)
- Δχ value and bond type label (colored badge)
- Appropriate SVG diagram (ionic/covalent/metallic)
- ElectronegativityBar (when Δχ available)
- Crystal structure + properties table

Loads `elements` on mount. Computes result on input change (debounced for formula mode).

**Commit:** `feat: add BondCalculator interactive component`

---

### Task 6: BondTheoryPanel Component

**Files:**
- Create: `src/features/bonds/BondTheoryPanel.tsx`

Collapsible panel (pattern from `ClassificationTheoryPanel`). Loads `bond_theory.json` on first expand.

Sections:
1. Four collapsible sections (one per bond type): rule, description, examples, properties
2. Crystal structures comparison table at the bottom

Reuse `CollapsibleSection` pattern inline (same as substances module — simple local component).

**Commit:** `feat: add BondTheoryPanel with collapsible sections`

---

### Task 7: Bond Practice Section

**Files:**
- Create: `src/features/bonds/practice/generate-exercises.ts`
- Create: `src/features/bonds/practice/PracticeSection.tsx`
- Reuse: `src/features/substances/practice/MultipleChoiceExercise.tsx` — move to shared `src/components/MultipleChoiceExercise.tsx` or import from substances

**generate-exercises.ts** — follows pattern from `src/features/substances/practice/generate-exercises.ts`:

Exercise generators (6 types from Task 3):
- `identify_bond_type`: pick random substance from preset list → compute bond type → 4 options (ionic/covalent polar/covalent nonpolar/metallic)
- `identify_crystal_structure`: pick substance → compute structure → 4 options
- `select_substance_by_bond`: pick bond type → show 4 substances, one has that bond
- `predict_property_by_structure`: pick substance + structure → ask about melting point/conductivity/hardness
- `compare_melting_points`: pick two substances with different structures → ask which melts higher
- `bond_from_delta_chi`: give two elements + their χ values → determine bond type

Input: `elements: Element[]`, `bondTheory: BondTheory`.

**Preset substance list** for exercises (representative OGE examples):
```typescript
const BOND_EXAMPLES = [
  { formula: 'NaCl', bondType: 'ionic' },
  { formula: 'KBr', bondType: 'ionic' },
  { formula: 'CaO', bondType: 'ionic' },
  { formula: 'H2O', bondType: 'covalent_polar' },
  { formula: 'HCl', bondType: 'covalent_polar' },
  { formula: 'NH3', bondType: 'covalent_polar' },
  { formula: 'CO2', bondType: 'covalent_polar' },
  { formula: 'H2', bondType: 'covalent_nonpolar' },
  { formula: 'O2', bondType: 'covalent_nonpolar' },
  { formula: 'N2', bondType: 'covalent_nonpolar' },
  { formula: 'Cl2', bondType: 'covalent_nonpolar' },
  { formula: 'Fe', bondType: 'metallic' },
  { formula: 'Cu', bondType: 'metallic' },
  { formula: 'Na', bondType: 'metallic' },
  { formula: 'Al', bondType: 'metallic' },
];
```

**PracticeSection.tsx** — follows `src/features/substances/practice/PracticeSection.tsx` exactly:
- Tracks `bond_type` and `crystal_structure_type` competencies
- Shows progress bars
- BKT update on answer
- Mastery at P(L) ≥ 0.8

**Commit:** `feat: add bond practice section with exercise generation`

---

### Task 8: Page Assembly and Navigation

**Files:**
- Create: `src/features/bonds/BondsPage.tsx`
- Create: `src/features/bonds/bonds.css`
- Create: `src/pages/bonds/index.astro`
- Modify: `src/components/Nav.astro` — add "Связи" link
- Modify: `data-src/rules/competencies.json` — set `link: "/bonds/"` for `bond_type` and `crystal_structure_type`

**BondsPage.tsx:**
```tsx
import BondCalculator from './BondCalculator';
import BondTheoryPanel from './BondTheoryPanel';
import PracticeSection from './practice/PracticeSection';
import './bonds.css';

export default function BondsPage() {
  return (
    <div className="bonds-page">
      <BondCalculator />
      <BondTheoryPanel />
      <PracticeSection />
    </div>
  );
}
```

**Astro page** (follows substances pattern):
```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import BondsPage from '../../features/bonds/BondsPage';
---
<BaseLayout title="Химическая связь" description="Определение типа химической связи и кристаллической решётки по формуле вещества. Калькулятор, теория и практика для ОГЭ.">
  <BondsPage client:idle />
</BaseLayout>
```

**Nav update** — add between Вещества and Реакции:
```javascript
{ href: '/bonds/', label: 'Связи' },
```

**bonds.css** — page container + calculator-specific styles. Follow BEM naming: `.bonds-page`, `.bond-calc`, `.bond-calc__input`, `.bond-result`, `.bond-result__badge`, `.bond-theory`, etc.

**Commit:** `feat: add /bonds/ page with navigation and CSS`

---

### Task 9: Build & Visual Verification

1. Run `npm run build` — must pass with zero errors
2. Run `npm run dev` — open `/bonds/` in browser
3. Verify:
   - Formula input: type "NaCl" → shows ionic bond, ionic lattice, SVG diagram
   - Formula input: type "H2O" → covalent polar, molecular lattice
   - Formula input: type "Fe" → metallic bond, metallic lattice
   - Formula input: type "O2" → covalent nonpolar, molecular lattice
   - Formula input: type "SiO2" → covalent polar + atomic lattice (exception)
   - Element pair mode: select Na + Cl → same as NaCl
   - Theory panel: opens, shows 4 bond types + crystal table
   - Practice: exercises generate, BKT updates, progress bars move
   - Mobile: check responsive layout
4. Fix any issues found

**Commit:** `fix: polish bonds module after visual review` (if needed)
