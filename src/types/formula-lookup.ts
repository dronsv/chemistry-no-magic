/** A single entry in the formula lookup table. */
export interface FormulaLookupEntry {
  /** Whether this is a substance, element symbol, or ion. */
  type: 'substance' | 'element' | 'ion';
  /** Substance ID (e.g. "h2o"), element symbol (e.g. "Fe"), or ion ID (e.g. "SO4_2minus"). */
  id: string;
  /** Substance class for coloring (oxide, acid, base, salt, etc.). Only for substances. */
  cls?: string;
  /** Atomic number. Only for elements. */
  Z?: number;
  /** Ion charge type. Only for ions. */
  ionType?: 'cation' | 'anion';
}

/** Maps display formula string → lookup info. */
export type FormulaLookup = Record<string, FormulaLookupEntry>;
