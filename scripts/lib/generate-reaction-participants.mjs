/**
 * Generate reaction_participants.json — derives n-ary participation records
 * from existing reactions data at build time.
 *
 * Each record links a reaction, an entity (substance formula), and a role
 * with optional stoichiometry.
 *
 * Derivation sources:
 * - molecular.reactants → role: "reactant"
 * - molecular.products  → role: "product"
 * - redox.oxidizer      → role: "oxidizing_agent"
 * - redox.reducer        → role: "reducing_agent"
 * - conditions.catalyst  → role: "catalyst"
 * - observations.precipitate (non-empty) → role: "precipitate" for matching products
 * - observations.gas (non-empty) → role: "gas_evolved" for matching products
 *
 * @param {Array} reactions - Loaded reactions array from reactions.json
 * @returns {Array<{reaction: string, entity: string, role: string, stoichiometry?: number}>}
 */
export function generateReactionParticipants(reactions) {
  const participants = [];

  for (const rx of reactions) {
    const rid = rx.reaction_id;

    // Reactants
    for (const r of rx.molecular.reactants) {
      participants.push({
        reaction: rid,
        entity: r.formula,
        role: 'reactant',
        stoichiometry: r.coeff,
      });
    }

    // Products
    for (const p of rx.molecular.products) {
      participants.push({
        reaction: rid,
        entity: p.formula,
        role: 'product',
        stoichiometry: p.coeff,
      });
    }

    // Oxidizing / reducing agents (from redox info)
    if (rx.redox) {
      participants.push({
        reaction: rid,
        entity: rx.redox.oxidizer.formula,
        role: 'oxidizing_agent',
      });
      participants.push({
        reaction: rid,
        entity: rx.redox.reducer.formula,
        role: 'reducing_agent',
      });
    }

    // Catalyst (from conditions)
    if (rx.conditions?.catalyst) {
      participants.push({
        reaction: rid,
        entity: rx.conditions.catalyst,
        role: 'catalyst',
      });
    }

    // Precipitate — match products whose formula appears in observations.precipitate text
    const precipitateTexts = rx.observations?.precipitate ?? [];
    if (precipitateTexts.length > 0) {
      const joined = normalizeFormula(precipitateTexts.join(' '));
      for (const p of rx.molecular.products) {
        if (joined.includes(normalizeFormula(p.formula))) {
          participants.push({
            reaction: rid,
            entity: p.formula,
            role: 'precipitate',
          });
        }
      }
    }

    // Gas evolved — match products whose formula appears in observations.gas text
    const gasTexts = rx.observations?.gas ?? [];
    if (gasTexts.length > 0) {
      const joined = normalizeFormula(gasTexts.join(' '));
      for (const p of rx.molecular.products) {
        if (joined.includes(normalizeFormula(p.formula))) {
          participants.push({
            reaction: rid,
            entity: p.formula,
            role: 'gas_evolved',
          });
        }
      }
    }
  }

  return participants;
}

/**
 * Normalize a formula string for matching: replace Unicode sub/superscripts
 * with ASCII equivalents so "Fe(OH)₃" matches "Fe(OH)3".
 */
function normalizeFormula(s) {
  return s
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, ch =>
      String(ch.codePointAt(0) - 0x2080)
    )
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => {
      const map = { '\u2070': '0', '\u00B9': '1', '\u00B2': '2', '\u00B3': '3',
                     '\u2074': '4', '\u2075': '5', '\u2076': '6', '\u2077': '7',
                     '\u2078': '8', '\u2079': '9' };
      return map[ch] ?? ch;
    });
}
