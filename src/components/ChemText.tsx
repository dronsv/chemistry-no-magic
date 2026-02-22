import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import FormulaChip from './FormulaChip';
import type { FormulaLookup, FormulaLookupEntry } from '../types/formula-lookup';

// ---------------------------------------------------------------------------
// Context — parent loads the lookup once, children access via useFormulaLookup()
// ---------------------------------------------------------------------------

const FormulaLookupCtx = createContext<FormulaLookup | null>(null);

export function FormulaLookupProvider({
  value,
  children,
}: {
  value: FormulaLookup | null;
  children: ReactNode;
}) {
  return (
    <FormulaLookupCtx.Provider value={value}>
      {children}
    </FormulaLookupCtx.Provider>
  );
}

export function useFormulaLookup(): FormulaLookup | null {
  return useContext(FormulaLookupCtx);
}

// ---------------------------------------------------------------------------
// Regex builder — longest match first, cached per lookup identity
// ---------------------------------------------------------------------------

/** Escape regex special chars in a formula string. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a regex that alternates all known formulas, longest first.
 * Uses a lookahead to avoid matching when followed by a lowercase Latin letter
 * (which would mean the match is part of a longer word).
 *
 * We do NOT use lookbehind ((?<!...)) for Safari < 16.4 compatibility.
 * Instead we manually check the preceding character after each match.
 */
function buildFormulaRegex(lookup: FormulaLookup): RegExp {
  const formulas = Object.keys(lookup).sort((a, b) => b.length - a.length);
  if (formulas.length === 0) return /(?!)/; // never matches
  const alt = formulas.map(escapeRe).join('|');
  // Lookahead: not followed by lowercase Latin (prevents matching inside words)
  return new RegExp(`(?:${alt})(?![a-z])`, 'g');
}

/** Characters that mean "the match is inside a word, skip it". */
const WORD_CHAR = /[A-Za-z\u0410-\u044F\u0451\u0401]/;

// ---------------------------------------------------------------------------
// ChemText component
// ---------------------------------------------------------------------------

interface Props {
  text: string;
}

/**
 * Parses text for chemical formulas and wraps recognised ones in <FormulaChip>.
 *
 * Formulas are matched against a build-time lookup of known substances and
 * elements. Longest match wins ("H₂SO₄" before "H₂" or "S").
 * Once matched, the span is excluded from further scanning.
 *
 * Uses FormulaLookupProvider context. If context is null, renders plain text.
 */
export default function ChemText({ text }: Props) {
  const lookup = useFormulaLookup();

  const regex = useMemo(
    () => (lookup ? buildFormulaRegex(lookup) : null),
    [lookup],
  );

  const parts = useMemo(() => {
    if (!lookup || !regex) return null;

    const result: (string | ReactNode)[] = [];
    let lastIndex = 0;
    let keyIdx = 0;

    regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      // Manual "lookbehind": skip if preceded by a Latin/Cyrillic letter
      if (match.index > 0 && WORD_CHAR.test(text[match.index - 1])) {
        continue;
      }

      const formula = match[0];
      const entry: FormulaLookupEntry | undefined = lookup[formula];
      if (!entry) continue;

      // Extra filter for single-char matches (H, O, I, V, S, etc.):
      // Skip if preceded by '(' or '+' or '-' — likely Roman numeral / oxidation state
      // Skip if followed by uppercase — likely abbreviation (IUPAC) or Roman numeral (II)
      if (formula.length === 1) {
        const charBefore = match.index > 0 ? text[match.index - 1] : '';
        const charAfter = text[match.index + 1] ?? '';
        if (/[+\-(]/.test(charBefore) || /[A-Z)]/.test(charAfter)) {
          continue;
        }
      }

      // Push text before this match
      if (match.index > lastIndex) {
        result.push(text.slice(lastIndex, match.index));
      }

      if (entry.type === 'substance') {
        result.push(
          <FormulaChip
            key={keyIdx++}
            formula={formula}
            substanceId={entry.id}
            substanceClass={entry.cls}
          />,
        );
      } else if (entry.type === 'ion') {
        result.push(
          <FormulaChip
            key={keyIdx++}
            formula={formula}
            ionType={entry.ionType}
            ionId={entry.id}
          />,
        );
      } else {
        // Element — styled chip, no substance link
        result.push(
          <FormulaChip
            key={keyIdx++}
            formula={formula}
            substanceClass="simple"
          />,
        );
      }

      lastIndex = match.index + formula.length;
    }

    // No matches at all → return null to signal "use plain text"
    if (result.length === 0 && lastIndex === 0) return null;

    // Trailing text
    if (lastIndex < text.length) {
      result.push(text.slice(lastIndex));
    }

    return result;
  }, [text, lookup, regex]);

  // If no lookup or no matches, render plain text
  if (!parts) return <>{text}</>;

  return <>{parts}</>;
}
