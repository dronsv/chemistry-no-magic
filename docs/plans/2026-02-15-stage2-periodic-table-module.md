# Stage 2: Periodic Table Learning Module — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn `/periodic-table/` into a full learning module with programmatic electron config visualizations, energy-based explanations, and mixed-format practice exercises with BKT integration.

**Architecture:** Electron config engine as pure TypeScript functions (computation rules in code). All course content (explanations, theory texts, exercise templates, competency names) in `data-src/` JSON with `_ru` suffix convention for future i18n. Reuse existing table components inline on page.

**Tech Stack:** React island (`client:idle`), SVG for diagrams, existing BKT engine + storage layer.

**Data principle:** JSON for content (editable without recompile), TypeScript for algorithms (universal physics).

---

## Task 1: Electron Config Types

**Files:**
- Create: `src/types/electron-config.ts`

**Step 1: Create types file**

```typescript
// src/types/electron-config.ts
export type SubshellType = 's' | 'p' | 'd' | 'f';
export type Spin = 'up' | 'down' | 'empty';

/** One subshell in the full electron configuration. */
export interface OrbitalFilling {
  n: number;
  l: SubshellType;
  electrons: number;
  max: number; // 2, 6, 10, or 14
}

/** One orbital box (for box diagram rendering with Hund's rule). */
export interface OrbitalBox {
  n: number;
  l: SubshellType;
  index: number; // orbital index within subshell (0-based)
  spins: [Spin, Spin];
}

/** Subshell on the energy level diagram. */
export interface EnergyLevel {
  n: number;
  l: SubshellType;
  energy_order: number; // Klechkowski filling position
  electrons: number;
  is_valence: boolean;
}

/** Exception element data (loaded from JSON). */
export interface ElectronConfigException {
  Z: number;
  symbol: string;
  expected_formula: string;
  actual_formula: string;
  rule: 'half_filled_stability' | 'full_filled_stability' | 'exchange_energy';
  reason_ru: string;
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx astro check 2>&1 | head -20`
Expected: No errors related to `electron-config.ts`

**Step 3: Commit**

```bash
git add src/types/electron-config.ts
git commit -m "feat: add electron config types for Stage 2"
```

---

## Task 2: Electron Config Exception Data (JSON)

**Files:**
- Create: `data-src/electron-config-exceptions.json`

**Step 1: Create exceptions JSON**

Array of ~10 exception elements with Russian explanations. Key entries:

