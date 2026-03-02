/** Build-time bond energy calculator (mirrors src/lib/calc-bond-energy.ts). */

function normKey(a, b, order) {
  const [x, y] = a <= b ? [a, b] : [b, a];
  return `${x}-${y}:${order}`;
}

/**
 * @param {string} entityId
 * @param {Array<{a: string, b: string, order: number, count: number}>} bondCounts
 * @param {{version: number, unit: string, bonds: Record<string, {avg: number, source?: string}>}} table
 */
export function calcBondEnergyV1(entityId, bondCounts, table) {
  const lines = [];
  const bondTypes = [];
  let total = 0;
  let missingCount = 0;

  for (const bc of bondCounts) {
    const key = normKey(bc.a, bc.b, bc.order);
    const rec = table.bonds[key];
    if (!rec) { missingCount++; continue; }
    const subtotal = rec.avg * bc.count;
    total += subtotal;
    bondTypes.push(key);
    lines.push({ bond: key, count: bc.count, E: rec.avg, subtotal, source: rec.source ?? 'table' });
  }

  const quality = bondCounts.length === 0 ? 'missing' : missingCount > 0 ? 'partial' : 'estimated';
  const notes = [];
  if (quality === 'partial') notes.push(`${missingCount} bond type(s) missing from table; result is incomplete.`);
  if (quality === 'estimated') notes.push('Average bond energies; educational estimate.');

  return {
    bond_energy_total_est_kj_mol: total,
    bond_types: bondTypes,
    bond_energy_quality: quality,
    trace: {
      calc_id: 'calc:bond_energy_v1',
      entity_id: entityId,
      table_version: table.version,
      unit: 'kJ/mol',
      total,
      quality,
      lines,
      notes,
    },
  };
}
