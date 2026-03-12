/**
 * Generate detected_by triples from qualitative reactions data.
 *
 * Maps free-text target_id values to canonical ion:/sub: IDs.
 */

const TARGET_ID_MAP = {
  'Cl-': 'ion:Cl_minus',
  'SO4^2-': 'ion:SO4_2minus',
  'CO3^2-': 'ion:CO3_2minus',
  'PO4^3-': 'ion:PO4_3minus',
  'NH4+': 'ion:NH4_plus',
  'Cu^2+': 'ion:Cu_2plus',
  'Fe^3+': 'ion:Fe_3plus',
  'Fe^2+': 'ion:Fe_2plus',
  'CO2': 'sub:co2',
  'NH3': 'sub:nh3',
  'H2S': 'sub:h2s',
};

/**
 * @param {Array} qualitativeReactions - Parsed qualitative_reactions.json
 * @param {Array<{id: string, formula?: string}>} substances
 * @returns {Array<import('../../src/types/relation').Relation>}
 */
export function generateDetectedBy(qualitativeReactions, substances) {
  const formulaToId = new Map();
  for (const s of substances) {
    if (s.formula) formulaToId.set(s.formula.toLowerCase(), `sub:${s.id}`);
  }

  return qualitativeReactions
    .map(entry => {
      const subjectId = TARGET_ID_MAP[entry.target_id];
      if (!subjectId) {
        console.warn(`generate-detected-by: no mapping for target_id "${entry.target_id}"`);
        return null;
      }
      if (!entry.reagent_formula) {
        console.warn(`generate-detected-by: missing reagent_formula for target_id "${entry.target_id}"`);
        return null;
      }
      const reagentNorm = entry.reagent_formula.toLowerCase();
      const reagentId = formulaToId.get(reagentNorm) ?? `mol:${entry.reagent_formula}`;
      return {
        subject: subjectId,
        predicate: 'detected_by',
        object: reagentId,
        source_kind: 'derived',
      };
    })
    .filter(Boolean);
}