```json
[
  {
    "Z": 24,
    "symbol": "Cr",
    "expected_formula": "[Ar] 3d⁴4s²",
    "actual_formula": "[Ar] 3d⁵4s¹",
    "rule": "half_filled_stability",
    "reason_ru": "Полузаполненная 3d-подоболочка (5 электронов с параллельными спинами) создаёт дополнительную обменную энергию стабилизации. Энергетически выгоднее переместить один электрон из 4s в 3d, получив симметричное заполнение d⁵."
  },
  {
    "Z": 29,
    "symbol": "Cu",
    "expected_formula": "[Ar] 3d⁹4s²",
    "actual_formula": "[Ar] 3d¹⁰4s¹",
    "rule": "full_filled_stability",
    "reason_ru": "Полностью заполненная 3d-подоболочка (10 электронов) особенно стабильна из-за максимальной обменной энергии. Один электрон переходит из 4s в 3d, завершая d¹⁰."
  },
  {
    "Z": 41, "symbol": "Nb",
    "expected_formula": "[Kr] 4d³5s²",
    "actual_formula": "[Kr] 4d⁴5s¹",
    "rule": "exchange_energy",
    "reason_ru": "Энергия обмена в 4d-подоболочке перевешивает энергию спаривания в 5s. Один электрон из 5s переходит в 4d."
  },
  {
    "Z": 42, "symbol": "Mo",
    "expected_formula": "[Kr] 4d⁴5s²",
    "actual_formula": "[Kr] 4d⁵5s¹",
    "rule": "half_filled_stability",
    "reason_ru": "Аналог хрома: полузаполненная 4d⁵-подоболочка стабильнее, чем 4d⁴5s². Один электрон из 5s переходит в 4d."
  },
  {
    "Z": 44, "symbol": "Ru",
    "expected_formula": "[Kr] 4d⁶5s²",
    "actual_formula": "[Kr] 4d⁷5s¹",
    "rule": "exchange_energy",
    "reason_ru": "Обменная энергия в 4d-подоболочке выше, чем энергия связи второго электрона в 5s."
  },
  {
    "Z": 45, "symbol": "Rh",
    "expected_formula": "[Kr] 4d⁷5s²",
    "actual_formula": "[Kr] 4d⁸5s¹",
    "rule": "exchange_energy",
    "reason_ru": "Энергия обмена в 4d перевешивает спаривание в 5s."
  },
  {
    "Z": 46, "symbol": "Pd",
    "expected_formula": "[Kr] 4d⁸5s²",
    "actual_formula": "[Kr] 4d¹⁰5s⁰",
    "rule": "full_filled_stability",
    "reason_ru": "Уникальный случай: оба электрона из 5s переходят в 4d, давая полностью заполненную d¹⁰. 5s-подоболочка остаётся пустой — настолько велик выигрыш энергии от d¹⁰."
  },
  {
    "Z": 47, "symbol": "Ag",
    "expected_formula": "[Kr] 4d⁹5s²",
    "actual_formula": "[Kr] 4d¹⁰5s¹",
    "rule": "full_filled_stability",
    "reason_ru": "Аналог меди: полностью заполненная 4d¹⁰-подоболочка стабильнее, чем 4d⁹5s². Один электрон из 5s переходит в 4d."
  },
  {
    "Z": 78, "symbol": "Pt",
    "expected_formula": "[Xe] 4f¹⁴5d⁸6s²",
    "actual_formula": "[Xe] 4f¹⁴5d⁹6s¹",
    "rule": "exchange_energy",
    "reason_ru": "Обменная энергия в 5d-подоболочке делает конфигурацию d⁹s¹ стабильнее, чем d⁸s²."
  },
  {
    "Z": 79, "symbol": "Au",
    "expected_formula": "[Xe] 4f¹⁴5d⁹6s²",
    "actual_formula": "[Xe] 4f¹⁴5d¹⁰6s¹",
    "rule": "full_filled_stability",
    "reason_ru": "Аналог меди и серебра: полностью заполненная 5d¹⁰ стабильнее. Релятивистские эффекты дополнительно сжимают 6s-орбиталь, усиливая этот эффект."
  }
]
```

**Step 2: Commit**

```bash
git add data-src/electron-config-exceptions.json
git commit -m "data: add electron config exceptions with Russian explanations"
```

---

## Task 3: Periodic Table Content Data (JSON)

**Files:**
- Create: `data-src/periodic-table-content.json`

This file contains all course content for the periodic table module: theory blocks, competency descriptions, and explanation templates. All in Russian with `_ru` suffix.

**Step 1: Create content JSON**

