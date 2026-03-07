/**
 * Per-file structural validation for data-src files.
 * Checks required fields, types, and value ranges.
 */

const VALID_METAL_TYPES = ['metal', 'nonmetal', 'metalloid'];
const VALID_ELEMENT_GROUPS = [
  'alkali_metal', 'alkaline_earth', 'transition_metal', 'post_transition_metal',
  'metalloid', 'nonmetal', 'halogen', 'noble_gas', 'lanthanide', 'actinide',
];
const VALID_ION_TYPES = ['cation', 'anion'];
const VALID_SOLUBILITY = ['soluble', 'insoluble', 'slightly_soluble', 'decomposes'];
const VALID_COMPETENCY_IDS = [
  'periodic_table', 'electron_config', 'periodic_trends', 'oxidation_states',
  'bond_type', 'crystal_structure_type',
  'classification', 'naming', 'amphoterism_logic',
  'reactions_exchange', 'gas_precipitate_logic', 'reactions_redox',
  'genetic_chain_logic', 'qualitative_analysis_logic',
  'reaction_energy_profile', 'catalyst_role_understanding',
  'calculations_basic', 'calculations_solutions', 'reaction_yield_logic',
  'electrolyte_logic',
  'ion_nomenclature',
];
const VALID_COVERAGES = ['P', 'S', 'O'];

/**
 * @param {any[]} elements
 * @returns {string[]} errors
 */
export function validateElements(elements) {
  const errors = [];
  if (!Array.isArray(elements)) return ['elements.json must be an array'];

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const prefix = `elements[${i}]`;
    if (typeof el.Z !== 'number' || el.Z < 1 || el.Z > 118) errors.push(`${prefix}: invalid Z`);
    if (typeof el.symbol !== 'string' || !el.symbol) errors.push(`${prefix}: missing symbol`);
    if (typeof el.group !== 'number' || el.group < 1 || el.group > 18) errors.push(`${prefix}: invalid group`);
    if (typeof el.period !== 'number' || el.period < 1 || el.period > 7) errors.push(`${prefix}: invalid period`);
    if (!VALID_METAL_TYPES.includes(el.metal_type)) errors.push(`${prefix}: invalid metal_type "${el.metal_type}"`);
    if (!VALID_ELEMENT_GROUPS.includes(el.element_group)) errors.push(`${prefix}: invalid element_group "${el.element_group}"`);
    if (!Array.isArray(el.typical_oxidation_states)) errors.push(`${prefix}: typical_oxidation_states must be array`);
    if (typeof el.atomic_mass !== 'number' || el.atomic_mass <= 0) errors.push(`${prefix}: atomic_mass must be positive number`);
    if (el.electronegativity !== null && typeof el.electronegativity !== 'number') errors.push(`${prefix}: electronegativity must be number or null`);
  }

  if (elements.length !== 118) errors.push(`Expected 118 elements, got ${elements.length}`);
  return errors;
}

/**
 * @param {any[]} ions
 * @returns {string[]} errors
 */
export function validateIons(ions) {
  const errors = [];
  if (!Array.isArray(ions)) return ['ions.json must be an array'];

  for (let i = 0; i < ions.length; i++) {
    const ion = ions[i];
    const prefix = `ions[${i}]`;
    if (typeof ion.id !== 'string' || !ion.id) errors.push(`${prefix}: missing id`);
    if (typeof ion.formula !== 'string' || !ion.formula) errors.push(`${prefix}: missing formula`);
    if (typeof ion.charge !== 'number') errors.push(`${prefix}: missing charge`);
    if (!VALID_ION_TYPES.includes(ion.type)) errors.push(`${prefix}: invalid type "${ion.type}"`);
    if (!Array.isArray(ion.tags)) errors.push(`${prefix}: tags must be array`);
  }
  return errors;
}

/**
 * @param {any[]} rules
 * @returns {string[]} errors
 */
export function validateClassificationRules(rules) {
  const errors = [];
  if (!Array.isArray(rules)) return ['classification_rules.json must be an array'];

  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    const prefix = `classification_rules[${i}]`;
    if (typeof r.id !== 'string') errors.push(`${prefix}: missing id`);
    if (typeof r.class !== 'string') errors.push(`${prefix}: missing class`);
    if (!Array.isArray(r.examples)) errors.push(`${prefix}: examples must be array`);
  }
  return errors;
}

/**
 * @param {any[]} rules
 * @returns {string[]} errors
 */
