import { describe, it, expect } from 'vitest';

import { parseFormula } from '../formula-parser.ts';

describe('parseFormula', () => {
  describe('simple formulas', () => {
    it('parses NaCl', () => {
      expect(parseFormula('NaCl')).toEqual({ Na: 1, Cl: 1 });
    });

    it('parses H2O', () => {
      expect(parseFormula('H2O')).toEqual({ H: 2, O: 1 });
    });

    it('parses Fe2O3', () => {
      expect(parseFormula('Fe2O3')).toEqual({ Fe: 2, O: 3 });
    });

    it('parses KMnO4', () => {
      expect(parseFormula('KMnO4')).toEqual({ K: 1, Mn: 1, O: 4 });
    });
  });

  describe('parentheses', () => {
    it('parses Ca(OH)2', () => {
      expect(parseFormula('Ca(OH)2')).toEqual({ Ca: 1, O: 2, H: 2 });
    });

    it('parses Mg3(PO4)2', () => {
      expect(parseFormula('Mg3(PO4)2')).toEqual({ Mg: 3, P: 2, O: 8 });
    });

    it('parses Al2(SO4)3', () => {
      expect(parseFormula('Al2(SO4)3')).toEqual({ Al: 2, S: 3, O: 12 });
    });
  });

  describe('single elements', () => {
    it('parses O2', () => {
      expect(parseFormula('O2')).toEqual({ O: 2 });
    });

    it('parses Fe', () => {
      expect(parseFormula('Fe')).toEqual({ Fe: 1 });
    });

    it('parses N2', () => {
      expect(parseFormula('N2')).toEqual({ N: 2 });
    });
  });

  describe('edge cases', () => {
    it('returns empty object for empty string', () => {
      expect(parseFormula('')).toEqual({});
    });

    it('merges duplicate elements in CH3COOH', () => {
      expect(parseFormula('CH3COOH')).toEqual({ C: 2, H: 4, O: 2 });
    });
  });
});
