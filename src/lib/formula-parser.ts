/**
 * Parse ASCII chemical formulas into element→count maps.
 * Handles: NaCl, H2O, Fe2O3, Ca(OH)2, Mg3(PO4)2
 */

// ── Formula normalization helpers ────────────────────────────────

/** Convert Unicode subscript digits (₀–₉) to ASCII digits. */
export function unicodeToAscii(formula: string): string {
  return formula.replace(/[\u2080-\u2089]/g, ch =>
    String(ch.charCodeAt(0) - 0x2080),
  );
}

/** Strip trailing superscript charge notation from ion formulas: SO₄²⁻ → SO₄ */
export function stripIonCharge(formula: string): string {
  return formula.replace(/[\u2070\u00B9\u00B2\u00B3\u2074-\u2079\u207A\u207B]+$/, '');
}

// ── Parsing ──────────────────────────────────────────────────────

/** Parse "KMnO4" → { K: 1, Mn: 1, O: 4 } */
export function parseFormula(formula: string): Record<string, number> {
  const result: Record<string, number> = {};
  const stack: Record<string, number>[] = [result];
  let i = 0;

  while (i < formula.length) {
    const ch = formula[i];

    if (ch === '(') {
      const group: Record<string, number> = {};
      stack.push(group);
      i++;
    } else if (ch === ')') {
      i++;
      const num = readNumber();
      const group = stack.pop()!;
      const target = stack[stack.length - 1];
      for (const [sym, count] of Object.entries(group)) {
        target[sym] = (target[sym] ?? 0) + count * num;
      }
    } else if (ch >= 'A' && ch <= 'Z') {
      const symbol = readSymbol();
      const num = readNumber();
      const target = stack[stack.length - 1];
      target[symbol] = (target[symbol] ?? 0) + num;
    } else {
      // Skip unexpected characters (digits after nothing, spaces, etc.)
      i++;
    }
  }

  return result;

  function readSymbol(): string {
    let sym = formula[i++];
    while (i < formula.length && formula[i] >= 'a' && formula[i] <= 'z') {
      sym += formula[i++];
    }
    return sym;
  }

  function readNumber(): number {
    let num = '';
    while (i < formula.length && formula[i] >= '0' && formula[i] <= '9') {
      num += formula[i++];
    }
    return num ? parseInt(num, 10) : 1;
  }
}
