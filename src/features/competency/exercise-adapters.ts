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
  format: 'multiple_choice' | 'multiple_choice_multi' | 'match_pairs' | 'interactive_orbital' | 'guided_selection';
  options: ExerciseOption[];
  correctId: string;
  correctIds?: string[];
  pairs?: Array<{ left: string; right: string }>;
  targetZ?: number;
  context?: { chain: string[]; gapIndex: number };
  explanation: string;
  competencyMap: Record<string, 'P' | 'S'>;
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
  // ── Periodic table & electron config ──
  periodic_trends: [
    'tmpl.pt.compare_property.v1', 'tmpl.pt.order_by_property.v1',
    'tmpl.bond.delta_chi.v1',
  ],
  periodic_table: [
    'tmpl.pt.compare_property.v1', 'tmpl.pt.order_by_property.v1',
    'tmpl.pt.find_period.v1', 'tmpl.pt.find_group.v1',
    'tmpl.pt.select_electron_config.v1', 'tmpl.pt.count_valence.v1',
    'tmpl.pt.element_from_config.v1',
  ],
  electron_config: [
    'tmpl.pt.select_electron_config.v1', 'tmpl.pt.count_valence.v1',
    'tmpl.pt.element_from_config.v1', 'tmpl.pt.fill_orbital.v1',
  ],
  // ── Oxidation states ──
  oxidation_states: [
    'tmpl.ox.determine_state.v1', 'tmpl.ox.max_state.v1',
    'tmpl.ox.min_state.v1', 'tmpl.ox.select_by_state.v1',
  ],
  // ── Bonds & crystal structure ──
  bond_type: [
    'tmpl.bond.identify_type.v1', 'tmpl.bond.select_by_type.v1',
    'tmpl.bond.delta_chi.v1', 'tmpl.bond.predict_property.v1',
  ],
  crystal_structure_type: [
    'tmpl.bond.identify_crystal.v1', 'tmpl.bond.compare_melting.v1',
    'tmpl.bond.predict_property.v1',
  ],
  // ── Substances & classification ──
  classification: [
    'tmpl.class.classify.v1', 'tmpl.class.select_by_class.v1',
    'tmpl.class.classify_subclass.v1', 'tmpl.class.identify_by_description.v1',
    'tmpl.sub.identify_amphoteric.v1', 'tmpl.sub.formula_to_name.v1',
    'tmpl.sub.name_to_formula.v1', 'tmpl.ion.compose_salt.v1',
    'tmpl.ion.acid_to_anion.v1', 'tmpl.ion.anion_to_acid.v1',
  ],
  naming: [
    'tmpl.ion.compose_salt.v1', 'tmpl.sub.formula_to_name.v1',
    'tmpl.sub.name_to_formula.v1', 'tmpl.sub.naming_rule.v1',
    'tmpl.ion.formula_to_name.v1', 'tmpl.ion.name_to_formula.v1',
    'tmpl.ion.suffix_rule.v1', 'tmpl.ion.acid_to_anion.v1',
    'tmpl.ion.anion_to_acid.v1', 'tmpl.ion.ate_ite_pair.v1',
    'tmpl.ion.ox_state_to_suffix.v1', 'tmpl.ion.classify_suffix_type.v1',
  ],
  amphoterism_logic: [
    'tmpl.sub.identify_amphoteric.v1', 'tmpl.sub.amphoteric_partner.v1',
  ],
  ion_nomenclature: [
    'tmpl.ion.formula_to_name.v1', 'tmpl.ion.name_to_formula.v1',
    'tmpl.ion.suffix_rule.v1', 'tmpl.ion.acid_to_anion.v1',
    'tmpl.ion.anion_to_acid.v1', 'tmpl.ion.ate_ite_pair.v1',
    'tmpl.ion.ox_state_to_suffix.v1', 'tmpl.ion.classify_suffix_type.v1',
  ],
  // ── Reactions ──
  reactions_exchange: [
    'tmpl.rxn.identify_type.v1', 'tmpl.rxn.predict_exchange.v1',
    'tmpl.rxn.driving_force.v1', 'tmpl.rxn.will_occur.v1',
    'tmpl.rxn.predict_substitution.v1', 'tmpl.rxn.activity_compare.v1',
    'tmpl.rxn.will_metal_react.v1',
  ],
  gas_precipitate_logic: [
    'tmpl.sol.check_pair.v1', 'tmpl.rxn.driving_force.v1',
    'tmpl.rxn.will_occur.v1',
  ],
  reactions_redox: ['tmpl.rxn.identify_oxidizer.v1'],
  genetic_chain_logic: ['tmpl.chain.complete_step.v1', 'tmpl.chain.choose_reagent.v1'],
  qualitative_analysis_logic: ['tmpl.qual.identify_reagent.v1', 'tmpl.qual.identify_ion.v1'],
  electrolyte_logic: ['tmpl.rxn.match_ionic.v1', 'tmpl.rxn.spectator_ions.v1'],
  reaction_energy_profile: [
    'tmpl.rxn.factors_rate.v1', 'tmpl.rxn.exo_endo.v1',
    'tmpl.rxn.equilibrium_shift.v1',
  ],
  catalyst_role_understanding: ['tmpl.rxn.catalyst_props.v1', 'tmpl.rxn.identify_catalyst.v1'],
  // ── Calculations ──
  calculations_basic: [
    'tmpl.calc.molar_mass.v1', 'tmpl.calc.mass_fraction.v1',
    'tmpl.calc.amount.v1', 'tmpl.calc.mass_from_moles.v1',
  ],
  calculations_solutions: [
    'tmpl.calc.concentration.v1', 'tmpl.calc.solute_mass.v1',
    'tmpl.calc.dilution.v1',
  ],
  reaction_yield_logic: ['tmpl.calc.by_equation.v1', 'tmpl.calc.yield.v1'],
};

