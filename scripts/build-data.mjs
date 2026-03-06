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
  validateProcessVocab,
  validateEffectsVocab,
  validateQuantitiesUnits,
  validateProperties,
  validateBondExamples,
  validateOxidationExamples,
  validateEngineTaskTemplates,
} from './lib/validate.mjs';
import { checkIntegrity } from './lib/integrity.mjs';
import {
  validateConceptsGraph,
  validateTheoryModuleRefs,
  validateCourseRefs,
  validateFilterStructure,
  validateZeroMatchOverrides,
  checkZeroMatchConcepts,
} from './lib/validate-ontology.mjs';
import { generateReport } from './lib/generate-report.mjs';
import { generateIndices } from './lib/generate-indices.mjs';
import { generateManifest } from './lib/generate-manifest.mjs';
import { generateSearchIndex } from './lib/generate-search-index.mjs';
import { generateFormulaLookup } from './lib/generate-formula-lookup.mjs';
import { generateNameIndex } from './lib/generate-name-index.mjs';
import { TRANSLATION_LOCALES } from './lib/i18n.mjs';
import { generateReactionParticipants } from './lib/generate-reaction-participants.mjs';
import { generateConceptLookups } from './lib/generate-concept-lookup.mjs';

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
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return { _keys: [] };
  }

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.json')) {
      const key = entry.name.replace('.json', '');
      const data = await loadJsonOptional(join(dir, entry.name));
      if (data) {
        overlays[key] = data;
        availableKeys.push(key);
      }
    } else if (entry.isDirectory()) {
      // Handle subdirectories (e.g. theory_modules/) — register each file as "subdir/key"
      const subdir = entry.name;
      const subFiles = await readdir(join(dir, subdir));
      for (const sf of subFiles) {
        if (!sf.endsWith('.json')) continue;
        const subKey = `${subdir}/${sf.replace('.json', '')}`;
        const data = await loadJsonOptional(join(dir, subdir, sf));
        if (data) {
          overlays[subKey] = data;
          availableKeys.push(subKey);
        }
      }
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
  const reactionRoles = await loadJson(join(DATA_SRC, 'reactions', 'reaction_roles.json'));
  const bondTheory = await loadJson(join(DATA_SRC, 'rules', 'bond_theory.json'));
  const bondExamples = await loadJson(join(DATA_SRC, 'rules', 'bond_examples.json'));
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
  const ionNomenclature = await loadJson(join(DATA_SRC, 'rules', 'ion_nomenclature.json'));
  const oxidationRules = await loadJson(join(DATA_SRC, 'rules', 'oxidation_rules.json'));
  const oxidationExamples = await loadJson(join(DATA_SRC, 'rules', 'oxidation_examples.json'));
  const solubilityFull = await loadJson(join(DATA_SRC, 'rules', 'solubility_rules_full.json'));
  const processVocab = await loadJson(join(DATA_SRC, 'process_vocab.json'));
  const effectsVocab = await loadJson(join(DATA_SRC, 'effects_vocab.json'));
  const quantitiesUnits = await loadJson(join(DATA_SRC, 'quantities_units_ontology.json'));
  const properties = await loadJson(join(DATA_SRC, 'rules', 'properties.json'));
  const storageRequirements = await loadJson(join(DATA_SRC, 'storage_requirements.json'));
  const storageProfiles = await loadJson(join(DATA_SRC, 'storage_profiles.json'));
  const periodicTrendAnomalies = await loadJson(join(DATA_SRC, 'rules', 'periodic_trend_anomalies.json'));
  const reasonVocab = await loadJson(join(DATA_SRC, 'rules', 'reason_vocab.json'));
  const engineTaskTemplates = await loadJson(join(DATA_SRC, 'engine', 'task_templates.json'));
  const promptTemplatesRu = await loadJson(join(DATA_SRC, 'engine', 'prompt_templates.ru.json'));
  const promptTemplatesEn = await loadJson(join(DATA_SRC, 'engine', 'prompt_templates.en.json'));
  const promptTemplatesPl = await loadJson(join(DATA_SRC, 'engine', 'prompt_templates.pl.json'));
  const promptTemplatesEs = await loadJson(join(DATA_SRC, 'engine', 'prompt_templates.es.json'));

  const calculators = await loadJson(join(DATA_SRC, 'calculators.json'));
  const bondEnergyTable = await loadJson(join(DATA_SRC, 'tables', 'bond_energy_avg_v1.json'));

  const concepts = await loadJson(join(DATA_SRC, 'concepts.json'));
  const topics = await loadJson(join(DATA_SRC, 'topics.json'));
  const topicPages = await loadJson(join(DATA_SRC, 'topic_pages.json'));

  // Load theory modules early for validation (optional directory)
  const theoryModulesDir = join(DATA_SRC, 'theory_modules');
  let theoryModuleEntries = [];  // Array of { data, filename }
  try {
    const tmFiles = (await readdir(theoryModulesDir)).filter(f => f.endsWith('.json'));
    for (const f of tmFiles) {
      theoryModuleEntries.push({ data: await loadJson(join(theoryModulesDir, f)), filename: f });
    }
  } catch { /* theory_modules dir optional */ }

  // Load courses early for validation (optional directory)
  const coursesDir = join(DATA_SRC, 'courses');
  let courseEntries = [];  // Array of { data, filename }
  try {
    const cFiles = (await readdir(coursesDir)).filter(f => f.endsWith('.json'));
    for (const f of cFiles) {
      courseEntries.push({ data: await loadJson(join(coursesDir, f)), filename: f });
    }
  } catch { /* courses dir optional */ }

  // Load contexts layer
  const chemContexts = await loadJson(join(DATA_SRC, 'contexts', 'contexts.json'));
  const substanceVariants = await loadJson(join(DATA_SRC, 'contexts', 'substance_variants.json'));
  const chemTerms = await loadJson(join(DATA_SRC, 'contexts', 'terms.json'));
  const termBindings = await loadJson(join(DATA_SRC, 'contexts', 'term_bindings.json'));

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
  console.log(`  ${ionNomenclature.suffix_rules.length} ion nomenclature rules, ${ionNomenclature.acid_to_anion_pairs.length} acid-anion pairs`);
  console.log(`  ${examSystems.length} exam systems (${examSystems.map(s => s.id).join(', ')})`);
  console.log(`  ${processVocab.length} process vocab entries, ${effectsVocab.length} effects vocab entries, ${quantitiesUnits.quantities.length} quantities, ${quantitiesUnits.units.length} units`);
  console.log(`  ${reactions.length} reactions, ${reactionRoles.length} reaction roles`);
  console.log(`  ${competencies.length} competencies, ${diagnosticQuestions.length} diagnostic questions`);
  console.log(`  ${periodicTableExercises.exercise_types.length} periodic table exercise templates`);
  console.log(`  ${reactionTemplates.length} reaction templates, ${taskTemplates.length} task templates`);
  console.log(`  ${bondTheory.bond_types.length} bond types, ${bondTheory.crystal_structures.length} crystal structures, ${bondsExercises.length} bond exercises, ${bondExamples.examples.length} bond examples`);
  console.log(`  ${oxidationTheory.rules.length} oxidation rules, ${oxidationExercises.length} oxidation exercises, ${oxidationExamples.length} oxidation examples`);
  console.log(`  ${properties.length} property definitions, ${engineTaskTemplates.length} engine task templates`);
  console.log(`  ${calculators.calculators.length} calculators, ${Object.keys(bondEnergyTable.bonds).length} bond energy entries`);
  console.log(`  ${Object.keys(promptTemplatesRu).length} prompt templates (ru), ${Object.keys(promptTemplatesEn).length} (en), ${Object.keys(promptTemplatesPl).length} (pl), ${Object.keys(promptTemplatesEs).length} (es)`);
  console.log(`  ${chemContexts.length} contexts, ${substanceVariants.length} substance variants, ${chemTerms.length} terms`);
  console.log(`  ${Object.keys(concepts).length} concepts`);
  if (theoryModuleEntries.length > 0) console.log(`  ${theoryModuleEntries.length} theory modules`);
  if (courseEntries.length > 0) console.log(`  ${courseEntries.length} courses`);
  console.log('');

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
    ...validateEffectsVocab(effectsVocab),
    ...validateProcessVocab(processVocab, effectsVocab),
    ...validateQuantitiesUnits(quantitiesUnits),
    ...validateProperties(properties),
    ...validateBondExamples(bondExamples),
    ...validateOxidationExamples(oxidationExamples),
    ...validateEngineTaskTemplates(engineTaskTemplates),
  ];

  for (const { filename, data } of substances) {
    allErrors.push(...validateSubstance(data, filename));
  }

  // 2b. Ontology cross-reference validation
  console.log('Validating ontology...');
  const ontologyErrors = [
    ...validateConceptsGraph(concepts),
    ...validateFilterStructure(concepts),
    ...validateZeroMatchOverrides(concepts),
    ...validateTheoryModuleRefs(theoryModuleEntries.map(m => m.data), concepts),
    ...validateCourseRefs(courseEntries.map(c => c.data), theoryModuleEntries.map(m => m.data)),
  ];
  allErrors.push(...ontologyErrors);

  // 2c. Zero-match detection (blocking unless explicitly allowlisted in concepts.json)
  const substanceData = substances.map(s => s.data);
  const zeroMatchErrors = checkZeroMatchConcepts(concepts, {
    substances: substanceData,
    elements,
    reactions,
  });
  if (zeroMatchErrors.length > 0) {
    console.error('\n  Zero-match errors:');
    for (const err of zeroMatchErrors) {
      console.error(`    ✖ ${err}`);
    }
    console.log('');
    allErrors.push(...zeroMatchErrors);
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
  await writeFile(join(bundleDir, 'rules', 'solubility_rules_full.json'), JSON.stringify(solubilityFull));
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
  await writeFile(join(bundleDir, 'rules', 'bond_examples.json'), JSON.stringify(bondExamples));
  await mkdir(join(bundleDir, 'exercises'), { recursive: true });
  await writeFile(join(bundleDir, 'exercises', 'periodic-table-exercises.json'), JSON.stringify(periodicTableExercises));
  await writeFile(join(bundleDir, 'exercises', 'bonds-exercises.json'), JSON.stringify(bondsExercises));
  await writeFile(join(bundleDir, 'rules', 'oxidation_theory.json'), JSON.stringify(oxidationTheory));
  await writeFile(join(bundleDir, 'rules', 'qualitative_reactions.json'), JSON.stringify(qualitativeReactions));
  await writeFile(join(bundleDir, 'rules', 'genetic_chains.json'), JSON.stringify(geneticChains));
  await writeFile(join(bundleDir, 'rules', 'energy_catalyst_theory.json'), JSON.stringify(energyCatalystTheory));
  await writeFile(join(bundleDir, 'rules', 'calculations_data.json'), JSON.stringify(calculationsData));
  await writeFile(join(bundleDir, 'rules', 'topic_mapping.json'), JSON.stringify(topicMapping));
  await writeFile(join(bundleDir, 'rules', 'ion_nomenclature.json'), JSON.stringify(ionNomenclature));
  await writeFile(join(bundleDir, 'rules', 'oxidation_rules.json'), JSON.stringify(oxidationRules));
  await writeFile(join(bundleDir, 'rules', 'oxidation_examples.json'), JSON.stringify(oxidationExamples));
  await writeFile(join(bundleDir, 'rules', 'properties.json'), JSON.stringify(properties));
  await writeFile(join(bundleDir, 'rules', 'storage_requirements.json'), JSON.stringify(storageRequirements));
  await writeFile(join(bundleDir, 'rules', 'storage_profiles.json'), JSON.stringify(storageProfiles));
  await writeFile(join(bundleDir, 'rules', 'periodic_trend_anomalies.json'), JSON.stringify(periodicTrendAnomalies));
  await writeFile(join(bundleDir, 'rules', 'reason_vocab.json'), JSON.stringify(reasonVocab));
  await writeFile(join(bundleDir, 'exercises', 'oxidation-exercises.json'), JSON.stringify(oxidationExercises));

  await mkdir(join(bundleDir, 'engine'), { recursive: true });
  await writeFile(join(bundleDir, 'engine', 'task_templates.json'), JSON.stringify(engineTaskTemplates));
  await writeFile(join(bundleDir, 'engine', 'prompt_templates.ru.json'), JSON.stringify(promptTemplatesRu));
  await writeFile(join(bundleDir, 'engine', 'prompt_templates.en.json'), JSON.stringify(promptTemplatesEn));
  await writeFile(join(bundleDir, 'engine', 'prompt_templates.pl.json'), JSON.stringify(promptTemplatesPl));
  await writeFile(join(bundleDir, 'engine', 'prompt_templates.es.json'), JSON.stringify(promptTemplatesEs));

  // Copy tables
  await mkdir(join(bundleDir, 'tables'), { recursive: true });
  await writeFile(join(bundleDir, 'tables', 'bond_energy_avg_v1.json'), JSON.stringify(bondEnergyTable));

  // Copy calculator registry
  await writeFile(join(bundleDir, 'calculators.json'), JSON.stringify(calculators));

  await writeFile(join(bundleDir, 'process_vocab.json'), JSON.stringify(processVocab));
  await writeFile(join(bundleDir, 'effects_vocab.json'), JSON.stringify(effectsVocab));
  await writeFile(join(bundleDir, 'quantities_units.json'), JSON.stringify(quantitiesUnits));

  await mkdir(join(bundleDir, 'reactions'), { recursive: true });
  await writeFile(join(bundleDir, 'reactions', 'reactions.json'), JSON.stringify(reactions));
  await writeFile(join(bundleDir, 'reactions', 'reaction_roles.json'), JSON.stringify(reactionRoles));

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

  // 6a1. Derive bond counts from structures
  console.log('Deriving bond counts...');
  const { deriveBondCounts } = await import('./lib/derive-bond-counts.mjs');
  const bondCountsIndex = {};
  for (const f of structureFiles) {
    const structure = await loadJson(join(structuresDir, f));
    bondCountsIndex[structure.id] = deriveBondCounts(structure);
  }
  // Add "missing" entries for substances without structures
  const structureIds = new Set(structureFiles.map(f => f.replace(/\.json$/, '')));
  for (const { data } of substances) {
    if (!structureIds.has(data.id)) {
      bondCountsIndex[data.id] = { substance_id: data.id, bonds: [], quality: 'missing' };
    }
  }
  await mkdir(join(bundleDir, 'derived'), { recursive: true });
  await writeFile(join(bundleDir, 'derived', 'structure_bond_counts.json'), JSON.stringify(bondCountsIndex));
  console.log(`  ${structureFiles.length} structures → bond counts (${Object.keys(bondCountsIndex).length} total, ${substances.length - structureFiles.length} missing)`);

  // Validate bond energy table coverage
  const { validateBondEnergyTableCoverage } = await import('./lib/validate-calculators.mjs');
  const calcValidationErrors = validateBondEnergyTableCoverage(bondEnergyTable, bondCountsIndex);
  if (calcValidationErrors.length > 0) {
    console.error('\nCalculator validation errors:');
    for (const err of calcValidationErrors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  // 6a1b. Run bond energy calculator
  console.log('Running bond energy calculator...');
  const { calcBondEnergyV1 } = await import('./lib/calc-bond-energy.mjs');
  const bondEnergyResults = {};
  let beComputed = 0, bePartial = 0, beMissing = 0;
  for (const [id, bc] of Object.entries(bondCountsIndex)) {
    if (bc.quality === 'exact' && bc.bonds.length > 0) {
      const result = calcBondEnergyV1(id, bc.bonds, bondEnergyTable);
      bondEnergyResults[id] = result;
      if (result.bond_energy_quality === 'estimated') beComputed++;
      else if (result.bond_energy_quality === 'partial') bePartial++;
    } else {
      beMissing++;
    }
  }
  await writeFile(join(bundleDir, 'derived', 'bond_energy.json'), JSON.stringify(bondEnergyResults));
  console.log(`  Bond energy: ${beComputed} estimated, ${bePartial} partial, ${beMissing} no input`);

  // Contexts layer: generate reverse index and copy to bundle
  const reverseIndex = {};
  for (const b of termBindings) {
    (reverseIndex[b.ref.id] ??= []).push(b.term_id);
  }
  await mkdir(join(bundleDir, 'contexts'), { recursive: true });
  await writeFile(join(bundleDir, 'contexts', 'contexts.json'), JSON.stringify(chemContexts));
  await writeFile(join(bundleDir, 'contexts', 'substance_variants.json'), JSON.stringify(substanceVariants));
  await writeFile(join(bundleDir, 'contexts', 'terms.json'), JSON.stringify(chemTerms));
  await writeFile(join(bundleDir, 'contexts', 'term_bindings.json'), JSON.stringify(termBindings));
  await writeFile(join(bundleDir, 'contexts', 'reverse_index.json'), JSON.stringify(reverseIndex));

  await writeFile(join(bundleDir, 'concepts.json'), JSON.stringify(concepts));
  await writeFile(join(bundleDir, 'topics.json'), JSON.stringify(topics));
  await writeFile(join(bundleDir, 'topic_pages.json'), JSON.stringify(topicPages));
  console.log(`  ${topics.length} topics, ${Object.keys(topicPages).length} topic pages`);

  // 6a2. Copy theory modules (pre-loaded in phase 1)
  const theoryModuleFiles = {};
  if (theoryModuleEntries.length > 0) {
    await mkdir(join(bundleDir, 'theory_modules'), { recursive: true });
    for (const { data, filename } of theoryModuleEntries) {
      const key = filename.replace('.json', '');
      await writeFile(join(bundleDir, 'theory_modules', filename), JSON.stringify(data));
      theoryModuleFiles[key] = `theory_modules/${filename}`;
    }
    console.log(`  ${theoryModuleEntries.length} theory modules`);
  }

  // 6a3. Copy courses (pre-loaded in phase 1)
  const courseFiles = {};
  if (courseEntries.length > 0) {
    await mkdir(join(bundleDir, 'courses'), { recursive: true });
    for (const { data, filename } of courseEntries) {
      const key = filename.replace('.json', '');
      await writeFile(join(bundleDir, 'courses', filename), JSON.stringify(data));
      courseFiles[key] = `courses/${filename}`;
    }
    console.log(`  ${courseEntries.length} courses`);
  }

  // 6b. Generate reaction participants from reactions data
  console.log('Generating reaction participants...');
  const reactionParticipants = generateReactionParticipants(reactions);
  await writeFile(join(bundleDir, 'reactions', 'reaction_participants.json'), JSON.stringify(reactionParticipants));
  console.log(`  ${reactionParticipants.length} participation records`);

  // 7. Generate indices
  console.log('Generating indices...');
  const indexKeys = await generateIndices(substances, taskTemplates, bundleDir);

  // 7b. Generate formula lookup (elements + substances + ions → display formula → id)
  console.log('Generating formula lookup...');
  const formulaCount = await generateFormulaLookup(elements, substances, ions, bundleDir);
  console.log(`  ${formulaCount} formula entries`);

  // 7b2. Generate concept lookups (surface forms → concept IDs per locale)
  console.log('Generating concept lookups...');
  const conceptCounts = await generateConceptLookups(
    concepts, join(DATA_SRC, 'translations'), bundleDir, ['ru', 'en', 'pl', 'es']
  );
  for (const [locale, count] of Object.entries(conceptCounts)) {
    console.log(`  ${locale}: ${count} concept entries`);
  }

  // 7c. Generate search index (Russian — default)
  console.log('Generating search index...');
  const searchIndex = generateSearchIndex({ elements, substances, reactions, competencies, ions });
  await writeFile(join(bundleDir, 'search_index.json'), JSON.stringify(searchIndex));
  console.log(`  ${searchIndex.length} search entries (ru)`);

  // 7d. Generate name index (Russian — default)
  console.log('Generating name index...');
  const nameIndexRu = generateNameIndex({ elements, ions, substances, terms: chemTerms, bindings: termBindings });
  await writeFile(join(bundleDir, 'name_index.ru.json'), JSON.stringify(nameIndexRu));
  console.log(`  ${Object.keys(nameIndexRu).length} name entries (ru)`);

  // 7d. Load translation overlays and generate per-locale data
  console.log('\nProcessing translations...');
  const translationsManifest = {};

  // Process all translation locales + ru (for morphology and other ru-only overlays)
  const allTranslationLocales = ['ru', ...TRANSLATION_LOCALES];
  for (const locale of allTranslationLocales) {
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
      const filePath = join(localeDir, `${key}.json`);
      // Ensure subdirectories exist for nested keys like "theory_modules/classification_inorganic"
      if (key.includes('/')) {
        await mkdir(join(localeDir, key.slice(0, key.lastIndexOf('/'))), { recursive: true });
      }
      await writeFile(filePath, JSON.stringify(overlays[key]));
    }

    translationsManifest[locale] = keys;
    console.log(`  ${locale}: ${keys.length} overlay files (${keys.join(', ')})`);

    // Generate locale-specific search index
    const localeSearchIndex = generateSearchIndex({
      elements,
      substances,
      reactions,
      competencies,
      ions,
      locale,
      translations: overlays,
    });
    await writeFile(join(bundleDir, `search_index.${locale}.json`), JSON.stringify(localeSearchIndex));
    console.log(`  ${locale}: ${localeSearchIndex.length} search entries`);

    // Generate locale-specific name index
    const localElements = overlays.elements
      ? elements.map(el => ({ ...el, ...(overlays.elements[el.symbol] || {}) }))
      : elements;
    const localIons = overlays.ions
      ? ions.map(ion => ({ ...ion, ...(overlays.ions[ion.id] || {}) }))
      : ions;
    const localSubstances = overlays.substances
      ? substances.map(({ filename, data }) => ({ filename, data: { ...data, ...(overlays.substances[data.id] || {}) } }))
      : substances;
    const localTerms = overlays.terms
      ? chemTerms.map(t => ({ ...t, ...(overlays.terms[t.id] || {}) }))
      : chemTerms;

    const localeNameIndex = generateNameIndex({
      elements: localElements,
      ions: localIons,
      substances: localSubstances,
      terms: localTerms,
      bindings: termBindings,
    });
    await writeFile(join(bundleDir, `name_index.${locale}.json`), JSON.stringify(localeNameIndex));
    console.log(`  ${locale}: ${Object.keys(localeNameIndex).length} name entries`);
  }

  // 7e. Generate data quality report
  console.log('Generating data quality report...');
  const report = generateReport({
    concepts,
    theoryModules: theoryModuleEntries.map(m => m.data),
    courses: courseEntries.map(c => c.data),
    substances: substanceData,
    elements,
    reactions,
    structures: structureFiles,
    validationErrors: ontologyErrors,
    zeroMatchConcepts: zeroMatchErrors,
    bondCountsIndex,
    bondEnergyResults,
  });
  await writeFile(join(bundleDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`  Report: ${report.concepts_total} concepts, ${report.zero_match_concepts.length} zero-match, ${report.structures_total} structures`);

  // 8. Generate manifest
  console.log('\nGenerating manifest...');
  const stats = {
    elements_count: elements.length,
    ions_count: ions.length,
    substances_count: substances.length,
    reaction_templates_count: reactionTemplates.length,
    task_templates_count: taskTemplates.length,
    reactions_count: reactions.length,
    contexts_count: chemContexts.length,
    variants_count: substanceVariants.length,
    terms_count: chemTerms.length,
  };
  await generateManifest({
    bundleHash,
    bundleDir,
    latestDir,
    stats,
    indexKeys,
    translations: translationsManifest,
    examSystemIds: examSystems.map(s => s.id),
    theoryModules: theoryModuleFiles,
    courses: courseFiles,
  });

  console.log(`\nBuild complete! Bundle: public/data/${bundleHash}/`);
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
