import type { BktParams } from '../types/bkt';

const CLAMP_MIN = 0.001;
const CLAMP_MAX = 0.999;

function clamp(value: number): number {
  return Math.min(CLAMP_MAX, Math.max(CLAMP_MIN, value));
}

/**
 * Apply BKT update: compute new P(L) after observing a correct/wrong answer.
 *
 * Implements formulas from Docs/07_adaptive_bkt_math_model.md:
 * - Posterior update (§4.1)
 * - Learning transition (§4.2)
 * - Hint/no-hint modifiers (§6)
 */
export function bktUpdate(
  pL: number,
  params: BktParams,
  correct: boolean,
  hintUsed: boolean,
): number {
  let G = params.P_G;
  let S = params.P_S;
  let T = params.P_T;

  // §6.1 — modify effective guess/slip based on hint usage
  if (hintUsed) {
    G = Math.min(0.60, G + 0.25);
    S = Math.min(0.60, S + 0.10);
  }

  // §6.2 — modify learning rate
  if (hintUsed) {
    T = Math.max(0.01, T - 0.03);
  } else {
    T = Math.min(0.35, T + 0.05);
  }

  // §4.1 — posterior after observation
  let pLGivenO: number;
  if (correct) {
    // P(L|correct) = P(L)*(1-S) / [P(L)*(1-S) + (1-P(L))*G]
    const num = pL * (1 - S);
    const denom = num + (1 - pL) * G;
    pLGivenO = denom === 0 ? pL : num / denom;
  } else {
    // P(L|wrong) = P(L)*S / [P(L)*S + (1-P(L))*(1-G)]
    const num = pL * S;
    const denom = num + (1 - pL) * (1 - G);
    pLGivenO = denom === 0 ? pL : num / denom;
  }

  // §4.2 — learning transition
  const pLNew = pLGivenO + (1 - pLGivenO) * T;

  return clamp(pLNew);
}

export type CompetencyLevel = 'none' | 'basic' | 'confident' | 'automatic';

/**
 * Determine mastery level from P(L) value.
 * Thresholds from §10 of the BKT model doc.
 */
export function getLevel(pL: number): CompetencyLevel {
  if (pL >= 0.93) return 'automatic';
  if (pL >= 0.8) return 'confident';
  if (pL >= 0.6) return 'basic';
  return 'none';
}
