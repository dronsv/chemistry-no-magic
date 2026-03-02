import { describe, it, expect } from 'vitest';
import type { BondEnergyTableV1 } from '../../types/calculator';
import type { BondCount } from '../../types/bond-counts';
import { calcBondEnergyV1 } from '../calc-bond-energy';

/** Minimal bond energy table for tests. */
const TABLE: BondEnergyTableV1 = {
  version: 1,
  unit: 'kJ/mol',
  bonds: {
    'H-O:1': { avg: 463, source: 'CRC' },
    'C-O:2': { avg: 799, source: 'CRC' },
    'N-O:1': { avg: 201, source: 'CRC' },
    'N-O:2': { avg: 607, source: 'CRC' },
  },
};

describe('BondEnergyTableV1 type shape', () => {
  it('can be constructed with required fields', () => {
    const t: BondEnergyTableV1 = { version: 1, unit: 'kJ/mol', bonds: {} };
    expect(t.version).toBe(1);
    expect(t.unit).toBe('kJ/mol');
    expect(t.bonds).toEqual({});
  });
});

describe('calcBondEnergyV1', () => {
  it('H2O — 2x H-O:1 = 926 kJ/mol, quality=estimated', () => {
    const bonds: BondCount[] = [{ a: 'H', b: 'O', order: 1, count: 2 }];
    const result = calcBondEnergyV1('H2O', bonds, TABLE);

    expect(result.bond_energy_total_est_kj_mol).toBe(926);
    expect(result.bond_energy_quality).toBe('estimated');
    expect(result.bond_types).toEqual(['H-O:1']);
    expect(result.trace.lines).toHaveLength(1);
    expect(result.trace.lines[0]).toEqual({
      bond: 'H-O:1',
      count: 2,
      E: 463,
      subtotal: 926,
      source: 'CRC',
    });
  });

  it('CO2 — 2x C=O:2 = 1598 kJ/mol', () => {
    const bonds: BondCount[] = [{ a: 'C', b: 'O', order: 2, count: 2 }];
    const result = calcBondEnergyV1('CO2', bonds, TABLE);

    expect(result.bond_energy_total_est_kj_mol).toBe(1598);
    expect(result.bond_energy_quality).toBe('estimated');
    expect(result.bond_types).toEqual(['C-O:2']);
  });

  it('HNO3 — H-O:1 + 2x N-O:1 + N-O:2 = 463+402+607 = 1472', () => {
    const bonds: BondCount[] = [
      { a: 'H', b: 'O', order: 1, count: 1 },
      { a: 'N', b: 'O', order: 1, count: 2 },
      { a: 'N', b: 'O', order: 2, count: 1 },
    ];
    const result = calcBondEnergyV1('HNO3', bonds, TABLE);

    expect(result.bond_energy_total_est_kj_mol).toBe(1472);
    expect(result.bond_energy_quality).toBe('estimated');
    expect(result.bond_types).toEqual(['H-O:1', 'N-O:1', 'N-O:2']);
    expect(result.trace.lines).toHaveLength(3);
  });

  it('empty bonds — quality=missing, total=0', () => {
    const result = calcBondEnergyV1('empty', [], TABLE);

    expect(result.bond_energy_total_est_kj_mol).toBe(0);
    expect(result.bond_energy_quality).toBe('missing');
    expect(result.trace.lines).toHaveLength(0);
  });

  it('partial — some bonds not in table, quality=partial, notes non-empty', () => {
    const bonds: BondCount[] = [
      { a: 'H', b: 'O', order: 1, count: 1 },
      { a: 'X', b: 'Y', order: 1, count: 1 },  // not in table
    ];
    const result = calcBondEnergyV1('partial', bonds, TABLE);

    expect(result.bond_energy_total_est_kj_mol).toBe(463);
    expect(result.bond_energy_quality).toBe('partial');
    expect(result.trace.notes.length).toBeGreaterThan(0);
    expect(result.trace.notes[0]).toContain('missing');
  });

  it('key normalization — {a:"O", b:"H"} finds H-O:1', () => {
    const bonds: BondCount[] = [{ a: 'O', b: 'H', order: 1, count: 1 }];
    const result = calcBondEnergyV1('rev', bonds, TABLE);

    expect(result.bond_energy_total_est_kj_mol).toBe(463);
    expect(result.bond_energy_quality).toBe('estimated');
    expect(result.bond_types).toEqual(['H-O:1']);
  });

  it('trace metadata — calc_id, entity_id, table_version, unit correct', () => {
    const bonds: BondCount[] = [{ a: 'H', b: 'O', order: 1, count: 2 }];
    const result = calcBondEnergyV1('H2O', bonds, TABLE);

    expect(result.trace.calc_id).toBe('calc:bond_energy_v1');
    expect(result.trace.entity_id).toBe('H2O');
    expect(result.trace.table_version).toBe(1);
    expect(result.trace.unit).toBe('kJ/mol');
  });
});
