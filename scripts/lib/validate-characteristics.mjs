/**
 * Validation for on-entity characteristics.
 * Each entity may have a `characteristics` map: conceptId → entry | entry[].
 */

/**
 * Validate characteristics embedded on entities.
 * @param {any[]} entities - array of element/ion/substance objects
 * @param {string} entityType - label for error messages (e.g. 'element', 'ion', 'substance')
 * @returns {string[]} error strings
 */
export function validateEntityCharacteristics(entities, entityType) {
  const errors = [];
  for (const entity of entities) {
    if (!entity.characteristics) continue;
    for (const [conceptId, entry] of Object.entries(entity.characteristics)) {
      if (!conceptId.startsWith('concept:')) {
        errors.push(`${entityType} ${entity.id || entity.symbol}: invalid concept key "${conceptId}"`);
      }
      const entries = Array.isArray(entry) ? entry : [entry];
      for (const e of entries) {
        if (e.value == null) {
          errors.push(`${entityType} ${entity.id || entity.symbol}: missing value for ${conceptId}`);
        }
      }
    }
  }
  return errors;
}