```json
{
  "theory_blocks": [
    {
      "id": "aufbau",
      "title_ru": "Принцип наименьшей энергии (правило Клечковского)",
      "text_ru": "Электроны заполняют орбитали в порядке возрастания их энергии. Порядок определяется суммой (n + l): чем она меньше, тем раньше заполняется подоболочка. При одинаковой сумме первой заполняется подоболочка с меньшим n.",
      "order_hint": "1s → 2s → 2p → 3s → 3p → 4s → 3d → 4p → 5s → 4d → 5p → 6s → 4f → 5d → 6p → 7s → 5f → 6d → 7p"
    },
    {
      "id": "hund",
      "title_ru": "Правило Хунда",
      "text_ru": "В пределах одной подоболочки электроны сначала занимают свободные орбитали по одному (с параллельными спинами), и лишь потом спариваются. Это минимизирует межэлектронное отталкивание."
    },
    {
      "id": "pauli",
      "title_ru": "Принцип Паули",
      "text_ru": "На одной орбитали может находиться не более двух электронов, причём с противоположными спинами. Отсюда максимальная ёмкость подоболочек: s — 2, p — 6, d — 10, f — 14."
    },
    {
      "id": "exceptions",
      "title_ru": "Провал электрона",
      "text_ru": "У некоторых элементов наблюдается «провал» электрона: один (или два) электрона из внешней s-подоболочки переходят в предвнешнюю d-подоболочку. Это происходит, когда энергия полузаполненной (d⁵) или полностью заполненной (d¹⁰) подоболочки оказывается ниже, чем у стандартной конфигурации. Причина — дополнительная обменная энергия стабилизации."
    },
    {
      "id": "valence",
      "title_ru": "Валентные электроны",
      "text_ru": "Валентные электроны — это электроны внешнего энергетического уровня (и предвнешнего d-подуровня для переходных металлов). Именно они участвуют в образовании химических связей и определяют степени окисления элемента."
    }
  ],
  "oxidation_explanation_template_ru": "Элемент {symbol} ({name_ru}) имеет конфигурацию валентных электронов {valence_config}. Всего {valence_count} валентных электронов. Возможные степени окисления: {ox_states}. {extra}",
  "competency_descriptions": {
    "periodic_table": {
      "name_ru": "Периодическая таблица",
      "description_ru": "Определение положения элемента (период, группа, подгруппа) по порядковому номеру. Связь положения со свойствами."
    },
    "electron_config": {
      "name_ru": "Электронная конфигурация",
      "description_ru": "Построение электронных формул, орбитальных диаграмм. Определение валентных электронов. Понимание правил Клечковского, Хунда, Паули и исключений."
    }
  }
}
```

**Step 2: Commit**

```bash
git add data-src/periodic-table-content.json
git commit -m "data: add periodic table module content (theory blocks, explanations)"
```

---

## Task 4: Practice Exercise Templates (JSON)

**Files:**
- Create: `data-src/exercises/periodic-table-exercises.json`

**Step 1: Create exercises JSON**

Exercise templates that the generator will use. Each template defines the exercise type, question pattern, and competency mapping. The generator fills in concrete elements at runtime.

```json
{
  "exercise_types": [
    {
      "id": "find_period_group",
      "type_label_ru": "Положение в таблице",
      "question_template_ru": "Элемент с порядковым номером {Z} расположен в:",
      "format": "multiple_choice",
      "competency_map": { "periodic_table": "P" },
      "distractor_strategy": "nearby_period_group",
      "explanation_template_ru": "{symbol} ({name_ru}): электронная конфигурация {config}, значит {period} период, {group_explanation}."
    },
    {
      "id": "select_electron_config",
      "type_label_ru": "Электронная конфигурация",
      "question_template_ru": "Выберите правильную электронную конфигурацию элемента {symbol} (Z={Z}):",
      "format": "multiple_choice",
      "competency_map": { "electron_config": "P" },
      "distractor_strategy": "swap_subshells",
      "explanation_template_ru": "По правилу Клечковского заполняем: {filling_steps}. Итого: {config}."
    },
    {
      "id": "fill_orbital_boxes",
      "type_label_ru": "Орбитальная диаграмма",
      "question_template_ru": "Заполните орбитальную диаграмму для элемента {symbol} (Z={Z}):",
      "format": "interactive_orbital",
      "competency_map": { "electron_config": "P" },
      "explanation_template_ru": "Заполняем по правилам Клечковского и Хунда: {filling_explanation}."
    },
    {
      "id": "count_valence",
      "type_label_ru": "Валентные электроны",
      "question_template_ru": "Сколько валентных электронов у элемента {symbol} (Z={Z})?",
      "format": "multiple_choice",
      "competency_map": { "electron_config": "P", "periodic_table": "S" },
      "distractor_strategy": "nearby_numbers",
      "explanation_template_ru": "Конфигурация {config}. Валентные электроны — на внешнем уровне ({valence_shell}): {valence_config} = {valence_count}."
    },
    {
      "id": "identify_exception",
      "type_label_ru": "Провал электрона",
      "question_template_ru": "Какой элемент имеет аномальную электронную конфигурацию из-за провала электрона?",
      "format": "multiple_choice",
      "competency_map": { "electron_config": "P" },
      "distractor_strategy": "exception_vs_normal",
      "explanation_template_ru": "{symbol} — исключение: {reason_ru}"
    },
    {
      "id": "element_from_config",
      "type_label_ru": "Элемент по конфигурации",
      "question_template_ru": "Какому элементу соответствует электронная конфигурация {config}?",
      "format": "multiple_choice",
      "competency_map": { "periodic_table": "P", "electron_config": "S" },
      "distractor_strategy": "nearby_Z",
      "explanation_template_ru": "Считаем электроны: {electron_count} = Z={Z}, это {symbol} ({name_ru})."
    },
    {
      "id": "predict_oxidation",
      "type_label_ru": "Степени окисления из конфигурации",
      "question_template_ru": "Какие степени окисления характерны для элемента {symbol} (конфигурация: {short_config})?",
      "format": "multiple_choice",
      "competency_map": { "oxidation_states": "P", "electron_config": "S" },
      "distractor_strategy": "wrong_ox_states",
      "explanation_template_ru": "{valence_count} валентных электронов ({valence_config}). {ox_explanation}"
    },
    {
      "id": "compare_electronegativity",
      "type_label_ru": "Электроотрицательность",
      "question_template_ru": "Какой элемент имеет большую электроотрицательность: {symbol_a} или {symbol_b}?",
      "format": "multiple_choice",
      "competency_map": { "periodic_table": "P" },
      "distractor_strategy": "two_elements",
      "explanation_template_ru": "Электроотрицательность растёт слева направо по периоду и снизу вверх по группе. {symbol_a} ({en_a}) vs {symbol_b} ({en_b})."
    }
  ]
}
```