export function validateNamingRules(rules) {
  const errors = [];
  if (!Array.isArray(rules)) return ['naming_rules.json must be an array'];

  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    const prefix = `naming_rules[${i}]`;
    if (typeof r.id !== 'string') errors.push(`${prefix}: missing id`);
    if (typeof r.class !== 'string') errors.push(`${prefix}: missing class`);
    if (!Array.isArray(r.examples)) errors.push(`${prefix}: examples must be array`);
  }
  return errors;
}

/**
 * @param {any[]} entries
 * @returns {string[]} errors
 */
export function validateSolubility(data) {
  const errors = [];
  const entries = Array.isArray(data) ? data : (data.pairs || []);
  if (!Array.isArray(data) && !Array.isArray(data?.pairs)) {
    return ['solubility_rules_light.json must be an array or object with pairs'];
  }

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const prefix = `solubility[${i}]`;
    if (typeof e.cation !== 'string') errors.push(`${prefix}: missing cation`);
    if (typeof e.anion !== 'string') errors.push(`${prefix}: missing anion`);
    if (!VALID_SOLUBILITY.includes(e.solubility)) errors.push(`${prefix}: invalid solubility "${e.solubility}"`);
  }
  return errors;
}

/**
 * @param {any[]} series
 * @returns {string[]} errors
 */
export function validateActivitySeries(series) {
  const errors = [];
  if (!Array.isArray(series)) return ['activity_series.json must be an array'];

  for (let i = 0; i < series.length; i++) {
    const e = series[i];
    const prefix = `activity_series[${i}]`;
    if (typeof e.symbol !== 'string') errors.push(`${prefix}: missing symbol`);
    if (typeof e.position !== 'number') errors.push(`${prefix}: missing position`);
    if (typeof e.reduces_H !== 'boolean') errors.push(`${prefix}: reduces_H must be boolean`);
  }
  return errors;
}

/**
 * @param {any[]} params
 * @returns {string[]} errors
 */
export function validateBktParams(params) {
  const errors = [];
  if (!Array.isArray(params)) return ['bkt_params.json must be an array'];

  const seen = new Set();
  for (let i = 0; i < params.length; i++) {
    const p = params[i];
    const prefix = `bkt_params[${i}]`;
    if (!VALID_COMPETENCY_IDS.includes(p.competency_id)) errors.push(`${prefix}: invalid competency_id "${p.competency_id}"`);
    if (typeof p.P_L0 !== 'number' || p.P_L0 < 0 || p.P_L0 > 1) errors.push(`${prefix}: P_L0 must be 0-1`);
    if (typeof p.P_T !== 'number' || p.P_T < 0 || p.P_T > 1) errors.push(`${prefix}: P_T must be 0-1`);
    if (typeof p.P_S !== 'number' || p.P_S < 0 || p.P_S > 1) errors.push(`${prefix}: P_S must be 0-1`);
    if (typeof p.P_G !== 'number' || p.P_G < 0 || p.P_G > 1) errors.push(`${prefix}: P_G must be 0-1`);
    if (seen.has(p.competency_id)) errors.push(`${prefix}: duplicate competency_id "${p.competency_id}"`);
    seen.add(p.competency_id);
  }

  for (const id of VALID_COMPETENCY_IDS) {
    if (!seen.has(id)) errors.push(`Missing BKT params for competency "${id}"`);
  }
  return errors;
}

/**
 * @param {any[]} templates
 * @returns {string[]} errors
 */
export function validateReactionTemplates(templates) {
  const errors = [];
  if (!Array.isArray(templates)) return ['reaction_templates.json must be an array'];

  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    const prefix = `reaction_templates[${i}]`;
    if (typeof t.id !== 'string') errors.push(`${prefix}: missing id`);
    if (typeof t.type !== 'string') errors.push(`${prefix}: missing type`);
    if (!Array.isArray(t.examples)) errors.push(`${prefix}: examples must be array`);
  }
  return errors;
}

/**
 * @param {any[]} templates
 * @returns {string[]} errors
 */
export function validateTaskTemplates(templates) {
  const errors = [];
  if (!Array.isArray(templates)) return ['task_templates.json must be an array'];

  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    const prefix = `task_templates[${i}]`;
    if (typeof t.id !== 'string') errors.push(`${prefix}: missing id`);
    if (typeof t.type_number !== 'number') errors.push(`${prefix}: missing type_number`);
    if (typeof t.competencies !== 'object' || t.competencies === null) {
      errors.push(`${prefix}: missing competencies`);
    } else {
      for (const [key, val] of Object.entries(t.competencies)) {
        if (!VALID_COMPETENCY_IDS.includes(key)) errors.push(`${prefix}: invalid competency key "${key}"`);
        if (!VALID_COVERAGES.includes(val)) errors.push(`${prefix}: invalid coverage "${val}" for "${key}"`);
      }
    }
  }
  return errors;
}

