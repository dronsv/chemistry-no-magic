/**
 * Validate that the bond energy table covers all bond types
 * present in exact structures.
 * @param {object} bondEnergyTable - { version, unit, bonds: Record<string, {avg,...}> }
 * @param {object} bondCountsIndex - Record<string, { substance_id, bonds: [{a,b,order,count}], quality }>
 * @returns {string[]} errors
 */
export function validateBondEnergyTableCoverage(bondEnergyTable, bondCountsIndex) {
  const errors = [];
  const missingBonds = new Set();

  for (const [id, bc] of Object.entries(bondCountsIndex)) {
    if (bc.quality !== 'exact') continue;
    for (const bond of bc.bonds) {
      const [a, b] = bond.a <= bond.b ? [bond.a, bond.b] : [bond.b, bond.a];
      const key = `${a}-${b}:${bond.order}`;
      if (!bondEnergyTable.bonds[key]) {
        missingBonds.add(key);
      }
    }
  }

  for (const key of [...missingBonds].sort()) {
    errors.push(`bond_energy_table: missing entry for "${key}" (used by exact structures)`);
  }

  return errors;
}
