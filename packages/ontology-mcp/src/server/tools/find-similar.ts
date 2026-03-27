import type { OntologyIndex, OntologyEntity, OntRefKind } from '../../shared/types.js';

interface SimilaritySignals {
  labelSim: number;
  kindMatch: boolean;
  parentMatch: boolean;
  tagOverlap: number;
  sharedRelations: number;
  descriptionSim: number;
}

interface SimilarEntity {
  ref: string;
  kind: OntRefKind;
  label: string;
  score: number;
  signals: SimilaritySignals;
}

/** Build set of character trigrams from a string. */
function trigrams(s: string): Set<string> {
  const t = new Set<string>();
  const lower = s.toLowerCase();
  for (let i = 0; i <= lower.length - 3; i++) {
    t.add(lower.slice(i, i + 3));
  }
  return t;
}

/** Dice coefficient over character trigrams. */
function trigramSim(a: string, b: string): number {
  if (!a || !b) return 0;
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) {
    if (tb.has(t)) shared++;
  }
  return (2 * shared) / (ta.size + tb.size);
}

/** Jaccard similarity of two string arrays. */
function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let intersection = 0;
  for (const x of sa) {
    if (sb.has(x)) intersection++;
  }
  const union = sa.size + sb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function getAllLabels(entity: OntologyEntity): string {
  return Object.values(entity.labels).join(' ');
}

function getAllDescriptions(entity: OntologyEntity): string {
  if (!entity.description) return '';
  return Object.values(entity.description).join(' ');
}

export function findSimilar(
  index: OntologyIndex,
  args: { ref: string; limit?: number; min_score?: number },
): { ref: string; similar: SimilarEntity[] } | { error: boolean; code: string; message: string } {
  const { ref, limit = 10, min_score = 0.15 } = args;

  const source = index.entitiesByRef.get(ref);
  if (!source) {
    return { error: true, code: 'NOT_FOUND', message: `Entity "${ref}" not found` };
  }

  const sourceLabels = getAllLabels(source);
  const sourceDesc = getAllDescriptions(source);
  const sourceTags = source.tags ?? [];

  // Collect all relation partners for the source entity
  const sourceRelPartners = new Set<string>();
  for (const rel of index.relations.bySubject.get(ref) ?? []) {
    sourceRelPartners.add(rel.object);
  }
  for (const rel of index.relations.byObject.get(ref) ?? []) {
    sourceRelPartners.add(rel.subject);
  }

  const candidates: SimilarEntity[] = [];

  for (const [candidateRef, candidate] of index.entitiesByRef) {
    if (candidateRef === ref) continue;

    // 1. Label similarity (weight: 0.3)
    const labelSim = trigramSim(sourceLabels, getAllLabels(candidate));

    // 2. Kind match (weight: 0.15)
    const kindMatch = source.kind === candidate.kind;

    // 3. Parent match (weight: 0.15)
    const parentMatch = !!(source.parent_ref && source.parent_ref === candidate.parent_ref);

    // 4. Tag overlap (weight: 0.1)
    const tagOverlap = jaccard(sourceTags, candidate.tags ?? []);

    // 5. Shared relations (weight: 0.2)
    let sharedRelCount = 0;
    for (const rel of index.relations.bySubject.get(candidateRef) ?? []) {
      if (sourceRelPartners.has(rel.object)) sharedRelCount++;
    }
    for (const rel of index.relations.byObject.get(candidateRef) ?? []) {
      if (sourceRelPartners.has(rel.subject)) sharedRelCount++;
    }
    const sharedRelations = Math.min(
      sharedRelCount / Math.max(sourceRelPartners.size, 1),
      1,
    );

    // 6. Description similarity (weight: 0.1)
    const descriptionSim = trigramSim(sourceDesc, getAllDescriptions(candidate));

    // Weighted composite score
    const score =
      labelSim * 0.3 +
      (kindMatch ? 0.15 : 0) +
      (parentMatch ? 0.15 : 0) +
      tagOverlap * 0.1 +
      sharedRelations * 0.2 +
      descriptionSim * 0.1;

    if (score >= min_score) {
      candidates.push({
        ref: candidateRef,
        kind: candidate.kind as OntRefKind,
        label: Object.values(candidate.labels)[0] ?? candidateRef,
        score: Math.round(score * 1000) / 1000,
        signals: {
          labelSim: Math.round(labelSim * 1000) / 1000,
          kindMatch,
          parentMatch,
          tagOverlap: Math.round(tagOverlap * 1000) / 1000,
          sharedRelations: Math.round(sharedRelations * 1000) / 1000,
          descriptionSim: Math.round(descriptionSim * 1000) / 1000,
        },
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return { ref, similar: candidates.slice(0, limit) };
}
