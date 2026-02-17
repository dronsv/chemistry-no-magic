#!/usr/bin/env node
/**
 * Data build pipeline for "Chemistry Without Magic".
 * Validates data-src/, computes content hash, copies to public/data/{hash}/.
 *
 * Usage:
 *   node scripts/build-data.mjs               # Full build
 *   node scripts/build-data.mjs --validate-only  # Validate without copying
 */

import { readdir, readFile, mkdir, writeFile, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { computeBundleHash } from './lib/hash.mjs';
import {
  validateElements,
  validateIons,
  validateClassificationRules,
  validateNamingRules,
  validateSolubility,
  validateActivitySeries,
  validateBktParams,
  validateReactionTemplates,
  validateTaskTemplates,
  validateSubstance,
  validateApplicabilityRules,
} from './lib/validate.mjs';
import { checkIntegrity } from './lib/integrity.mjs';
import { generateIndices } from './lib/generate-indices.mjs';
import { generateManifest } from './lib/generate-manifest.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const DATA_SRC = join(ROOT, 'data-src');
const PUBLIC_DATA = join(ROOT, 'public', 'data');

const validateOnly = process.argv.includes('--validate-only');

async function loadJson(path) {
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw);
}

async function loadSubstances() {
  const dir = join(DATA_SRC, 'substances');
  let files;
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }
  const substances = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const data = await loadJson(join(dir, f));
    substances.push({ filename: f, data });
  }
  return substances;
}

