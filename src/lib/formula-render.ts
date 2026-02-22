/**
 * Shared utilities for rendering chemical formulas with proper sup/sub notation.
 * Used by FormulaChip and replaces custom rendering in SolubilityTable.
 */

/** Unicode superscript character ranges. */
const SUPERSCRIPT_CHARS = '\u2070\u00B9\u00B2\u00B3\u2074\u2075\u2076\u2077\u2078\u2079\u207A\u207B';

/** Unicode subscript character ranges. */
const SUBSCRIPT_CHARS = '\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089';

/** Decode a single Unicode superscript character to its ASCII equivalent. */
function decodeSuperscript(ch: string): string {
  const map: Record<string, string> = {
    '\u2070': '0', '\u00B9': '1', '\u00B2': '2', '\u00B3': '3',
    '\u2074': '4', '\u2075': '5', '\u2076': '6', '\u2077': '7',
    '\u2078': '8', '\u2079': '9', '\u207A': '+', '\u207B': '\u2212',
  };
  return map[ch] ?? ch;
}

/** Decode a single Unicode subscript character to its ASCII digit. */
function decodeSubscript(ch: string): string {
  return String(ch.charCodeAt(0) - 0x2080);
}

/** Check if a character is a Unicode superscript. */
export function isSuperscript(ch: string): boolean {
  return SUPERSCRIPT_CHARS.includes(ch);
}

/** Check if a character is a Unicode subscript. */
export function isSubscript(ch: string): boolean {
  return SUBSCRIPT_CHARS.includes(ch);
}

export interface FormulaPart {
  type: 'text' | 'sup' | 'sub';
  content: string;
}

/**
 * Parse a formula string with Unicode super/subscripts into structured parts.
 * E.g. "SO₄²⁻" → [{text,"SO"}, {sub,"4"}, {sup,"2−"}]
 */
export function parseFormulaParts(formula: string): FormulaPart[] {
  const parts: FormulaPart[] = [];
  let i = 0;

  while (i < formula.length) {
    const ch = formula[i];
    if (isSuperscript(ch)) {
      let sup = '';
      while (i < formula.length && isSuperscript(formula[i])) {
        sup += decodeSuperscript(formula[i]);
        i++;
      }
      parts.push({ type: 'sup', content: sup });
    } else if (isSubscript(ch)) {
      let sub = '';
      while (i < formula.length && isSubscript(formula[i])) {
        sub += decodeSubscript(formula[i]);
        i++;
      }
      parts.push({ type: 'sub', content: sub });
    } else {
      let text = '';
      while (i < formula.length && !isSuperscript(formula[i]) && !isSubscript(formula[i])) {
        text += formula[i];
        i++;
      }
      parts.push({ type: 'text', content: text });
    }
  }

  return parts;
}
