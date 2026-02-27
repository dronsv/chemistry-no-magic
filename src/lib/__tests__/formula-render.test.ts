import { describe, it, expect } from 'vitest';

import {
  isSuperscript,
  isSubscript,
  parseFormulaParts,
} from '../formula-render.ts';

describe('isSuperscript', () => {
  it('returns true for all Unicode superscript digits 0-9', () => {
    const superscriptDigits = [
      '\u2070', // ⁰
      '\u00B9', // ¹
      '\u00B2', // ²
      '\u00B3', // ³
      '\u2074', // ⁴
      '\u2075', // ⁵
      '\u2076', // ⁶
      '\u2077', // ⁷
      '\u2078', // ⁸
      '\u2079', // ⁹
    ];
    for (const ch of superscriptDigits) {
      expect(isSuperscript(ch)).toBe(true);
    }
  });

  it('returns true for superscript plus and minus signs', () => {
    expect(isSuperscript('\u207A')).toBe(true); // ⁺
    expect(isSuperscript('\u207B')).toBe(true); // ⁻
  });

  it('returns false for normal ASCII digits', () => {
    for (const ch of '0123456789') {
      expect(isSuperscript(ch)).toBe(false);
    }
  });

  it('returns false for regular letters', () => {
    for (const ch of 'abcXYZ') {
      expect(isSuperscript(ch)).toBe(false);
    }
  });

  it('returns false for regular plus and minus', () => {
    expect(isSuperscript('+')).toBe(false);
    expect(isSuperscript('-')).toBe(false);
  });
});

describe('isSubscript', () => {
  it('returns true for all Unicode subscript digits 0-9', () => {
    const subscriptDigits = [
      '\u2080', // ₀
      '\u2081', // ₁
      '\u2082', // ₂
      '\u2083', // ₃
      '\u2084', // ₄
      '\u2085', // ₅
      '\u2086', // ₆
      '\u2087', // ₇
      '\u2088', // ₈
      '\u2089', // ₉
    ];
    for (const ch of subscriptDigits) {
      expect(isSubscript(ch)).toBe(true);
    }
  });

  it('returns false for normal ASCII digits', () => {
    for (const ch of '0123456789') {
      expect(isSubscript(ch)).toBe(false);
    }
  });

  it('returns false for regular letters', () => {
    for (const ch of 'abcXYZ') {
      expect(isSubscript(ch)).toBe(false);
    }
  });

  it('returns false for superscript characters', () => {
    expect(isSubscript('\u00B2')).toBe(false); // ²
    expect(isSubscript('\u207A')).toBe(false); // ⁺
  });
});

describe('parseFormulaParts', () => {
  it('returns empty array for empty string', () => {
    expect(parseFormulaParts('')).toEqual([]);
  });

  it('parses plain text without any sub/superscripts', () => {
    expect(parseFormulaParts('NaCl')).toEqual([
      { type: 'text', content: 'NaCl' },
    ]);
  });

  it('parses formula with subscript (H₂O)', () => {
    expect(parseFormulaParts('H\u2082O')).toEqual([
      { type: 'text', content: 'H' },
      { type: 'sub', content: '2' },
      { type: 'text', content: 'O' },
    ]);
  });

  it('parses ion charge superscript (²⁻ decodes to 2 followed by minus sign)', () => {
    const result = parseFormulaParts('\u00B2\u207B');
    expect(result).toEqual([
      { type: 'sup', content: '2\u2212' },
    ]);
  });

  it('parses mixed formula SO₄²⁻', () => {
    expect(parseFormulaParts('SO\u2084\u00B2\u207B')).toEqual([
      { type: 'text', content: 'SO' },
      { type: 'sub', content: '4' },
      { type: 'sup', content: '2\u2212' },
    ]);
  });

  it('parses Fe₂O₃ with multiple subscript groups', () => {
    expect(parseFormulaParts('Fe\u2082O\u2083')).toEqual([
      { type: 'text', content: 'Fe' },
      { type: 'sub', content: '2' },
      { type: 'text', content: 'O' },
      { type: 'sub', content: '3' },
    ]);
  });

  it('parses superscript-only string ²⁺ as a single sup part', () => {
    expect(parseFormulaParts('\u00B2\u207A')).toEqual([
      { type: 'sup', content: '2+' },
    ]);
  });

  it('parses multi-digit subscript (₁₂ decodes to 12)', () => {
    expect(parseFormulaParts('C\u2081\u2082H\u2082\u2082O\u2081\u2081')).toEqual([
      { type: 'text', content: 'C' },
      { type: 'sub', content: '12' },
      { type: 'text', content: 'H' },
      { type: 'sub', content: '22' },
      { type: 'text', content: 'O' },
      { type: 'sub', content: '11' },
    ]);
  });

  it('parses single superscript digit ³⁺ (e.g. Fe³⁺)', () => {
    expect(parseFormulaParts('Fe\u00B3\u207A')).toEqual([
      { type: 'text', content: 'Fe' },
      { type: 'sup', content: '3+' },
    ]);
  });

  it('parses monovalent cation charge ⁺ alone', () => {
    expect(parseFormulaParts('Na\u207A')).toEqual([
      { type: 'text', content: 'Na' },
      { type: 'sup', content: '+' },
    ]);
  });

  it('parses monovalent anion charge ⁻ alone', () => {
    expect(parseFormulaParts('Cl\u207B')).toEqual([
      { type: 'text', content: 'Cl' },
      { type: 'sup', content: '\u2212' },
    ]);
  });

  it('parses complex ion with parentheses, subscript, and charge: [Cu(OH)₄]²⁻', () => {
    expect(parseFormulaParts('[Cu(OH)\u2084]\u00B2\u207B')).toEqual([
      { type: 'text', content: '[Cu(OH)' },
      { type: 'sub', content: '4' },
      { type: 'text', content: ']' },
      { type: 'sup', content: '2\u2212' },
    ]);
  });
});
