# Semantic Preview Layer — Remaining Work Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the last gaps of the Semantic Preview Layer: make formula variable tokens hoverable in theory equations, expose ion hover previews, and add regression coverage.

**Architecture:** The Semantic Preview Layer (resolver + 6 adapters + `OntInteractiveRef` + `OntPreviewCard` + `ont-ref-registry`) is already built and committed (2026-03-18, 39 passing tests). This plan covers only the three documented remainders. Task 1 adds a pure `formulaToDisplayNodes()` function (React-node sibling of the existing string `formulaToDisplayString()`) and wires the `equation` block in `TheoryModulePanel` to render each variable token wrapped in `OntInteractiveRef`. Task 2 routes the `FormulaChip` ion path through `OntInteractiveRef` for hover preview while preserving the existing click popup. Task 3 adds a guarded check + E2E smoke coverage.

**Tech Stack:** Astro 5, React islands, TypeScript (strict), Vitest (node env — no jsdom), Playwright E2E. i18n via Paraglide (`import * as m from '../paraglide/messages.js'`). CSS: per-component `.css` files, global CSS vars from `src/styles/global.css`.

---

## Background: What already exists (do NOT rebuild)

Verified present and tested on 2026-06-01:

- `src/lib/ont-ref-registry.ts` — `resolveRefKind()`, `extractRefId()`, `buildCanonicalHref()` (19 tests in `src/lib/__tests__/ont-ref-registry.test.ts`).
- `src/lib/ont-preview/resolve-ont-preview.ts` + 6 adapters in `src/lib/ont-preview/adapters/` including `formula-variable-preview.ts` (20 tests in `src/lib/__tests__/ont-preview-resolver.test.ts`).
- `src/components/OntInteractiveRef.tsx` — hover (200ms)/escape/positioning/**session cache** already done. Props: `{ entityRef?, formulaVariable?: Variable, formulaId?, display: ReactNode, context?: PreviewContext, locale: string }`. It already builds a `subjectKind: 'formula_variable'` request when `formulaVariable` + `formulaId` are both passed.
- `src/components/OntPreviewCard.tsx` + CSS.
- `src/types/ont-preview.ts` — all preview types.
- `src/types/formula.ts` — `Variable.binding`, `Variable.explanation_overrides`, `ComputableFormula.concept_refs/didactic_scope/generalizes/deprotonation_step`, `VariableBinding`.
- Ka formula family + `q:equilibrium_constant` in data.
- `OntInteractiveRef` already wraps: `ConceptRef`, `FormulaChip` (element/substance path), `OntEmbedBlock`, `AcidStrengthScale`, `ElementQuicklinks`, `ConceptModuleIsland`.

The three gaps this plan closes:
1. **Formula variable tokens** — `TheoryModulePanel`'s `equation` block renders via `formulaToDisplayString()` which returns a flat **string**; individual variables (`[H⁺]`, `Ka`) are not interactive.
2. **Ion hover preview** — `FormulaChip`'s ion path is intentionally excluded from `OntInteractiveRef` (it opens `IonDetailsProvider` click popup). The `ion-preview` adapter exists but is unreachable via hover.
3. **Coverage** — no test asserts `formulaToDisplayNodes()` behavior; no E2E touches preview.

---

## File Structure

**New files:**
- `src/lib/formula-display-nodes.tsx` — pure function `formulaToDisplayNodes()` returning `ReactNode[]`, tokenizing an `ExprNode` tree and wrapping variable symbols in `OntInteractiveRef`. Lives in `.tsx` (returns JSX). One responsibility: equation → interactive nodes.
- `src/lib/__tests__/formula-display-nodes.test.ts` — unit tests for the **pure tokenizer** part (variable-symbol extraction), node count, and ordering. (Cannot render `OntInteractiveRef` without jsdom, so tests target the token list, not DOM.)
- `tests/e2e/preview.spec.ts` — Playwright smoke test that a concept page renders and an interactive ref exists.

**Modified files:**
- `src/lib/formula-evaluator.ts` — export a reusable `extractDisplayTokens()` helper (pure, no JSX) so both the string renderer and the node renderer share token logic. (Refactor without behavior change.)
- `src/components/TheoryModulePanel.tsx` — `equation` block uses `formulaToDisplayNodes()` when a resolved formula exists.

---

## Task 1: Pure token extraction helper in formula-evaluator

**Why first:** Both the existing string renderer and the new node renderer need the same "walk the expression, emit ordered tokens" logic. Extract it once (DRY), test it in the node-env Vitest, then build JSX on top.

A **token** is one of: a variable symbol, a constant ref, a literal, or an operator/punctuation string. Only variable-symbol tokens become interactive.

**Files:**
- Modify: `src/lib/formula-evaluator.ts` (add after `exprToDisplayString`, around line 219)
- Test: `src/lib/__tests__/formula-display-nodes.test.ts` (new — tests this helper)

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/formula-display-nodes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { extractDisplayTokens, formulaToDisplayString } from '../formula-evaluator';
import type { ComputableFormula } from '../../types/formula';

const DATA_DIR = join(import.meta.dirname, '../../../data-src/foundations');
const formulas: ComputableFormula[] = JSON.parse(
  readFileSync(join(DATA_DIR, 'formulas.json'), 'utf8'),
);

function findFormula(id: string): ComputableFormula {
  const f = formulas.find(fm => fm.id === id);
  if (!f) throw new Error(`Formula not found: ${id}`);
  return f;
}

describe('extractDisplayTokens', () => {
  it('emits a result token, an equals token, then expression tokens', () => {
    const f = findFormula('formula:acid_dissociation_constant');
    const tokens = extractDisplayTokens(f);
    // First token is the result variable Ka
    expect(tokens[0]).toEqual({ kind: 'variable', symbol: 'Ka', display: 'Ka' });
    // Second is the equals separator
    expect(tokens[1]).toEqual({ kind: 'text', text: ' = ' });
  });

  it('marks each variable symbol as a variable token with its display string', () => {
    const f = findFormula('formula:acid_dissociation_constant');
    const tokens = extractDisplayTokens(f);
    const varSymbols = tokens
      .filter((t): t is Extract<typeof t, { kind: 'variable' }> => t.kind === 'variable')
      .map(t => t.symbol);
    // Ka (result) + cH, cA, cHA (inputs) all appear
    expect(varSymbols).toContain('Ka');
    expect(varSymbols).toContain('cH');
    expect(varSymbols).toContain('cA');
    expect(varSymbols).toContain('cHA');
  });

  it('uses display_symbol for the rendered token text', () => {
    const f = findFormula('formula:acid_dissociation_constant');
    const tokens = extractDisplayTokens(f);
    const cH = tokens.find(t => t.kind === 'variable' && t.symbol === 'cH');
    expect(cH).toBeDefined();
    expect(cH && cH.kind === 'variable' && cH.display).toBe('[H⁺]');
  });

  it('emits operator tokens as text (divide, multiply)', () => {
    const f = findFormula('formula:acid_dissociation_constant');
    const tokens = extractDisplayTokens(f);
    const textBlob = tokens.filter(t => t.kind === 'text').map(t => t.text).join('');
    expect(textBlob).toContain('/');   // Ka = [H⁺]·[A⁻] / [HA]
    expect(textBlob).toContain('×');
  });

  it('concatenated token display equals the legacy string renderer output', () => {
    // formula:density → ρ = m / V (simple: 3 variables, one divide)
    const f = findFormula('formula:density');
    const tokens = extractDisplayTokens(f);
    const joined = tokens
      .map(t => (t.kind === 'variable' ? t.display : t.kind === 'text' ? t.text : t.display))
      .join('');
    // Parity guard: token concatenation matches the legacy string renderer exactly
    expect(joined).toBe(formulaToDisplayString(f));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/formula-display-nodes.test.ts`
Expected: FAIL — `extractDisplayTokens is not a function` (not yet exported).

- [ ] **Step 3: Implement `extractDisplayTokens` in formula-evaluator.ts**

In `src/lib/formula-evaluator.ts`, add these exports immediately after `exprToDisplayString` (after line 219). This mirrors the exact operator handling of `exprToDisplayString` (lines 186-218) but emits tokens instead of a string. `DisplaySymbolMap` (line 122) and `buildDisplayMap` (line ~139) already exist and are used here.

```typescript
/** A single renderable token of a formula expression. */
export type DisplayToken =
  | { kind: 'variable'; symbol: string; display: string }
  | { kind: 'const'; ref: string; display: string }
  | { kind: 'text'; text: string };

