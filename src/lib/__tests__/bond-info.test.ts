import { describe, it, expect } from 'vitest';
import { computeBondInfo } from '../bond-info';
import type { MoleculeStructure } from '../../types/molecule';
import type { ElementLike } from '../bond-calculator';

function makeElements(...entries: [string, number | null, 'metal' | 'nonmetal' | 'metalloid'][]): Map<string, ElementLike> {
  const map = new Map<string, ElementLike>();
  for (const [symbol, en, metalType] of entries) {
    map.set(symbol, { symbol, electronegativity: en, metal_type: metalType });
  }
  return map;
}

describe('computeBondInfo', () => {
  it('returns bond type and ΔEN for H2O (polar covalent)', () => {
    const structure: MoleculeStructure = {
      id: 'h2o',
      atoms: [
        { id: 'O1', symbol: 'O', x: 0, y: 0 },
        { id: 'H1', symbol: 'H', x: -1, y: 1 },
        { id: 'H2', symbol: 'H', x: 1, y: 1 },
      ],
      bonds: [
        { from: 'O1', to: 'H1', order: 1 },
        { from: 'O1', to: 'H2', order: 1 },
      ],
    };
    // O: 3.44, H: 2.20 → ΔEN = 1.24
    const elements = makeElements(['O', 3.44, 'nonmetal'], ['H', 2.20, 'nonmetal']);
    const result = computeBondInfo(structure, elements);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ from: 'O1', to: 'H1', bondType: 'covalent_polar', deltaChi: 1.24 });
    expect(result[1]).toEqual({ from: 'O1', to: 'H2', bondType: 'covalent_polar', deltaChi: 1.24 });
  });

  it('returns ionic for NaCl', () => {
    const structure: MoleculeStructure = {
      id: 'nacl',
      atoms: [
        { id: 'Na1', symbol: 'Na', x: 0, y: 0 },
        { id: 'Cl1', symbol: 'Cl', x: 1, y: 0 },
      ],
      bonds: [
        { from: 'Na1', to: 'Cl1', order: 1 },
      ],
    };
    // Na: 0.93, Cl: 3.16 → ΔEN = 2.23
    const elements = makeElements(['Na', 0.93, 'metal'], ['Cl', 3.16, 'nonmetal']);
    const result = computeBondInfo(structure, elements);

    expect(result).toHaveLength(1);
    expect(result[0].bondType).toBe('ionic');
    expect(result[0].deltaChi).toBe(2.23);
  });

  it('returns nonpolar for N2 (same element)', () => {
    const structure: MoleculeStructure = {
      id: 'n2',
      atoms: [
        { id: 'N1', symbol: 'N', x: 0, y: 0 },
        { id: 'N2', symbol: 'N', x: 1, y: 0 },
      ],
      bonds: [
        { from: 'N1', to: 'N2', order: 3 },
      ],
    };
    const elements = makeElements(['N', 3.04, 'nonmetal']);
    const result = computeBondInfo(structure, elements);

    expect(result).toHaveLength(1);
    expect(result[0].bondType).toBe('covalent_nonpolar');
    expect(result[0].deltaChi).toBe(0);
  });

  it('handles missing element data gracefully', () => {
    const structure: MoleculeStructure = {
      id: 'test',
      atoms: [
        { id: 'X1', symbol: 'Xx', x: 0, y: 0 },
        { id: 'Y1', symbol: 'Yy', x: 1, y: 0 },
      ],
      bonds: [
        { from: 'X1', to: 'Y1', order: 1 },
      ],
    };
    const elements = makeElements(); // empty
    const result = computeBondInfo(structure, elements);

    expect(result).toHaveLength(1);
    expect(result[0].bondType).toBe('covalent_nonpolar');
    expect(result[0].deltaChi).toBeNull();
  });

  it('handles null electronegativity', () => {
    const structure: MoleculeStructure = {
      id: 'test',
      atoms: [
        { id: 'Fe1', symbol: 'Fe', x: 0, y: 0 },
        { id: 'O1', symbol: 'O', x: 1, y: 0 },
      ],
      bonds: [
        { from: 'Fe1', to: 'O1', order: 1 },
      ],
    };
    // Fe has EN but fallback: metal + nonmetal → ionic
    const elements = makeElements(['Fe', null, 'metal'], ['O', 3.44, 'nonmetal']);
    const result = computeBondInfo(structure, elements);

    expect(result).toHaveLength(1);
    expect(result[0].bondType).toBe('ionic'); // fallback: metal + nonmetal
    expect(result[0].deltaChi).toBeNull();
  });

  it('returns empty array for structure with no bonds', () => {
    const structure: MoleculeStructure = {
      id: 'noble',
      atoms: [{ id: 'He1', symbol: 'He', x: 0, y: 0 }],
      bonds: [],
    };
    const elements = makeElements(['He', null, 'nonmetal']);
    const result = computeBondInfo(structure, elements);
    expect(result).toEqual([]);
  });
});
