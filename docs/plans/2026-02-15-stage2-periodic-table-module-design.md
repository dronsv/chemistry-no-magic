# Stage 2 Design: Periodic Table Learning Module

## Overview

Turn `/periodic-table/` from a placeholder into a full learning module with programmatic electron configuration visualizations, energy-based explanations, and mixed-format practice exercises. All visualizations are computed from Z and rules — no hardcoded diagrams.

**Target competencies:** `periodic_table`, `electron_config` (both to P(L) >= 0.8)

**Approach:** Single all-in-one page — table at top, element detail panel in middle, practice section at bottom. The existing `PeriodicTableHint` floating modal stays untouched as a quick-access tool from any page.

---

## Page Architecture

```
/periodic-table/
┌──────────────────────────────────────────────┐
│  Full periodic table (reuse Long/Short)       │
│  + search, form toggle, trends, legend        │
├──────────────────────────────────────────────┤
│  Element Detail Panel (expanded on click)     │
│  ┌─────────┬──────────────┬────────────────┐ │
│  │ Electron │ Orbital Box  │ Energy Level   │ │
│  │ Formula  │ Diagram      │ Diagram        │ │
│  └─────────┴──────────────┴────────────────┘ │
│  Properties + "Why?" energy-based explanation │
├──────────────────────────────────────────────┤
│  Practice Section                             │
│  Randomized exercises: multiple choice +      │
│  interactive orbital filling                  │
│  BKT updates on each answer                   │
└──────────────────────────────────────────────┘
```

Reuses existing components: `PeriodicTableLong`, `PeriodicTableShort`, `ElementCell`, `Legend`, `TrendsOverlay`. The new `PeriodicTablePage` root component embeds them inline (not in a floating panel).

---

## Electron Config Engine

New file: `src/lib/electron-config.ts` (~120 lines, pure functions, zero deps)

### Rules Implemented

1. **Aufbau principle** — fill in Klechkowski order: 1s, 2s, 2p, 3s, 3p, 4s, 3d, 4p, 5s, 4d, 5p, 6s, 4f, 5d, 6p, 7s, 5f, 6d, 7p
2. **Pauli exclusion** — max per subshell: s=2, p=6, d=10, f=14
3. **Hund's rule** — maximize unpaired spins in degenerate orbitals (for box diagram)
4. **Half-filled / full subshell exceptions** — hardcoded exception map for elements where electron migration occurs due to exchange energy stabilization

### Exception Elements

| Z | Symbol | Expected | Actual | Rule |
|---|--------|----------|--------|------|
| 24 | Cr | [Ar] 3d4 4s2 | [Ar] 3d5 4s1 | half-filled 3d stability |
| 29 | Cu | [Ar] 3d9 4s2 | [Ar] 3d10 4s1 | fully-filled 3d stability |
| 41 | Nb | [Kr] 4d3 5s2 | [Kr] 4d4 5s1 | half-filled tendency |
| 42 | Mo | [Kr] 4d4 5s2 | [Kr] 4d5 5s1 | half-filled 4d stability |
| 44 | Ru | [Kr] 4d6 5s2 | [Kr] 4d7 5s1 | exchange energy |
| 45 | Rh | [Kr] 4d7 5s2 | [Kr] 4d8 5s1 | exchange energy |
| 46 | Pd | [Kr] 4d8 5s2 | [Kr] 4d10 5s0 | fully-filled 4d, empty 5s |
| 47 | Ag | [Kr] 4d9 5s2 | [Kr] 4d10 5s1 | fully-filled 4d stability |
| 78 | Pt | [Xe] 4f14 5d8 6s2 | [Xe] 4f14 5d9 6s1 | exchange energy |
| 79 | Au | [Xe] 4f14 5d9 6s2 | [Xe] 4f14 5d10 6s1 | fully-filled 5d stability |

### Functions

```ts
getElectronConfig(Z: number): OrbitalFilling[]
// Full config: [{n:1, l:'s', electrons:2}, ...]

getElectronFormula(Z: number): string
// "1s²2s²2p⁶3s²3p⁵"

getShorthandFormula(Z: number): string
// "[Ne] 3s²3p⁵"

getValenceElectrons(Z: number): OrbitalFilling[]
// Outermost shell orbitals only

getOrbitalBoxes(Z: number): OrbitalBox[]
// Box diagram data with Hund's rule applied

getEnergyLevels(Z: number): EnergyLevel[]
// Energy-ordered subshells with filling info

getException(Z: number): ExceptionInfo | null
// Returns expected/actual/reason if element is an exception

getNobleGasCore(Z: number): { symbol: string; Z: number } | null
// Nearest noble gas with Z < element's Z
```