/** Set of variable symbols for a formula (so const/literal tokens are not misclassified). */
function variableSymbolSet(formula: ComputableFormula): Set<string> {
  return new Set(formula.variables.map(v => v.symbol));
}

function exprToTokens(
  expr: ExprNode | string | number,
  displayMap: DisplaySymbolMap,
  varSymbols: Set<string>,
  out: DisplayToken[],
): void {
  if (typeof expr === 'string') {
    if (varSymbols.has(expr)) {
      out.push({ kind: 'variable', symbol: expr, display: displayMap[expr] ?? expr });
    } else {
      out.push({ kind: 'text', text: displayMap[expr] ?? expr });
    }
    return;
  }
  if (typeof expr === 'number') {
    out.push({ kind: 'text', text: String(expr) });
    return;
  }

  switch (expr.op) {
    case 'literal':
      out.push({ kind: 'text', text: String(expr.value) });
      return;
    case 'const': {
      const display = displayMap[expr.ref] ?? expr.ref.replace('const:', '');
      out.push({ kind: 'const', ref: expr.ref, display });
      return;
    }
    case 'add':
      joinTokens(expr.operands, ' + ', displayMap, varSymbols, out);
      return;
    case 'subtract':
      joinTokens(expr.operands, ' − ', displayMap, varSymbols, out);
      return;
    case 'multiply': {
      // Negation: -1 × X → −X (mirror exprToDisplayString)
      if (expr.operands.length === 2) {
        const first = expr.operands[0];
        if (typeof first === 'object' && 'op' in first && first.op === 'literal' && first.value === -1) {
          out.push({ kind: 'text', text: '−' });
          exprToTokens(expr.operands[1], displayMap, varSymbols, out);
          return;
        }
      }
      joinTokens(expr.operands, ' × ', displayMap, varSymbols, out);
      return;
    }
    case 'divide':
      exprToTokens(expr.operands[0], displayMap, varSymbols, out);
      out.push({ kind: 'text', text: ' / ' });
      exprToTokens(expr.operands[1], displayMap, varSymbols, out);
      return;
    case 'power':
      exprToTokens(expr.operands[0], displayMap, varSymbols, out);
      out.push({ kind: 'text', text: '^' });
      exprToTokens(expr.operands[1], displayMap, varSymbols, out);
      return;
    case 'exp':
      out.push({ kind: 'text', text: 'exp(' });
      exprToTokens(expr.operand, displayMap, varSymbols, out);
      out.push({ kind: 'text', text: ')' });
      return;
    case 'log10':
      out.push({ kind: 'text', text: 'lg(' });
      exprToTokens(expr.operand, displayMap, varSymbols, out);
      out.push({ kind: 'text', text: ')' });
      return;
    case 'sum':
      out.push({ kind: 'text', text: 'Σ(' });
      exprToTokens(expr.term, displayMap, varSymbols, out);
      out.push({ kind: 'text', text: ')' });
      return;
    default:
      out.push({ kind: 'text', text: '?' });
  }
}

