/** Answer format types matching the real OGE exam. */
export type OgeAnswerType =
  | 'select'       // Pick N items from a list (ordered or unordered)
  | 'sequence'     // Arrange items in a specific order
  | 'matching'     // Match left column (А,Б,В) to right column (1,2,3,4)
  | 'input_cells'  // Fill labeled cells (e.g. period X, group Y)
  | 'numeric'      // Enter a calculated number
  | 'free_text';   // Part 2: open-ended written answer

/** Config for 'select' answer type. */
export interface OgeSelectConfig {
  /** How many items to select. */
  count: number;
  /** Whether selection order matters (e.g. task 7: basic oxide first, then amphoteric hydroxide). */
  ordered: boolean;
}

/** Config for 'numeric' answer type. */
export interface OgeNumericConfig {
  precision: 'integer' | 'tenths';
}

/** An option in a select/matching task (right column for matching). */
export interface OgeOption {
  id: string;
  text: string;
}

/** A left-column item in a matching task. */
export interface OgeLeftItem {
  label: string;  // "А", "Б", "В"
  text: string;
}

/**
 * A real OGE task from a demo or official variant.
 *
 * Depending on `answer_type`, different optional fields are populated:
 * - select: `options`, `select_config`
 * - sequence: `items`
 * - matching: `left_items`, `options`
 * - input_cells: `input_labels`
 * - numeric: `numeric_config`
 * - free_text: (no extra fields)
 */
export interface OgeTask {
  task_id: string;
  year: number;
  source: 'demo' | 'real' | 'reserve';
  task_number: number;   // 1–23
  part: 1 | 2;
  question_ru: string;
  /** Shared context shown before the question (e.g. tasks 18–19 share a paragraph). */
  context_ru?: string;

  answer_type: OgeAnswerType;
  select_config?: OgeSelectConfig;
  numeric_config?: OgeNumericConfig;
  /** Labels for input_cells type (e.g. ["X", "Y"]). */
  input_labels?: string[];

  /** Options for select/matching tasks. For matching, these are the right column. */
  options?: OgeOption[];
  /** Items for sequence tasks (to be arranged in order). */
  items?: OgeOption[];
  /** Left column items for matching tasks. */
  left_items?: OgeLeftItem[];

  correct_answer: string;
  max_score: number;
  difficulty: 'Б' | 'П' | 'В';
  time_minutes: number;
  /** Our competency IDs this task primarily tests. */
  competencies: string[];
  explanation_ru: string;
}
