/**
 * Concept graph validation for data-src/concepts.json.
 * Checks kinds, parent_id references, children_order integrity, and cycles.
 */

const VALID_KINDS = [
  'substance_class',
  'element_group',
  'reaction_type',
  'reaction_facet',
  'property',
  'process',
];

/**
 * Validate concept graph structure: kinds, parent_id refs, children_order, cycles.
 * @param {Record<string, object>} concepts — keys are concept IDs, values are ConceptEntry objects
 * @returns {string[]} errors — array of human-readable error strings
 */
export function validateConceptsGraph(concepts) {
  const errors = [];
  const ids = new Set(Object.keys(concepts));

  for (const [id, entry] of Object.entries(concepts)) {
    const prefix = `concepts["${id}"]`;

    // Validate kind
    if (!VALID_KINDS.includes(entry.kind)) {
      errors.push(`${prefix}: invalid kind "${entry.kind}"`);
    }

    // Validate order
    if (typeof entry.order !== 'number') {
      errors.push(`${prefix}: order must be a number`);
    }

    // Validate parent_id reference
    if (entry.parent_id !== null && entry.parent_id !== undefined) {
      if (!ids.has(entry.parent_id)) {
        errors.push(`${prefix}: parent_id "${entry.parent_id}" not found in concepts`);
      }
    }

    // Validate children_order
    if (entry.children_order !== undefined) {
      if (!Array.isArray(entry.children_order)) {
        errors.push(`${prefix}: children_order must be an array`);
      } else {
        for (const childId of entry.children_order) {
          if (!ids.has(childId)) {
            errors.push(`${prefix}: children_order item "${childId}" not found in concepts`);
          } else {
            const child = concepts[childId];
            if (child.parent_id !== id) {
              errors.push(
                `${prefix}: children_order item "${childId}" has parent_id "${child.parent_id}" instead of "${id}"`
              );
            }
          }
        }
      }
    }
  }

  // Detect cycles in parent chains
  for (const id of ids) {
    const visited = new Set();
    let current = id;
    while (current !== null && current !== undefined) {
      if (visited.has(current)) {
        errors.push(`concepts["${id}"]: cycle detected in parent chain`);
        break;
      }
      visited.add(current);
      const entry = concepts[current];
      if (!entry) break;
      current = entry.parent_id;
    }
  }

  return errors;
}
