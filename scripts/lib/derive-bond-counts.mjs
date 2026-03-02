/**
 * Derives bond counts from a MoleculeStructure object.
 * Always returns quality: 'exact' — the 'missing' quality is set by the
 * build pipeline for substances that have no structure file at all.
 *
 * @param {object} structure - { id, atoms: [{id, symbol, ...}], bonds: [{from, to, order, ...}] }
 * @returns {{ substance_id: string, bonds: Array<{a: string, b: string, order: number, count: number}>, quality: 'exact' }}
 */
export function deriveBondCounts(structure) {
  const atoms = Array.isArray(structure.atoms) ? structure.atoms : [];
  const rawBonds = Array.isArray(structure.bonds) ? structure.bonds : [];

  const atomMap = new Map();
  for (const atom of atoms) {
    atomMap.set(atom.id, atom.symbol);
  }

  /** @type {Map<string, {a: string, b: string, order: number, count: number}>} */
  const counts = new Map();
  for (const bond of rawBonds) {
    const order = typeof bond.order === 'number' ? bond.order : 1;
    const symFrom = atomMap.get(bond.from);
    const symTo = atomMap.get(bond.to);
    if (!symFrom || !symTo) continue;

    const [a, b] = symFrom <= symTo ? [symFrom, symTo] : [symTo, symFrom];
    const key = `${a}\0${b}\0${order}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { a, b, order, count: 1 });
    }
  }

  const bonds = [...counts.values()]
    .sort((x, y) => x.a.localeCompare(y.a) || x.b.localeCompare(y.b) || x.order - y.order);

  return { substance_id: structure.id, bonds, quality: 'exact' };
}
