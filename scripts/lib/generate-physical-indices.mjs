/**
 * WP5 — Build-time reverse indices for physical foundations catalogs.
 *
 * Inputs: foundations/*.json (bridges, mechanisms, physical_concepts, math_concepts)
 * Output: foundations/indices.json
 *
 * Indices produced:
 *   concept_to_bridges   — concept_id → bridge_ids[] (from bridge.prerequisite_concepts)
 *   mechanism_to_bridges — mechanism_id → bridge_ids[] (from bridge.mechanism_ids)
 *   bridge_to_pages      — bridge_id → page_slugs[] (from bridge.page_slugs)
 *   mechanism_order      — bridge_id → mechanism_ids[] in causal order (= bridge.mechanism_ids)
 */

/**
 * @param {object[]} bridges
 * @param {object[]} mechanisms
 * @param {object[]} physicalConcepts
 * @param {object[]} mathConcepts
 * @returns {object} PhysicalIndices
 */
export function generatePhysicalIndices(bridges, mechanisms, physicalConcepts, mathConcepts) {
  /** @type {Record<string, string[]>} */
  const concept_to_bridges = {};
  /** @type {Record<string, string[]>} */
  const mechanism_to_bridges = {};
  /** @type {Record<string, string[]>} */
  const bridge_to_pages = {};
  /** @type {Record<string, string[]>} */
  const mechanism_order = {};

  for (const bridge of bridges) {
    // bridge_to_pages
    bridge_to_pages[bridge.id] = bridge.page_slugs ?? [];

    // mechanism_order (causal chain preserved)
    mechanism_order[bridge.id] = bridge.mechanism_ids ?? [];

    // mechanism_to_bridges (reverse of bridge.mechanism_ids)
    for (const mechId of bridge.mechanism_ids ?? []) {
      (mechanism_to_bridges[mechId] ??= []).push(bridge.id);
    }

    // concept_to_bridges (reverse of bridge.prerequisite_concepts)
    for (const conceptId of bridge.prerequisite_concepts ?? []) {
      (concept_to_bridges[conceptId] ??= []).push(bridge.id);
    }
  }

  return {
    concept_to_bridges,
    mechanism_to_bridges,
    bridge_to_pages,
    mechanism_order,
  };
}
