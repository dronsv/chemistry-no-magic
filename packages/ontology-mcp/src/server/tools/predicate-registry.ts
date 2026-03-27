import type { OntologyIndex } from '../../shared/types.js';

export interface PredicateInfo {
  predicate: string;
  count: number;
}

export interface ListPredicatesResult {
  predicates: PredicateInfo[];
}

export function listPredicates(index: OntologyIndex): ListPredicatesResult {
  const counts = new Map<string, number>();

  for (const rels of index.relations.bySubject.values()) {
    for (const r of rels) {
      counts.set(r.predicate, (counts.get(r.predicate) ?? 0) + 1);
    }
  }

  const predicates = Array.from(counts.entries())
    .map(([predicate, count]) => ({ predicate, count }))
    .sort((a, b) => b.count - a.count);

  return { predicates };
}

export interface ValidatePredicateResult {
  known: boolean;
  count: number;
  similar?: string[];
}

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp[m][n];
}

export function validatePredicate(
  index: OntologyIndex,
  predicate: string,
): ValidatePredicateResult {
  const { predicates } = listPredicates(index);
  const known = predicates.find(p => p.predicate === predicate);

  if (known) {
    return { known: true, count: known.count };
  }

  // Find similar predicates using edit distance (threshold: <= 4 or within 40% length)
  const threshold = Math.max(4, Math.floor(predicate.length * 0.4));
  const similar = predicates
    .map(p => ({ predicate: p.predicate, dist: editDistance(predicate, p.predicate) }))
    .filter(p => p.dist <= threshold)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 5)
    .map(p => p.predicate);

  return { known: false, count: 0, ...(similar.length > 0 ? { similar } : {}) };
}
