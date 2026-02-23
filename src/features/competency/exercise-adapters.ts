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
      const [{ generateExercise }, { loadElements }] = await Promise.all([
        import('../bonds/practice/generate-exercises'),
        import('../../lib/data-loader'),
      ]);
      const elements = await loadElements(locale);
      return { generate: () => generateExercise(elements) };
    }

    case 'oxidation-states': {
      const [{ generateExercise }, { loadElements }] = await Promise.all([
        import('../oxidation-states/practice/generate-exercises'),
        import('../../lib/data-loader'),
      ]);
      const elements = await loadElements(locale);
      return { generate: () => generateExercise(elements) };
    }

    case 'substances': {
      const [{ generateExercise }, dl] = await Promise.all([
        import('../substances/practice/generate-exercises'),
        import('../../lib/data-loader'),
      ]);
      const [substances, classRules, namingRules] = await Promise.all([
        dl.loadSubstancesIndex(locale),
        dl.loadClassificationRules(),
        dl.loadNamingRules(),
      ]);
      return { generate: () => generateExercise(substances, classRules, namingRules) };
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
