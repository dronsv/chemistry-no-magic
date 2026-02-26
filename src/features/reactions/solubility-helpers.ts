import type { SolubilityRule } from '../../types/rules';

/**
 * Check if a cell (cation + anion) matches a solubility rule.
 * Returns 'match' if the cell is covered by the rule's main prediction,
 * 'exception' if it falls into an exception clause, or 'none'.
 */
export function cellMatchesRule(
  cation: string,
  anion: string,
  rule: SolubilityRule,
): 'match' | 'exception' | 'none' {
  const cationMatch = rule.cations === null || rule.cations.includes(cation);
  const anionMatch = rule.anions === null || rule.anions.includes(anion);

  if (!cationMatch || !anionMatch) return 'none';

  // Check if this cell is an exception
  for (const exc of rule.exceptions) {
    if (exc.cations.includes(cation)) {
      return 'exception';
    }
  }

  return 'match';
}