/**
 * @param {any} substance
 * @param {string} filename
 * @returns {string[]} errors
 */
export function validateSubstance(substance, filename) {
  const errors = [];
  const prefix = `substances/${filename}`;
  if (typeof substance.id !== 'string') errors.push(`${prefix}: missing id`);
  if (typeof substance.formula !== 'string') errors.push(`${prefix}: missing formula`);
  if (typeof substance.class !== 'string') errors.push(`${prefix}: missing class`);
  return errors;
}

/**
 * @param {any[]} rules
 * @returns {string[]} errors
 */
export function validateApplicabilityRules(rules) {
  const errors = [];
  if (!Array.isArray(rules)) return ['applicability_rules.json must be an array'];

  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    const prefix = `applicability_rules[${i}]`;
    if (typeof r.id !== 'string') errors.push(`${prefix}: missing id`);
  }
  errors.push(...validateApplicabilityRuleStructure(rules));
  return errors;
}

const VALID_RULE_KINDS = [
  'exchange_condition', 'activity_restriction', 'thermal_decomposition',
  'gas_evolution', 'oxidizing_acid', 'passivation', 'amphoteric_reaction', 'oxide_exception',
];

const REQUIRED_FIELDS_BY_KIND = {
  thermal_decomposition: ['reactant_class', 'conditions', 'product_classes'],
  gas_evolution: ['reactant_class', 'reagent_class', 'gas_product'],
  activity_restriction: ['subject_class', 'constraint'],
  passivation: ['metals', 'acids'],
  exchange_condition: ['required_products'],
};

export function validateApplicabilityRuleStructure(rules) {
  const errors = [];
  if (!Array.isArray(rules)) return ['applicability_rules.json must be an array'];
  for (const rule of rules) {
    if (!rule.rule_kind)
      errors.push(`applicability_rules: ${rule.id} — missing rule_kind`);
    else if (!VALID_RULE_KINDS.includes(rule.rule_kind))
      errors.push(`applicability_rules: ${rule.id} — unknown rule_kind '${rule.rule_kind}'`);
    const required = REQUIRED_FIELDS_BY_KIND[rule.rule_kind] ?? [];
    for (const f of required)
      if (!rule[f]) errors.push(`applicability_rules: ${rule.id} — missing '${f}' for kind '${rule.rule_kind}'`);
  }
  return errors;
}

/**
 * Validate a translation overlay against base data.
 * Checks that overlay keys exist in base, and translated fields are present.
 * @param {Record<string, any>} overlay - overlay keyed by item ID
 * @param {string[]} baseIds - valid IDs from base data
 * @param {string} locale - locale code
 * @param {string} dataKey - data category (e.g. 'elements', 'competencies')
 * @returns {string[]} errors
 */
export function validateTranslationOverlay(overlay, baseIds, locale, dataKey) {
  const errors = [];
  const prefix = `translations/${locale}/${dataKey}`;

  if (typeof overlay !== 'object' || overlay === null || Array.isArray(overlay)) {
    return [`${prefix}: must be an object keyed by ID`];
  }

  const baseIdSet = new Set(baseIds);
  for (const key of Object.keys(overlay)) {
    if (!baseIdSet.has(key)) {
      errors.push(`${prefix}: orphan key "${key}" not found in base data`);
    }
    const entry = overlay[key];
    if (typeof entry !== 'object' || entry === null) {
      errors.push(`${prefix}["${key}"]: value must be an object`);
    }
  }

  return errors;
}

/**
 * Validate an exam system registry.
 * @param {any[]} systems
 * @returns {string[]} errors
 */
/**
 * @param {any[]} vocab
 * @returns {string[]} errors
 */
