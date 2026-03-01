import type { Manifest } from '../types/manifest';
import type { ContextsData, ChemContext, SubstanceVariant, ChemTerm, TermBinding } from '../types/matter';
import type { Element } from '../types/element';
import type { Ion } from '../types/ion';
import type { Substance } from '../types/substance';
import type { BktParams } from '../types/bkt';
import type { TaskTemplate, ReactionTemplate } from '../types/templates';
import type { DiagnosticQuestion } from '../types/diagnostic';
import type { CompetencyNode } from '../types/competency';
import type { ElementGroupDict, ElementGroupInfo } from '../types/element-group';
import type { PeriodicTableTheory } from '../types/periodic-table-theory';
import type { ClassificationRule, NamingRule, SubstanceIndexEntry } from '../types/classification';
import type { SolubilityEntry, ActivitySeriesEntry, ApplicabilityRule, SolubilityRulesFull } from '../types/rules';
import type { Reaction } from '../types/reaction';
import type { BondTheory, BondExamplesData } from '../types/bond';
import type { OxidationTheory, OxidationExample } from '../types/oxidation';
import type { MoleculeStructure } from '../types/molecule';
import type { QualitativeTest } from '../types/qualitative';
import type { GeneticChain } from '../types/genetic-chain';
import type { EnergyCatalystTheory } from '../types/energy-catalyst';
import type { CalculationsData } from '../types/calculations';
import type { OgeTask } from '../types/oge-task';
import type { OgeSolutionAlgorithm } from '../types/oge-solution';
import type { ExamSystem, ExamSystemMeta } from '../types/exam-system';
import type { SearchIndexEntry } from '../types/search';
import type { UnifiedTopic } from '../types/topic-mapping';
import type { FormulaLookup } from '../types/formula-lookup';
import type { ProcessVocabEntry, EffectsVocabEntry } from '../types/process-vocab';
import type { QuantitiesUnitsOntology } from '../types/quantities-units';
import type { IonNomenclatureRules } from '../types/ion-nomenclature';
import type { SupportedLocale } from '../types/i18n';
import type { NameIndex } from '../types/name-index';
import type { ConceptRegistry, ConceptOverlay, ConceptLookup } from '../types/ontology-ref';
import type { PromptTemplateMap, PropertyDef, MorphologyData } from './task-engine/types';
import type { ReactionRole, ReactionParticipant } from '../types/reaction-participant';

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
 * Returns null if overlay is not available or fetch fails.
 *
 * By default, skips 'ru' locale (base language for most data).
 * Pass `allowRu: true` for data where the base language varies
 * (e.g. exam tasks whose primary locale is en/pl/es).
 */
