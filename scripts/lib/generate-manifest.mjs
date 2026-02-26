import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Generate manifest.json files (both in bundle dir and latest/).
 * @param {object} opts
 * @param {string} opts.bundleHash
 * @param {string} opts.bundleDir
 * @param {string} opts.latestDir
 * @param {object} opts.stats
 * @param {object} opts.indexKeys - {classes, ions, competencies}
 * @param {Record<string, string[]>} [opts.translations] - { en: ['elements', 'competencies', ...], pl: [...], es: [...] }
 * @param {string[]} [opts.examSystemIds] - IDs of available exam systems
 */
export async function generateManifest({ bundleHash, bundleDir, latestDir, stats, indexKeys, translations, examSystemIds }) {
  const manifest = {
    bundle_hash: bundleHash,
    created_at: new Date().toISOString(),
    schema_version: '1.1.0',
    entrypoints: {
      elements: 'elements.json',
      ions: 'ions.json',
      rules: {
        classification_rules: 'rules/classification_rules.json',
        naming_rules: 'rules/naming_rules.json',
        solubility_rules_light: 'rules/solubility_rules_light.json',
        activity_series: 'rules/activity_series.json',
        applicability_rules: 'rules/applicability_rules.json',
        bkt_params: 'rules/bkt_params.json',
        competencies: 'rules/competencies.json',
        periodic_table_theory: 'rules/periodic-table-theory.json',
        bond_theory: 'rules/bond_theory.json',
        bond_examples: 'rules/bond_examples.json',
        oxidation_theory: 'rules/oxidation_theory.json',
        qualitative_reactions: 'rules/qualitative_reactions.json',
        genetic_chains: 'rules/genetic_chains.json',
        energy_catalyst_theory: 'rules/energy_catalyst_theory.json',
        calculations_data: 'rules/calculations_data.json',
        topic_mapping: 'rules/topic_mapping.json',
        ion_nomenclature: 'rules/ion_nomenclature.json',
        oxidation_examples: 'rules/oxidation_examples.json',
        properties: 'rules/properties.json',
        solubility_rules_full: 'rules/solubility_rules_full.json',
      },
      templates: {
        reaction_templates: 'templates/reaction_templates.json',
        task_templates: 'templates/task_templates.json',
      },
      engine: {
        task_templates: 'engine/task_templates.json',
        prompt_templates_ru: 'engine/prompt_templates.ru.json',
        prompt_templates_en: 'engine/prompt_templates.en.json',
        prompt_templates_pl: 'engine/prompt_templates.pl.json',
        prompt_templates_es: 'engine/prompt_templates.es.json',
      },
      contexts: {
        contexts: 'contexts/contexts.json',
        substance_variants: 'contexts/substance_variants.json',
        terms: 'contexts/terms.json',
        term_bindings: 'contexts/term_bindings.json',
        reverse_index: 'contexts/reverse_index.json',
      },
      substances: 'substances',
      diagnostic: 'diagnostic/questions.json',
      element_groups: 'element-groups.json',
      periodic_table_content: 'periodic-table-content.json',
      reactions: 'reactions/reactions.json',
      structures: 'structures',
      exercises: {
        periodic_table: 'exercises/periodic-table-exercises.json',
        bonds: 'exercises/bonds-exercises.json',
        oxidation: 'exercises/oxidation-exercises.json',
      },
      oge_tasks: 'exam/oge_tasks.json',
      oge_solution_algorithms: 'exam/oge_solution_algorithms.json',
      exam_systems: 'exam/systems.json',
      search_index: 'search_index.json',
      formula_lookup: 'formula_lookup.json',
      process_vocab: 'process_vocab.json',
      quantities_units: 'quantities_units.json',
      indices: {
        substances_index: 'indices/substances_index.json',
      },
    },
    translations: translations || {},
    stats,
  };

  // Add dynamic index entries
  for (const cls of indexKeys.classes) {
    manifest.entrypoints.indices[`by_class_${cls}`] = `indices/by_class/${cls}.json`;
  }
  for (const ion of indexKeys.ions) {
    manifest.entrypoints.indices[`by_ion_${ion}`] = `indices/by_ion/${ion}.json`;
  }
  for (const comp of indexKeys.competencies) {
    manifest.entrypoints.indices[`by_competency_${comp}`] = `indices/by_competency/${comp}.json`;
  }

  const manifestJson = JSON.stringify(manifest, null, 2);
  await writeFile(join(bundleDir, 'manifest.json'), manifestJson);
  await writeFile(join(latestDir, 'manifest.json'), manifestJson);

  return manifest;
}
