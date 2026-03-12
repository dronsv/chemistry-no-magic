import type { TrendRule } from '../types/trend-rule';
import type { TrendAnomaly } from '../types/storage';
import type { TrendTrace } from '../types/trend-trace';

interface MinimalElement {
  symbol: string;
  Z: number;
  group: number;
  period: number;
}

/**
 * Detect context between two elements: same period, same group, or neither.
 */
export function detectContext(
  a: MinimalElement,
  b: MinimalElement,
): 'across_period' | 'down_group' | null {
  if (a.period === b.period) return 'across_period';
  if (a.group === b.group) return 'down_group';
  return null;
}

/**
 * Find the trend rule that applies for a property and context.
 */
export function findApplicableTrend(
  property: string,
  context: 'across_period' | 'down_group',
  trendRules: TrendRule[],
): TrendRule | null {
  return trendRules.find(
    t => t.property === property && t.context === context,
  ) ?? null;
}

/**
 * Check if an element pair matches a known exception to a trend.
 * Checks both directions: A→B and B→A.
 */
export function checkException(
  symbolA: string,
  symbolB: string,
  trendId: string,
  exceptions: TrendAnomaly[],
): TrendAnomaly | null {
  return exceptions.find(
    e => e.overrides_trend === trendId &&
      ((e.from === symbolA && e.to === symbolB) ||
       (e.from === symbolB && e.to === symbolA)),
  ) ?? null;
}

/**
 * Predict which element has the higher property value based on a trend rule.
 *
 * For 'across_period' + 'increases': higher Z → higher value.
 * For 'across_period' + 'decreases': lower Z → higher value.
 * For 'down_group' + 'increases': higher period → higher value.
 * For 'down_group' + 'decreases': lower period → higher value.
 */
export function predictHigher(
  a: MinimalElement,
  b: MinimalElement,
  trend: TrendRule,
): string {
  if (trend.context === 'across_period') {
    const further = a.Z > b.Z ? a : b;
    const closer = a.Z > b.Z ? b : a;
    return trend.direction === 'increases' ? further.symbol : closer.symbol;
  }
  // down_group
  const lower = a.period > b.period ? a : b;
  const upper = a.period > b.period ? b : a;
  return trend.direction === 'increases' ? lower.symbol : upper.symbol;
}

/**
 * Full trend reasoning for a pair of elements and a property.
 *
 * Returns a TrendTrace with the applicable trend, prediction,
 * reasoning chain, and exception status.
 */
export function reasonTrend(
  property: string,
  a: MinimalElement,
  b: MinimalElement,
  trendRules: TrendRule[],
  exceptions: TrendAnomaly[],
): TrendTrace {
  const context = detectContext(a, b);

  if (!context) {
    return {
      property,
      elementA: a.symbol,
      elementB: b.symbol,
      context: null,
      trend_id: null,
      trend_direction: null,
      predicted_higher: null,
      reasoning_chain: [],
      exception: null,
    };
  }

  const trend = findApplicableTrend(property, context, trendRules);

  if (!trend) {
    return {
      property,
      elementA: a.symbol,
      elementB: b.symbol,
      context,
      trend_id: null,
      trend_direction: null,
      predicted_higher: null,
      reasoning_chain: [],
      exception: null,
    };
  }

  const predicted = predictHigher(a, b, trend);
  const exc = checkException(a.symbol, b.symbol, trend.id, exceptions);

  return {
    property,
    elementA: a.symbol,
    elementB: b.symbol,
    context,
    trend_id: trend.id,
    trend_direction: trend.direction,
    predicted_higher: predicted,
    reasoning_chain: trend.reasoning_chain,
    exception: exc ? { id: exc.id, reason: exc.reason } : null,
  };
}
