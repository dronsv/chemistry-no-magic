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

/** Superscript digit to ASCII digit. */
const SUPERSCRIPT_DIGIT_MAP: Record<string, string> = {
  '\u2070': '0', '\u00B9': '1', '\u00B2': '2', '\u00B3': '3',
  '\u2074': '4', '\u2075': '5', '\u2076': '6', '\u2077': '7',
  '\u2078': '8', '\u2079': '9',
};

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

/**
 * Extract the signed charge magnitude from an ion formula string.
 * The charge is encoded in trailing Unicode superscripts.
 * E.g. "Na⁺" → 1, "Ca²⁺" → 2, "SO₄²⁻" → -2, "Cl⁻" → -1
 * Returns 0 if no charge notation found.
 */
export function chargeFromFormula(formula: string): number {
  // Work from the end: collect superscript chars
  let end = formula.length;
  let hasPlus = false;
  let hasMinus = false;
  let digitStr = '';

  for (let i = formula.length - 1; i >= 0; i--) {
    const ch = formula[i];
    if (ch === '\u207A') { hasPlus = true; end = i; }
    else if (ch === '\u207B') { hasMinus = true; end = i; }
    else if (SUPERSCRIPT_DIGIT_MAP[ch] !== undefined) {
      digitStr = SUPERSCRIPT_DIGIT_MAP[ch] + digitStr;
      end = i;
    } else {
      break;
    }
  }

  if (!hasPlus && !hasMinus) return 0;

  const magnitude = digitStr.length > 0 ? parseInt(digitStr, 10) : 1;
  return hasMinus ? -magnitude : magnitude;
}

export function composeFormula(cation: Ion, anion: Ion): string {
  const catCharge = Math.abs(chargeFromFormula(cation.formula));
  const anCharge = Math.abs(chargeFromFormula(anion.formula));

  const g = catCharge > 0 && anCharge > 0 ? gcd(catCharge, anCharge) : 1;
  const catCount = anCharge / g || 1;
  const anCount = catCharge / g || 1;

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
