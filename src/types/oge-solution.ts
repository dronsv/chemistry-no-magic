/** Solution algorithm for a specific OGE task number (1–19). */
export interface OgeSolutionAlgorithm {
  task_number: number;
  title_ru: string;
  topic_ru: string;
  answer_format: string;
  algorithm_ru: string[];
  key_facts_ru: string[];
  common_traps_ru: string[];
  variability_ru: string;
}
