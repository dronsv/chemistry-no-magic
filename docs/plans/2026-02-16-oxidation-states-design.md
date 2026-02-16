# Степени окисления — Design

## Goal
Separate page `/oxidation-states/` with an interactive oxidation state calculator as the central element,
step-by-step solution explainer, theory panel, and BKT-tracked practice.
Covers competency `oxidation_states` (OGE task types 16 and 17).

## Architecture
Calculator-centric approach with step-by-step solver: user inputs a formula →
algorithm computes oxidation states for all elements →
results shown with programmatic SVG (states above element symbols) →
"Show solution" button reveals which rules were applied and in what order.

Three-layer page (same pattern as /bonds/ and /reactions/):
OxidationCalculator → OxidationTheoryPanel → PracticeSection.

## Calculator (src/features/oxidation-states/OxidationCalculator.tsx)

- Formula text input (debounced 300ms), reuses `parseFormula()` and `calcOxidationStates()`
- Result: SVG with oxidation states above each element symbol (color: + red, − blue, 0 gray)
- "Показать решение" button → expands step-by-step block:
  1. Fixed rules applied (F→−1, Group 1→+1, Group 2→+2, Al→+3)
  2. O rule (−2 default, −1 for peroxides)
  3. H rule (+1 default, −1 for hydrides)
  4. Algebraic solve for the unknown element

Each step shows the rule name + brief explanation.

## Algorithm Extension (src/lib/oxidation-state.ts)

Add `explainOxidationSteps()` function that returns the same result as `calcOxidationStates()`
plus an array of `SolveStep` objects describing each rule application:
```typescript
interface SolveStep {
  symbol: string;
  state: number;
  rule_id: string;        // 'fluorine' | 'group1' | 'group2' | 'aluminum' | 'oxygen' | 'oxygen_peroxide' | 'hydrogen' | 'hydrogen_hydride' | 'algebraic'
  equation?: string;      // for algebraic step: "1×(+1) + 1×x + 4×(−2) = 0"
}
```

## SVG Diagrams

- **FormulaWithOxStates**: renders formula horizontally with oxidation state numbers above each element.
  Color coding: positive = red, negative = blue, zero = gray. Uses superscript-style positioning.

## Theory Panel

Collapsible sections from `data-src/rules/oxidation_theory.json`:
- 7 standard rules for determining oxidation states
- Special cases (peroxides, hydrides)
- Oxidizer vs reducer concepts (for task type 17)
- Connection to electron configuration

## Practice Exercises

From `data-src/exercises/oxidation-exercises.json`:
- **Type 16**: "Определите СО [element] в [formula]" → multiple choice
- **Type 17**: "Укажите окислитель/восстановитель" → multiple choice

BKT tracking for `oxidation_states` competency.

## Files to Create
- `src/features/oxidation-states/OxidationCalculator.tsx`
- `src/features/oxidation-states/OxidationTheoryPanel.tsx`
- `src/features/oxidation-states/practice/PracticeSection.tsx`
- `src/features/oxidation-states/practice/generate-exercises.ts`
- `src/features/oxidation-states/diagrams/FormulaWithOxStates.tsx`
- `src/features/oxidation-states/OxidationStatesPage.tsx`
- `src/features/oxidation-states/oxidation-states.css`
- `src/pages/oxidation-states/index.astro`
- `data-src/rules/oxidation_theory.json`
- `data-src/exercises/oxidation-exercises.json`

## Files to Modify
- `src/lib/oxidation-state.ts` — add `explainOxidationSteps()`
- `scripts/build-data.mjs` — pipeline for new data files
- `scripts/lib/generate-manifest.mjs` — manifest entries
- `src/lib/data-loader.ts` — `loadOxidationTheory()`
- `src/components/Nav.astro` — add "СО" link
- `data-src/rules/competencies.json` — set link for oxidation_states

## Visuals
All SVG generated programmatically by React components. No static images.
