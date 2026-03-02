/** A single bond type with count. */
export interface BondCount {
  /** Element symbol A (alphabetically first). */
  a: string;
  /** Element symbol B (alphabetically second or equal to a). */
  b: string;
  /** Bond order: 1 (single), 2 (double), 3 (triple). */
  order: number;
  /** Number of bonds of this type in the molecule. */
  count: number;
}

/** Bond counts derived from a molecule structure. */
export interface SubstanceBondCounts {
  substance_id: string;
  bonds: BondCount[];
  quality: 'exact' | 'missing';
}

/** Map of substance_id → bond counts. Build output format. */
export type BondCountsIndex = Record<string, SubstanceBondCounts>;
