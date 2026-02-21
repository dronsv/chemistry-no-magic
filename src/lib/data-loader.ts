import type { Manifest } from '../types/manifest';
import type { Element } from '../types/element';
import type { Ion } from '../types/ion';
import type { Substance } from '../types/substance';
import type { BktParams } from '../types/bkt';
import type { TaskTemplate, ReactionTemplate } from '../types/templates';
import type { DiagnosticQuestion } from '../types/diagnostic';
import type { CompetencyNode } from '../types/competency';
import type { ElementGroupDict } from '../types/element-group';
import type { PeriodicTableTheory } from '../types/periodic-table-theory';
import type { ClassificationRule, NamingRule, SubstanceIndexEntry } from '../types/classification';
import type { SolubilityEntry, ActivitySeriesEntry, ApplicabilityRule } from '../types/rules';
import type { Reaction } from '../types/reaction';
import type { BondTheory } from '../types/bond';
import type { OxidationTheory } from '../types/oxidation';
import type { MoleculeStructure } from '../types/molecule';
import type { QualitativeTest } from '../types/qualitative';
import type { GeneticChain } from '../types/genetic-chain';
import type { EnergyCatalystTheory } from '../types/energy-catalyst';
import type { CalculationsData } from '../types/calculations';
import type { OgeTask } from '../types/oge-task';
import type { OgeSolutionAlgorithm } from '../types/oge-solution';
import type { SearchIndexEntry } from '../types/search';
import type { SupportedLocale } from '../types/i18n';

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

// ---------------------------------------------------------------------------
// Translation overlay helpers
// ---------------------------------------------------------------------------

/** Cache for loaded translation overlays: `"en:elements"` → promise */
const overlayCache = new Map<string, Promise<Record<string, Record<string, unknown>> | null>>();

/**
 * Load a translation overlay file for a given locale and data key.
 * Returns null if locale is 'ru', overlay is not available, or fetch fails.
 */
async function loadTranslationOverlay(
  locale: SupportedLocale,
  dataKey: string,
): Promise<Record<string, Record<string, unknown>> | null> {
  if (locale === 'ru') return null;

  const cacheKey = `${locale}:${dataKey}`;
  const cached = overlayCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const promise = (async () => {
    const manifest = await getManifest();
    const available = manifest.translations?.[locale];
    if (!available?.includes(dataKey)) return null;

    try {
      return await loadDataFile<Record<string, Record<string, unknown>>>(
        `translations/${locale}/${dataKey}.json`,
      );
    } catch {
      return null;
    }
  })();

  overlayCache.set(cacheKey, promise);
  return promise;
}

/**
 * Apply a translation overlay to an array of items.
 * Overlay values are shallow-merged onto matching items, replacing `_ru` fields in-place.
 */
function applyOverlay<T extends Record<string, unknown>>(
  items: T[],
  overlay: Record<string, Record<string, unknown>> | null,
  keyFn: (item: T) => string,
): T[] {
  if (!overlay) return items;
  return items.map(item => {
    const overrides = overlay[keyFn(item)];
    if (!overrides) return item;
    return { ...item, ...overrides } as T;
  });
}

/**
 * Apply a translation overlay to a single object (e.g. a substance).
 */
function applyOverlaySingle<T extends Record<string, unknown>>(
  item: T,
  overlay: Record<string, Record<string, unknown>> | null,
  key: string,
): T {
  if (!overlay) return item;
  const overrides = overlay[key];
  if (!overrides) return item;
  return { ...item, ...overrides } as T;
}

// ---------------------------------------------------------------------------
// Data loaders
// ---------------------------------------------------------------------------

