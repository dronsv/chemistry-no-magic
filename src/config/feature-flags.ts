export const featureFlags = {
  /** Use new QueryBuilder UI instead of sentence-template based solver */
  newQueryBuilder: false,
  /** Fall back to old solver if new resolver fails */
  oldSolverFallback: true,
  /** Show temporal fields (at, during) in query builder — hidden in Phase 1 */
  temporalFieldsVisible: false,
} as const;

export type FeatureFlag = keyof typeof featureFlags;

export function isEnabled(flag: FeatureFlag): boolean {
  if (typeof window !== 'undefined') {
    const override = localStorage.getItem(`ff_${flag}`);
    if (override !== null) return override === 'true';
  }
  return featureFlags[flag];
}
