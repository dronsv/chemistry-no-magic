import { describe, it, expect } from 'vitest';

import { deriveBondCounts } from '../../../scripts/lib/derive-bond-counts.mjs';

// --- Helper: build a minimal MoleculeStructure-like object ---

function makeStructure(
  id: string,
  atoms: { id: string; symbol: string }[],
  bonds: { from: string; to: string; order: number; dative?: boolean }[],
) {
  return {
    id,
    atoms: atoms.map((a) => ({ ...a, x: 0, y: 0 })),
    bonds,
  };
}

describe('deriveBondCounts', () => {
  it('counts H2O: 2 single O-H bonds', () => {
    const structure = makeStructure(
      'H2O',
      [
        { id: 'O1', symbol: 'O' },
        { id: 'H1', symbol: 'H' },
        { id: 'H2', symbol: 'H' },
      ],
      [
        { from: 'O1', to: 'H1', order: 1 },
        { from: 'O1', to: 'H2', order: 1 },
      ],
    );

    const result = deriveBondCounts(structure);

    expect(result.substance_id).toBe('H2O');
    expect(result.quality).toBe('exact');
    expect(result.bonds).toEqual([
      { a: 'H', b: 'O', order: 1, count: 2 },
    ]);
  });

  it('counts CO2: 2 double C=O bonds', () => {
    const structure = makeStructure(
      'CO2',
      [
        { id: 'C1', symbol: 'C' },
        { id: 'O1', symbol: 'O' },
        { id: 'O2', symbol: 'O' },
      ],
      [
        { from: 'C1', to: 'O1', order: 2 },
        { from: 'C1', to: 'O2', order: 2 },
      ],
    );

    const result = deriveBondCounts(structure);

    expect(result.substance_id).toBe('CO2');
    expect(result.quality).toBe('exact');
    expect(result.bonds).toEqual([
      { a: 'C', b: 'O', order: 2, count: 2 },
    ]);
  });

  it('returns empty bonds for ionic NaCl (no bonds array entries)', () => {
    const structure = makeStructure(
      'NaCl',
      [
        { id: 'Na1', symbol: 'Na' },
        { id: 'Cl1', symbol: 'Cl' },
      ],
      [],
    );

    const result = deriveBondCounts(structure);

    expect(result.substance_id).toBe('NaCl');
    expect(result.quality).toBe('exact');
    expect(result.bonds).toEqual([]);
  });

  it('counts SO3: 3 double S=O bonds with correct alphabetical order', () => {
    const structure = makeStructure(
      'SO3',
      [
        { id: 'S1', symbol: 'S' },
        { id: 'O1', symbol: 'O' },
        { id: 'O2', symbol: 'O' },
        { id: 'O3', symbol: 'O' },
      ],
      [
        { from: 'S1', to: 'O1', order: 2 },
        { from: 'S1', to: 'O2', order: 2 },
        { from: 'S1', to: 'O3', order: 2 },
      ],
    );

    const result = deriveBondCounts(structure);

    // O comes before S alphabetically
    expect(result.bonds).toEqual([
      { a: 'O', b: 'S', order: 2, count: 3 },
    ]);
  });

  it('normalizes bond direction: O1→H1 produces a:"H", b:"O"', () => {
    const structure = makeStructure(
      'test_norm',
      [
        { id: 'O1', symbol: 'O' },
        { id: 'H1', symbol: 'H' },
      ],
      [
        { from: 'O1', to: 'H1', order: 1 },
      ],
    );

    const result = deriveBondCounts(structure);

    expect(result.bonds[0].a).toBe('H');
    expect(result.bonds[0].b).toBe('O');
  });

  it('aggregates mixed bond orders separately', () => {
    // A molecule with both single and double C-O bonds (e.g., carboxylic acid fragment)
    const structure = makeStructure(
      'mixed_CO',
      [
        { id: 'C1', symbol: 'C' },
        { id: 'O1', symbol: 'O' },
        { id: 'O2', symbol: 'O' },
      ],
      [
        { from: 'C1', to: 'O1', order: 1 },
        { from: 'C1', to: 'O2', order: 2 },
      ],
    );

    const result = deriveBondCounts(structure);

    expect(result.bonds).toEqual([
      { a: 'C', b: 'O', order: 1, count: 1 },
      { a: 'C', b: 'O', order: 2, count: 1 },
    ]);
  });

  it('treats dative bonds the same as regular bonds', () => {
    // NH4+ has a dative N→H bond
    const structure = makeStructure(
      'NH4_plus',
      [
        { id: 'N1', symbol: 'N' },
        { id: 'H1', symbol: 'H' },
        { id: 'H2', symbol: 'H' },
        { id: 'H3', symbol: 'H' },
        { id: 'H4', symbol: 'H' },
      ],
      [
        { from: 'N1', to: 'H1', order: 1 },
        { from: 'N1', to: 'H2', order: 1 },
        { from: 'N1', to: 'H3', order: 1 },
        { from: 'N1', to: 'H4', order: 1, dative: true },
      ],
    );

    const result = deriveBondCounts(structure);

    // All 4 N-H bonds aggregated together, dative is treated the same
    expect(result.bonds).toEqual([
      { a: 'H', b: 'N', order: 1, count: 4 },
    ]);
  });

  it('sorts output bonds by key for deterministic output', () => {
    // A molecule with N-H, C-H, and C-N bonds
    const structure = makeStructure(
      'multi_bond',
      [
        { id: 'N1', symbol: 'N' },
        { id: 'C1', symbol: 'C' },
        { id: 'H1', symbol: 'H' },
        { id: 'H2', symbol: 'H' },
      ],
      [
        { from: 'N1', to: 'H1', order: 1 },
        { from: 'C1', to: 'H2', order: 1 },
        { from: 'C1', to: 'N1', order: 2 },
      ],
    );

    const result = deriveBondCounts(structure);

    // Sorted by key: C-H:1 < C-N:2 < H-N:1
    expect(result.bonds).toEqual([
      { a: 'C', b: 'H', order: 1, count: 1 },
      { a: 'C', b: 'N', order: 2, count: 1 },
      { a: 'H', b: 'N', order: 1, count: 1 },
    ]);
  });

  it('skips bonds referencing unknown atom IDs', () => {
    const structure = makeStructure(
      'bad_ref',
      [
        { id: 'O1', symbol: 'O' },
        { id: 'H1', symbol: 'H' },
      ],
      [
        { from: 'O1', to: 'H1', order: 1 },
        { from: 'O1', to: 'MISSING', order: 1 },
      ],
    );

    const result = deriveBondCounts(structure);

    expect(result.bonds).toEqual([
      { a: 'H', b: 'O', order: 1, count: 1 },
    ]);
  });

  it('handles missing atoms array gracefully', () => {
    const result = deriveBondCounts({ id: 'no_atoms', bonds: [] } as any);
    expect(result.substance_id).toBe('no_atoms');
    expect(result.bonds).toEqual([]);
    expect(result.quality).toBe('exact');
  });

  it('handles missing bonds array gracefully', () => {
    const result = deriveBondCounts({
      id: 'no_bonds',
      atoms: [{ id: 'H1', symbol: 'H', x: 0, y: 0 }],
    } as any);
    expect(result.substance_id).toBe('no_bonds');
    expect(result.bonds).toEqual([]);
  });

  it('defaults undefined bond.order to 1', () => {
    const structure = {
      id: 'undef_order',
      atoms: [
        { id: 'H1', symbol: 'H', x: 0, y: 0 },
        { id: 'Cl1', symbol: 'Cl', x: 0, y: 0 },
      ],
      bonds: [{ from: 'H1', to: 'Cl1' }],
    };

    const result = deriveBondCounts(structure as any);

    expect(result.bonds).toEqual([
      { a: 'Cl', b: 'H', order: 1, count: 1 },
    ]);
  });
});
