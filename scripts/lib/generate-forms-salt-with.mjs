/**
 * Generate forms_salt_with.json relation triples from solubility pair data.
 *
 * Emits { subject: "ion:CATION", predicate: "forms_salt_with", object: "ion:ANION" }
 * for all cation-anion pairs in solubility_rules_light.json.
 * Insoluble pairs are excluded (absence = insoluble by default).
 */

/**
 * @param {object} solubilityData - Parsed solubility_rules_light.json
 * @returns {Array<{subject: string, predicate: string, object: string, solubility: string}>}
 */
export function generateFormsSaltWith(solubilityData) {
  const pairs = solubilityData.pairs ?? [];
  return pairs
    .filter(p => p.solubility !== 'insoluble')
    .map(p => ({
      subject: `ion:${p.cation}`,
      predicate: 'forms_salt_with',
      object: `ion:${p.anion}`,
      solubility: p.solubility,
    }));
}
