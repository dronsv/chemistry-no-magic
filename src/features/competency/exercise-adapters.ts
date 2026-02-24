import type { SupportedLocale } from '../../types/i18n';

/** Maps each competency ID to its feature directory name. */
const COMPETENCY_FEATURE: Record<string, string> = {
  periodic_table: 'periodic-table',
  electron_config: 'periodic-table',
  periodic_trends: 'periodic-table',
  oxidation_states: 'oxidation-states',
  bond_type: 'bonds',
  crystal_structure_type: 'bonds',
  classification: 'substances',
  naming: 'substances',
  amphoterism_logic: 'substances',
  reactions_exchange: 'reactions',
  gas_precipitate_logic: 'reactions',
  reactions_redox: 'reactions',
  genetic_chain_logic: 'reactions',
  qualitative_analysis_logic: 'reactions',
  electrolyte_logic: 'reactions',
  reaction_energy_profile: 'reactions',
  catalyst_role_understanding: 'reactions',
  calculations_basic: 'calculations',
  calculations_solutions: 'calculations',
  reaction_yield_logic: 'calculations',
  ion_nomenclature: 'ions',
};

export interface ExerciseOption {
  id: string;
  text: string;
}

export interface Exercise {
  type: string;
  question: string;
  format: 'multiple_choice' | 'interactive_orbital';
  options: ExerciseOption[];
  correctId: string;
  explanation: string;
  competencyMap: Record<string, 'P' | 'S'>;
  targetZ?: number;
}

export interface Adapter {
  generate: () => Exercise;
}

export function getFeature(competencyId: string): string | undefined {
  return COMPETENCY_FEATURE[competencyId];
}

export async function loadAdapter(competencyId: string, locale?: SupportedLocale): Promise<Adapter> {
  const feature = COMPETENCY_FEATURE[competencyId];
  if (!feature) throw new Error(`No adapter for competency: ${competencyId}`);

  switch (feature) {
    case 'periodic-table': {
      const [{ generateExercise }, { loadElements }] = await Promise.all([
        import('../periodic-table/practice/generate-exercises'),
        import('../../lib/data-loader'),
      ]);
      const elements = await loadElements(locale);
      return { generate: () => generateExercise(elements) };
    }

    case 'bonds': {
      const [{ generateExercise }, dl] = await Promise.all([
        import('../bonds/practice/generate-exercises'),
        import('../../lib/data-loader'),
      ]);
      const [elements, bondExamples] = await Promise.all([
        dl.loadElements(locale),
        dl.loadBondExamples(),
      ]);
      return { generate: () => generateExercise(elements, bondExamples) };
    }

    case 'oxidation-states': {
      const [{ generateExercise }, dl] = await Promise.all([
        import('../oxidation-states/practice/generate-exercises'),
        import('../../lib/data-loader'),
      ]);
      const [elements, oxidationExamples] = await Promise.all([
        dl.loadElements(locale),
        dl.loadOxidationExamples(),
      ]);
      return { generate: () => generateExercise({ elements, oxidationExamples }) };
    }

    case 'substances': {
      const [{ generateExercise }, dl] = await Promise.all([
        import('../substances/practice/generate-exercises'),
        import('../../lib/data-loader'),
      ]);
      const [substances, classRules, namingRules, elements] = await Promise.all([
        dl.loadSubstancesIndex(locale),
        dl.loadClassificationRules(),
        dl.loadNamingRules(),
        dl.loadElements(locale),
      ]);
      return { generate: () => generateExercise(substances, classRules, namingRules, elements) };
    }

    case 'reactions': {
      const [{ generateExercise }, dl] = await Promise.all([
        import('../reactions/practice/generate-exercises'),
        import('../../lib/data-loader'),
      ]);
      const [templates, solubility, activitySeries, applicabilityRules, reactions, qualitativeTests, geneticChains, energyCatalystTheory] = await Promise.all([
        dl.loadReactionTemplates(),
        dl.loadSolubilityRules(),
        dl.loadActivitySeries(),
        dl.loadApplicabilityRules(),
        dl.loadReactions(),
        dl.loadQualitativeTests(),
        dl.loadGeneticChains(),
        dl.loadEnergyCatalystTheory(),
      ]);
      return {
        generate: () => generateExercise({
          templates, solubility, activitySeries, applicabilityRules,
          reactions, qualitativeTests, geneticChains, energyCatalystTheory,
        }),
      };
    }

    case 'calculations': {
      const [{ generateExercise }, { loadCalculationsData }] = await Promise.all([
        import('../calculations/practice/generate-exercises'),
        import('../../lib/data-loader'),
      ]);
      const data = await loadCalculationsData();
      return { generate: () => generateExercise({ data }) };
    }

    case 'ions': {
      const [{ generateExercise }, dl] = await Promise.all([
        import('../ions/practice/generate-exercises'),
        import('../../lib/data-loader'),
      ]);
      const [ions, nomenclatureRules] = await Promise.all([
        dl.loadIons(locale),
        dl.loadIonNomenclature(),
      ]);
      return { generate: () => generateExercise({ ions, nomenclatureRules }) };
    }

    default:
      throw new Error(`Unknown feature: ${feature}`);
  }
}