async function main() {
  console.log('=== Chemistry Data Build Pipeline ===\n');

  // 1. Load all data
  console.log('Loading data-src files...');
  const elements = await loadJson(join(DATA_SRC, 'elements.json'));
  const ions = await loadJson(join(DATA_SRC, 'ions.json'));
  const classificationRules = await loadJson(join(DATA_SRC, 'rules', 'classification_rules.json'));
  const namingRules = await loadJson(join(DATA_SRC, 'rules', 'naming_rules.json'));
  const solubility = await loadJson(join(DATA_SRC, 'rules', 'solubility_rules_light.json'));
  const activitySeries = await loadJson(join(DATA_SRC, 'rules', 'activity_series.json'));
  const applicabilityRules = await loadJson(join(DATA_SRC, 'rules', 'applicability_rules.json'));
  const bktParams = await loadJson(join(DATA_SRC, 'rules', 'bkt_params.json'));
  const reactionTemplates = await loadJson(join(DATA_SRC, 'templates', 'reaction_templates.json'));
  const taskTemplates = await loadJson(join(DATA_SRC, 'templates', 'task_templates.json'));
  const substances = await loadSubstances();
  const diagnosticQuestions = await loadJson(join(DATA_SRC, 'diagnostic', 'questions.json'));
  const periodicTableContent = await loadJson(join(DATA_SRC, 'periodic-table-content.json'));
  const periodicTableExercises = await loadJson(join(DATA_SRC, 'exercises', 'periodic-table-exercises.json'));
  const competencies = await loadJson(join(DATA_SRC, 'rules', 'competencies.json'));
  const periodicTableTheory = await loadJson(join(DATA_SRC, 'rules', 'periodic-table-theory.json'));
  const reactions = await loadJson(join(DATA_SRC, 'reactions', 'reactions.json'));
  const bondTheory = await loadJson(join(DATA_SRC, 'rules', 'bond_theory.json'));
  const bondsExercises = await loadJson(join(DATA_SRC, 'exercises', 'bonds-exercises.json'));
  const oxidationTheory = await loadJson(join(DATA_SRC, 'rules', 'oxidation_theory.json'));
  const oxidationExercises = await loadJson(join(DATA_SRC, 'exercises', 'oxidation-exercises.json'));
  const elementGroups = await loadJson(join(DATA_SRC, 'element-groups.json'));

  // Load molecule structures (optional — directory may not exist yet)
  const structuresDir = join(DATA_SRC, 'structures');
  let structureFiles = [];
  try {
    const sFiles = await readdir(structuresDir);
    structureFiles = sFiles.filter(f => f.endsWith('.json'));
  } catch { /* no structures yet */ }

  console.log(`  ${elements.length} elements, ${ions.length} ions, ${substances.length} substances`);
  if (structureFiles.length > 0) console.log(`  ${structureFiles.length} molecule structures`);
  console.log(`  ${Object.keys(elementGroups).length} element groups`);
  console.log(`  ${reactions.length} reactions`);
  console.log(`  ${competencies.length} competencies, ${diagnosticQuestions.length} diagnostic questions`);
  console.log(`  ${periodicTableExercises.exercise_types.length} periodic table exercise templates`);
  console.log(`  ${reactionTemplates.length} reaction templates, ${taskTemplates.length} task templates`);
  console.log(`  ${bondTheory.bond_types.length} bond types, ${bondTheory.crystal_structures.length} crystal structures, ${bondsExercises.length} bond exercises`);
  console.log(`  ${oxidationTheory.rules.length} oxidation rules, ${oxidationExercises.length} oxidation exercises\n`);

  // 2. Validate
  console.log('Validating...');
  const allErrors = [
    ...validateElements(elements),
    ...validateIons(ions),
    ...validateClassificationRules(classificationRules),
    ...validateNamingRules(namingRules),
    ...validateSolubility(solubility),
    ...validateActivitySeries(activitySeries),
    ...validateApplicabilityRules(applicabilityRules),
    ...validateBktParams(bktParams),
    ...validateReactionTemplates(reactionTemplates),
    ...validateTaskTemplates(taskTemplates),
  ];

  for (const { filename, data } of substances) {
    allErrors.push(...validateSubstance(data, filename));
  }

  // 3. Cross-file integrity
  console.log('Checking referential integrity...');
  allErrors.push(...checkIntegrity({
    elements,
    ions,
    substances,
    bktParams,
    taskTemplates,
  }));

  if (allErrors.length > 0) {
    console.error('\nValidation errors:');
    for (const err of allErrors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }
  console.log('  All checks passed.\n');

  if (validateOnly) {
    console.log('Validation-only mode. Done.');
    return;
  }

  // 4. Compute hash
  console.log('Computing bundle hash...');
  const bundleHash = await computeBundleHash(DATA_SRC);
  console.log(`  Hash: ${bundleHash}\n`);

  // 5. Prepare output dirs
  const bundleDir = join(PUBLIC_DATA, bundleHash);
  const latestDir = join(PUBLIC_DATA, 'latest');

  // Clean previous builds
  await rm(PUBLIC_DATA, { recursive: true, force: true });
  await mkdir(bundleDir, { recursive: true });
  await mkdir(latestDir, { recursive: true });

  // 6. Copy source data to bundle
  console.log('Copying data to bundle...');
  await writeFile(join(bundleDir, 'elements.json'), JSON.stringify(elements));
  await writeFile(join(bundleDir, 'ions.json'), JSON.stringify(ions));

  await mkdir(join(bundleDir, 'rules'), { recursive: true });
  await writeFile(join(bundleDir, 'rules', 'classification_rules.json'), JSON.stringify(classificationRules));
  await writeFile(join(bundleDir, 'rules', 'naming_rules.json'), JSON.stringify(namingRules));
  await writeFile(join(bundleDir, 'rules', 'solubility_rules_light.json'), JSON.stringify(solubility));
  await writeFile(join(bundleDir, 'rules', 'activity_series.json'), JSON.stringify(activitySeries));
  await writeFile(join(bundleDir, 'rules', 'applicability_rules.json'), JSON.stringify(applicabilityRules));
  await writeFile(join(bundleDir, 'rules', 'bkt_params.json'), JSON.stringify(bktParams));
  await writeFile(join(bundleDir, 'rules', 'competencies.json'), JSON.stringify(competencies));

  await mkdir(join(bundleDir, 'templates'), { recursive: true });
  await writeFile(join(bundleDir, 'templates', 'reaction_templates.json'), JSON.stringify(reactionTemplates));
  await writeFile(join(bundleDir, 'templates', 'task_templates.json'), JSON.stringify(taskTemplates));

  await mkdir(join(bundleDir, 'substances'), { recursive: true });
  for (const { filename, data } of substances) {
    await writeFile(join(bundleDir, 'substances', filename), JSON.stringify(data));
  }

  await mkdir(join(bundleDir, 'diagnostic'), { recursive: true });
  await writeFile(join(bundleDir, 'diagnostic', 'questions.json'), JSON.stringify(diagnosticQuestions));

  await writeFile(join(bundleDir, 'element-groups.json'), JSON.stringify(elementGroups));
  await writeFile(join(bundleDir, 'periodic-table-content.json'), JSON.stringify(periodicTableContent));
  await writeFile(join(bundleDir, 'rules', 'periodic-table-theory.json'), JSON.stringify(periodicTableTheory));
  await writeFile(join(bundleDir, 'rules', 'bond_theory.json'), JSON.stringify(bondTheory));
  await mkdir(join(bundleDir, 'exercises'), { recursive: true });
  await writeFile(join(bundleDir, 'exercises', 'periodic-table-exercises.json'), JSON.stringify(periodicTableExercises));
  await writeFile(join(bundleDir, 'exercises', 'bonds-exercises.json'), JSON.stringify(bondsExercises));
  await writeFile(join(bundleDir, 'rules', 'oxidation_theory.json'), JSON.stringify(oxidationTheory));
  await writeFile(join(bundleDir, 'exercises', 'oxidation-exercises.json'), JSON.stringify(oxidationExercises));

  await mkdir(join(bundleDir, 'reactions'), { recursive: true });
  await writeFile(join(bundleDir, 'reactions', 'reactions.json'), JSON.stringify(reactions));

  if (structureFiles.length > 0) {
    await mkdir(join(bundleDir, 'structures'), { recursive: true });
    for (const f of structureFiles) {
      const data = await loadJson(join(structuresDir, f));
      await writeFile(join(bundleDir, 'structures', f), JSON.stringify(data));
    }
  }

  // 7. Generate indices
  console.log('Generating indices...');
  const indexKeys = await generateIndices(substances, taskTemplates, bundleDir);

  // 8. Generate manifest
  console.log('Generating manifest...');
  const stats = {
    elements_count: elements.length,
    ions_count: ions.length,
    substances_count: substances.length,
    reaction_templates_count: reactionTemplates.length,
    task_templates_count: taskTemplates.length,
    reactions_count: reactions.length,
  };
  await generateManifest({
    bundleHash,
    bundleDir,
    latestDir,
    stats,
    indexKeys,
  });

  console.log(`\nBuild complete! Bundle: public/data/${bundleHash}/`);
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
