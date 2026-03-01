/**
 * Compose a substance formula from a cation + anion pair.
 * E.g. Na⁺ + Cl⁻ → NaCl, Ca²⁺ + SO₄²⁻ → CaSO₄
 */
import type { Ion } from '../types/ion';

const SUBSCRIPT_MAP: Record<number, string> = {
  2: '\u2082', 3: '\u2083', 4: '\u2084', 5: '\u2085',
  6: '\u2086', 7: '\u2087', 8: '\u2088', 9: '\u2089',
};

/** Characters used in superscript charge notation (⁺, ⁻, ⁰–⁹). */
const SUPERSCRIPT_CHARS = '\u207A\u207B\u2070\u00B9\u00B2\u00B3\u2074\u2075\u2076\u2077\u2078\u2079';

function gcd(a: number, b: number): number {
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

/** Strip trailing Unicode superscript charge markers from an ion formula. */
export function ionBase(formula: string): string {
  let end = formula.length;
  while (end > 0 && SUPERSCRIPT_CHARS.includes(formula[end - 1])) {
    end--;
  }
  return formula.slice(0, end);
}

function isPolyatomic(base: string): boolean {
  let uppercaseCount = 0;
  for (const ch of base) {
    if (ch >= 'A' && ch <= 'Z') uppercaseCount++;
  }
  return uppercaseCount > 1;
}

function sub(n: number): string {
  return SUBSCRIPT_MAP[n] ?? String(n);
}

export function composeFormula(cation: Ion, anion: Ion): string {
  const catCharge = Math.abs(cation.charge);
  const anCharge = Math.abs(anion.charge);

  const g = gcd(catCharge, anCharge);
  const catCount = anCharge / g;
  const anCount = catCharge / g;

  const catBase = ionBase(cation.formula);
  const anBase = ionBase(anion.formula);

  let formula = '';

  if (catCount === 1) {
    formula += catBase;
  } else if (isPolyatomic(catBase)) {
    formula += `(${catBase})${sub(catCount)}`;
  } else {
    formula += catBase + sub(catCount);
  }

  if (anCount === 1) {
    formula += anBase;
  } else if (isPolyatomic(anBase)) {
    formula += `(${anBase})${sub(anCount)}`;
  } else {
    formula += anBase + sub(anCount);
  }

  return formula;
}