/** Competency IDs that the generative engine can serve. */
const ENGINE_COMPETENCY_MAP: Record<string, string[]> = {
  // Phase 1
  periodic_trends: ['tmpl.pt.compare_property.v1', 'tmpl.pt.order_by_property.v1'],
  periodic_table: [
    'tmpl.pt.compare_property.v1', 'tmpl.pt.order_by_property.v1',
    'tmpl.pt.find_period.v1', 'tmpl.pt.find_group.v1',
  ],
  oxidation_states: ['tmpl.ox.determine_state.v1', 'tmpl.ox.max_state.v1'],
  naming: ['tmpl.ion.compose_salt.v1'],
  gas_precipitate_logic: ['tmpl.sol.check_pair.v1'],
  // Phase 2
  bond_type: ['tmpl.bond.identify_type.v1', 'tmpl.bond.select_by_type.v1'],
  crystal_structure_type: ['tmpl.bond.identify_crystal.v1', 'tmpl.bond.compare_melting.v1'],
  classification: ['tmpl.class.classify.v1', 'tmpl.class.select_by_class.v1'],
  reactions_exchange: ['tmpl.rxn.identify_type.v1'],
};

/**
 * Load an engine-based exercise adapter for a competency.
 * Returns null if no engine templates are available for this competency.
 * This is a parallel alternative to `loadAdapter` — not a replacement.
 */
export async function loadEngineAdapter(competencyId: string, locale?: SupportedLocale): Promise<Adapter | null> {
  if (!ENGINE_COMPETENCY_MAP[competencyId]) return null;

  const [{ createTaskEngine }, dl] = await Promise.all([
    import('../../lib/task-engine'),
    import('../../lib/data-loader'),
  ]);

  const [elements, ions, properties, solubilityPairs, oxidationExamples, promptTemplates, morphology, templates, bondExamples, substanceIndex, reactions] = await Promise.all([
    dl.loadElements(locale),
    dl.loadIons(locale),
    dl.loadProperties(),
    dl.loadSolubilityRules(),
    dl.loadOxidationExamples(),
    dl.loadPromptTemplates(locale ?? 'ru'),
    locale === 'ru' || !locale ? dl.loadMorphology() : Promise.resolve(null),
    dl.loadTaskTemplates(),
    dl.loadBondExamples(),
    dl.loadSubstancesIndex(locale),
    dl.loadReactions(),
  ]);

  const ontology = {
    elements, ions, properties, solubilityPairs, oxidationExamples,
    morphology, promptTemplates, bondExamples, substanceIndex, reactions,
  };

  const engine = createTaskEngine(templates, ontology);

  return {
    generate: () => {
      const task = engine.generateForCompetency(competencyId);
      if (!task) throw new Error(`No engine template for competency: ${competencyId}`);
      return engine.toExercise(task);
    },
  };
}