function joinTokens(
  operands: (ExprNode | string | number)[],
  sep: string,
  displayMap: DisplaySymbolMap,
  varSymbols: Set<string>,
  out: DisplayToken[],
): void {
  operands.forEach((o, i) => {
    if (i > 0) out.push({ kind: 'text', text: sep });
    exprToTokens(o, displayMap, varSymbols, out);
  });
}

/**
 * Tokenize a formula into ordered display tokens: result variable, ' = ',
 * then the expression. Variable tokens carry their symbol so the UI can wrap
 * them interactively; everything else is plain text or a constant.
 */
export function extractDisplayTokens(
  formula: ComputableFormula,
  inversionFor?: string,
  constants?: PhysicalConstant[],
): DisplayToken[] {
  const displayMap = buildDisplayMap(formula, constants);
  const varSymbols = variableSymbolSet(formula);
  const out: DisplayToken[] = [];

  if (inversionFor) {
    const invExpr = formula.inversions[inversionFor];
    if (!invExpr) return [];
    const targetDisplay = displayMap[inversionFor] ?? inversionFor;
    out.push({ kind: 'variable', symbol: inversionFor, display: targetDisplay });
    out.push({ kind: 'text', text: ' = ' });
    exprToTokens(invExpr, displayMap, varSymbols, out);
    return out;
  }

  const resultDisplay = displayMap[formula.result_variable] ?? formula.result_variable;
  out.push({ kind: 'variable', symbol: formula.result_variable, display: resultDisplay });
  out.push({ kind: 'text', text: ' = ' });
  exprToTokens(formula.expression, displayMap, varSymbols, out);
  return out;
}
```

Note: `ExprNode`, `PhysicalConstant`, `ComputableFormula` are already imported in `formula-evaluator.ts` (used by existing code). If the linter flags `PhysicalConstant` as unused before this addition, it is already imported — verify the existing import line near the top includes it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/formula-display-nodes.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the existing formula-evaluator tests to confirm no regression**

Run: `npx vitest run src/lib/__tests__/formula-evaluator.test.ts`
Expected: PASS (all existing tests still green — we only added exports, changed nothing).

- [ ] **Step 6: Commit**

```bash
git add src/lib/formula-evaluator.ts src/lib/__tests__/formula-display-nodes.test.ts
git commit -m "$(cat <<'EOF'
feat(formula): add extractDisplayTokens for interactive equation rendering