**Step 2: Commit**

```bash
git add data-src/exercises/periodic-table-exercises.json
git commit -m "data: add periodic table exercise templates (8 types)"
```

---

## Task 5: Data Pipeline Updates

**Files:**
- Modify: `scripts/build-data.mjs`
- Modify: `scripts/lib/generate-manifest.mjs`
- Modify: `src/types/manifest.ts`
- Modify: `src/lib/data-loader.ts`

**Step 1: Update build pipeline to copy new data files**

In `scripts/build-data.mjs`, after the diagnostic copy block (~line 162), add:

```javascript
// Copy electron config exceptions
const electronExceptions = await loadJson(join(DATA_SRC, 'electron-config-exceptions.json'));
await writeFile(join(bundleDir, 'electron-config-exceptions.json'), JSON.stringify(electronExceptions));

// Copy periodic table content
const ptContent = await loadJson(join(DATA_SRC, 'periodic-table-content.json'));
await writeFile(join(bundleDir, 'periodic-table-content.json'), JSON.stringify(ptContent));

// Copy exercise templates
await mkdir(join(bundleDir, 'exercises'), { recursive: true });
const ptExercises = await loadJson(join(DATA_SRC, 'exercises', 'periodic-table-exercises.json'));
await writeFile(join(bundleDir, 'exercises', 'periodic-table-exercises.json'), JSON.stringify(ptExercises));
```

Add count logging after the existing console.log lines:

```javascript
console.log(`  ${electronExceptions.length} electron config exceptions`);
```

**Step 2: Update manifest generation**

In `scripts/lib/generate-manifest.mjs`, add to the `entrypoints` object:

```javascript
electron_config_exceptions: 'electron-config-exceptions.json',
periodic_table_content: 'periodic-table-content.json',
exercises: {
  periodic_table: 'exercises/periodic-table-exercises.json',
},
```

**Step 3: Update manifest TypeScript type**

In `src/types/manifest.ts`, add to `ManifestEntrypoints`:

```typescript
electron_config_exceptions?: string;
periodic_table_content?: string;
exercises?: Record<string, string>;
```

**Step 4: Add data loader functions**

In `src/lib/data-loader.ts`, add imports and functions:

