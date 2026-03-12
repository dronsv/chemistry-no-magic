/**
 * Generate participates_in-family triples from reactions data.
 *
 * Uses role-specific predicates: reactant_in, product_of, catalyst_in,
 * oxidizing_agent_in, reducing_agent_in.
 *
 * Subjects use sub:{id} when resolvable via formula lookup; rx:{reaction_id} for objects.
 */

const ROLE_PREDICATE = {
  reactant: 'reactant_in',
  product: 'product_of',
  catalyst: 'catalyst_in',
  oxidizing_agent: 'oxidizing_agent_in',
  reducing_agent: 'reducing_agent_in',
};

/**
 * @param {Array} reactions - Parsed reactions.json entries
 * @param {Array<{id: string, formula?: string, formula_display?: string}>} substances
 * @returns {Array<{subject: string, predicate: string, object: string, source_kind: string}>}
 */
export function generateParticipatesIn(reactions, substances) {
  // Build formula → sub:id lookup (case-insensitive)
  const formulaToId = new Map();
  for (const s of substances) {
    if (s.formula) formulaToId.set(s.formula.toLowerCase(), `sub:${s.id}`);
    if (s.formula_display) formulaToId.set(s.formula_display.toLowerCase(), `sub:${s.id}`);
  }

  const triples = [];
  const seen = new Set();

  function push(formula, predicate, rxId) {
    const subjectId = formulaToId.get(formula.toLowerCase()) ?? `mol:${formula}`;
    const key = `${subjectId}|${predicate}|${rxId}`;
    if (seen.has(key)) return;
    seen.add(key);
    triples.push({ subject: subjectId, predicate, object: `rx:${rxId}`, source_kind: 'derived' });
  }

  for (const rx of reactions) {
    const rxId = rx.reaction_id;
    for (const r of rx.molecular?.reactants ?? []) push(r.formula, ROLE_PREDICATE.reactant, rxId);
    for (const p of rx.molecular?.products ?? []) push(p.formula, ROLE_PREDICATE.product, rxId);
    if (rx.conditions?.catalyst) push(rx.conditions.catalyst, ROLE_PREDICATE.catalyst, rxId);
    if (rx.redox?.oxidizer) push(rx.redox.oxidizer.formula, ROLE_PREDICATE.oxidizing_agent, rxId);
    if (rx.redox?.reducer) push(rx.redox.reducer.formula, ROLE_PREDICATE.reducing_agent, rxId);
  }

  return triples;
}