async function loadTranslationOverlay(
  locale: SupportedLocale,
  dataKey: string,
  allowRu = false,
): Promise<Record<string, Record<string, unknown>> | null> {
  if (locale === 'ru' && !allowRu) return null;

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

/**
 * Merge an overlay array into a base array by matching items on a key field.
 * Used for nested object overlays where sub-arrays need ID-based merging.
 */
function mergeArrayOverlay<T extends Record<string, unknown>>(
  base: T[], over: unknown, keyFn: (item: T) => string,
): T[] {
  if (!Array.isArray(over)) return base;
  const map = new Map<string, Record<string, unknown>>();
  for (const item of over) map.set(keyFn(item as T), item as Record<string, unknown>);
  return base.map(item => {
    const overrides = map.get(keyFn(item));
    return overrides ? { ...item, ...overrides } as T : item;
  });
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
export async function loadIons(locale?: SupportedLocale): Promise<Ion[]> {
  const manifest = await getManifest();
  const ions = await loadDataFile<Ion[]>(manifest.entrypoints.ions);
  if (!locale || locale === 'ru') return ions;
  const overlay = await loadTranslationOverlay(locale, 'ions');
  return applyOverlay(ions, overlay, ion => ion.id);
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

/** Load all task templates (engine templates with template_id, generators, solvers). */
export async function loadTaskTemplates(): Promise<TaskTemplate[]> {
  const manifest = await getManifest();
  const engine = manifest.entrypoints.engine;
  if (!engine) {
    throw new Error('Engine section not found in manifest');
  }
  const path = engine['task_templates' as keyof typeof engine];
  if (!path) {
    throw new Error(
      'Task templates not found in manifest. Expected key "task_templates" in entrypoints.engine.',
    );
  }

  return loadDataFile<TaskTemplate[]>(path);
}

const PROMPT_LOCALE_MAP: Record<string, string> = {
  ru: 'prompt_templates_ru',
  en: 'prompt_templates_en',
  pl: 'prompt_templates_pl',
  es: 'prompt_templates_es',
};

/** Load prompt templates for a given locale. */
export async function loadPromptTemplates(locale: SupportedLocale = 'ru'): Promise<PromptTemplateMap> {
  const manifest = await getManifest();
  const engine = manifest.entrypoints.engine;
  if (!engine) throw new Error('Engine section not found in manifest');
  const key = PROMPT_LOCALE_MAP[locale] ?? PROMPT_LOCALE_MAP['ru'];
  const path = engine[key as keyof typeof engine];
  if (!path) throw new Error(`Prompt templates for locale "${locale}" not found in manifest`);
  return loadDataFile<PromptTemplateMap>(path);
}

/** Load property definitions. */
export async function loadProperties(): Promise<PropertyDef[]> {
  return loadRule('properties') as Promise<PropertyDef[]>;
}

/** Load Russian morphology data. */
export async function loadMorphology(): Promise<MorphologyData | null> {
  try {
    const manifest = await getManifest();
    const available = manifest.translations?.['ru'];
    if (!available?.includes('morphology')) return null;
    return await loadDataFile<MorphologyData>(`translations/ru/morphology.json`);
  } catch {
    return null;
  }
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
export async function loadElementGroups(locale?: SupportedLocale): Promise<ElementGroupDict> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.element_groups;

  if (!path) {
    throw new Error(
      'Element groups not found in manifest. Expected key "element_groups" in entrypoints.',
    );
  }

  const groups = await loadDataFile<ElementGroupDict>(path);
  if (!locale || locale === 'ru') return groups;
  const overlay = await loadTranslationOverlay(locale, 'element_groups');
  if (!overlay) return groups;
  const result: ElementGroupDict = {};
  for (const [key, value] of Object.entries(groups)) {
    const overrides = overlay[key];
    result[key] = overrides ? { ...value, ...overrides } as ElementGroupInfo : value;
  }
  return result;
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
export async function loadPeriodicTableTheory(locale?: SupportedLocale): Promise<PeriodicTableTheory> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.rules['periodic_table_theory'];

  if (!path) {
    throw new Error(
      'Periodic table theory not found in manifest. Expected key "periodic_table_theory" in entrypoints.rules.',
    );
  }

  const data = await loadDataFile<PeriodicTableTheory>(path);
  if (!locale || locale === 'ru') return data;

  const overlay = await loadTranslationOverlay(locale, 'periodic_table_theory');
  if (!overlay) return data;

  return {
    property_trends: data.property_trends.map(trend => {
      const o = overlay[`trend:${trend.id}`] as Record<string, unknown> | undefined;
      if (!o) return trend;
      const oExamples = o.examples as Record<string, unknown>[] | undefined;
      const mergedExamples = trend.examples && oExamples
        ? trend.examples.map((ex, i) => {
            const exO = oExamples[i];
            if (!exO) return ex;
            if (ex.type === 'series' && exO.elements) {
              // Merge element-level overrides (e.g. value_ru for metallic_character)
              const mergedElements = ex.elements.map((el, j) => {
                const elO = (exO.elements as Record<string, unknown>[])?.[j];
                return elO ? { ...el, ...elO } : el;
              });
              return { ...ex, ...exO, elements: mergedElements };
            }
            return { ...ex, ...exO, ...(ex.type === 'series' ? { elements: ex.elements } : {}) };
          })
        : trend.examples;
      const { examples: _ignored, ...rest } = o;
      return { ...trend, ...rest, ...(mergedExamples ? { examples: mergedExamples } : {}) } as typeof trend;
    }),
    exception_consequences: data.exception_consequences.map(exc => {
      const o = overlay[`exception:${exc.id}`];
      return o ? { ...exc, ...o } as typeof exc : exc;
    }),
    general_principle_ru: overlay['principle']
      ? { ...data.general_principle_ru, ...overlay['principle'] } as typeof data.general_principle_ru
      : data.general_principle_ru,
  };
}

/** Load classification rules. */
export async function loadClassificationRules(locale?: SupportedLocale): Promise<ClassificationRule[]> {
  const data = await loadRule('classification_rules') as ClassificationRule[];
  if (!locale || locale === 'ru') return data;
  const overlay = await loadTranslationOverlay(locale, 'classification_rules');
  return applyOverlay(data, overlay, r => r.id);
}

/** Load naming rules. */
export async function loadNamingRules(locale?: SupportedLocale): Promise<NamingRule[]> {
  const data = await loadRule('naming_rules') as NamingRule[];
  if (!locale || locale === 'ru') return data;
  const overlay = await loadTranslationOverlay(locale, 'naming_rules');
  return applyOverlay(data, overlay, r => r.id);
}

/** Load substances index. */
export async function loadSubstancesIndex(locale?: SupportedLocale): Promise<SubstanceIndexEntry[]> {
  const data = await loadIndex('substances_index');
  const substances = (data as { substances: SubstanceIndexEntry[] }).substances;
  if (!locale || locale === 'ru') return substances;
  const overlay = await loadTranslationOverlay(locale, 'substances');
  return applyOverlay(substances, overlay, s => s.id);
}

/** Load solubility rules (unwraps v2 object format). */
export async function loadSolubilityRules(): Promise<SolubilityEntry[]> {
  const raw = await loadRule('solubility_rules_light');
  if (Array.isArray(raw)) return raw as SolubilityEntry[];
  return (raw as { pairs: SolubilityEntry[] }).pairs ?? [];
}

/** Load full solubility rules (23×11 table with rules). */
export async function loadSolubilityRulesFull(): Promise<SolubilityRulesFull> {
  const raw = await loadRule('solubility_rules_full');
  return raw as SolubilityRulesFull;
}

/** Load activity series of metals. */
export async function loadActivitySeries(locale?: SupportedLocale): Promise<ActivitySeriesEntry[]> {
  const data = await loadRule('activity_series') as ActivitySeriesEntry[];
  if (!locale || locale === 'ru') return data;
  const overlay = await loadTranslationOverlay(locale, 'activity_series');
  return applyOverlay(data, overlay, e => e.symbol);
}

/** Load applicability rules. */
export async function loadApplicabilityRules(locale?: SupportedLocale): Promise<ApplicabilityRule[]> {
  const data = await loadRule('applicability_rules') as ApplicabilityRule[];
  if (!locale || locale === 'ru') return data;
  const overlay = await loadTranslationOverlay(locale, 'applicability_rules');
  return applyOverlay(data, overlay, r => r.id);
}

/** Load bond theory content (bond types + crystal structures). */
export async function loadBondTheory(locale?: SupportedLocale): Promise<BondTheory> {
  const data = (await loadRule('bond_theory')) as BondTheory;
  if (!locale || locale === 'ru') return data;
  const overlay = await loadTranslationOverlay(locale, 'bond_theory');
  if (!overlay) return data;
  // overlay keys: "bond:{id}" for bond_types, "crystal:{id}" for crystal_structures
  return {
    bond_types: data.bond_types.map(bt => {
      const o = overlay[`bond:${bt.id}`];
      return o ? { ...bt, ...o } as typeof bt : bt;
    }),
    crystal_structures: data.crystal_structures.map(cs => {
      const o = overlay[`crystal:${cs.id}`];
      if (!o) return cs;
      const { properties: pOverride, ...rest } = o as Record<string, unknown> & { properties?: Record<string, string> };
      return {
        ...cs,
        ...rest,
        ...(pOverride ? { properties: { ...cs.properties, ...pOverride } } : {}),
      } as typeof cs;
    }),
  };
}

/** Load bond examples (substance-to-bond/crystal mapping for exercises). */
export async function loadBondExamples(): Promise<BondExamplesData> {
  return loadRule('bond_examples') as Promise<BondExamplesData>;
}

/** Load oxidation state theory content. */
export async function loadOxidationTheory(locale?: SupportedLocale): Promise<OxidationTheory> {
  const data = await loadRule('oxidation_theory') as OxidationTheory;
  if (!locale || locale === 'ru') return data;
  const overlay = await loadTranslationOverlay(locale, 'oxidation_theory');
  if (!overlay) return data;
  return {
    rules: applyOverlay(data.rules, overlay, r => r.id),
    redox_concepts: overlay['_redox']
      ? { ...data.redox_concepts, ...(overlay['_redox'] as object) } as typeof data.redox_concepts
      : data.redox_concepts,
  };
}

/** Load oxidation state examples (formula + target element + expected state). */
export async function loadOxidationExamples(): Promise<OxidationExample[]> {
  return loadRule('oxidation_examples') as Promise<OxidationExample[]>;
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

/** Load reaction role definitions. */
export async function loadReactionRoles(locale?: SupportedLocale): Promise<ReactionRole[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.reaction_roles;
  if (!path) throw new Error('reaction_roles not found in manifest');
  const roles = await loadDataFile<ReactionRole[]>(path);
  if (!locale || locale === 'ru') return roles;
  const overlay = await loadTranslationOverlay(locale, 'reaction_roles');
  return applyOverlay(roles, overlay, r => r.id);
}

/** Load build-time derived reaction participants. */
export async function loadReactionParticipants(): Promise<ReactionParticipant[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.reaction_participants;
  if (!path) throw new Error('reaction_participants not found in manifest');
  return loadDataFile<ReactionParticipant[]>(path);
}

/** Load all reaction templates. */
export async function loadReactionTemplates(locale?: SupportedLocale): Promise<ReactionTemplate[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.templates['reaction_templates'];

  if (!path) {
    throw new Error(
      'Reaction templates not found in manifest. Expected key "reaction_templates" in entrypoints.templates.',
    );
  }

  const templates = await loadDataFile<ReactionTemplate[]>(path);
  if (!locale || locale === 'ru') return templates;
  const overlay = await loadTranslationOverlay(locale, 'reaction_templates');
  return applyOverlay(templates, overlay, t => t.id);
}

/** Load qualitative reaction tests. */
export async function loadQualitativeTests(locale?: SupportedLocale): Promise<QualitativeTest[]> {
  const data = await loadRule('qualitative_reactions') as QualitativeTest[];
  if (!locale || locale === 'ru') return data;
  const overlay = await loadTranslationOverlay(locale, 'qualitative_reactions');
  return applyOverlay(data, overlay, t => t.target_id);
}

/** Load genetic chains. */
export async function loadGeneticChains(locale?: SupportedLocale): Promise<GeneticChain[]> {
  const data = await loadRule('genetic_chains') as GeneticChain[];
  if (!locale || locale === 'ru') return data;
  const overlay = await loadTranslationOverlay(locale, 'genetic_chains');
  return applyOverlay(data, overlay, c => c.chain_id);
}

/** Load energy & catalyst theory content. */
export async function loadEnergyCatalystTheory(locale?: SupportedLocale): Promise<EnergyCatalystTheory> {
  const data = await loadRule('energy_catalyst_theory') as EnergyCatalystTheory;
  if (!locale || locale === 'ru') return data;
  const overlay = await loadTranslationOverlay(locale, 'energy_catalyst_theory');
  if (!overlay) return data;
  const o = overlay as unknown as Partial<Record<string, unknown>>;
  return {
    rate_factors: mergeArrayOverlay(data.rate_factors, o['rate_factors'], f => f.factor_id),
    catalyst_properties: o['catalyst_properties']
      ? { ...data.catalyst_properties, ...(o['catalyst_properties'] as object) } as typeof data.catalyst_properties
      : data.catalyst_properties,
    common_catalysts: mergeArrayOverlay(data.common_catalysts, o['common_catalysts'], c => c.catalyst),
    equilibrium_shifts: mergeArrayOverlay(data.equilibrium_shifts, o['equilibrium_shifts'], s => s.factor),
    heat_classification: o['heat_classification']
      ? { ...data.heat_classification, ...(o['heat_classification'] as object) } as typeof data.heat_classification
      : data.heat_classification,
  };
}

/** Load calculations data (substances + reactions for calc exercises). */
export async function loadCalculationsData(locale?: SupportedLocale): Promise<CalculationsData> {
  const data = await loadRule('calculations_data') as CalculationsData;
  if (!locale || locale === 'ru') return data;
  const overlay = await loadTranslationOverlay(locale, 'calculations_data');
  if (!overlay) return data;
  const o = overlay as unknown as Partial<Record<string, unknown>>;
  return {
    calc_substances: mergeArrayOverlay(data.calc_substances, o['calc_substances'], s => s.formula),
    calc_reactions: mergeArrayOverlay(data.calc_reactions, o['calc_reactions'], r => r.equation_ru),
  };
}

/** Load ion nomenclature rules (suffix derivation system). */
export async function loadIonNomenclature(locale?: SupportedLocale): Promise<IonNomenclatureRules> {
  const data = await loadRule('ion_nomenclature') as IonNomenclatureRules;
  if (!locale || locale === 'ru') return data;
  const overlay = await loadTranslationOverlay(locale, 'ion_nomenclature');
  if (!overlay) return data;
  const o = overlay as unknown as Partial<Record<string, unknown>>;
  return {
    suffix_rules: mergeArrayOverlay(data.suffix_rules, o['suffix_rules'], r => r.id),
    acid_to_anion_pairs: mergeArrayOverlay(data.acid_to_anion_pairs, o['acid_to_anion_pairs'], p => p.acid),
    multilingual_comparison: o['multilingual_comparison']
      ? { ...data.multilingual_comparison, ...(o['multilingual_comparison'] as object) } as typeof data.multilingual_comparison
      : data.multilingual_comparison,
    mnemonic_ru: typeof o['mnemonic_ru'] === 'string' ? o['mnemonic_ru'] : data.mnemonic_ru,
  };
}

/** Primary locale for each exam system (avoids loading systems.json just for this). */
const EXAM_PRIMARY_LOCALE: Record<string, SupportedLocale> = {
  oge: 'ru', ege: 'ru', gcse: 'en', egzamin: 'pl', ebau: 'es',
};

/** Load OGE tasks from all variants. */
export async function loadOgeTasks(locale?: SupportedLocale): Promise<OgeTask[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.oge_tasks;

  if (!path) {
    throw new Error(
      'OGE tasks not found in manifest. Expected key "oge_tasks" in entrypoints.',
    );
  }

  const tasks = await loadDataFile<OgeTask[]>(path);
  if (!locale || locale === 'ru') return tasks;
  const overlay = await loadTranslationOverlay(locale, 'oge_tasks');
  return applyOverlay(tasks, overlay, t => t.task_id);
}

/** Load OGE solution algorithms (step-by-step methods for each task number). */
export async function loadOgeSolutionAlgorithms(locale?: SupportedLocale): Promise<OgeSolutionAlgorithm[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.oge_solution_algorithms;

  if (!path) {
    throw new Error(
      'OGE solution algorithms not found in manifest. Expected key "oge_solution_algorithms" in entrypoints.',
    );
  }

  const algos = await loadDataFile<OgeSolutionAlgorithm[]>(path);
  if (!locale || locale === 'ru') return algos;
  const overlay = await loadTranslationOverlay(locale, 'oge_algorithms');
  return applyOverlay(algos, overlay, a => String(a.task_number));
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

/** Load all exam systems from registry. */
export async function loadExamSystems(): Promise<ExamSystem[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.exam_systems;

  if (!path) {
    throw new Error(
      'Exam systems not found in manifest. Expected key "exam_systems" in entrypoints.',
    );
  }

  return loadDataFile<ExamSystem[]>(path);
}

/** Load metadata for a specific exam system. */
export async function loadExamSystemMeta(systemId: string): Promise<ExamSystemMeta> {
  return loadDataFile<ExamSystemMeta>(`exam/${systemId}/meta.json`);
}

/** Load tasks for a specific exam system. */
export async function loadExamTasks(systemId: string, locale?: SupportedLocale): Promise<OgeTask[]> {
  const tasks = await loadDataFile<OgeTask[]>(`exam/${systemId}/tasks.json`);
  const primaryLocale = EXAM_PRIMARY_LOCALE[systemId] ?? 'ru';
  if (!locale || locale === primaryLocale) return tasks;
  const overlay = await loadTranslationOverlay(locale, `${systemId}_tasks`, true);
  return applyOverlay(tasks, overlay, t => t.task_id);
}

/** Load solution algorithms for a specific exam system. */
export async function loadExamAlgorithms(systemId: string, locale?: SupportedLocale): Promise<OgeSolutionAlgorithm[]> {
  const algos = await loadDataFile<OgeSolutionAlgorithm[]>(`exam/${systemId}/algorithms.json`);
  const primaryLocale = EXAM_PRIMARY_LOCALE[systemId] ?? 'ru';
  if (!locale || locale === primaryLocale) return algos;
  const overlay = await loadTranslationOverlay(locale, `${systemId}_algorithms`, true);
  return applyOverlay(algos, overlay, a => String(a.task_number));
}

/** Load unified topic mapping (cross-exam competency map). */
export async function loadTopicMapping(): Promise<UnifiedTopic[]> {
  return loadRule('topic_mapping') as Promise<UnifiedTopic[]>;
}

/** Load formula lookup (display formula → substance/element info). */
export async function loadFormulaLookup(): Promise<FormulaLookup> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.formula_lookup;

  if (!path) {
    throw new Error(
      'Formula lookup not found in manifest. Expected key "formula_lookup" in entrypoints.',
    );
  }

  return loadDataFile<FormulaLookup>(path);
}

/** Load process vocabulary (lab operations, reaction types, constraints). */
export async function loadProcessVocab(locale?: SupportedLocale): Promise<ProcessVocabEntry[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.process_vocab;

  if (!path) {
    throw new Error(
      'Process vocab not found in manifest. Expected key "process_vocab" in entrypoints.',
    );
  }

  const data = await loadDataFile<ProcessVocabEntry[]>(path);
  if (!locale || locale === 'ru') return data;
  const overlay = await loadTranslationOverlay(locale, 'process_vocab');
  return overlay ? applyOverlay(data, overlay, item => item.id) : data;
}

/** Load effects vocabulary (kinetic, thermodynamic, mass_transfer, phase effects). */
export async function loadEffectsVocab(locale?: SupportedLocale): Promise<EffectsVocabEntry[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.effects_vocab;

  if (!path) {
    throw new Error(
      'Effects vocab not found in manifest. Expected key "effects_vocab" in entrypoints.',
    );
  }

  const data = await loadDataFile<EffectsVocabEntry[]>(path);
  if (!locale || locale === 'ru') return data;
  const overlay = await loadTranslationOverlay(locale, 'effects_vocab');
  return overlay ? applyOverlay(data, overlay, item => item.id) : data;
}

/** Load quantities & units ontology. */
export async function loadQuantitiesUnits(): Promise<QuantitiesUnitsOntology> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.quantities_units;

  if (!path) {
    throw new Error(
      'Quantities/units ontology not found in manifest. Expected key "quantities_units" in entrypoints.',
    );
  }

  return loadDataFile<QuantitiesUnitsOntology>(path);
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

/** Load contexts layer data (contexts, variants, terms, bindings, reverse index). */
export async function loadContextsData(locale?: SupportedLocale): Promise<ContextsData> {
  const manifest = await getManifest();
  const ep = manifest.entrypoints.contexts;
  if (!ep) throw new Error('Contexts not found in manifest');

  const [contexts, variants, terms, bindings, reverseIndex] = await Promise.all([
    loadDataFile<ChemContext[]>(ep.contexts),
    loadDataFile<SubstanceVariant[]>(ep.substance_variants),
    loadDataFile<ChemTerm[]>(ep.terms),
    loadDataFile<TermBinding[]>(ep.term_bindings),
    loadDataFile<Record<string, string[]>>(ep.reverse_index),
  ]);

  if (!locale || locale === 'ru') {
    return { contexts, variants, terms, bindings, reverse_index: reverseIndex };
  }
  const overlay = await loadTranslationOverlay(locale, 'terms');
  return {
    contexts,
    variants,
    bindings,
    terms: applyOverlay(terms, overlay, t => t.id),
    reverse_index: reverseIndex,
  };
}

/** Load per-locale name→entity reverse index. */
export async function loadNameIndex(locale?: SupportedLocale): Promise<NameIndex> {
  const manifest = await getManifest();
  const basePath = manifest.entrypoints.name_index;

  if (!basePath) {
    throw new Error(
      'Name index not found in manifest. Expected key "name_index" in entrypoints.',
    );
  }

  const loc = locale ?? 'ru';
  const localePath = basePath.replace('.json', `.${loc}.json`);
  return loadDataFile<NameIndex>(localePath);
}

/** Load concept registry (structural data, no locale text). */
export async function loadConcepts(): Promise<ConceptRegistry> {
  return loadDataFile<ConceptRegistry>('concepts.json');
}

/** Load concept locale overlay (names, slugs, surface_forms, grammatical forms). */
export async function loadConceptOverlay(locale: SupportedLocale): Promise<ConceptOverlay | null> {
  const overlay = await loadTranslationOverlay(locale, 'concepts', true);
  return overlay as ConceptOverlay | null;
}

/** Load concept lookup for text auto-detection (surface form → concept ID). */
export async function loadConceptLookup(locale: SupportedLocale): Promise<ConceptLookup> {
  return loadDataFile<ConceptLookup>(`concept_lookup.${locale}.json`);
}

// ---------------------------------------------------------------------------
// Theory modules & courses
// ---------------------------------------------------------------------------

import type { TheoryModule, Course } from '../types/theory-module';

/** Load a theory module by its filename key (e.g. 'classification_inorganic'). */
export async function loadTheoryModule(moduleKey: string): Promise<TheoryModule> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.theory_modules?.[moduleKey];
  if (!path) {
    throw new Error(`Theory module "${moduleKey}" not found in manifest`);
  }
  return loadDataFile<TheoryModule>(path);
}

/** Load a theory module overlay for a given locale. */
export async function loadTheoryModuleOverlay(
  moduleKey: string,
  locale: SupportedLocale,
): Promise<Record<string, unknown> | null> {
  return loadTranslationOverlay(locale, `theory_modules/${moduleKey}`, false);
}

/** Load a course by its filename key. */
export async function loadCourse(courseKey: string): Promise<Course> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.courses?.[courseKey];
  if (!path) {
    throw new Error(`Course "${courseKey}" not found in manifest`);
  }
  return loadDataFile<Course>(path);
}
