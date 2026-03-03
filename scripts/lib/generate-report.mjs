/**
 * Generate data quality report for the data bundle.
 * @param {object} data
 * @param {Record<string, object>} data.concepts — concept registry
 * @param {object[]} data.theoryModules — loaded theory module objects
 * @param {object[]} data.courses — loaded course objects
 * @param {object[]} data.substances — substance data objects (just {id, class, ...})
 * @param {object[]} data.elements — element objects
 * @param {object[]} data.reactions — reaction objects
 * @param {string[]} data.structures — structure filenames (e.g. ["h2o.json", "co2.json"])
 * @param {string[]} data.validationErrors — errors from ontology validators
 * @param {string[]} data.zeroMatchConcepts — zero-match findings from ontology checks
 * @param {Record<string, object>} [data.bondEnergyResults] — bond energy calculator results
 * @returns {object} report
 */
export function generateReport(data) {
  const {
    concepts = {},
    theoryModules = [],
    courses = [],
    substances = [],
    elements = [],
    reactions = [],
    structures = [],
    validationErrors = [],
    zeroMatchConcepts = [],
    bondCountsIndex = {},
    bondEnergyResults = {},
  } = data ?? {};

  const conceptEntries = Object.values(concepts);

  // Count concepts with non-empty filters (at least one key)
  const conceptsWithFilters = conceptEntries.filter(
    (c) => c.filters && typeof c.filters === 'object' && Object.keys(c.filters).length > 0
  ).length;

  // Group-and-count by kind
  const conceptsByKind = {};
  for (const entry of conceptEntries) {
    const kind = entry.kind;
    conceptsByKind[kind] = (conceptsByKind[kind] || 0) + 1;
  }

  // Extract concept IDs from warning strings
  // Format: concepts["cls:x"]: zero matches in substances (kind: substance_class)
  const zeroMatchConceptIds = zeroMatchConcepts
    .map((warning) => {
      const match = warning.match(/\["?([^"\]]+)"?\]/);
      return match ? match[1] : null;
    })
    .filter(Boolean);

  // Count substances whose id matches a structure filename (minus .json)
  const structureIds = new Set(structures.map((f) => f.replace(/\.json$/, '')));
  const substancesWithStructure = substances.filter((s) => structureIds.has(s.id)).length;

  return {
    generated_at: new Date().toISOString(),
    concepts_total: conceptEntries.length,
    concepts_with_filters: conceptsWithFilters,
    concepts_by_kind: conceptsByKind,
    zero_match_concepts: zeroMatchConceptIds,
    theory_modules_total: theoryModules.length,
    courses_total: courses.length,
    substances_total: substances.length,
    elements_total: elements.length,
    reactions_total: reactions.length,
    structures_total: structures.length,
    substances_with_structure: substancesWithStructure,
    bond_counts_generated: Object.values(bondCountsIndex).filter(v => v.quality === 'exact').length,
    bond_counts_missing: Object.values(bondCountsIndex).filter(v => v.quality === 'missing').length,
    bond_energy_computed: Object.values(bondEnergyResults).filter(r => r.bond_energy_quality === 'estimated').length,
    bond_energy_partial: Object.values(bondEnergyResults).filter(r => r.bond_energy_quality === 'partial').length,
    bond_energy_no_input: substances.length - Object.keys(bondEnergyResults).length,
    validation_errors: validationErrors,
  };
}
