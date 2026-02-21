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
import { existsSync } from 'node:fs';
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
import { generateSearchIndex } from './lib/generate-search-index.mjs';
import { generateFormulaLookup } from './lib/generate-formula-lookup.mjs';
import { TRANSLATION_LOCALES } from './lib/i18n.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const DATA_SRC = join(ROOT, 'data-src');
const PUBLIC_DATA = join(ROOT, 'public', 'data');

const validateOnly = process.argv.includes('--validate-only');

async function loadJson(path) {
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw);
}

/** Try to load a JSON file, return null if it doesn't exist or is empty. */
async function loadJsonOptional(path) {
  try {
    const data = await loadJson(path);
    if (data && typeof data === 'object' && Object.keys(data).length > 0) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
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

/**
 * Load all translation overlays for a given locale.
 * Returns { elements, competencies, substances, reactions, pages, ... } or empty object.
 */
async function loadTranslationOverlays(locale) {
  const dir = join(DATA_SRC, 'translations', locale);
  if (!existsSync(dir)) return { _keys: [] };

  const overlays = {};
  const availableKeys = [];
  let files;
  try {
    files = await readdir(dir);
  } catch {
    return { _keys: [] };
  }

  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const key = f.replace('.json', '');
    const data = await loadJsonOptional(join(dir, f));
    if (data) {
      overlays[key] = data;
      availableKeys.push(key);
    }
  }

  overlays._keys = availableKeys;
  return overlays;
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
  const qualitativeReactions = await loadJson(join(DATA_SRC, 'rules', 'qualitative_reactions.json'));
  const geneticChains = await loadJson(join(DATA_SRC, 'rules', 'genetic_chains.json'));
  const energyCatalystTheory = await loadJson(join(DATA_SRC, 'rules', 'energy_catalyst_theory.json'));
  const calculationsData = await loadJson(join(DATA_SRC, 'rules', 'calculations_data.json'));
  const elementGroups = await loadJson(join(DATA_SRC, 'element-groups.json'));
  const ogeTasks = await loadJson(join(DATA_SRC, 'exam', 'oge_tasks.json'));
  const ogeSolutionAlgorithms = await loadJson(join(DATA_SRC, 'exam', 'oge_solution_algorithms.json'));
  const examSystems = await loadJson(join(DATA_SRC, 'exam', 'systems.json'));
  const topicMapping = await loadJson(join(DATA_SRC, 'rules', 'topic_mapping.json'));

  // Load per-system exam metadata
  const examMetas = {};
  for (const sys of examSystems) {
    try {
      examMetas[sys.id] = await loadJson(join(DATA_SRC, 'exam', sys.id, 'meta.json'));
    } catch { /* meta optional for systems without tasks yet */ }
  }

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
  console.log(`  ${qualitativeReactions.length} qualitative reactions, ${geneticChains.length} genetic chains, ${energyCatalystTheory.rate_factors.length} rate factors`);
  console.log(`  ${calculationsData.calc_substances.length} calc substances, ${calculationsData.calc_reactions.length} calc reactions`);
  console.log(`  ${ogeTasks.length} OGE tasks, ${ogeSolutionAlgorithms.length} solution algorithms`);
  console.log(`  ${topicMapping.length} unified topics`);
  console.log(`  ${examSystems.length} exam systems (${examSystems.map(s => s.id).join(', ')})`);
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
  await writeFile(join(bundleDir, 'rules', 'qualitative_reactions.json'), JSON.stringify(qualitativeReactions));
  await writeFile(join(bundleDir, 'rules', 'genetic_chains.json'), JSON.stringify(geneticChains));
  await writeFile(join(bundleDir, 'rules', 'energy_catalyst_theory.json'), JSON.stringify(energyCatalystTheory));
  await writeFile(join(bundleDir, 'rules', 'calculations_data.json'), JSON.stringify(calculationsData));
  await writeFile(join(bundleDir, 'rules', 'topic_mapping.json'), JSON.stringify(topicMapping));
  await writeFile(join(bundleDir, 'exercises', 'oxidation-exercises.json'), JSON.stringify(oxidationExercises));

  await mkdir(join(bundleDir, 'reactions'), { recursive: true });
  await writeFile(join(bundleDir, 'reactions', 'reactions.json'), JSON.stringify(reactions));

  await mkdir(join(bundleDir, 'exam'), { recursive: true });
  await writeFile(join(bundleDir, 'exam', 'oge_tasks.json'), JSON.stringify(ogeTasks));
  await writeFile(join(bundleDir, 'exam', 'oge_solution_algorithms.json'), JSON.stringify(ogeSolutionAlgorithms));

  // Multi-exam system files
  await writeFile(join(bundleDir, 'exam', 'systems.json'), JSON.stringify(examSystems));
  for (const sys of examSystems) {
    const sysDir = join(bundleDir, 'exam', sys.id);
    await mkdir(sysDir, { recursive: true });
    if (examMetas[sys.id]) {
      await writeFile(join(sysDir, 'meta.json'), JSON.stringify(examMetas[sys.id]));
    }
    // Copy per-system tasks and algorithms if they exist
    try {
      const tasks = await loadJson(join(DATA_SRC, 'exam', sys.id, 'tasks.json'));
      await writeFile(join(sysDir, 'tasks.json'), JSON.stringify(tasks));
    } catch { /* no tasks yet for this system */ }
    try {
      const algos = await loadJson(join(DATA_SRC, 'exam', sys.id, 'algorithms.json'));
      await writeFile(join(sysDir, 'algorithms.json'), JSON.stringify(algos));
    } catch { /* no algorithms yet for this system */ }
  }

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

  // 7b. Generate formula lookup (elements + substances → display formula → id)
  console.log('Generating formula lookup...');
  const formulaCount = await generateFormulaLookup(elements, substances, bundleDir);
  console.log(`  ${formulaCount} formula entries`);

  // 7c. Generate search index (Russian — default)
  console.log('Generating search index...');
  const searchIndex = generateSearchIndex({ elements, substances, reactions, competencies });
  await writeFile(join(bundleDir, 'search_index.json'), JSON.stringify(searchIndex));
  console.log(`  ${searchIndex.length} search entries (ru)`);

  // 7d. Load translation overlays and generate per-locale data
  console.log('\nProcessing translations...');
  const translationsManifest = {};

  for (const locale of TRANSLATION_LOCALES) {
    const overlays = await loadTranslationOverlays(locale);
    const keys = overlays._keys;

    if (keys.length === 0) {
      console.log(`  ${locale}: no translations`);
      translationsManifest[locale] = [];
      continue;
    }

    // Copy overlay files to bundle
    const localeDir = join(bundleDir, 'translations', locale);
    await mkdir(localeDir, { recursive: true });

    for (const key of keys) {
      await writeFile(join(localeDir, `${key}.json`), JSON.stringify(overlays[key]));
    }

    translationsManifest[locale] = keys;
    console.log(`  ${locale}: ${keys.length} overlay files (${keys.join(', ')})`);

    // Generate locale-specific search index
    const localeSearchIndex = generateSearchIndex({
      elements,
      substances,
      reactions,
      competencies,
      locale,
      translations: overlays,
    });
    await writeFile(join(bundleDir, `search_index.${locale}.json`), JSON.stringify(localeSearchIndex));
    console.log(`  ${locale}: ${localeSearchIndex.length} search entries`);
  }

  // 8. Generate manifest
  console.log('\nGenerating manifest...');
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
    translations: translationsManifest,
    examSystemIds: examSystems.map(s => s.id),
  });

  console.log(`\nBuild complete! Bundle: public/data/${bundleHash}/`);
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