/** Load the full elements list. */
export async function loadElements(locale?: SupportedLocale): Promise<Element[]> {
  const manifest = await getManifest();
  const elements = await loadDataFile<Element[]>(manifest.entrypoints.elements);
  if (!locale || locale === 'ru') return elements;
  const overlay = await loadTranslationOverlay(locale, 'elements');
  return applyOverlay(elements, overlay, el => el.symbol);
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
export async function loadSubstance(id: string, locale?: SupportedLocale): Promise<Substance> {
  const manifest = await getManifest();
  const basePath = manifest.entrypoints.substances;
  // Substances directory contains individual files per substance
  const path = `${basePath}/${id}.json`;
  const substance = await loadDataFile<Substance>(path);
  if (!locale || locale === 'ru') return substance;
  const overlay = await loadTranslationOverlay(locale, 'substances');
  return applyOverlaySingle(substance, overlay, id);
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
export async function loadCompetencies(locale?: SupportedLocale): Promise<CompetencyNode[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.rules['competencies'];

  if (!path) {
    throw new Error(
      'Competencies not found in manifest. Expected key "competencies" in entrypoints.rules.',
    );
  }

  const competencies = await loadDataFile<CompetencyNode[]>(path);
  if (!locale || locale === 'ru') return competencies;
  const overlay = await loadTranslationOverlay(locale, 'competencies');
  return applyOverlay(competencies, overlay, c => c.id);
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
export async function loadDiagnosticQuestions(locale?: SupportedLocale): Promise<DiagnosticQuestion[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.diagnostic;

  if (!path) {
    throw new Error(
      'Diagnostic questions not found in manifest. Expected key "diagnostic" in entrypoints.',
    );
  }

  const questions = await loadDataFile<DiagnosticQuestion[]>(path);
  if (!locale || locale === 'ru') return questions;
  const overlay = await loadTranslationOverlay(locale, 'diagnostic_questions');
  return applyOverlay(questions, overlay, q => q.id);
}

/** Load element groups dictionary. */
export async function loadElementGroups(): Promise<ElementGroupDict> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.element_groups;

  if (!path) {
    throw new Error(
      'Element groups not found in manifest. Expected key "element_groups" in entrypoints.',
    );
  }

  return loadDataFile<ElementGroupDict>(path);
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

/** Load oxidation state theory content. */
export async function loadOxidationTheory(): Promise<OxidationTheory> {
  return loadRule('oxidation_theory') as Promise<OxidationTheory>;
}

/** Load all reactions (concrete reaction cards with ionic equations, observations, kinetics). */
export async function loadReactions(locale?: SupportedLocale): Promise<Reaction[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.reactions;

  if (!path) {
    throw new Error(
      'Reactions not found in manifest. Expected key "reactions" in entrypoints.',
    );
  }

  const reactions = await loadDataFile<Reaction[]>(path);
  if (!locale || locale === 'ru') return reactions;
  const overlay = await loadTranslationOverlay(locale, 'reactions');
  return applyOverlay(reactions, overlay, r => r.reaction_id);
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

/** Load qualitative reaction tests. */
export async function loadQualitativeTests(): Promise<QualitativeTest[]> {
  return loadRule('qualitative_reactions') as Promise<QualitativeTest[]>;
}

/** Load genetic chains. */
export async function loadGeneticChains(): Promise<GeneticChain[]> {
  return loadRule('genetic_chains') as Promise<GeneticChain[]>;
}

/** Load energy & catalyst theory content. */
export async function loadEnergyCatalystTheory(): Promise<EnergyCatalystTheory> {
  return loadRule('energy_catalyst_theory') as Promise<EnergyCatalystTheory>;
}

/** Load calculations data (substances + reactions for calc exercises). */
export async function loadCalculationsData(): Promise<CalculationsData> {
  return loadRule('calculations_data') as Promise<CalculationsData>;
}

/** Load OGE tasks from all variants. */
export async function loadOgeTasks(): Promise<OgeTask[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.oge_tasks;

  if (!path) {
    throw new Error(
      'OGE tasks not found in manifest. Expected key "oge_tasks" in entrypoints.',
    );
  }

  return loadDataFile<OgeTask[]>(path);
}

/** Load OGE solution algorithms (step-by-step methods for each task number). */
export async function loadOgeSolutionAlgorithms(): Promise<OgeSolutionAlgorithm[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.oge_solution_algorithms;

  if (!path) {
    throw new Error(
      'OGE solution algorithms not found in manifest. Expected key "oge_solution_algorithms" in entrypoints.',
    );
  }

  return loadDataFile<OgeSolutionAlgorithm[]>(path);
}

/** Load search index for global search. Supports per-locale indices. */
export async function loadSearchIndex(locale?: SupportedLocale): Promise<SearchIndexEntry[]> {
  const manifest = await getManifest();
  const basePath = manifest.entrypoints.search_index;

  if (!basePath) {
    throw new Error(
      'Search index not found in manifest. Expected key "search_index" in entrypoints.',
    );
  }

  // For non-ru locales, try locale-specific search index first
  if (locale && locale !== 'ru') {
    const localePath = basePath.replace('.json', `.${locale}.json`);
    try {
      return await loadDataFile<SearchIndexEntry[]>(localePath);
    } catch {
      // Fall back to default (Russian) search index
    }
  }

  return loadDataFile<SearchIndexEntry[]>(basePath);
}

/** Load a molecule structure by substance ID. */
export async function loadStructure(id: string): Promise<MoleculeStructure> {
  const manifest = await getManifest();
  const basePath = manifest.entrypoints.structures;

  if (!basePath) {
    throw new Error('Structures not found in manifest. Expected key "structures" in entrypoints.');
  }

  return loadDataFile<MoleculeStructure>(`${basePath}/${id}.json`);
}
