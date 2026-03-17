/**
 * Validation for data-src/characteristics/ files.
 * Each file is an array of TypedCharacteristic objects.
 */

const VALID_VALUE_KINDS = ['number', 'boolean', 'string', 'ordinal'];

/**
 * Validate a merged array of TypedCharacteristic records.
 * @param {any[]} records - merged array from all characteristics files
 * @param {string} [label] - label for error messages
 * @returns {string[]} error strings
 */
export function validateCharacteristics(records, label = 'characteristics') {
  const errors = [];
  if (!Array.isArray(records)) {
    return [`${label}: must be an array`];
  }

  const seenIds = new Set();
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const prefix = `${label}[${i}]`;

    if (!rec || typeof rec !== 'object') {
      errors.push(`${prefix}: must be an object`);
      continue;
    }

    // Required fields
    if (typeof rec.id !== 'string' || !rec.id) {
      errors.push(`${prefix}: missing or invalid id`);
    } else {
      if (seenIds.has(rec.id)) {
        errors.push(`${prefix}: duplicate id "${rec.id}"`);
      }
      seenIds.add(rec.id);
    }

    if (typeof rec.characteristic_concept_id !== 'string' || !rec.characteristic_concept_id) {
      errors.push(`${prefix} (${rec.id ?? '?'}): missing characteristic_concept_id`);
    } else if (!rec.characteristic_concept_id.startsWith('concept:')) {
      errors.push(`${prefix} (${rec.id ?? '?'}): characteristic_concept_id must start with "concept:", got "${rec.characteristic_concept_id}"`);
    }

    if (typeof rec.subject_id !== 'string' || !rec.subject_id) {
      errors.push(`${prefix} (${rec.id ?? '?'}): missing subject_id`);
    }

    if (rec.value === undefined || rec.value === null) {
      errors.push(`${prefix} (${rec.id ?? '?'}): missing value`);
    }

    // value_kind vs typeof value consistency
    if (rec.value_kind !== undefined) {
      if (!VALID_VALUE_KINDS.includes(rec.value_kind)) {
        errors.push(`${prefix} (${rec.id ?? '?'}): unknown value_kind "${rec.value_kind}"`);
      } else if (rec.value !== undefined && rec.value !== null) {
        const actualKind = typeof rec.value;
        if (rec.value_kind === 'number' && actualKind !== 'number') {
          errors.push(`${prefix} (${rec.id ?? '?'}): value_kind is "number" but value is ${actualKind}`);
        } else if (rec.value_kind === 'boolean' && actualKind !== 'boolean') {
          errors.push(`${prefix} (${rec.id ?? '?'}): value_kind is "boolean" but value is ${actualKind}`);
        } else if (rec.value_kind === 'string' && actualKind !== 'string') {
          errors.push(`${prefix} (${rec.id ?? '?'}): value_kind is "string" but value is ${actualKind}`);
        } else if (rec.value_kind === 'ordinal' && actualKind !== 'string') {
          errors.push(`${prefix} (${rec.id ?? '?'}): value_kind is "ordinal" but value is ${actualKind}`);
        }
      }
    }
  }

  return errors;
}
