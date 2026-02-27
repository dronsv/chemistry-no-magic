import { describe, it, expect } from 'vitest';

import type { ElementLike } from '../bond-calculator.ts';
import {
  determineBondType,
  determineCrystalStructure,
  analyzeFormula,
} from '../bond-calculator.ts';

// --- Test element factories ---

function el(symbol: string, electronegativity: number | null, metal_type: ElementLike['metal_type']): ElementLike {
  return { symbol, electronegativity, metal_type };
}

const Na = el('Na', 0.93, 'metal');
const Cl = el('Cl', 3.16, 'nonmetal');
const H = el('H', 2.2, 'nonmetal');
const O = el('O', 3.44, 'nonmetal');
const Fe = el('Fe', 1.83, 'metal');
const Cu = el('Cu', 1.90, 'metal');
const C = el('C', 2.55, 'nonmetal');
const Si = el('Si', 1.90, 'metalloid');
const Al = el('Al', 1.61, 'metal');
const N = el('N', 3.04, 'nonmetal');

describe('determineBondType', () => {
  describe('electronegativity difference thresholds', () => {
    it('returns ionic when delta-chi >= 1.7 (NaCl, delta=2.23)', () => {
      expect(determineBondType(Na, Cl)).toBe('ionic');
    });

    it('returns covalent_polar when 0.4 < delta-chi < 1.7 (HCl, delta=0.96)', () => {
      expect(determineBondType(H, Cl)).toBe('covalent_polar');
    });

    it('returns covalent_nonpolar when delta-chi <= 0.4 (OCl, delta=0.28)', () => {
      expect(determineBondType(O, Cl)).toBe('covalent_nonpolar');
    });
  });

  describe('same element', () => {
    it('returns metallic for same metal element (Fe-Fe)', () => {
      expect(determineBondType(Fe, Fe)).toBe('metallic');
    });

    it('returns covalent_nonpolar for same nonmetal element (O-O)', () => {
      expect(determineBondType(O, O)).toBe('covalent_nonpolar');
    });

    it('returns covalent_nonpolar for same metalloid element (Si-Si)', () => {
      expect(determineBondType(Si, Si)).toBe('covalent_nonpolar');
    });
  });

  describe('both metals', () => {
    it('returns metallic for two different metals (Fe-Cu)', () => {
      expect(determineBondType(Fe, Cu)).toBe('metallic');
    });
  });

  describe('null electronegativity fallback', () => {
    it('returns ionic when metal + nonmetal and electronegativity is null', () => {
      const unknownMetal = el('X', null, 'metal');
      const unknownNonmetal = el('Y', null, 'nonmetal');
      expect(determineBondType(unknownMetal, unknownNonmetal)).toBe('ionic');
    });

    it('returns covalent_nonpolar when nonmetal + nonmetal and electronegativity is null', () => {
      const a = el('X', null, 'nonmetal');
      const b = el('Y', null, 'nonmetal');
      expect(determineBondType(a, b)).toBe('covalent_nonpolar');
    });

    it('returns ionic when only one element has null electronegativity (metal + nonmetal)', () => {
      const unknownMetal = el('X', null, 'metal');
      expect(determineBondType(unknownMetal, Cl)).toBe('ionic');
    });

    it('returns covalent_nonpolar for metalloid + nonmetal with null electronegativity', () => {
      const unknownMetalloid = el('X', null, 'metalloid');
      const unknownNonmetal = el('Y', null, 'nonmetal');
      expect(determineBondType(unknownMetalloid, unknownNonmetal)).toBe('covalent_nonpolar');
    });
  });

  describe('boundary values', () => {
    it('returns ionic at exactly delta-chi = 1.7', () => {
      const a = el('A', 1.0, 'nonmetal');
      const b = el('B', 2.7, 'nonmetal');
      expect(determineBondType(a, b)).toBe('ionic');
    });

    it('returns covalent_polar at delta-chi just above 0.4', () => {
      const a = el('A', 1.0, 'nonmetal');
      const b = el('B', 1.41, 'nonmetal');
      expect(determineBondType(a, b)).toBe('covalent_polar');
    });

    it('returns covalent_nonpolar at exactly delta-chi = 0.4', () => {
      const a = el('A', 1.0, 'nonmetal');
      const b = el('B', 1.4, 'nonmetal');
      expect(determineBondType(a, b)).toBe('covalent_nonpolar');
    });
  });
});