/** Load all data and create a task engine instance. */
export async function buildEngine(locale?: SupportedLocale) {
  const [{ createTaskEngine }, dl] = await Promise.all([
    import('../../lib/task-engine'),
    import('../../lib/data-loader'),
  ]);

  const [
    elements, ions, properties, solubilityPairs, oxidationExamples,
    promptTemplates, morphology, templates, bondExamples, substanceIndex, reactions,
    activitySeries, classificationRules, namingRules, qualitativeTests,
    energyCatalystTheory, geneticChains, calculationsData, ionNomenclature,
  ] = await Promise.all([
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
    dl.loadActivitySeries().catch(() => []),
    dl.loadClassificationRules().catch(() => []),
    dl.loadNamingRules().catch(() => []),
    dl.loadQualitativeTests().catch(() => []),
    dl.loadEnergyCatalystTheory().catch(() => null),
    dl.loadGeneticChains().catch(() => []),
    dl.loadCalculationsData().catch(() => null),
    dl.loadIonNomenclature().catch(() => null),
  ]);

  const ontology = {
    core: { elements, ions, properties },
    rules: {
      solubilityPairs, oxidationExamples, bondExamples,
      activitySeries, classificationRules, namingRules,
      qualitativeTests, energyCatalyst: energyCatalystTheory,
      ionNomenclature: ionNomenclature ?? undefined,
    },
    data: {
      substances: substanceIndex, reactions, geneticChains,
      calculations: calculationsData ?? undefined,
    },
    i18n: { morphology, promptTemplates },
  };

  return createTaskEngine(templates, ontology);
}

/**
 * Load an engine-based exercise adapter for a competency.
 * Returns null if no engine templates are available for this competency.
 */
export async function loadEngineAdapter(competencyId: string, locale?: SupportedLocale): Promise<Adapter | null> {
  if (!ENGINE_COMPETENCY_MAP[competencyId]) return null;

  const engine = await buildEngine(locale);

  return {
    generate: () => {
      const task = engine.generateForCompetency(competencyId);
      if (!task) throw new Error(`No engine template for competency: ${competencyId}`);
      return engine.toExercise(task);
    },
  };
}

/**
 * Load an engine-based adapter that generates exercises for any competency
 * in the given set. Picks a random competency on each generate() call.
 */
export async function loadFeatureAdapter(
  competencyIds: string[],
  locale?: SupportedLocale,
): Promise<Adapter> {
  const engine = await buildEngine(locale);

  return {
    generate: () => {
      const compId = competencyIds[Math.floor(Math.random() * competencyIds.length)];
      const task = engine.generateForCompetency(compId);
      if (!task) throw new Error(`No engine template for competency: ${compId}`);
      return engine.toExercise(task);
    },
  };
}
