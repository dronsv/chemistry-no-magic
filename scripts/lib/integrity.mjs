/**
 * Cross-file referential integrity checks.
 * Verifies that ion refs, substance refs, and competency IDs are consistent.
 */

/**
 * @param {object} data - All loaded data files
 * @param {any[]} data.elements
 * @param {any[]} data.ions
 * @param {any[]} data.substances - Array of {filename, data} objects
 * @param {any[]} data.bktParams
 * @param {any[]} data.taskTemplates
 * @returns {string[]} errors
 */
export function checkIntegrity(data) {
  const errors = [];

  // Collect known ion IDs
  const ionIds = new Set(data.ions.map(i => i.id));

  // Check substance ion references
  for (const { filename, data: sub } of data.substances) {
    if (sub.ions && Array.isArray(sub.ions)) {
      for (const ionRef of sub.ions) {
        if (!ionIds.has(ionRef)) {
          errors.push(`substances/${filename}: references unknown ion "${ionRef}"`);
        }
      }
    }
  }

  // Check BKT params cover all competencies from task templates
  const bktCompetencies = new Set(data.bktParams.map(p => p.competency_id));
  const taskCompetencies = new Set();
  for (const t of data.taskTemplates) {
    if (t.competencies) {
      for (const key of Object.keys(t.competencies)) {
        taskCompetencies.add(key);
      }
    }
  }

  for (const c of taskCompetencies) {
    if (!bktCompetencies.has(c)) {
      errors.push(`Task templates reference competency "${c}" but no BKT params defined for it`);
    }
  }

  // Check element Z values are sequential 1-118
  const zValues = data.elements.map(e => e.Z).sort((a, b) => a - b);
  for (let i = 0; i < zValues.length; i++) {
    if (zValues[i] !== i + 1) {
      errors.push(`Elements: missing or duplicate Z=${i + 1}`);
      break;
    }
  }

  return errors;
}