describe('determineCrystalStructure', () => {
  describe('direct bond type mapping', () => {
    it('returns ionic for ionic bond', () => {
      expect(determineCrystalStructure('ionic', 'NaCl', ['Na', 'Cl'])).toBe('ionic');
    });

    it('returns metallic for metallic bond', () => {
      expect(determineCrystalStructure('metallic', 'Fe', ['Fe'])).toBe('metallic');
    });
  });

  describe('atomic crystal — single elements', () => {
    it('returns atomic for C (diamond/graphite)', () => {
      expect(determineCrystalStructure('covalent_nonpolar', 'C', ['C'])).toBe('atomic');
    });

    it('returns atomic for Si', () => {
      expect(determineCrystalStructure('covalent_nonpolar', 'Si', ['Si'])).toBe('atomic');
    });

    it('returns atomic for B', () => {
      expect(determineCrystalStructure('covalent_nonpolar', 'B', ['B'])).toBe('atomic');
    });

    it('returns atomic for Ge', () => {
      expect(determineCrystalStructure('covalent_nonpolar', 'Ge', ['Ge'])).toBe('atomic');
    });

    it('returns molecular for non-atomic single element (O)', () => {
      expect(determineCrystalStructure('covalent_nonpolar', 'O2', ['O'])).toBe('molecular');
    });
  });

  describe('atomic crystal — compounds', () => {
    it('returns atomic for SiO2', () => {
      expect(determineCrystalStructure('covalent_polar', 'SiO2', ['Si', 'O'])).toBe('atomic');
    });

    it('returns atomic for B2O3', () => {
      expect(determineCrystalStructure('covalent_polar', 'B2O3', ['B', 'O'])).toBe('atomic');
    });

    it('returns atomic for SiC', () => {
      expect(determineCrystalStructure('covalent_polar', 'SiC', ['Si', 'C'])).toBe('atomic');
    });

    it('returns atomic for Al2O3', () => {
      expect(determineCrystalStructure('covalent_polar', 'Al2O3', ['Al', 'O'])).toBe('atomic');
    });
  });

  describe('molecular crystal — default', () => {
    it('returns molecular for H2O', () => {
      expect(determineCrystalStructure('covalent_polar', 'H2O', ['H', 'O'])).toBe('molecular');
    });

    it('returns molecular for CO2', () => {
      expect(determineCrystalStructure('covalent_polar', 'CO2', ['C', 'O'])).toBe('molecular');
    });

    it('returns molecular for N2', () => {
      expect(determineCrystalStructure('covalent_nonpolar', 'N2', ['N'])).toBe('molecular');
    });
  });
});

describe('analyzeFormula', () => {
  function buildElementMap(...elements: ElementLike[]): Map<string, ElementLike> {
    return new Map(elements.map(e => [e.symbol, e]));
  }

  describe('single element formulas', () => {
    it('analyzes Fe as metallic bond and metallic crystal', () => {
      const map = buildElementMap(Fe);
      const result = analyzeFormula('Fe', map);

      expect(result.formula).toBe('Fe');
      expect(result.crystalStructure).toBe('metallic');
      expect(result.bonds).toHaveLength(1);
      expect(result.bonds[0].bondType).toBe('metallic');
      expect(result.bonds[0].elementA).toBe('Fe');
      expect(result.bonds[0].elementB).toBe('Fe');
      expect(result.bonds[0].deltaChi).toBe(0);
    });

    it('analyzes O2 as covalent_nonpolar bond and molecular crystal', () => {
      const map = buildElementMap(O);
      const result = analyzeFormula('O2', map);

      expect(result.crystalStructure).toBe('molecular');
      expect(result.bonds[0].bondType).toBe('covalent_nonpolar');
    });

    it('analyzes C as covalent_nonpolar bond and atomic crystal', () => {
      const map = buildElementMap(C);
      const result = analyzeFormula('C', map);

      expect(result.crystalStructure).toBe('atomic');
      expect(result.bonds[0].bondType).toBe('covalent_nonpolar');
    });
  });

  describe('compound formulas', () => {
    it('analyzes NaCl as ionic bond and ionic crystal', () => {
      const map = buildElementMap(Na, Cl);
      const result = analyzeFormula('NaCl', map);

      expect(result.formula).toBe('NaCl');
      expect(result.crystalStructure).toBe('ionic');
      expect(result.bonds).toHaveLength(1);
      expect(result.bonds[0].bondType).toBe('ionic');
      expect(result.bonds[0].elementA).toBe('Na');
      expect(result.bonds[0].elementB).toBe('Cl');
      expect(result.bonds[0].deltaChi).toBeCloseTo(2.23, 1);
    });

    it('analyzes SiO2 as covalent_polar bond and atomic crystal', () => {
      const map = buildElementMap(Si, O);
      const result = analyzeFormula('SiO2', map);

      expect(result.crystalStructure).toBe('atomic');
      expect(result.bonds[0].bondType).toBe('covalent_polar');
    });

    it('analyzes H2O as covalent_polar bond and molecular crystal', () => {
      const map = buildElementMap(H, O);
      const result = analyzeFormula('H2O', map);

      expect(result.crystalStructure).toBe('molecular');
      expect(result.bonds[0].bondType).toBe('covalent_polar');
      expect(result.bonds[0].deltaChi).toBeCloseTo(1.24, 1);
    });
  });

  describe('multi-element compounds', () => {
    it('picks the max delta-chi pair in a ternary compound (NaOH)', () => {
      const map = buildElementMap(Na, O, H);
      const result = analyzeFormula('NaOH', map);

      expect(result.bonds).toHaveLength(1);
      // Na(0.93) vs O(3.44) has the largest delta = 2.51
      expect(result.bonds[0].elementA).toBe('Na');
      expect(result.bonds[0].elementB).toBe('O');
      expect(result.bonds[0].deltaChi).toBeCloseTo(2.51, 1);
      expect(result.bonds[0].bondType).toBe('ionic');
    });
  });

  describe('edge cases', () => {
    it('returns empty bonds and molecular crystal for unknown element', () => {
      const map = buildElementMap(Na);
      const result = analyzeFormula('XeF2', map);

      expect(result.bonds).toHaveLength(0);
      expect(result.crystalStructure).toBe('molecular');
    });

    it('returns empty bonds and molecular crystal for empty formula', () => {
      const map = buildElementMap(Na);
      const result = analyzeFormula('', map);

      expect(result.bonds).toHaveLength(0);
      expect(result.crystalStructure).toBe('molecular');
    });

    it('returns empty bonds when only one element of a compound is in the map', () => {
      const map = buildElementMap(Na);
      const result = analyzeFormula('NaCl', map);

      expect(result.bonds).toHaveLength(0);
      expect(result.crystalStructure).toBe('molecular');
    });
  });
});
