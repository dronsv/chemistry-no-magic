import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Generate formula_lookup.json — maps display formulas to substance/element info.
 *
 * Used by ChemText component to recognize chemical formulas in task text
 * and wrap them in interactive FormulaChip components.
 *
 * Priority: substance formulas first (longer, more specific),
 * then element symbols (shorter, lower priority).
 * At runtime, longest match wins.
 *
 * @param {Array<{Z: number, symbol: string}>} elements
 * @param {Array<{filename: string, data: {id: string, formula: string, class: string}}>} substances
 * @param {string} outDir - Bundle output directory
 * @returns {number} Total entries in lookup
 */
export async function generateFormulaLookup(elements, substances, outDir) {
  const lookup = {};

  // 1. Add substance formulas (higher priority — typically longer)
  for (const { data } of substances) {
    lookup[data.formula] = {
      type: 'substance',
      id: data.id,
      cls: data.class,
    };
  }

  // 2. Add element symbols (lower priority — 1-2 chars)
  for (const el of elements) {
    // Don't override if an element symbol happens to match a substance formula
    if (!lookup[el.symbol]) {
      lookup[el.symbol] = {
        type: 'element',
        id: el.symbol,
        Z: el.Z,
      };
    }
  }

  const path = join(outDir, 'formula_lookup.json');
  await writeFile(path, JSON.stringify(lookup));

  return Object.keys(lookup).length;
}
