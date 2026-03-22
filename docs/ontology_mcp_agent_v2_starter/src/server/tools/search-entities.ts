import type { SearchCandidate } from '../../shared/types';
import { searchAlias, type OntologyIndex } from '../indexing/build-index';

export function createSearchEntitiesTool(index: OntologyIndex) {
  return async function searchEntities(args: {
    query: string;
    kinds?: string[];
    limit?: number;
  }): Promise<{ candidates: SearchCandidate[] }> {
    const refs = searchAlias(index, args.query);
    const candidates = refs
      .map((ref): SearchCandidate => {
        const entity = index.entitiesByRef.get(ref)!;
        return {
          ref,
          kind: entity.kind,
          score: 0.95,
          matchReason: 'exact alias match',
        };
      })
      .filter((candidate) => {
        if (!args.kinds?.length) return true;
        return args.kinds.includes(candidate.kind);
      })
      .slice(0, args.limit ?? 10);

    return { candidates };
  };
}
