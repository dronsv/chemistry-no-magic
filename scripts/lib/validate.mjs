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
  'periodic_table', 'electron_config', 'oxidation_states', 'classification',
  'naming', 'reactions_exchange', 'gas_precipitate_logic', 'reactions_redox',
  'reaction_energy_profile', 'catalyst_role_understanding', 'calculations_basic',
  'calculations_solutions',
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
    if (typeof el.name_ru !== 'string' || !el.name_ru) errors.push(`${prefix}: missing name_ru`);
    if (typeof el.group !== 'number' || el.group < 1 || el.group > 18) errors.push(`${prefix}: invalid group`);
    if (typeof el.period !== 'number' || el.period < 1 || el.period > 7) errors.push(`${prefix}: invalid period`);
    if (!VALID_METAL_TYPES.includes(el.metal_type)) errors.push(`${prefix}: invalid metal_type "${el.metal_type}"`);
    if (!VALID_ELEMENT_GROUPS.includes(el.element_group)) errors.push(`${prefix}: invalid element_group "${el.element_group}"`);
    if (!Array.isArray(el.typical_oxidation_states)) errors.push(`${prefix}: typical_oxidation_states must be array`);
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
    if (typeof ion.name_ru !== 'string' || !ion.name_ru) errors.push(`${prefix}: missing name_ru`);
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
    if (typeof r.description_ru !== 'string') errors.push(`${prefix}: missing description_ru`);
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
    if (typeof r.template_ru !== 'string') errors.push(`${prefix}: missing template_ru`);
    if (!Array.isArray(r.examples)) errors.push(`${prefix}: examples must be array`);
  }
  return errors;
}

/**
 * @param {any[]} entries
 * @returns {string[]} errors
 */
export function validateSolubility(entries) {
  const errors = [];
  if (!Array.isArray(entries)) return ['solubility_rules_light.json must be an array'];

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
    if (typeof e.name_ru !== 'string') errors.push(`${prefix}: missing name_ru`);
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
    if (typeof t.description_ru !== 'string') errors.push(`${prefix}: missing description_ru`);
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
    if (typeof t.name_ru !== 'string') errors.push(`${prefix}: missing name_ru`);
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
    if (typeof r.description_ru !== 'string') errors.push(`${prefix}: missing description_ru`);
  }
  return errors;
}
