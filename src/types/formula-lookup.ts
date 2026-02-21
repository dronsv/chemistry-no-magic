/** A single entry in the formula lookup table. */
export interface FormulaLookupEntry {
  /** Whether this is a substance (has a detail page) or an element symbol. */
  type: 'substance' | 'element';
  /** Substance ID (e.g. "h2o") or element symbol (e.g. "Fe"). */
  id: string;
  /** Substance class for coloring (oxide, acid, base, salt, etc.). Only for substances. */
  cls?: string;
  /** Atomic number. Only for elements. */
  Z?: number;
}

/** Maps display formula string → lookup info. */
export type FormulaLookup = Record<string, FormulaLookupEntry>;