```typescript
import type { ElectronConfigException } from '../types/electron-config';

/** Load electron config exceptions. */
export async function loadElectronConfigExceptions(): Promise<ElectronConfigException[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.electron_config_exceptions;
  if (!path) {
    throw new Error('electron_config_exceptions not found in manifest entrypoints.');
  }
  return loadDataFile<ElectronConfigException[]>(path);
}

/** Load periodic table module content. */
export async function loadPeriodicTableContent(): Promise<unknown> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.periodic_table_content;
  if (!path) {
    throw new Error('periodic_table_content not found in manifest entrypoints.');
  }
  return loadDataFile<unknown>(path);
}

/** Load exercise templates by module name. */
export async function loadExerciseTemplates(module: string): Promise<unknown> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.exercises?.[module];
  if (!path) {
    throw new Error(`Exercise templates for "${module}" not found in manifest.`);
  }
  return loadDataFile<unknown>(path);
}
```

**Step 5: Verify build**

Run: `npm run build:data`
Expected: Completes with new files listed, no errors.

**Step 6: Commit**

```bash
git add scripts/build-data.mjs scripts/lib/generate-manifest.mjs src/types/manifest.ts src/lib/data-loader.ts
git commit -m "feat: extend data pipeline for Stage 2 content (exceptions, theory, exercises)"
```

---

## Task 6: Electron Config Engine

**Files:**
- Create: `src/lib/electron-config.ts`

**Step 1: Implement the engine**

