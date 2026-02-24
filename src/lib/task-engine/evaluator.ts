import type { EvaluationSpec, EvaluationResult } from './types';

/**
 * Evaluate a user answer against the correct answer using the specified mode.
 *
 * Modes:
 *  - exact:           JSON-level equality
 *  - tolerance:       numeric comparison within ± tolerance
 *  - partial_credit:  position-by-position array match → fractional score
 *  - set_equivalence: order-independent set equality
 */
export function evaluate(
  userAnswer: string | number | string[],
  correctAnswer: string | number | string[],
  spec: EvaluationSpec,
): EvaluationResult {
  switch (spec.mode) {
    case 'exact':
      return evaluateExact(userAnswer, correctAnswer);
    case 'tolerance':
      return evaluateTolerance(userAnswer, correctAnswer, spec.tolerance ?? 0);
    case 'partial_credit':
      return evaluatePartialCredit(userAnswer, correctAnswer);
    case 'set_equivalence':
      return evaluateSetEquivalence(userAnswer, correctAnswer);
    default:
      return evaluateExact(userAnswer, correctAnswer);
  }
}

function evaluateExact(
  user: string | number | string[],
  correct: string | number | string[],
): EvaluationResult {
  const match = JSON.stringify(user) === JSON.stringify(correct);
  return { correct: match, score: match ? 1 : 0 };
}

function evaluateTolerance(
  user: string | number | string[],
  correct: string | number | string[],
  tolerance: number,
): EvaluationResult {
  const u = Number(user);
  const c = Number(correct);
  if (isNaN(u) || isNaN(c)) return evaluateExact(user, correct);
  const match = Math.abs(u - c) <= tolerance;
  return { correct: match, score: match ? 1 : 0 };
}

function evaluatePartialCredit(
  user: string | number | string[],
  correct: string | number | string[],
): EvaluationResult {
  if (!Array.isArray(user) || !Array.isArray(correct)) return evaluateExact(user, correct);
  if (user.length !== correct.length) return { correct: false, score: 0 };
  let matches = 0;
  for (let i = 0; i < correct.length; i++) {
    if (user[i] === correct[i]) matches++;
  }
  const score = matches / correct.length;
  return { correct: score === 1, score };
}

function evaluateSetEquivalence(
  user: string | number | string[],
  correct: string | number | string[],
): EvaluationResult {
  const uSet = new Set(Array.isArray(user) ? user : [String(user)]);
  const cSet = new Set(Array.isArray(correct) ? correct : [String(correct)]);
  if (uSet.size !== cSet.size) return { correct: false, score: 0 };
  for (const v of cSet) {
    if (!uSet.has(v)) return { correct: false, score: 0 };
  }
  return { correct: true, score: 1 };
}
