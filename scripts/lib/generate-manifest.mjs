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
 */
export async function generateManifest({ bundleHash, bundleDir, latestDir, stats, indexKeys }) {
  const manifest = {
    bundle_hash: bundleHash,
    created_at: new Date().toISOString(),
    schema_version: '1.0.0',
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
      },
      templates: {
        reaction_templates: 'templates/reaction_templates.json',
        task_templates: 'templates/task_templates.json',
      },
      substances: 'substances',
      indices: {
        substances_index: 'indices/substances_index.json',
      },
    },
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
