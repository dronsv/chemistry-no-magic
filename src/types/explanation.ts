/** A single step in a rendered explanation. */
export interface ExplanationStep {
  /** Step type for styling/rendering. */
  type: 'formula' | 'substitution' | 'result' | 'trend' | 'exception' | 'approximation_note';
  /** Machine-readable expression or key (e.g. "n = m / M", "trend:ie_across_period"). */
  key: string;
  /** Human-readable text for this step (locale-dependent). */
  text: string;
}

/** A complete rendered explanation for a solver result. */
export interface Explanation {
  /** Formula or trend rule that was applied. */
  source_id: string;
  /** Ordered explanation steps. */
  steps: ExplanationStep[];
}
