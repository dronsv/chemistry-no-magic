import type { Manifest } from '../types/manifest';
import type { Element } from '../types/element';
import type { Ion } from '../types/ion';
import type { Substance } from '../types/substance';
import type { BktParams } from '../types/bkt';
import type { TaskTemplate, ReactionTemplate } from '../types/templates';
import type { DiagnosticQuestion } from '../types/diagnostic';
import type { CompetencyNode } from '../types/competency';
import type { ElectronConfigException } from '../types/electron-config';
import type { PeriodicTableTheory } from '../types/periodic-table-theory';
import type { ClassificationRule, NamingRule, SubstanceIndexEntry } from '../types/classification';
import type { SolubilityEntry, ActivitySeriesEntry, ApplicabilityRule } from '../types/rules';
import type { Reaction } from '../types/reaction';
import type { BondTheory } from '../types/bond';

/** Module-level cache: stores the in-flight or resolved manifest promise. */
let manifestPromise: Promise<Manifest> | null = null;

/**
 * Fetch and cache `/data/latest/manifest.json`.
 * Concurrent callers share the same in-flight request (no stampede).
 */
export async function getManifest(): Promise<Manifest> {
  if (manifestPromise) {
    return manifestPromise;
  }

  manifestPromise = (async () => {
    const url = '/data/latest/manifest.json';
    const response = await fetch(url);

    if (!response.ok) {
      manifestPromise = null; // allow retry on failure
      throw new Error(
        `Failed to load manifest from ${url}: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as Manifest;
  })();

  return manifestPromise;
}

/**
 * Resolve a relative path against the current bundle_hash and fetch the JSON file.
 *
 * @param path - Relative path within the data bundle (e.g. `"elements.json"`, `"rules/classification_rules.json"`).
 * @returns Parsed JSON typed as `T`.
 */
export async function loadDataFile<T>(path: string): Promise<T> {
  const manifest = await getManifest();
  const url = `/data/${manifest.bundle_hash}/${path}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to load data file ${url}: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

/** Load the full elements list. */
export async function loadElements(): Promise<Element[]> {
  const manifest = await getManifest();
  return loadDataFile<Element[]>(manifest.entrypoints.elements);
}

/** Load the full ions list. */
export async function loadIons(): Promise<Ion[]> {
  const manifest = await getManifest();
  return loadDataFile<Ion[]>(manifest.entrypoints.ions);
}

/**
 * Load a single substance by its ID.
 *
 * @param id - Substance identifier (e.g. `"NaCl"`).
 */
export async function loadSubstance(id: string): Promise<Substance> {
  const manifest = await getManifest();
  const basePath = manifest.entrypoints.substances;
  // Substances directory contains individual files per substance
  const path = `${basePath}/${id}.json`;
  return loadDataFile<Substance>(path);
}

/**
 * Load a rule file by name.
 *
 * @param name - Rule name matching a key in `manifest.entrypoints.rules`
 *               (e.g. `"classification_rules"`, `"naming_rules"`).
 */
export async function loadRule(name: string): Promise<unknown> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.rules[name];

  if (!path) {
    throw new Error(
      `Unknown rule "${name}". Available rules: ${Object.keys(manifest.entrypoints.rules).join(', ')}`,
    );
  }

  return loadDataFile<unknown>(path);
}

/**
 * Load an index file by name.
 *
 * @param name - Index name matching a key in `manifest.entrypoints.indices`
 *               (e.g. `"substances_index"`).
 */
export async function loadIndex(name: string): Promise<unknown> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.indices[name];

  if (!path) {
    throw new Error(
      `Unknown index "${name}". Available indices: ${Object.keys(manifest.entrypoints.indices).join(', ')}`,
    );
  }

  return loadDataFile<unknown>(path);
}

/** Load competency definitions (names, blocks, prerequisites). */
export async function loadCompetencies(): Promise<CompetencyNode[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.rules['competencies'];

  if (!path) {
    throw new Error(
      'Competencies not found in manifest. Expected key "competencies" in entrypoints.rules.',
    );
  }

  return loadDataFile<CompetencyNode[]>(path);
}

/** Load BKT parameters for all competencies. */
export async function loadBktParams(): Promise<BktParams[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.rules['bkt_params'];

  if (!path) {
    throw new Error(
      'BKT params not found in manifest. Expected key "bkt_params" in entrypoints.rules.',
    );
  }

  return loadDataFile<BktParams[]>(path);
}

/** Load all task templates. */
export async function loadTaskTemplates(): Promise<TaskTemplate[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.templates['task_templates'];

  if (!path) {
    throw new Error(
      'Task templates not found in manifest. Expected key "task_templates" in entrypoints.templates.',
    );
  }

  return loadDataFile<TaskTemplate[]>(path);
}

/** Load diagnostic questions. */
export async function loadDiagnosticQuestions(): Promise<DiagnosticQuestion[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.diagnostic;

  if (!path) {
    throw new Error(
      'Diagnostic questions not found in manifest. Expected key "diagnostic" in entrypoints.',
    );
  }

  return loadDataFile<DiagnosticQuestion[]>(path);
}

/** Load electron config exceptions. */
export async function loadElectronConfigExceptions(): Promise<ElectronConfigException[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.electron_config_exceptions;

  if (!path) {
    throw new Error(
      'Electron config exceptions not found in manifest. Expected key "electron_config_exceptions" in entrypoints.',
    );
  }

  return loadDataFile<ElectronConfigException[]>(path);
}

/** Load periodic table content (theory blocks, explanations). */
export async function loadPeriodicTableContent(): Promise<unknown> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.periodic_table_content;

  if (!path) {
    throw new Error(
      'Periodic table content not found in manifest. Expected key "periodic_table_content" in entrypoints.',
    );
  }

  return loadDataFile<unknown>(path);
}

/** Load exercise templates by module name. */
export async function loadExercises(module: string): Promise<unknown> {
  const manifest = await getManifest();
  const exercises = manifest.entrypoints.exercises;

  if (!exercises) {
    throw new Error('Exercises not found in manifest. Expected key "exercises" in entrypoints.');
  }

  const path = exercises[module];
  if (!path) {
    throw new Error(
      `Exercise module "${module}" not found. Available: ${Object.keys(exercises).join(', ')}`,
    );
  }

  return loadDataFile<unknown>(path);
}

/** Load periodic table theory (property trends, exception consequences). */
export async function loadPeriodicTableTheory(): Promise<PeriodicTableTheory> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.rules['periodic_table_theory'];

  if (!path) {
    throw new Error(
      'Periodic table theory not found in manifest. Expected key "periodic_table_theory" in entrypoints.rules.',
    );
  }

  return loadDataFile<PeriodicTableTheory>(path);
}

/** Load classification rules. */
export async function loadClassificationRules(): Promise<ClassificationRule[]> {
  return loadRule('classification_rules') as Promise<ClassificationRule[]>;
}

/** Load naming rules. */
export async function loadNamingRules(): Promise<NamingRule[]> {
  return loadRule('naming_rules') as Promise<NamingRule[]>;
}

/** Load substances index. */
export async function loadSubstancesIndex(): Promise<SubstanceIndexEntry[]> {
  const data = await loadIndex('substances_index');
  return (data as { substances: SubstanceIndexEntry[] }).substances;
}

/** Load solubility rules. */
export async function loadSolubilityRules(): Promise<SolubilityEntry[]> {
  return loadRule('solubility_rules_light') as Promise<SolubilityEntry[]>;
}

/** Load activity series of metals. */
export async function loadActivitySeries(): Promise<ActivitySeriesEntry[]> {
  return loadRule('activity_series') as Promise<ActivitySeriesEntry[]>;
}

/** Load applicability rules. */
export async function loadApplicabilityRules(): Promise<ApplicabilityRule[]> {
  return loadRule('applicability_rules') as Promise<ApplicabilityRule[]>;
}

/** Load bond theory content (bond types + crystal structures). */
export async function loadBondTheory(): Promise<BondTheory> {
  return loadRule('bond_theory') as Promise<BondTheory>;
}

/** Load all reactions (concrete reaction cards with ionic equations, observations, kinetics). */
export async function loadReactions(): Promise<Reaction[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.reactions;

  if (!path) {
    throw new Error(
      'Reactions not found in manifest. Expected key "reactions" in entrypoints.',
    );
  }

  return loadDataFile<Reaction[]>(path);
}

/** Load all reaction templates. */
export async function loadReactionTemplates(): Promise<ReactionTemplate[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.templates['reaction_templates'];

  if (!path) {
    throw new Error(
      'Reaction templates not found in manifest. Expected key "reaction_templates" in entrypoints.templates.',
    );
  }

  return loadDataFile<ReactionTemplate[]>(path);
}