Pure functions, ~120 lines. Computation rules in code (Klechkowski order, subshell capacities, Hund's rule). Exception Z-numbers as a Set for quick lookup — the actual exception data (explanations) comes from JSON at runtime.

Key constants in code:
```typescript
// Klechkowski filling order: [n, l] pairs
const FILLING_ORDER: [number, SubshellType][] = [
  [1,'s'],[2,'s'],[2,'p'],[3,'s'],[3,'p'],[4,'s'],[3,'d'],[4,'p'],
  [5,'s'],[4,'d'],[5,'p'],[6,'s'],[4,'f'],[5,'d'],[6,'p'],[7,'s'],
  [5,'f'],[6,'d'],[7,'p'],
];

const SUBSHELL_CAPACITY: Record<SubshellType, number> = { s:2, p:6, d:10, f:14 };
const SUBSHELL_ORBITALS: Record<SubshellType, number> = { s:1, p:3, d:5, f:7 };

const NOBLE_GASES = [
  { Z:2, symbol:'He' }, { Z:10, symbol:'Ne' }, { Z:18, symbol:'Ar' },
  { Z:36, symbol:'Kr' }, { Z:54, symbol:'Xe' }, { Z:86, symbol:'Rn' },
];

// Exception overrides: Z → array of [n, l, electron_count] tuples
const EXCEPTIONS: Record<number, [number, SubshellType, number][]> = {
  24: [[3,'d',5],[4,'s',1]],   // Cr
  29: [[3,'d',10],[4,'s',1]],  // Cu
  41: [[4,'d',4],[5,'s',1]],   // Nb
  42: [[4,'d',5],[5,'s',1]],   // Mo
  44: [[4,'d',7],[5,'s',1]],   // Ru
  45: [[4,'d',8],[5,'s',1]],   // Rh
  46: [[4,'d',10],[5,'s',0]],  // Pd
  47: [[4,'d',10],[5,'s',1]],  // Ag
  78: [[4,'f',14],[5,'d',9],[6,'s',1]],  // Pt
  79: [[4,'f',14],[5,'d',10],[6,'s',1]], // Au
};
```

Functions to implement:
- `getElectronConfig(Z)` — fills by Aufbau, then applies exception overrides
- `getElectronFormula(Z)` — formats as `1s²2s²2p⁶...` with superscript unicode
- `getShorthandFormula(Z)` — `[Ar] 3d⁵4s¹`
- `getValenceElectrons(Z)` — outermost n level orbitals
- `getOrbitalBoxes(Z)` — applies Hund's rule for spin placement
- `getEnergyLevels(Z)` — returns levels in energy order with is_valence flag
- `getNobleGasCore(Z)` — finds nearest noble gas below Z
- `isException(Z)` — boolean check
- `getExpectedConfig(Z)` — what Aufbau alone would give (ignoring exceptions, for comparison display)

**Step 2: Verify build**

Run: `npx astro check 2>&1 | head -20`
Expected: No type errors.

**Step 3: Commit**

```bash
git add src/lib/electron-config.ts
git commit -m "feat: implement electron config engine (Aufbau, Hund, Pauli, exceptions)"
```

---

## Task 7: ElectronFormula Visualization

**Files:**
- Create: `src/features/periodic-table/ElectronFormula.tsx`

**Step 1: Implement component**

Props: `{ Z: number; showShorthand?: boolean }`

Renders the electron config as formatted text with superscripts. Shows shorthand ([Ar] 3d⁵...) or full form. Highlights valence shell. If element is an exception, shows crossed-out expected config + actual config.

Uses `getElectronFormula()`, `getShorthandFormula()`, `isException()`, `getExpectedConfig()` from engine.

~40 lines. No SVG, just styled `<span>` elements with CSS classes for highlighting.

**Step 2: Commit**

```bash
git add src/features/periodic-table/ElectronFormula.tsx
git commit -m "feat: add ElectronFormula visualization component"
```

---

## Task 8: OrbitalBoxDiagram Visualization

**Files:**
- Create: `src/features/periodic-table/OrbitalBoxDiagram.tsx`

**Step 1: Implement component**

Props: `{ Z: number }`

SVG rendering of orbital boxes grouped by subshell. Each orbital is a rectangle with up/down arrow symbols. Subshell labels below.

Uses `getOrbitalBoxes()` from engine. Groups boxes by `${n}${l}` key.

Layout: horizontal row of subshell groups, each group shows its boxes side by side. Arrow `↑` for `'up'`, `↓` for `'down'`, empty for `'empty'`.

Valence subshells get a highlighted border. Half-filled subshells (all singles) get a subtle background accent.

~80 lines. Pure SVG, responsive via viewBox.

**Step 2: Commit**

```bash
git add src/features/periodic-table/OrbitalBoxDiagram.tsx
git commit -m "feat: add OrbitalBoxDiagram SVG visualization"
```

---

## Task 9: EnergyLevelDiagram Visualization

**Files:**
- Create: `src/features/periodic-table/EnergyLevelDiagram.tsx`

**Step 1: Implement component**

Props: `{ Z: number }`

SVG with vertical energy axis (bottom = low energy, top = high). Horizontal lines for each subshell at approximate energy positions. Small dots/arrows on lines representing electrons. Valence level highlighted.

Uses `getEnergyLevels()` from engine. Positions subshells vertically by `energy_order`. Shows Klechkowski crossover visually (4s below 3d, etc.).

~80 lines. Pure SVG, responsive via viewBox.

**Step 2: Commit**

```bash
git add src/features/periodic-table/EnergyLevelDiagram.tsx
git commit -m "feat: add EnergyLevelDiagram SVG visualization"
```

---

## Task 10: ElementDetailPanel

**Files:**
- Create: `src/features/periodic-table/ElementDetailPanel.tsx`

**Step 1: Implement component**

Props: `{ element: Element; exceptions: ElectronConfigException[]; onClose: () => void }`

Rich panel replacing simple ElementDetails on the page module. Layout:
- Header: Z, symbol, name_ru, group/period/element_group
- Three visualizations in a row: ElectronFormula, OrbitalBoxDiagram, EnergyLevelDiagram
- Properties: valence electron count, oxidation states, electronegativity
- If exception: highlighted block with expected vs actual config + reason_ru from JSON
- "Why these oxidation states?" explanation (template from content JSON, filled with computed values)

~100 lines. Composes the three visualization components.

**Step 2: Commit**

```bash
git add src/features/periodic-table/ElementDetailPanel.tsx
git commit -m "feat: add ElementDetailPanel with visualizations and explanations"
```

---

## Task 11: Exercise Generator

**Files:**
- Create: `src/features/periodic-table/practice/generate-exercises.ts`

**Step 1: Implement generator**

Pure function that takes exercise type + elements array → produces a concrete exercise with question text, options (for MC), correct answer, and explanation.

Uses electron config engine to compute correct answers and generate plausible distractors.

Key logic per exercise type:
- `find_period_group`: pick random element, correct = its period/group, distractors = nearby values
- `select_electron_config`: pick element, compute config, distractors = configs with swapped subshells or wrong counts
- `fill_orbital_boxes`: pick element (Z ≤ 36 for sanity), correct = orbital boxes from engine
- `count_valence`: pick element, correct = valence count, distractors = count ± 1-2
- `identify_exception`: pick 1 exception + 3 normal elements
- `element_from_config`: compute config, ask which element, distractors = nearby Z
- `predict_oxidation`: pick element, correct = its typical_oxidation_states
- `compare_electronegativity`: pick two elements, ask which is higher

Templates and explanation strings come from the exercise JSON data.

~80 lines. Returns a uniform `Exercise` interface.

**Step 2: Commit**

```bash
git add src/features/periodic-table/practice/generate-exercises.ts
git commit -m "feat: add exercise generator for periodic table module"
```

---

## Task 12: Practice UI Components

**Files:**
- Create: `src/features/periodic-table/practice/PracticeSection.tsx`
- Create: `src/features/periodic-table/practice/MultipleChoiceExercise.tsx`
- Create: `src/features/periodic-table/practice/OrbitalFillingExercise.tsx`
- Create: `src/features/periodic-table/practice/ExerciseResult.tsx`

**Step 1: Implement MultipleChoiceExercise**

Same pattern as existing `QuestionCard.tsx` from diagnostics: question text, 4 option buttons, reveal correct/wrong + explanation on select.

Props: `{ exercise: Exercise; onAnswer: (correct: boolean) => void }`

~50 lines.

**Step 2: Implement OrbitalFillingExercise**

Interactive orbital filling: shows empty boxes for a given element. User clicks a box slot to place an electron (cycles: empty → up → down → empty). Submit button validates against engine output.

Props: `{ exercise: Exercise; onAnswer: (correct: boolean) => void }`

~100 lines.

**Step 3: Implement ExerciseResult**

Shows correct/wrong badge, explanation text, current P(L) for affected competencies.

Props: `{ correct: boolean; explanation: string; competencyLevels: Map<string, number> }`

~50 lines.

**Step 4: Implement PracticeSection**

Orchestrates the practice flow:
1. Load exercise templates + BKT params on mount
2. Generate a random exercise
3. Show exercise (MC or interactive depending on format)
4. On answer: show ExerciseResult, run bktUpdate for affected competencies, save to localStorage
5. "Next" button generates new exercise
6. Header shows current P(L) for periodic_table and electron_config
7. When both ≥ 0.8: congratulation message

Props: `{ elements: Element[]; exceptions: ElectronConfigException[] }`

~100 lines.

**Step 5: Commit**

```bash
git add src/features/periodic-table/practice/
git commit -m "feat: add practice UI components (MC, orbital filling, results, orchestrator)"
```

---

## Task 13: PeriodicTablePage Root Component

**Files:**
- Create: `src/features/periodic-table/PeriodicTablePage.tsx`
- Create: `src/features/periodic-table/periodic-table-page.css`

**Step 1: Implement root component**

Composes everything into one page:

1. On mount: load elements, exceptions, content (parallel fetch)
2. Render full periodic table (reuse `PeriodicTableLong`/`PeriodicTableShort`, `Legend`, `TrendsOverlay`)
3. On element click: show `ElementDetailPanel` below table
4. Below detail panel: theory block (collapsible sections from content JSON)
5. Below theory: `PracticeSection`

State: `elements`, `exceptions`, `content`, `selectedElement`, `formType`, `highlightedGroup`, `searchQuery`, `showTrends`

Reuses same props contract as PeriodicTableHint for table components but renders inline, not floating.

~120 lines.

**Step 2: Add page-specific CSS**

Layout for inline table (not floating), detail panel placement, practice section spacing.

~80 lines in `periodic-table-page.css`.

**Step 3: Commit**

```bash
git add src/features/periodic-table/PeriodicTablePage.tsx src/features/periodic-table/periodic-table-page.css
git commit -m "feat: add PeriodicTablePage root component"
```

---

## Task 14: Wire Up Astro Page

**Files:**
- Modify: `src/pages/periodic-table/index.astro`

**Step 1: Replace placeholder with React island**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import PeriodicTablePage from '../../features/periodic-table/PeriodicTablePage';
---

<BaseLayout title="Периодическая таблица" description="Интерактивная периодическая таблица Менделеева: электронные конфигурации, орбитальные диаграммы, энергетические уровни и практика.">
  <PeriodicTablePage client:idle />
</BaseLayout>
```

**Step 2: Build and verify**

Run: `npm run build`
Expected: No errors. `/periodic-table/` page builds successfully.

**Step 3: Commit**

```bash
git add src/pages/periodic-table/index.astro
git commit -m "feat: wire PeriodicTablePage into /periodic-table/ route"
```

---

## Task 15: Visual Verification & Final Commit

**Step 1: Run dev server**

Run: `npm run dev`

**Step 2: Manual verification checklist**

- [ ] `/periodic-table/` loads, shows full periodic table
- [ ] Long/Short form toggle works
- [ ] Search filters elements
- [ ] Click element → ElementDetailPanel appears with 3 visualizations
- [ ] Electron formula shows correct config with superscripts
- [ ] Orbital box diagram renders with correct arrows
- [ ] Energy level diagram shows subshells in order
- [ ] Exception elements (Cr Z=24, Cu Z=29) show crossed-out expected + actual
- [ ] Practice section generates random exercises
- [ ] Multiple choice exercises work (select → reveal → next)
- [ ] Orbital filling exercise works (click to place electrons → submit)
- [ ] BKT updates after each exercise answer
- [ ] P(L) levels shown in practice header
- [ ] Existing PeriodicTableHint (floating modal from nav) still works independently

**Step 3: Fix any issues found**

**Step 4: Final commit**

```bash
git add -A
git commit -m "Stage 2 complete: periodic table learning module with electron config visualizations and practice"
```

---

## Summary: File Map

### New files (15)
| File | Lines | Purpose |
|------|-------|---------|
| `src/types/electron-config.ts` | 30 | Types |
| `data-src/electron-config-exceptions.json` | data | Exception explanations (JSON) |
| `data-src/periodic-table-content.json` | data | Theory blocks, templates (JSON) |
| `data-src/exercises/periodic-table-exercises.json` | data | Exercise templates (JSON) |
| `src/lib/electron-config.ts` | 120 | Config engine (pure functions) |
| `src/features/periodic-table/ElectronFormula.tsx` | 40 | Formula text visualization |
| `src/features/periodic-table/OrbitalBoxDiagram.tsx` | 80 | Box diagram SVG |
| `src/features/periodic-table/EnergyLevelDiagram.tsx` | 80 | Energy level SVG |
| `src/features/periodic-table/ElementDetailPanel.tsx` | 100 | Rich detail panel |
| `src/features/periodic-table/PeriodicTablePage.tsx` | 120 | Page root component |
| `src/features/periodic-table/periodic-table-page.css` | 80 | Page styles |
| `src/features/periodic-table/practice/generate-exercises.ts` | 80 | Exercise generator |
| `src/features/periodic-table/practice/PracticeSection.tsx` | 100 | Practice orchestrator |
| `src/features/periodic-table/practice/MultipleChoiceExercise.tsx` | 50 | MC exercise component |
| `src/features/periodic-table/practice/OrbitalFillingExercise.tsx` | 100 | Interactive exercise |
| `src/features/periodic-table/practice/ExerciseResult.tsx` | 50 | Result display |

### Modified files (4)
| File | Change |
|------|--------|
| `scripts/build-data.mjs` | Copy 3 new data files |
| `scripts/lib/generate-manifest.mjs` | Add 3 new entrypoints |
| `src/types/manifest.ts` | Add optional fields to ManifestEntrypoints |
| `src/lib/data-loader.ts` | Add 3 loader functions |
| `src/pages/periodic-table/index.astro` | Replace placeholder with PeriodicTablePage |