export function validateProcessVocab(vocab, effectsVocab) {
  const errors = [];
  if (!Array.isArray(vocab)) return ['process_vocab.json must be an array'];

  const VALID_KINDS = ['chemical', 'physical', 'driving_force', 'operation', 'constraint'];
  const seen = new Set();
  const effectIds = effectsVocab ? new Set(effectsVocab.map(e => e.id)) : null;

  for (let i = 0; i < vocab.length; i++) {
    const v = vocab[i];
    const prefix = `process_vocab[${i}]`;
    if (typeof v.id !== 'string' || !v.id) errors.push(`${prefix}: missing id`);
    if (!VALID_KINDS.includes(v.kind)) errors.push(`${prefix}: invalid kind "${v.kind}"`);
    if (v.params !== undefined && !Array.isArray(v.params)) errors.push(`${prefix}: params must be array`);
    if (v.params && !v.params.every(p => typeof p === 'string')) errors.push(`${prefix}: params entries must be strings`);
    if (seen.has(v.id)) errors.push(`${prefix}: duplicate id "${v.id}"`);
    seen.add(v.id);

    // Validate effects references
    if (v.effects !== undefined) {
      if (!Array.isArray(v.effects)) {
        errors.push(`${prefix}: effects must be array`);
      } else if (effectIds) {
        for (const eff of v.effects) {
          const effId = typeof eff === 'string' ? eff : eff?.id;
          if (effId && !effectIds.has(effId)) {
            errors.push(`${prefix}: effects ref "${effId}" not found in effects_vocab`);
          }
        }
      }
    }

    // Validate parent reference
    if (v.parent !== undefined && typeof v.parent !== 'string') {
      errors.push(`${prefix}: parent must be a string`);
    }
  }

  // Cross-validate parent references exist in process_vocab
  for (let i = 0; i < vocab.length; i++) {
    const v = vocab[i];
    if (v.parent && !seen.has(v.parent)) {
      errors.push(`process_vocab[${i}]: parent "${v.parent}" not found in process_vocab`);
    }
  }

  return errors;
}

/**
 * @param {any[]} vocab
 * @returns {string[]} errors
 */
export function validateEffectsVocab(vocab) {
  const errors = [];
  if (!Array.isArray(vocab)) return ['effects_vocab.json must be an array'];

  const VALID_CATEGORIES = ['kinetic', 'thermodynamic', 'mass_transfer', 'phase'];
  const seen = new Set();

  for (let i = 0; i < vocab.length; i++) {
    const v = vocab[i];
    const prefix = `effects_vocab[${i}]`;
    if (typeof v.id !== 'string' || !v.id) errors.push(`${prefix}: missing id`);
    if (!VALID_CATEGORIES.includes(v.category)) errors.push(`${prefix}: invalid category "${v.category}"`);
    if (seen.has(v.id)) errors.push(`${prefix}: duplicate id "${v.id}"`);
    seen.add(v.id);
  }
  return errors;
}

/**
 * @param {any} ont
 * @returns {string[]} errors
 */
export function validateQuantitiesUnits(ont) {
  const errors = [];
  if (typeof ont !== 'object' || ont === null || Array.isArray(ont)) {
    return ['quantities_units_ontology.json must be an object'];
  }

  if (!ont.meta || typeof ont.meta !== 'object') errors.push('missing meta');
  if (!Array.isArray(ont.quantities)) return [...errors, 'quantities must be an array'];
  if (!Array.isArray(ont.units)) return [...errors, 'units must be an array'];

  const quantityIds = new Set();
  for (let i = 0; i < ont.quantities.length; i++) {
    const q = ont.quantities[i];
    const prefix = `quantities[${i}]`;
    if (typeof q.id !== 'string' || !q.id.startsWith('q:')) errors.push(`${prefix}: id must start with "q:"`);
    if (typeof q.dimension !== 'string') errors.push(`${prefix}: missing dimension`);
    if (!Array.isArray(q.recommended_units)) errors.push(`${prefix}: recommended_units must be array`);
    quantityIds.add(q.id);
  }

  const unitIds = new Set();
  for (let i = 0; i < ont.units.length; i++) {
    const u = ont.units[i];
    const prefix = `units[${i}]`;
    if (typeof u.id !== 'string' || !u.id.startsWith('unit:')) errors.push(`${prefix}: id must start with "unit:"`);
    if (typeof u.quantity !== 'string') errors.push(`${prefix}: missing quantity`);
    if (!quantityIds.has(u.quantity)) errors.push(`${prefix}: quantity "${u.quantity}" not found in quantities`);
    if (u.to_SI !== null && typeof u.to_SI !== 'object') errors.push(`${prefix}: to_SI must be object or null`);
    unitIds.add(u.id);
  }

  // Cross-reference: recommended_units must reference existing unit IDs
  for (let i = 0; i < ont.quantities.length; i++) {
    const q = ont.quantities[i];
    if (!Array.isArray(q.recommended_units)) continue;
    for (const uid of q.recommended_units) {
      if (!unitIds.has(uid)) errors.push(`quantities[${i}]: recommended_unit "${uid}" not found in units`);
    }
  }

  return errors;
}

