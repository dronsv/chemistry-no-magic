import type { Element } from '../../types/element';
import type { ClassificationRule, NamingRule, SubstanceIndexEntry } from '../../types/classification';
import type { ReactionTemplate } from '../../types/templates';
import type { SolubilityEntry, ActivitySeriesEntry, ApplicabilityRule } from '../../types/rules';
import type { Reaction } from '../../types/reaction';
import type { QualitativeTest } from '../../types/qualitative';
import type { GeneticChain } from '../../types/genetic-chain';
import type { EnergyCatalystTheory } from '../../types/energy-catalyst';
import type { CalculationsData } from '../../types/calculations';
import type { ExamExercise, ExamVariant } from '../../types/exam';

import { generateExercise as genPeriodicTable } from '../periodic-table/practice/generate-exercises';
import { generateExercise as genBonds } from '../bonds/practice/generate-exercises';
import { generateExercise as genOxidation } from '../oxidation-states/practice/generate-exercises';
import { generateExercise as genSubstances } from '../substances/practice/generate-exercises';
import { generateExercise as genReactions } from '../reactions/practice/generate-exercises';
import type { GeneratorContext as ReactionsCtx } from '../reactions/practice/generate-exercises';
import { generateExercise as genCalculations } from '../calculations/practice/generate-exercises';
import type { GeneratorContext as CalcCtx } from '../calculations/practice/generate-exercises';

/** All data required to generate an exam variant. */
export interface ExamData {
  elements: Element[];
  substances: SubstanceIndexEntry[];
  classificationRules: ClassificationRule[];
  namingRules: NamingRule[];
  reactionTemplates: ReactionTemplate[];
  solubility: SolubilityEntry[];
  activitySeries: ActivitySeriesEntry[];
  applicabilityRules: ApplicabilityRule[];
  reactions: Reaction[];
  qualitativeTests: QualitativeTest[];
  geneticChains: GeneticChain[];
  energyCatalystTheory: EnergyCatalystTheory | null;
  calculationsData: CalculationsData;
}

/**
 * Mapping: competency ID → which module/type combos can generate it as primary.
 * The generator picks one exercise type per competency for a balanced variant.
 */
