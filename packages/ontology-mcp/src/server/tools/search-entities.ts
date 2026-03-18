import type { OntologyIndex, OntologyEntity, SearchCandidate, OntRefKind } from '../../shared/types.js';

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function pickLabel(entity: OntologyEntity, preferLocale = 'en'): string {
  return (
    entity.labels[preferLocale] ??
    entity.labels['en'] ??
    entity.labels['ru'] ??
    Object.values(entity.labels)[0] ??
    entity.formula ??
    entity.ref
  );
}

export function searchEntities(
  index: OntologyIndex,
  args: { query: string; kinds?: string[]; limit?: number }
): { candidates: SearchCandidate[] } {
  const { query, kinds, limit = 10 } = args;
  const results: SearchCandidate[] = [];
  const seen = new Set<string>();

  function addCandidate(ref: string, score: number, matchReason: string): void {
    if (seen.has(ref)) return;
    const entity = index.entitiesByRef.get(ref);
    if (!entity) return;
    if (kinds?.length && !kinds.includes(entity.kind)) return;
    seen.add(ref);
    results.push({
      ref,
      kind: entity.kind as OntRefKind,
      label: pickLabel(entity),
      score,
      matchReason,
    });
  }

  // 1. Exact ref match
  if (index.entitiesByRef.has(query)) {
    addCandidate(query, 1.0, 'exact ref match');
  }

  // 2. Symbol match (element symbols like Na, H, Fe)
  const symbolRef = index.symbolIndex.get(query);
  if (symbolRef) {
    addCandidate(symbolRef, 0.99, 'element symbol match');
  }

  // 3. Formula match (exact chemical formula)
  const formulaRef = index.formulaIndex.get(query);
  if (formulaRef) {
    addCandidate(formulaRef, 0.98, 'formula match');
  }

  // 4. Exact alias match
  const normalizedQuery = normalize(query);
  const exactAliasRefs = index.aliasIndex.get(normalizedQuery);
  if (exactAliasRefs) {
    for (const ref of exactAliasRefs) {
      addCandidate(ref, 0.95, 'exact alias match');
    }
  }

  // 5. Substring alias match (iterate aliasIndex keys)
  if (normalizedQuery.length >= 2) {
    for (const [key, refs] of index.aliasIndex.entries()) {
      if (key === normalizedQuery) continue; // already handled above
      let score: number;
      let reason: string;
      if (key.startsWith(normalizedQuery)) {
        score = 0.85;
        reason = 'prefix alias match';
      } else if (key.includes(normalizedQuery)) {
        score = 0.7;
        reason = 'substring alias match';
      } else if (normalizedQuery.includes(key) && key.length >= 3) {
        score = 0.72;
        reason = 'query contains alias';
      } else {
        continue;
      }
      for (const ref of refs) {
        addCandidate(ref, score, reason);
      }
    }
  }

  // Sort by score descending, then by ref for stability
  results.sort((a, b) => b.score - a.score || a.ref.localeCompare(b.ref));

  return { candidates: results.slice(0, limit) };
}
