import type { MoleculeStructure } from '../types/molecule';
import { determineBondType, type BondType, type ElementLike } from './bond-calculator';

/** Per-bond info for visualization. */
export interface BondInfoEntry {
  /** Bond's from atom id (matches MoleculeBond.from) */
  from: string;
  /** Bond's to atom id (matches MoleculeBond.to) */
  to: string;
  /** Bond type classification */
  bondType: BondType;
  /** ΔEN (electronegativity difference), null if data unavailable */
  deltaChi: number | null;
}

/**
 * Compute bond info (type + ΔEN) for each bond in a molecule structure.
 *
 * @param structure - Molecule structure with atoms and bonds
 * @param elementsMap - Map of element symbol → ElementLike (needs symbol, electronegativity, metal_type)
 * @returns Array of BondInfoEntry, one per bond in the structure
 */
export function computeBondInfo(
  structure: MoleculeStructure,
  elementsMap: Map<string, ElementLike>,
): BondInfoEntry[] {
  // Build atom id → symbol map
  const atomSymbol = new Map<string, string>();
  for (const atom of structure.atoms) {
    atomSymbol.set(atom.id, atom.symbol);
  }

  return structure.bonds.map((bond) => {
    const symFrom = atomSymbol.get(bond.from);
    const symTo = atomSymbol.get(bond.to);

    if (!symFrom || !symTo) {
      return { from: bond.from, to: bond.to, bondType: 'covalent_nonpolar' as BondType, deltaChi: null };
    }

    const elFrom = elementsMap.get(symFrom);
    const elTo = elementsMap.get(symTo);

    if (!elFrom || !elTo) {
      return { from: bond.from, to: bond.to, bondType: 'covalent_nonpolar' as BondType, deltaChi: null };
    }

    const bondType = determineBondType(elFrom, elTo);
    const deltaChi =
      elFrom.electronegativity !== null && elTo.electronegativity !== null
        ? Math.round(Math.abs(elFrom.electronegativity - elTo.electronegativity) * 100) / 100
        : null;

    return { from: bond.from, to: bond.to, bondType, deltaChi };
  });
}
