import type { ReasoningStep } from './trend-rule';

/** Result of trend-based reasoning for a pair of elements. */
export interface TrendTrace {
  property: string;
  elementA: string;
  elementB: string;
  /** Detected context: same period, same group, or null if neither. */
  context: 'across_period' | 'down_group' | null;
  /** Matched trend rule ID, or null if no rule applies. */
  trend_id: string | null;
  /** Direction of the matched trend. */
  trend_direction: 'increases' | 'decreases' | null;
  /** Symbol of the element predicted to have the higher value. Null if no trend applies. */
  predicted_higher: string | null;
  /** Reasoning chain from the matched trend rule. */
  reasoning_chain: ReasoningStep[];
  /** Non-null when this specific pair is a known exception to the trend. */
  exception: { id: string; reason: string } | null;
}
