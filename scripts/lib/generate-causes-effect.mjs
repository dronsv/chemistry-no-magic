/**
 * Generate causes_effect triples from process vocab data.
 *
 * Extracts effects[] from process vocab entries into relation triples.
 * Guarded effects (with `when` field) use the `condition` attribute.
 */

/**
 * @param {Array<{id: string, effects?: Array<string | {id: string, when: string}>}>} processVocab
 * @returns {Array<import('../../src/types/relation').Relation>}
 */
export function generateCausesEffect(processVocab) {
  const triples = [];

  for (const entry of processVocab) {
    if (!Array.isArray(entry.effects)) continue;

    for (const eff of entry.effects) {
      if (typeof eff === 'string') {
        triples.push({
          subject: `proc:${entry.id}`,
          predicate: 'causes_effect',
          object: `eff:${eff}`,
          source_kind: 'derived',
        });
      } else if (eff && typeof eff === 'object' && eff.id) {
        triples.push({
          subject: `proc:${entry.id}`,
          predicate: 'causes_effect',
          object: `eff:${eff.id}`,
          condition: `when:${eff.when}`,
          source_kind: 'derived',
        });
      }
    }
  }

  return triples;
}
