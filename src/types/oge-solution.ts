/** Solution algorithm for a specific OGE task number (1–19). */
export interface OgeSolutionAlgorithm {
  task_number: number;
  title: string;
  topic: string;
  answer_format: string;
  algorithm: string[];
  key_facts: string[];
  common_traps: string[];
  variability: string;
}