/**
 * @param {any[]} entries
 * @returns {string[]} errors
 */
export function validateProperties(entries) {
  const errors = [];
  if (!Array.isArray(entries)) return ['properties.json must be an array'];
  const ids = new Set();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const p = `properties[${i}]`;
    if (!e.id) errors.push(`${p}: missing id`);
    if (ids.has(e.id)) errors.push(`${p}: duplicate id "${e.id}"`);
    ids.add(e.id);
    if (!e.value_field) errors.push(`${p}: missing value_field`);
    if (!e.i18n?.ru) errors.push(`${p}: missing i18n.ru`);
  }
  return errors;
}

/**
 * @param {any} data
 * @returns {string[]} errors
 */
export function validateBondExamples(data) {
  const errors = [];
  if (!data.examples || !Array.isArray(data.examples)) return ['bond_examples.json must have "examples" array'];
  for (let i = 0; i < data.examples.length; i++) {
    const e = data.examples[i];
    const p = `bond_examples[${i}]`;
    if (!e.formula) errors.push(`${p}: missing formula`);
    if (!e.bond_type) errors.push(`${p}: missing bond_type`);
    if (!e.crystal_type) errors.push(`${p}: missing crystal_type`);
  }
  return errors;
}

/**
 * @param {any[]} entries
 * @returns {string[]} errors
 */
export function validateOxidationExamples(entries) {
  const errors = [];
  if (!Array.isArray(entries)) return ['oxidation_examples.json must be an array'];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const p = `oxidation_examples[${i}]`;
    if (!e.formula) errors.push(`${p}: missing formula`);
    if (!e.target_element) errors.push(`${p}: missing target_element`);
    if (typeof e.oxidation_state !== 'number') errors.push(`${p}: missing/invalid oxidation_state`);
  }
  return errors;
}

/**
 * @param {any[]} templates  — engine task templates
 * @returns {string[]} errors
 */
export function validateEngineTaskTemplates(templates) {
  const errors = [];
  if (!Array.isArray(templates)) return ['engine/task_templates.json must be an array'];

  const ids = new Set();
  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    const p = `engine_task_templates[${i}]`;
    if (!t.template_id) errors.push(`${p}: missing template_id`);
    if (ids.has(t.template_id)) errors.push(`${p}: duplicate template_id "${t.template_id}"`);
    ids.add(t.template_id);
    if (!t.meta || typeof t.meta !== 'object') errors.push(`${p}: missing meta`);
    if (!t.pipeline || typeof t.pipeline !== 'object') errors.push(`${p}: missing pipeline`);
    if (!t.prompt_template_id) errors.push(`${p}: missing prompt_template_id`);
  }
  return errors;
}

export function validateExamSystems(systems) {
  const errors = [];
  if (!Array.isArray(systems)) return ['exam/systems.json must be an array'];

  const REQUIRED_FIELDS = ['id', 'country', 'grade', 'duration_min', 'max_score', 'task_count'];

  for (let i = 0; i < systems.length; i++) {
    const sys = systems[i];
    const prefix = `exam_systems[${i}]`;
    for (const field of REQUIRED_FIELDS) {
      if (sys[field] === undefined || sys[field] === null) {
        errors.push(`${prefix}: missing ${field}`);
      }
    }
    if (typeof sys.duration_min !== 'number' || sys.duration_min <= 0) {
      errors.push(`${prefix}: duration_min must be positive number`);
    }
    if (!Array.isArray(sys.sections)) {
      errors.push(`${prefix}: sections must be array`);
    }
  }
  return errors;
}

/**
 * Validate a relations file (acid_base_relations.json, ion_roles.json, etc.)
 * @param {any[]} relations
 * @param {string} filename
 * @returns {string[]} errors
 */
export function validateRelations(relations, filename) {
  const errors = [];
  if (!Array.isArray(relations)) return [`${filename} must be an array`];
  for (let i = 0; i < relations.length; i++) {
    const r = relations[i];
    const p = `${filename}[${i}]`;
    if (!r.subject)   errors.push(`${p}: missing subject`);
    if (!r.predicate) errors.push(`${p}: missing predicate`);
    if (!r.object)    errors.push(`${p}: missing object`);
    if (r.step !== undefined && typeof r.step !== 'number') errors.push(`${p}: step must be a number`);
    const extra = Object.keys(r).filter(k => !['subject','predicate','object','step'].includes(k));
    if (extra.length) errors.push(`${p}: unexpected fields: ${extra.join(', ')}`);
  }
  return errors;
}
