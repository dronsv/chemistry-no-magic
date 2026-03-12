import type { SolubilityRule } from '../../types/rules';

/** Strip the 'ion:' namespace prefix so IDs match rule data format. */
function bare(id: string): string {
  return id.startsWith('ion:') ? id.slice(4) : id;
}

/**
 * Check if a cell (cation + anion) matches a solubility rule.
 * Returns 'match' if the cell is covered by the rule's main prediction,
 * 'exception' if it falls into an exception clause, or 'none'.
 *
 * Note: rule data uses bare IDs (e.g. 'Na_plus') while the table passes
 * namespaced IDs ('ion:Na_plus'). The bare() helper normalizes this.
 */
export function cellMatchesRule(
  cation: string,
  anion: string,
  rule: SolubilityRule,
): 'match' | 'exception' | 'none' {
  const cat = bare(cation);
  const an = bare(anion);

  const cationMatch = rule.cations === null || rule.cations.includes(cat);
  const anionMatch = rule.anions === null || rule.anions.includes(an);

  if (!cationMatch || !anionMatch) return 'none';

  // Check if this cell is an exception
  for (const exc of rule.exceptions) {
    if (exc.cations.includes(cat)) {
      return 'exception';
    }
  }

  return 'match';
}