### Types (`src/types/electron-config.ts`)

```ts
type SubshellType = 's' | 'p' | 'd' | 'f';
type Spin = 'up' | 'down' | 'empty';

interface OrbitalFilling {
  n: number;
  l: SubshellType;
  electrons: number;
  max: number;          // 2, 6, 10, or 14
}

interface OrbitalBox {
  n: number;
  l: SubshellType;
  index: number;        // orbital index within subshell (0-based)
  spins: [Spin, Spin];  // two slots per orbital
}

interface EnergyLevel {
  n: number;
  l: SubshellType;
  energy_order: number; // Klechkowski filling position
  electrons: number;
  is_valence: boolean;
}

interface ExceptionInfo {
  Z: number;
  symbol: string;
  expected: string;
  actual: string;
  rule: 'half_filled_stability' | 'full_filled_stability' | 'exchange_energy';
  reason_ru: string;
}
```

---

## Visualizations

Three React components in `src/features/periodic-table/`. All take `Z: number` as prop and compute everything from the engine.

### ElectronFormula.tsx (~40 lines)

Renders formatted electron config text with superscript notation.

- Full form: `1s²2s²2p⁶3s²3p⁵`
- Noble gas shorthand toggle: `[Ne] 3s²3p⁵`
- Valence shell highlighted (color/bold)
- Exception elements: struck-through expected config + actual config with explanation badge

### OrbitalBoxDiagram.tsx (~80 lines)

SVG rendering of orbital boxes with up/down arrows.

- Grouped by subshell: `[↑↓]` for s, `[↑↓][↑↓][↑↓]` for p, `[↑↓]×5` for d, etc.
- Labels below each group: 1s, 2s, 2p, 3s...
- Half-filled orbitals visually distinct (all single arrows in e.g. 3d⁵)
- Valence subshells highlighted with border/background
- CSS transition when element changes (arrows appear in filling order)

### EnergyLevelDiagram.tsx (~80 lines)

SVG with vertical energy axis showing subshell energy levels.

- Horizontal lines at approximate energy positions for each subshell
- Electrons shown as small dots or arrows on lines
- Klechkowski diagonal arrows overlay (optional toggle)
- Visually shows why 4s fills before 3d (energy crossover)
- Valence level highlighted

---

## Element Detail Panel

New `ElementDetailPanel.tsx` (~100 lines) replaces the simple `ElementDetails.tsx` on the page module (the hint modal keeps its simple version).

### Layout

```
┌─────────────────────────────────────────────┐
│  Z=24  Cr  Хром                    [Close]  │
│  Period 4 · Group 6 · Transition metal       │
├─────────────┬───────────────┬───────────────┤
│  Электронная │  Орбитальная  │ Энергетическая│
│  формула     │  диаграмма    │  диаграмма    │
│  [Ar] 3d⁵4s¹│  [↑][↑]...   │  ── 4s ●     │
│              │               │  ── 3d ●●●●● │
├─────────────┴───────────────┴───────────────┤
│  Валентные электроны: 6                      │
│  Степени окисления: +2, +3, +6              │
│  Электроотрицательность: 1.66               │
├──────────────────────────────────────────────┤
│  ⚡ Особенность конфигурации                 │
│  Ожидаемая: [Ar] 3d⁴4s²  (зачёркнуто)      │
│  Реальная:  [Ar] 3d⁵4s¹  (выделено)         │
│  Причина: Полузаполненная 3d-подоболочка...  │
├──────────────────────────────────────────────┤
│  💡 Почему хром проявляет СО +2, +3 и +6?   │
│  (energy-based explanation computed from      │
│   valence config and oxidation states)        │
└──────────────────────────────────────────────┘
```

The exception block only appears for elements in the exception list. The "why" explanation links oxidation states to electron config.

---

## Practice Exercises

New directory: `src/features/periodic-table/practice/`

### Exercise Types (mixed format)

| # | Type | Format | Primary | Secondary |
|---|------|--------|---------|-----------|
| 1 | Find period/group by Z | Multiple choice | periodic_table | — |
| 2 | Select correct electron config | Multiple choice | electron_config | — |
| 3 | Fill orbital boxes for element | Interactive | electron_config | — |
| 4 | Count valence electrons | Multiple choice | electron_config | periodic_table |
| 5 | Identify exception elements | Multiple choice | electron_config | — |
| 6 | Identify element from config | Multiple choice | periodic_table | electron_config |
| 7 | Predict oxidation states from config | Multiple choice | oxidation_states | electron_config |
| 8 | Compare electronegativity | Multiple choice | periodic_table | — |

