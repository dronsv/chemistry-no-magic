/**
 * Derives bond counts from a MoleculeStructure object.
 *
 * @param {object} structure - { id, atoms: [{id, symbol, ...}], bonds: [{from, to, order, ...}] }
 * @returns {{ substance_id: string, bonds: Array<{a: string, b: string, order: number, count: number}>, quality: 'exact' }}
 */
export function deriveBondCounts(structure) {
  const atomMap = new Map();
  for (const atom of structure.atoms) {
    atomMap.set(atom.id, atom.symbol);
  }

  const counts = new Map();
  for (const bond of structure.bonds) {
    const symFrom = atomMap.get(bond.from);
    const symTo = atomMap.get(bond.to);
    if (!symFrom || !symTo) continue;

    const [a, b] = symFrom <= symTo ? [symFrom, symTo] : [symTo, symFrom];
    const key = `${a}-${b}:${bond.order}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const bonds = [...counts.entries()]
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, count]) => {
      const [pair, order] = key.split(':');
      const [a, b] = pair.split('-');
      return { a, b, order: Number(order), count };
    });

  return { substance_id: structure.id, bonds, quality: 'exact' };
}