const COMPETENCY_SOURCES: Record<string, { module: string; types: string[] }[]> = {
  periodic_table: [
    { module: 'periodic-table', types: ['find_period_group'] },
  ],
  electron_config: [
    { module: 'periodic-table', types: ['select_electron_config', 'count_valence', 'identify_exception', 'element_from_config'] },
  ],
  periodic_trends: [
    { module: 'periodic-table', types: ['compare_electronegativity'] },
    { module: 'bonds', types: ['compare_melting_points'] },
  ],
  oxidation_states: [
    { module: 'oxidation-states', types: ['determine_ox_state', 'select_compound_by_ox_state', 'max_min_ox_state'] },
  ],
  bond_type: [
    { module: 'bonds', types: ['identify_bond_type', 'select_substance_by_bond', 'bond_from_delta_chi'] },
  ],
  crystal_structure_type: [
    { module: 'bonds', types: ['identify_crystal_structure', 'predict_property_by_structure'] },
  ],
  classification: [
    { module: 'substances', types: ['classify_by_formula', 'classify_subclass', 'identify_class_by_description'] },
  ],
  naming: [
    { module: 'substances', types: ['formula_to_name', 'name_to_formula', 'naming_rule_template'] },
  ],
  amphoterism_logic: [
    { module: 'substances', types: ['identify_amphoteric', 'amphoteric_reaction_partner', 'amphoteric_elements'] },
  ],
  reactions_exchange: [
    { module: 'reactions', types: ['classify_reaction_type', 'predict_exchange_products', 'will_reaction_occur'] },
  ],
  gas_precipitate_logic: [
    { module: 'reactions', types: ['identify_driving_force', 'solubility_lookup', 'predict_observation'] },
  ],
  reactions_redox: [
    { module: 'reactions', types: ['identify_oxidizer_reducer', 'predict_substitution_products', 'will_metal_react', 'activity_series_compare'] },
  ],
  genetic_chain_logic: [
    { module: 'reactions', types: ['complete_chain_step', 'choose_reagent_for_step'] },
  ],
  qualitative_analysis_logic: [
    { module: 'reactions', types: ['identify_reagent_for_ion', 'identify_ion_by_observation'] },
  ],
  reaction_energy_profile: [
    { module: 'reactions', types: ['factors_affecting_rate', 'exo_endo_classify', 'equilibrium_shift'] },
  ],
  catalyst_role_understanding: [
    { module: 'reactions', types: ['catalyst_properties', 'identify_catalyst'] },
  ],
  calculations_basic: [
    { module: 'calculations', types: ['calc_molar_mass', 'calc_mass_fraction', 'calc_amount_of_substance', 'calc_mass_from_moles'] },
  ],
  calculations_solutions: [
    { module: 'calculations', types: ['calc_solution_concentration', 'calc_solute_mass', 'calc_dilution'] },
  ],
  reaction_yield_logic: [
    { module: 'calculations', types: ['calc_by_equation', 'calc_yield'] },
  ],
  electrolyte_logic: [
    { module: 'reactions', types: ['match_ionic_equation', 'identify_spectator_ions'] },
  ],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function callGenerator(
  module: string,
  type: string,
  data: ExamData,
): { type: string; question: string; options: { id: string; text: string }[]; correctId: string; explanation: string; competencyMap: Record<string, 'P' | 'S'> } {
  switch (module) {
    case 'periodic-table':
      return genPeriodicTable(data.elements, type);
    case 'bonds':
      return genBonds(data.elements, type);
    case 'oxidation-states':
      return genOxidation(data.elements, type);
    case 'substances':
      return genSubstances(data.substances, data.classificationRules, data.namingRules, type);
    case 'reactions': {
      const ctx: ReactionsCtx = {
        templates: data.reactionTemplates,
        solubility: data.solubility,
        activitySeries: data.activitySeries,
        applicabilityRules: data.applicabilityRules,
        reactions: data.reactions,
        qualitativeTests: data.qualitativeTests,
        geneticChains: data.geneticChains,
        energyCatalystTheory: data.energyCatalystTheory,
      };
      return genReactions(ctx, type);
    }
    case 'calculations': {
      const ctx: CalcCtx = { data: data.calculationsData };
      return genCalculations(ctx);
    }
    default:
      throw new Error(`Unknown module: ${module}`);
  }
}

const EXAM_TIME_LIMIT_SEC = 120 * 60; // 2 hours
const MAX_RETRIES = 5;

/**
 * Generate a full exam variant with one exercise per competency (20 questions).
 * Each competency gets a randomly chosen exercise type from its available sources.
 */
export function generateVariant(data: ExamData): ExamVariant {
  const competencyIds = Object.keys(COMPETENCY_SOURCES);
  const exercises: ExamExercise[] = [];

  for (let i = 0; i < competencyIds.length; i++) {
    const compId = competencyIds[i];
    const sources = COMPETENCY_SOURCES[compId];
    const source = pick(sources);
    const type = pick(source.types);

    let ex: ReturnType<typeof callGenerator> | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        ex = callGenerator(source.module, type, data);
        break;
      } catch {
        // Retry with a different type if available
        const altType = pick(source.types);
        try {
          ex = callGenerator(source.module, altType, data);
          break;
        } catch {
          // Will retry in next iteration
        }
      }
    }

    if (!ex) {
      // Last resort: try any available source/type combo
      for (const s of sources) {
        for (const t of s.types) {
          try {
            ex = callGenerator(s.module, t, data);
            break;
          } catch {
            continue;
          }
        }
        if (ex) break;
      }
    }

    if (!ex) continue; // Skip if all attempts fail

    exercises.push({
      index: exercises.length,
      module: source.module,
      type: ex.type,
      question: ex.question,
      options: ex.options,
      correctId: ex.correctId,
      explanation: ex.explanation,
      competencyMap: ex.competencyMap,
    });
  }

  return {
    createdAt: Date.now(),
    timeLimitSec: EXAM_TIME_LIMIT_SEC,
    exercises,
  };
}