Tokenizes a formula expression into ordered display tokens (variable / const /
text), mirroring exprToDisplayString operator handling. Variable tokens carry
their symbol so the UI can wrap them in hover previews. Pure function, node-env
tested against real formulas.json.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: formulaToDisplayNodes — wrap variable tokens in OntInteractiveRef

**Files:**
- Create: `src/lib/formula-display-nodes.tsx`
- Test: extends `src/lib/__tests__/formula-display-nodes.test.ts` (token-list assertions only; JSX rendering verified via E2E in Task 4)

- [ ] **Step 1: Write the failing test (token→variable mapping for the renderer input)**

Append to `src/lib/__tests__/formula-display-nodes.test.ts`:

```typescript
import { collectVariableTokens } from '../formula-display-nodes';

describe('collectVariableTokens', () => {
  it('returns one entry per variable token paired with its Variable object', () => {
    const f = findFormula('formula:acid_dissociation_constant');
    const pairs = collectVariableTokens(f);
    const symbols = pairs.map(p => p.token.symbol);
    expect(symbols).toContain('Ka');
    expect(symbols).toContain('cH');
    // Each pair resolves to the matching Variable (so OntInteractiveRef gets formulaVariable)
    const cH = pairs.find(p => p.token.symbol === 'cH');
    expect(cH?.variable.binding?.ref).toBe('ion:H_plus');
  });

  it('text tokens are not included as variable pairs', () => {
    const f = findFormula('formula:acid_dissociation_constant');
    const pairs = collectVariableTokens(f);
    expect(pairs.every(p => p.token.kind === 'variable')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/__tests__/formula-display-nodes.test.ts`
Expected: FAIL — `collectVariableTokens` not exported / module not found.

- [ ] **Step 3: Implement `src/lib/formula-display-nodes.tsx`**

```tsx
import type { ReactNode } from 'react';
import type { ComputableFormula, Variable, PhysicalConstant } from '../types/formula';
import { extractDisplayTokens, type DisplayToken } from './formula-evaluator';
import OntInteractiveRef from '../components/OntInteractiveRef';

export interface VariableTokenPair {
  token: Extract<DisplayToken, { kind: 'variable' }>;
  variable: Variable;
}

/**
 * Pair each variable token with its Variable definition. Pure (no JSX) so it
 * can be unit-tested in the node-env Vitest.
 */
export function collectVariableTokens(
  formula: ComputableFormula,
  inversionFor?: string,
  constants?: PhysicalConstant[],
): VariableTokenPair[] {
  const tokens = extractDisplayTokens(formula, inversionFor, constants);
  const bySymbol = new Map(formula.variables.map(v => [v.symbol, v]));
  const pairs: VariableTokenPair[] = [];
  for (const token of tokens) {
    if (token.kind !== 'variable') continue;
    const variable = bySymbol.get(token.symbol);
    if (variable) pairs.push({ token, variable });
  }
  return pairs;
}

/**
 * Render a formula as interactive React nodes: variable tokens become
 * <OntInteractiveRef> hover targets bound to their Variable; const/text tokens
 * render as plain spans.
 */
export function formulaToDisplayNodes(
  formula: ComputableFormula,
  locale: string,
  inversionFor?: string,
  constants?: PhysicalConstant[],
): ReactNode {
  const tokens = extractDisplayTokens(formula, inversionFor, constants);
  const bySymbol = new Map(formula.variables.map(v => [v.symbol, v]));

  return (
    <span className="formula-nodes">
      {tokens.map((token, i) => {
        if (token.kind === 'variable') {
          const variable = bySymbol.get(token.symbol);
          if (variable) {
            return (
              <OntInteractiveRef
                key={i}
                formulaVariable={variable}
                formulaId={formula.id}
                locale={locale}
                display={<span className="formula-nodes__var">{token.display}</span>}
              />
            );
          }
          return <span key={i} className="formula-nodes__var">{token.display}</span>;
        }
        if (token.kind === 'const') {
          return <span key={i} className="formula-nodes__const">{token.display}</span>;
        }
        return <span key={i}>{token.text}</span>;
      })}
    </span>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/__tests__/formula-display-nodes.test.ts`
