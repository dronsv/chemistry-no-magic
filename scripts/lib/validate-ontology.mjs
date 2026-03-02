/**
 * Ontology validation: concept graph, theory module refs, course refs.
 * Checks kinds, parent_id references, children_order integrity, cycles,
 * theory module cross-references, and course module references.
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
  if (typeof concepts !== 'object' || concepts === null || Array.isArray(concepts)) {
    return ['concepts.json must be an object keyed by concept ID'];
  }

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
        const seen = new Set();
        for (const childId of entry.children_order) {
          if (seen.has(childId)) {
            errors.push(`${prefix}: duplicate in children_order "${childId}"`);
          }
          seen.add(childId);
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
  const inCycle = new Set();
  for (const id of ids) {
    if (inCycle.has(id)) continue;
    const visited = new Set();
    let current = id;
    while (current !== null && current !== undefined) {
      if (visited.has(current)) {
        errors.push(`concepts["${id}"]: cycle detected in parent chain`);
        for (const v of visited) inCycle.add(v);
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

/**
 * Recursively extract ref IDs from a RichText segment array.
 * RichText segments can be: { t: 'text', v: '...' }, { t: 'ref', id: '...' },
 * or wrappers like { t: 'em', children: [...] } / { t: 'strong', children: [...] }.
 * @param {unknown[]} richText
 * @returns {string[]} ref IDs found
 */
function extractRichTextRefs(richText) {
  if (!Array.isArray(richText)) return [];
  const refs = [];
  for (const seg of richText) {
    if (seg.t === 'ref' && seg.id) refs.push(seg.id);
    if (seg.children) refs.push(...extractRichTextRefs(seg.children));
  }
  return refs;
}

/**
 * Validate theory module cross-references: applies_to, conceptId, RichText refs.
 * @param {object[]} modules - Array of TheoryModule objects
 * @param {Record<string, object>} concepts - The concept registry
 * @returns {string[]} errors
 */
export function validateTheoryModuleRefs(modules, concepts) {
  const errors = [];

  for (const mod of modules) {
    const prefix = `module["${mod.id}"]`;

    // Validate applies_to references
    if (Array.isArray(mod.applies_to)) {
      for (const ref of mod.applies_to) {
        if (!concepts[ref]) {
          errors.push(`${prefix}: applies_to ref "${ref}" not found in concepts`);
        }
      }
    }

    // Walk sections → blocks
    if (!Array.isArray(mod.sections)) continue;
    for (const section of mod.sections) {
      if (!Array.isArray(section.blocks)) continue;
      for (const block of section.blocks) {
        const blockPrefix = `${prefix}.section["${section.id}"]`;

        // concept_card: validate conceptId
        if (block.t === 'concept_card' && block.conceptId) {
          if (!concepts[block.conceptId]) {
            errors.push(`${blockPrefix}: conceptId "${block.conceptId}" not found in concepts`);
          }
        }

        // concept_card: validate reactivity_rules RichText refs
        if (block.reactivity_rules) {
          for (const refId of extractRichTextRefs(block.reactivity_rules)) {
            if (!concepts[refId]) {
              errors.push(`${blockPrefix}: ref "${refId}" not found in concepts`);
            }
          }
        }

        // text_block: validate content RichText refs
        if (block.t === 'text_block' && block.content) {
          for (const refId of extractRichTextRefs(block.content)) {
            if (!concepts[refId]) {
              errors.push(`${blockPrefix}: ref "${refId}" not found in concepts`);
            }
          }
        }
      }
    }
  }

  return errors;
}

/**
 * Validate course references: module IDs exist.
 * @param {object[]} courses - Array of Course objects
 * @param {object[]} modules - Array of TheoryModule objects
 * @returns {string[]} errors
 */
export function validateCourseRefs(courses, modules) {
  const errors = [];
  const moduleIds = new Set(modules.map(m => m.id));

  for (const course of courses) {
    const prefix = `course["${course.id}"]`;

    if (Array.isArray(course.modules)) {
      for (const modRef of course.modules) {
        if (!moduleIds.has(modRef)) {
          errors.push(`${prefix}: module "${modRef}" not found in theory modules`);
        }
      }
    }
  }

  return errors;
}
