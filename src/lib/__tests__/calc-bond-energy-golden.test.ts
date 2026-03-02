import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { calcBondEnergyV1 } from '../calc-bond-energy';
import type { BondEnergyTableV1 } from '../../types/calculator';
import type { BondCountsIndex } from '../../types/bond-counts';

const ROOT = join(__dirname, '..', '..', '..');
const table: BondEnergyTableV1 = JSON.parse(
  readFileSync(join(ROOT, 'data-src/tables/bond_energy_avg_v1.json'), 'utf-8')
);

// Resolve bundle hash from manifest, then load bond counts from built data
const manifest = JSON.parse(
  readFileSync(join(ROOT, 'public/data/latest/manifest.json'), 'utf-8')
);
const bondCounts: BondCountsIndex = JSON.parse(
  readFileSync(
    join(ROOT, 'public/data', manifest.bundle_hash, 'derived/structure_bond_counts.json'),
    'utf-8'
  )
);

describe('golden traces (real data)', () => {
  it('H2O: 2×H-O:1 = 926 kJ/mol', () => {
    const bc = bondCounts['h2o'];
    expect(bc.quality).toBe('exact');
    const result = calcBondEnergyV1('h2o', bc.bonds, table);
    expect(result.bond_energy_total_est_kj_mol).toBe(926);
    expect(result.bond_types).toEqual(['H-O:1']);
    expect(result.bond_energy_quality).toBe('estimated');
  });

  it('CO2: 2×C=O = 1598 kJ/mol', () => {
    const bc = bondCounts['co2'];
    const result = calcBondEnergyV1('co2', bc.bonds, table);
    expect(result.bond_energy_total_est_kj_mol).toBe(1598);
    expect(result.bond_energy_quality).toBe('estimated');
  });

  it('NH3: 3×H-N:1 = 1173 kJ/mol', () => {
    const bc = bondCounts['nh3'];
    const result = calcBondEnergyV1('nh3', bc.bonds, table);
    expect(result.bond_energy_total_est_kj_mol).toBe(1173);
  });

  it('CH4: 4×C-H:1 = 1652 kJ/mol', () => {
    const bc = bondCounts['ch4'];
    const result = calcBondEnergyV1('ch4', bc.bonds, table);
    expect(result.bond_energy_total_est_kj_mol).toBe(1652);
  });

  it('HCl: 1×Cl-H:1 = 431 kJ/mol', () => {
    const bc = bondCounts['hcl'];
    const result = calcBondEnergyV1('hcl', bc.bonds, table);
    expect(result.bond_energy_total_est_kj_mol).toBe(431);
  });

  it('all exact structures with bonds produce estimated quality (no partial)', () => {
    let partialCount = 0;
    for (const [id, bc] of Object.entries(bondCounts)) {
      if (bc.quality !== 'exact' || bc.bonds.length === 0) continue;
      const result = calcBondEnergyV1(id, bc.bonds, table);
      if (result.bond_energy_quality === 'partial') {
        partialCount++;
        console.log(`  PARTIAL: ${id} — missing bonds in table`);
      }
    }
    expect(partialCount).toBe(0);
  });

  it('trace lines sum matches total', () => {
    for (const [id, bc] of Object.entries(bondCounts)) {
      if (bc.quality !== 'exact' || bc.bonds.length === 0) continue;
      const result = calcBondEnergyV1(id, bc.bonds, table);
      const lineSum = result.trace.lines.reduce((s, l) => s + l.subtotal, 0);
      expect(lineSum, `${id}: trace line sum should match total`).toBe(
        result.bond_energy_total_est_kj_mol
      );
    }
  });
});
