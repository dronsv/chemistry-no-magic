/**
 * Ontology validation: concept graph, theory module refs, course refs,
 * filter structure, zero-match detection, and zero-match override policy.
 * Checks kinds, parent_id references, children_order integrity, cycles,
 * theory module cross-references, course module references,
 * filter DSL structure, and concept-to-entity match coverage.
 */

const VALID_KINDS = [
  'substance_class',
  'element_group',
  'reaction_type',
  'reaction_facet',
  'property',
  'process',
  'domain_concept',
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
    const conceptIds = new Set(Object.keys(concepts));
    for (const section of mod.sections) {
      if (!Array.isArray(section.blocks)) continue;
      if (section.title_ref && !conceptIds.has(section.title_ref)) {
        errors.push(`${prefix}.section["${section.id}"]: title_ref "${section.title_ref}" not found in concepts`);
      }
      for (const block of section.blocks) {
        const blockPrefix = `${prefix}.section["${section.id}"]`;

        // concept_card: validate conceptId
        if (block.t === 'concept_card' && block.conceptId) {
          if (!concepts[block.conceptId]) {
            errors.push(`${blockPrefix}: conceptId "${block.conceptId}" not found in concepts`);
          }
        }

        // concept_card: validate reactivity_rules RichText refs
        if (block.t === 'concept_card' && block.reactivity_rules) {
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

// ── Private filter evaluator (JS port of src/lib/filter-evaluator.ts) ──────

const VALID_FILTER_KEYS = new Set(['all', 'any', 'not', 'pred', 'concept']);
const VALID_PRED_KEYS = new Set(['field', 'eq', 'in', 'has', 'gt', 'lt']);

function evalPred(pred, entity) {
  const val = entity[pred.field];
  if (pred.eq !== undefined) return val === pred.eq;
  if (pred.in !== undefined) {
    if (Array.isArray(val)) return val.some(v => pred.in.includes(v));
    return pred.in.includes(val);
  }
  if (pred.has !== undefined) return Array.isArray(val) && val.includes(pred.has);
  if (pred.gt !== undefined) return typeof val === 'number' && val > pred.gt;
  if (pred.lt !== undefined) return typeof val === 'number' && val < pred.lt;
  return false;
}

function evalFilter(filter, entity, resolve, depth) {
  if (depth > 10) return false;
  if ('all' in filter) return filter.all.every(f => evalFilter(f, entity, resolve, depth + 1));
  if ('any' in filter) return filter.any.some(f => evalFilter(f, entity, resolve, depth + 1));
  if ('not' in filter) return !evalFilter(filter.not, entity, resolve, depth + 1);
  if ('pred' in filter) return evalPred(filter.pred, entity);
  if ('concept' in filter) {
    const cf = resolve(filter.concept);
    return cf ? evalFilter(cf, entity, resolve, depth + 1) : false;
  }
  return false;
}

// ── Filter structure validation ────────────────────────────────────────────

/**
 * Recursively validate a single filter node.
 * @param {object} node - A filter expression node
 * @param {string} path - Human-readable path for error messages
 * @param {Set<string>} conceptIds - Set of known concept IDs
 * @param {string[]} errors - Accumulator for error messages
 */
function validateFilterNode(node, path, conceptIds, errors) {
  if (typeof node !== 'object' || node === null) {
    errors.push(`${path}: filter node must be an object`);
    return;
  }

  const keys = Object.keys(node);

  // Empty object {} is valid — means no constraints
  if (keys.length === 0) return;

  // Must have exactly one recognized key
  const filterKeys = keys.filter(k => VALID_FILTER_KEYS.has(k));
  if (filterKeys.length === 0) {
    errors.push(`${path}: invalid filter — unrecognized keys: ${keys.join(', ')}`);
    return;
  }
  if (filterKeys.length > 1) {
    errors.push(`${path}: invalid filter — multiple filter keys: ${filterKeys.join(', ')}`);
    return;
  }

  const key = filterKeys[0];

  if (key === 'all' || key === 'any') {
    if (!Array.isArray(node[key])) {
      errors.push(`${path}: "${key}" must be an array`);
      return;
    }
    node[key].forEach((child, i) => {
      validateFilterNode(child, `${path}.${key}[${i}]`, conceptIds, errors);
    });
  } else if (key === 'not') {
    validateFilterNode(node.not, `${path}.not`, conceptIds, errors);
  } else if (key === 'pred') {
    const pred = node.pred;
    if (typeof pred !== 'object' || pred === null) {
      errors.push(`${path}: pred must be an object`);
      return;
    }
    if (typeof pred.field !== 'string' || pred.field === '') {
      errors.push(`${path}: pred "field" must be a non-empty string`);
    }
    for (const predKey of Object.keys(pred)) {
      if (!VALID_PRED_KEYS.has(predKey)) {
        errors.push(`${path}: pred has unknown key "${predKey}"`);
      }
    }
  } else if (key === 'concept') {
    if (!conceptIds.has(node.concept)) {
      errors.push(`${path}: concept ref "${node.concept}" not found in concepts`);
    }
  }
}

/**
 * Validate filter DSL nodes structurally and check concept references.
 * @param {Record<string, object>} concepts — keys are concept IDs
 * @returns {string[]} errors
 */
export function validateFilterStructure(concepts) {
  const errors = [];
  const conceptIds = new Set(Object.keys(concepts));

  for (const [id, entry] of Object.entries(concepts)) {
    if (!entry.filters || typeof entry.filters !== 'object') continue;
    const keys = Object.keys(entry.filters);
    if (keys.length === 0) continue; // empty {} is valid

    validateFilterNode(entry.filters, `concepts["${id}"].filters`, conceptIds, errors);
  }

  return errors;
}

// ── Zero-match concept detection ───────────────────────────────────────────

/** Kind → entity array key mapping */
const KIND_ENTITY_MAP = {
  substance_class: 'substances',
  element_group: 'elements',
  reaction_type: 'reactions',
};

/**
 * Check concepts with filters against actual entity data.
 * Returns warnings for concepts whose filters match zero entities.
 * @param {Record<string, object>} concepts
 * @param {{ substances?: object[], elements?: object[], reactions?: object[] }} entities
 * @returns {string[]} warnings
 */
export function checkZeroMatchConcepts(concepts, entities) {
  const warnings = [];

  const resolve = (conceptId) => {
    const c = concepts[conceptId];
    return c && c.filters && Object.keys(c.filters).length > 0 ? c.filters : undefined;
  };

  for (const [id, entry] of Object.entries(concepts)) {
    // Skip kinds without entity mapping
    const entityKey = KIND_ENTITY_MAP[entry.kind];
    if (!entityKey) continue;
    // Explicit opt-out for planned concepts without data coverage yet.
    if (entry.allow_zero_match === true) continue;

    // Skip empty filters
    if (!entry.filters || typeof entry.filters !== 'object') continue;
    if (Object.keys(entry.filters).length === 0) continue;

    const pool = entities[entityKey];
    if (!pool || pool.length === 0) continue;

    const matches = pool.filter(e => evalFilter(entry.filters, e, resolve, 0));
    if (matches.length === 0) {
      warnings.push(`concepts["${id}"]: zero matches in ${entityKey} (kind: ${entry.kind})`);
    }
  }

  return warnings;
}

/**
 * Validate per-concept zero-match overrides.
 * `allow_zero_match: true` is allowed only for mapped kinds with non-empty filters.
 * @param {Record<string, object>} concepts
 * @returns {string[]} errors
 */
export function validateZeroMatchOverrides(concepts) {
  const errors = [];

  for (const [id, entry] of Object.entries(concepts)) {
    const prefix = `concepts["${id}"]`;
    if (!('allow_zero_match' in entry)) continue;

    if (typeof entry.allow_zero_match !== 'boolean') {
      errors.push(`${prefix}: allow_zero_match must be boolean`);
      continue;
    }
    if (entry.allow_zero_match !== true) continue;

    if (!KIND_ENTITY_MAP[entry.kind]) {
      errors.push(`${prefix}: allow_zero_match is only valid for kinds mapped to entity pools`);
    }

    if (!entry.filters || typeof entry.filters !== 'object' || Object.keys(entry.filters).length === 0) {
      errors.push(`${prefix}: allow_zero_match requires non-empty filters`);
    }
  }

  return errors;
}

// ── Didactic ref validation ─────────────────────────────────────────────

/**
 * Walk all RichText segments in a didactic module and verify ref IDs exist.
 * @param {Record<string, Array<{data: object, key: string}>>} didacticEntries - { locale: [{data, key}] }
 * @param {Record<string, object>} concepts - The concept registry
 * @param {{ ionIds: Set<string>, substanceIds: Set<string>, elementSymbols: Set<string> }} entityIds
 * @returns {string[]} errors
 */
export function validateDidacticRefs(didacticEntries, concepts, entityIds) {
  const errors = [];
  const conceptIds = new Set(Object.keys(concepts));

  for (const [locale, entries] of Object.entries(didacticEntries)) {
    for (const { data, key } of entries) {
      const prefix = `didactic/${locale}/${key}`;

      if (!data.sections || typeof data.sections !== 'object') continue;

      for (const [sectionId, section] of Object.entries(data.sections)) {
        // Validate section title RichText refs
        if (section.title) {
          for (const refId of extractRichTextRefs(section.title)) {
            validateRefId(refId, `${prefix}.sections["${sectionId}"].title`, conceptIds, entityIds, errors);
          }
        }

        if (!section.blocks || typeof section.blocks !== 'object') continue;

        for (const [blockId, block] of Object.entries(section.blocks)) {
          const blockPrefix = `${prefix}.sections["${sectionId}"].blocks["${blockId}"]`;

          // Check all RichText fields in the block overlay
          for (const field of ['title', 'rule', 'description', 'text', 'content', 'label']) {
            if (block[field]) {
              for (const refId of extractRichTextRefs(block[field])) {
                validateRefId(refId, `${blockPrefix}.${field}`, conceptIds, entityIds, errors);
              }
            }
          }

          // Check items (array of RichText)
          if (Array.isArray(block.items)) {
            for (const item of block.items) {
              for (const refId of extractRichTextRefs(item)) {
                validateRefId(refId, `${blockPrefix}.items`, conceptIds, entityIds, errors);
              }
            }
          }

          // Check columns (array of RichText)
          if (Array.isArray(block.columns)) {
            for (const col of block.columns) {
              for (const refId of extractRichTextRefs(col)) {
                validateRefId(refId, `${blockPrefix}.columns`, conceptIds, entityIds, errors);
              }
            }
          }

          // Check rows (array of array of RichText)
          if (Array.isArray(block.rows)) {
            for (const row of block.rows) {
              if (!Array.isArray(row)) continue;
              for (const cell of row) {
                for (const refId of extractRichTextRefs(cell)) {
                  validateRefId(refId, `${blockPrefix}.rows`, conceptIds, entityIds, errors);
                }
              }
            }
          }
        }
      }
    }
  }

  return errors;
}

/**
 * Validate a ref ID against known entity registries.
 * Ref ID format: "concept:X", "substance:X", "ion:X", "element:X", or unprefixed concept ID.
 */
function validateRefId(refId, path, conceptIds, entityIds, errors) {
  if (refId.startsWith('concept:') || refId.startsWith('prop:') || refId.startsWith('process:')) {
    // These are concept refs — check against concept registry
    if (!conceptIds.has(refId)) {
      errors.push(`${path}: ref "${refId}" not found in concepts`);
    }
  } else if (refId.startsWith('substance:') || refId.startsWith('sub:')) {
    const id = refId.replace(/^(substance|sub):/, '');
    if (!entityIds.substanceIds.has(id)) {
      errors.push(`${path}: ref "${refId}" — substance not found`);
    }
  } else if (refId.startsWith('ion:')) {
    const id = refId.slice(4);
    if (!entityIds.ionIds.has(id)) {
      errors.push(`${path}: ref "${refId}" — ion not found`);
    }
  } else if (refId.startsWith('element:')) {
    const symbol = refId.slice(8);
    if (!entityIds.elementSymbols.has(symbol)) {
      errors.push(`${path}: ref "${refId}" — element not found`);
    }
  } else if (refId.startsWith('q:') || refId.startsWith('unit:')) {
    // quantity/unit refs — skip validation for now (validated elsewhere)
  } else {
    // Unprefixed — check as concept
    if (!conceptIds.has(refId)) {
      errors.push(`${path}: ref "${refId}" not found in concepts`);
    }
  }
}

// ── Semantic didactic ref validation ─────────────────────────────────────

const REF_TOKEN_PATTERN = /\{ref:([^|}]+)(?:\|[^}]+)?\}/g;

/**
 * Validate all concept/entity refs in semantic didactic modules.
 * @param {Array<{data: object, key: string}>} semanticEntries
 * @param {Record<string, object>} concepts
 * @returns {string[]} errors
 */
export function validateSemanticRefs(semanticEntries, concepts) {
  const errors = [];
  const conceptIds = new Set(Object.keys(concepts));

  for (const { data, key } of semanticEntries) {
    const prefix = `semantic/${key}`;
    if (!Array.isArray(data.sections)) continue;

    for (const section of data.sections) {
      if (!Array.isArray(section.blocks)) continue;

      for (const block of section.blocks) {
        const bp = `${prefix}.sections["${section.id}"].blocks["${block.id}"]`;

        if (block.kind === 'bond_rule_card') {
          for (const ref of [block.concept_ref, block.mechanism_ref, block.lattice_ref]) {
            if (ref && !conceptIds.has(ref)) {
              errors.push(`${bp}: ref "${ref}" not found in concepts`);
            }
          }
          if (Array.isArray(block.result_refs)) {
            for (const ref of block.result_refs) {
              if (!conceptIds.has(ref)) errors.push(`${bp}: result_ref "${ref}" not found in concepts`);
            }
          }
          if (block.criterion) {
            if (block.criterion.property_ref && !conceptIds.has(block.criterion.property_ref)) {
              errors.push(`${bp}: criterion.property_ref "${block.criterion.property_ref}" not found`);
            }
            if (Array.isArray(block.criterion.participant_refs)) {
              for (const ref of block.criterion.participant_refs) {
                if (!conceptIds.has(ref)) errors.push(`${bp}: participant_ref "${ref}" not found`);
              }
            }
          }
        } else if (block.kind === 'comparison_table') {
          if (Array.isArray(block.row_refs)) {
            for (const ref of block.row_refs) {
              if (!conceptIds.has(ref)) errors.push(`${bp}: row_ref "${ref}" not found`);
            }
          }
          // Validate column refs (q:* refs validated elsewhere, concept:* here)
          if (Array.isArray(block.columns)) {
            for (const col of block.columns) {
              if (col.ref && col.ref.startsWith('concept:') && !conceptIds.has(col.ref)) {
                errors.push(`${bp}: column ref "${col.ref}" not found`);
              }
            }
          }
        }
      }
    }
  }

  return errors;
}

/**
 * Validate {ref:id|form} tokens inside didactic template question strings.
 * @param {Record<string, {data: object}>} templateEntries - { locale: {data} }
 * @param {Record<string, object>} concepts
 * @param {{ ionIds: Set<string>, substanceIds: Set<string>, elementSymbols: Set<string> }} entityIds
 * @returns {string[]} errors
 */
export function validateTemplateRefs(templateEntries, concepts, entityIds) {
  const errors = [];
  const conceptIds = new Set(Object.keys(concepts));

  for (const [locale, { data }] of Object.entries(templateEntries)) {
    for (const [templateKey, template] of Object.entries(data)) {
      if (templateKey === '_comment') continue;
      const question = template.question || template;
      if (typeof question !== 'string') continue;

      // Extract {ref:id|form} tokens — skip tokens containing {slot} placeholders
      REF_TOKEN_PATTERN.lastIndex = 0;
      let match;
      while ((match = REF_TOKEN_PATTERN.exec(question)) !== null) {
        const refId = match[1];
        // Skip template slots like {ref:{concept}|nom} — they contain curly braces
        if (refId.includes('{')) continue;

        const path = `templates/${locale}["${templateKey}"]`;
        validateRefId(refId, path, conceptIds, entityIds, errors);
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
