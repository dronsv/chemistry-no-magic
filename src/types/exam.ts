/** A single exercise within an exam variant. */
export interface ExamExercise {
  /** Index in the variant (0-based). */
  index: number;
  /** Source module that generated this exercise. */
  module: string;
  /** Exercise type key from the source generator. */
  type: string;
  /** Question text. */
  question: string;
  /** Answer options. */
  options: { id: string; text: string }[];
  /** Correct option ID. */
  correctId: string;
  /** Explanation shown after exam submission. */
  explanation: string;
  /** Competency weights for BKT update. */
  competencyMap: Record<string, 'P' | 'S'>;
}

/** User's answer for a single exercise. */
export interface ExamAnswer {
  /** Exercise index. */
  index: number;
  /** Selected option ID, or null if skipped. */
  selectedId: string | null;
}

/** Full exam variant: list of exercises + metadata. */
export interface ExamVariant {
  /** Generated timestamp. */
  createdAt: number;
  /** Time limit in seconds. */
  timeLimitSec: number;
  /** Ordered list of exercises. */
  exercises: ExamExercise[];
}

/** Result for a single exercise after grading. */
export interface ExamExerciseResult {
  index: number;
  question: string;
  selectedId: string | null;
  correctId: string;
  correct: boolean;
  explanation: string;
  competencyMap: Record<string, 'P' | 'S'>;
}

/** Aggregated result per competency. */
export interface CompetencyResult {
  competencyId: string;
  name: string;
  total: number;
  correct: number;
  pL: number;
}

/** Full exam results. */
export interface ExamResults {
  totalQuestions: number;
  totalCorrect: number;
  timeSpentSec: number;
  exercises: ExamExerciseResult[];
  competencies: CompetencyResult[];
}