Expected: PASS (7 tests total — 5 from Task 1 + 2 here).

- [ ] **Step 5: Typecheck**

Run: `npx astro check 2>&1 | tail -20`
Expected: No new errors in `formula-display-nodes.tsx` or `formula-evaluator.ts`. (Pre-existing project-wide errors, if any, are unrelated — confirm none mention these two files.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/formula-display-nodes.tsx src/lib/__tests__/formula-display-nodes.test.ts
git commit -m "$(cat <<'EOF'
feat(formula): formulaToDisplayNodes wraps variable tokens in OntInteractiveRef

Renders an equation as interactive React nodes — each variable becomes a hover
preview target bound to its Variable (quantity + binding), reusing the existing
formula_variable preview adapter. collectVariableTokens is the pure, tested core.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Wire equation block in TheoryModulePanel to interactive nodes

**Files:**
- Modify: `src/components/TheoryModulePanel.tsx` (equation case, lines 173-185; import near line 13)

- [ ] **Step 1: Add the import**

In `src/components/TheoryModulePanel.tsx`, after the existing line 13 (`import { formulaToDisplayString } from '../lib/formula-evaluator';`), add:

```typescript
import { formulaToDisplayNodes } from '../lib/formula-display-nodes';
```

- [ ] **Step 2: Replace the equation block render**

Replace the existing `case 'equation':` block (lines 173-185):

```typescript
    case 'equation': {
      const f = block.formula_id ? formulaData.formulas[block.formula_id] : undefined;
      const eqText = f
        ? formulaToDisplayString(f, block.inversion_for, formulaData.constants)
        : block.text;
      const note = block.note;
      return (
        <div className="theory-module__equation">
          {eqText}{note ? ` (${note})` : ''}
        </div>
      );
    }
```

with:

```typescript
    case 'equation': {
      const f = block.formula_id ? formulaData.formulas[block.formula_id] : undefined;
      const note = block.note;
      // When the formula resolves, render interactive variable tokens; otherwise
      // fall back to the static text (block.text) for unresolved/manual equations.
      const body = f
        ? formulaToDisplayNodes(f, locale, block.inversion_for, formulaData.constants)
        : block.text;
      return (
        <div className="theory-module__equation">
          {body}{note ? ` (${note})` : ''}
        </div>
      );
    }
```

Note: `formulaToDisplayString` may now be unused in this file. If `npx astro check` flags it as an unused import, remove it from the line 13 import. Do NOT remove it from `formula-evaluator.ts` — other modules (concept-preview, formula-preview adapters) still use it.

- [ ] **Step 3: Add minimal CSS for the variable token**

Append to `src/components/theory-module.css`:

```css
.formula-nodes__var {
  cursor: help;
  border-bottom: 1px dotted var(--color-text-muted);
}
.formula-nodes__const {
  color: var(--color-text-muted);
}
```

- [ ] **Step 4: Build data + typecheck**

Run: `npx astro check 2>&1 | tail -20`
Expected: No new errors referencing `TheoryModulePanel.tsx`.

- [ ] **Step 5: Run the full unit suite to confirm no regression**

Run: `npm test 2>&1 | tail -15`
Expected: All tests pass (the prior baseline plus the new `formula-display-nodes` tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/TheoryModulePanel.tsx src/components/theory-module.css
git commit -m "$(cat <<'EOF'
feat(theory): make formula variable tokens hoverable in equations

TheoryModulePanel equation blocks now render resolved formulas via
formulaToDisplayNodes, so each variable ([H⁺], Ka, …) shows its quantity +
binding preview on hover. Static/manual equations fall back to plain text.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Ion hover preview in FormulaChip (additive — keep click popup)

**Context:** Today, `FormulaChip`'s ion branch (lines 186-214) is excluded from `OntInteractiveRef` with the comment "ionId is intentionally excluded — it opens its own popup via IonDetailsProvider." The `ion-preview` adapter exists and is tested. Goal: add **hover preview** for ions via `OntInteractiveRef` while keeping the **click → IonDetailsProvider popup** behavior (click navigation in `OntInteractiveRef` only fires when `canonicalHref` is set; ions have no canonical page, so `buildCanonicalHref('ion:…')` returns `null` and `OntInteractiveRef` stays non-navigable — the chip's own `onClick` continues to open the popup).

**Files:**
- Modify: `src/components/FormulaChip.tsx` (ion path, lines 186-214)

- [ ] **Step 1: Confirm ion refs are non-navigable (guard assumption)**

Add a focused assertion to the existing registry test `src/lib/__tests__/ont-ref-registry.test.ts` (inside its top-level `describe`):

```typescript
  it('ion refs have no canonical page (popup-only)', () => {
    expect(buildCanonicalHref('ion:H_plus', 'ru')).toBeNull();
  });
```

If `buildCanonicalHref` is not already imported in that test file, add it to the existing import from `../ont-ref-registry`.

- [ ] **Step 2: Run to verify it passes (documents current contract)**

Run: `npx vitest run src/lib/__tests__/ont-ref-registry.test.ts`
Expected: PASS — confirms ions resolve to `null` href, so wrapping them in `OntInteractiveRef` will NOT hijack the click (no `canonicalHref` ⇒ `isNavigable` false ⇒ no `onClick` override; the inner chip's own `onClick` runs).

- [ ] **Step 3: Wrap the ion chip in OntInteractiveRef**

In `src/components/FormulaChip.tsx`, locate where the ion chip is currently returned without an `OntInteractiveRef` wrapper (the `ionId` branch returns `chipSpan` directly because `entityRef` excludes ions). Update the wrapper condition so an ion ref also gets a preview wrapper. Change the `entityRef` computation block (lines 186-189):

```typescript
  // Wrap in OntInteractiveRef for hover preview when a navigable entity ref is available.
  // ionId is intentionally excluded — it opens its own popup via IonDetailsProvider.
  const entityRef = substanceId ?? (elementId ? `el:${elementId}` : undefined);
```

to:

```typescript
  // Wrap in OntInteractiveRef for hover preview. Ions get a hover preview too;
  // because ion refs have no canonical page, OntInteractiveRef stays non-navigable
  // and the chip's own onClick (IonDetailsProvider popup) keeps working on click.
  const entityRef =
    substanceId ?? (elementId ? `el:${elementId}` : ionId ? `ion:${ionId.replace(/^ion:/, '')}` : undefined);
```

The existing `if (entityRef && locale) { … return <OntInteractiveRef … /> }` block (lines 190-213) now also fires for ions. The inner `chipSpanNoTitle` already wires `onClick={handleClick}`, which for ions calls `ionDetails.showIonDetails(...)` — preserved.

- [ ] **Step 4: Build + typecheck + unit suite**

Run: `npx astro check 2>&1 | tail -20 && npm test 2>&1 | tail -10`
Expected: No new type errors referencing `FormulaChip.tsx`; all unit tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/FormulaChip.tsx src/lib/__tests__/ont-ref-registry.test.ts
git commit -m "$(cat <<'EOF'
feat(preview): add ion hover preview to FormulaChip, keep click popup

Ion chips now show the ion-preview card on hover via OntInteractiveRef. Because
ion refs have no canonical page, the wrapper stays non-navigable and the chip's
own click still opens the IonDetailsProvider popup. Adds a registry test pinning
ion refs to a null canonical href.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: E2E smoke coverage for preview wiring

**Context:** Components are only covered by Playwright (no jsdom). Add one smoke test that a page renders the `OntInteractiveRef` wrapper (`.ont-iref`). An existing spec, `tests/e2e/ontology-refs.spec.ts`, already covers ref-name resolution and uses confirmed routes — match its harness exactly (imports `{ test, expect, type Page } from '@playwright/test'`, uses `page.goto('/oxidation-states/')` etc., waits via `page.waitForTimeout`). Confirmed real routes include `/`, `/bonds/`, `/calculations/`, `/oxidation-states/`, `/periodic-table/`.

**Files:**
- Create: `tests/e2e/preview.spec.ts`

- [ ] **Step 1: Inspect the existing ref E2E spec for the exact harness**

Run: `sed -n '1,40p' tests/e2e/ontology-refs.spec.ts && grep -n "page.goto" tests/e2e/ontology-refs.spec.ts`
Expected: Confirms import style (`@playwright/test`), console-error helper, and the `page.goto` routes in use. Reuse the same import + a route from that list below.

- [ ] **Step 2: Write the E2E smoke test**

Create `tests/e2e/preview.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

// /calculations/ renders TheoryModulePanel equations and FormulaChips, which are
// wrapped in OntInteractiveRef (span.ont-iref). /oxidation-states/ also mounts
// FormulaChips with element refs. Both are confirmed routes used by other E2E specs.

test('ontology refs render interactive wrappers', async ({ page }) => {
  await page.goto('/calculations/');
  // OntInteractiveRef renders span.ont-iref around wrapped refs.
  const wrappers = page.locator('.ont-iref');
  await expect(wrappers.first()).toBeVisible({ timeout: 10_000 });
});

test('preview-bearing page loads without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('favicon') || text.includes('manifest')) return;
      errors.push(text);
    }
  });
  page.on('pageerror', err => errors.push(`PAGE_ERROR: ${err.message}`));
  await page.goto('/calculations/');
  await page.waitForTimeout(2000);
  expect(errors).toEqual([]);
});
```

If `/calculations/` does not mount any `.ont-iref` in headless (large islands may not hydrate within timeout — see memory note on PeriodicTable/Bonds hydration), switch the target to `/oxidation-states/`, or relax the first assertion to `.formula-chip` presence + page title. Document the choice in the commit message.

- [ ] **Step 3: Run the E2E suite**

Run: `npm run test:e2e 2>&1 | tail -25`
Expected: New `preview.spec.ts` tests pass alongside existing E2E. If hydration timing fails the first assertion, apply the fallback from Step 2 and re-run.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/preview.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): smoke-cover OntInteractiveRef wiring on a theory page

Asserts ontology refs render the .ont-iref interactive wrapper and the page
loads without console errors — first E2E coverage for the preview layer.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Final verification + memory update

- [ ] **Step 1: Run the full release gate**

Run: `npm test && npm run validate:data && npm run lint:ontology 2>&1 | tail -20`
Expected: Unit tests pass; data validation passes; `lint:ontology` shows only the 3 known pre-existing failures (`rx_metal_water_01_na`, `rx_metal_water_02_ca`, `rx_reduction_01_cuo_h2`) — no new ontology errors.

- [ ] **Step 2: Update project memory**

Edit `/home/andrey/.claude/projects/-home-andrey-work-chemistry/memory/project_acids_enrichment_status.md`: under the "REMAINING" line, mark items (1) formula variable tokens and (2) ion hover preview as DONE with this date, and note (3) E2E smoke coverage added. Update the MEMORY.md index line for Semantic Preview Layer to "complete".

- [ ] **Step 3: Commit memory (if tracked) or note completion**

Memory dir is gitignored (`.claude/`), so no commit needed. Confirm `git status` is clean apart from intended changes.

Run: `git status -sb`
Expected: clean working tree (all task commits landed).

---

## Self-Review Notes

**Spec coverage of remaining items:**
- Spec §"Phase 4 — Formula renderer: wrap variable tokens" → Tasks 1-3. ✅
- Spec §"Phase 4 — Deprecate old hardcoded tooltip path in IonDetailsProvider; migrate ion preview UI to OntInteractiveRef; keep provider temporarily if still needed" → Task 4 (additive hover preview; click popup retained per "keep provider temporarily"). ✅
- Spec §"Testing Matrix — Formula variable hover; Ion preview; Mobile tap (info→sheet, ref→navigate)" → Tasks 1-5 cover variable hover (unit + E2E) and ion hover. Mobile sheet behavior already implemented in `OntInteractiveRef` (pointer-coarse path); not re-planned.
- Already-implemented phases (0, 1a, 1b, 2, 3, session cache) → intentionally NOT re-planned; documented in Background.

**Type consistency:** `DisplayToken` (Task 1) is consumed by `collectVariableTokens`/`formulaToDisplayNodes` (Task 2) and the equation block (Task 3) with matching `kind: 'variable' | 'const' | 'text'` discriminants. `OntInteractiveRef` props (`formulaVariable: Variable`, `formulaId: string`, `display: ReactNode`, `locale: string`) match its actual interface verified in source. `buildCanonicalHref(ref, locale): string | null` matches registry source.

**No placeholders:** every code step shows complete code; every run step shows the command and expected result.
