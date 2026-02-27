import type { ExamExercise, ExamVariant } from '../../types/exam';

/** Minimal engine interface for exam variant generation. */
export interface VariantEngine {
  generateForCompetency(competencyId: string): unknown | null;
  toExercise(task: unknown): {
    type: string;
    question: string;
    format: string;
    options: { id: string; text: string }[];
    correctId: string;
    explanation: string;
    competencyMap: Record<string, 'P' | 'S'>;
  };
}

/** Competency IDs to include in the exam, in order. */
const EXAM_COMPETENCY_IDS = [
  'periodic_table',
  'electron_config',
  'periodic_trends',
  'oxidation_states',
  'bond_type',
  'crystal_structure_type',
  'classification',
  'naming',
  'amphoterism_logic',
  'reactions_exchange',
  'gas_precipitate_logic',
  'reactions_redox',
  'genetic_chain_logic',
  'qualitative_analysis_logic',
  'reaction_energy_profile',
  'catalyst_role_understanding',
  'calculations_basic',
  'calculations_solutions',
  'reaction_yield_logic',
  'electrolyte_logic',
];

const EXAM_TIME_LIMIT_SEC = 120 * 60; // 2 hours
const MAX_RETRIES = 5;

/**
 * Generate a full exam variant with one exercise per competency (20 questions).
 * Uses the generative task engine.
 */
export function generateVariant(engine: VariantEngine): ExamVariant {
  const exercises: ExamExercise[] = [];

  for (const compId of EXAM_COMPETENCY_IDS) {
    let ex: ReturnType<VariantEngine['toExercise']> | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const task = engine.generateForCompetency(compId);
        if (task) {
          ex = engine.toExercise(task);
          break;
        }
      } catch {
        // Retry
      }
    }

    if (!ex) continue;

    exercises.push({
      index: exercises.length,
      module: compId,
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
