import type { SupportedLocale } from './i18n';

/** Registry entry for a national exam system. */
export interface ExamSystem {
  id: string;
  country: string;
  name?: string;
  grade: string;
  duration_min: number;
  max_score: number;
  task_count: number;
  sections: string[];
  primary_locale: SupportedLocale;
  flag: string;
}

/** Detailed metadata for a specific exam system. */
export interface ExamSystemMeta {
  id: string;
  full_name?: string;
  description?: string;
  country: string;
  grade: string;
  duration_min: number;
  max_score: number;
  task_count: number;
  scoring: {
    grade_thresholds: Record<string, number>;
    [key: string]: unknown;
  };
  topics: string[];
  [key: string]: unknown;
}

/** Get the localized name for an exam system. */
export function getExamSystemName(system: ExamSystem, _locale: SupportedLocale): string {
  return system.name ?? system.id;
}