### Exercise Generation

Exercises are **not hardcoded**. A generator function picks random elements and computes correct answers + distractors from the engine:

```ts
// src/features/periodic-table/practice/generate-exercises.ts
generateExercise(type: ExerciseType, elements: Element[]): Exercise
```

Example: for type 2, pick a random element, compute its config, generate 3 plausible wrong configs (swap subshells, wrong electron count, etc.). Each run produces different questions.

### Components

- `PracticeSection.tsx` (~100 lines) — orchestrates flow: pick exercise type, show exercise, collect answer, run BKT, show result, next
- `MultipleChoiceExercise.tsx` (~50 lines) — reuses QuestionCard pattern from diagnostics
- `OrbitalFillingExercise.tsx` (~100 lines) — interactive: empty orbital boxes rendered, user clicks/taps to place electrons (up arrow, then down arrow). Validate against engine output.
- `ExerciseResult.tsx` (~50 lines) — correct/wrong indicator, explanation, current P(L) badge

### BKT Integration

- After each answer: `bktUpdate(pL, params, isCorrect, false)` for primary competency
- Secondary competency gets weight 0.5 update
- Save via `saveBktPL()` to localStorage
- Practice section header shows current P(L) levels for periodic_table and electron_config
- When both reach >= 0.8: congratulation message + suggest next module

---

## Data Changes

### New data file

`data-src/electron-config-exceptions.json` — exception explanations (Russian text, editable):

```json
[
  {
    "Z": 24,
    "symbol": "Cr",
    "expected": "[Ar] 3d⁴4s²",
    "actual": "[Ar] 3d⁵4s¹",
    "rule": "half_filled_stability",
    "reason_ru": "Полузаполненная 3d-подоболочка (5 электронов с параллельными спинами) даёт дополнительную обменную энергию стабилизации. Энергетически выгоднее переместить один электрон из 4s в 3d."
  }
]
```

### Pipeline update

- `scripts/build-data.mjs` — copy `electron-config-exceptions.json` into bundle
- `scripts/lib/generate-manifest.mjs` — add `electron_config_exceptions` to entrypoints
- `src/lib/data-loader.ts` — add `loadElectronConfigExceptions()`

### No changes to elements.json

Electron configs are computed from Z. The data file stays minimal.

---

## Future: Cross-linking / Glossary System

Not built in Stage 2, but noted for design:

- A `<Term>` Astro/React component wrapping chemistry terms in prose
- On hover/click: tooltip card with definition, formula, link to relevant page
- Centralized glossary data file (`data-src/glossary.json`)
- Auto-detection possible via regex over term dictionary
- Applies across all pages/features once theory content grows (Stages 3-5)

---

## File Summary

### New files

| File | Purpose | ~Lines |
|------|---------|--------|
| `src/lib/electron-config.ts` | Config computation engine | 120 |
| `src/types/electron-config.ts` | Orbital/config types | 30 |
| `data-src/electron-config-exceptions.json` | Exception explanations | data |
| `src/features/periodic-table/PeriodicTablePage.tsx` | Full-page module root | 120 |
| `src/features/periodic-table/ElementDetailPanel.tsx` | Rich detail panel | 100 |
| `src/features/periodic-table/ElectronFormula.tsx` | Text formula viz | 40 |
| `src/features/periodic-table/OrbitalBoxDiagram.tsx` | Box diagram SVG | 80 |
| `src/features/periodic-table/EnergyLevelDiagram.tsx` | Energy level SVG | 80 |
| `src/features/periodic-table/practice/PracticeSection.tsx` | Practice orchestrator | 100 |
| `src/features/periodic-table/practice/MultipleChoiceExercise.tsx` | MC exercise | 50 |
| `src/features/periodic-table/practice/OrbitalFillingExercise.tsx` | Interactive exercise | 100 |
| `src/features/periodic-table/practice/ExerciseResult.tsx` | Result + explanation | 50 |
| `src/features/periodic-table/practice/generate-exercises.ts` | Random exercise generator | 80 |

### Modified files

| File | Change |
|------|--------|
| `src/pages/periodic-table/index.astro` | Replace placeholder with `<PeriodicTablePage client:idle />` |
| `scripts/build-data.mjs` | Copy exceptions file into bundle |
| `scripts/lib/generate-manifest.mjs` | Add `electron_config_exceptions` entrypoint |
| `src/lib/data-loader.ts` | Add `loadElectronConfigExceptions()` |

### Unchanged

- `PeriodicTableHint.tsx` — floating modal stays as-is (quick access from any page)
- `ElementDetails.tsx` — still used by the hint modal
- `data-src/elements.json` — no new fields needed
