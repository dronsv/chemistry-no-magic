import type { OntologyIndex } from '../indexing/build-index';
import { createSearchEntitiesTool } from './search-entities';

export function createResolveMentionTool(index: OntologyIndex) {
  const searchEntities = createSearchEntitiesTool(index);

  return async function resolveMention(args: {
    mention: string;
    material_language: string;
    left_context?: string;
    right_context?: string;
    kinds?: string[];
  }): Promise<{
    best_candidate?: { ref: string; score: number; reason: string };
    candidates: Array<{ ref: string; score: number; reason: string }>;
    ambiguity?: string;
    proposed_action: string;
  }> {
    const result = await searchEntities({
      query: args.mention,
      kinds: args.kinds,
      limit: 5,
    });

    const candidates = result.candidates.map((c) => ({
      ref: c.ref,
      score: c.score,
      reason: c.matchReason,
    }));

    if (candidates.length === 1) {
      return {
        best_candidate: candidates[0],
        candidates,
        proposed_action: 'bind_existing_ref',
      };
    }

    if (candidates.length > 1) {
      return {
        candidates,
        ambiguity: 'multiple plausible candidates',
        proposed_action: 'require_review',
      };
    }

    return {
      candidates: [],
      proposed_action: 'classify_addition_or_leave_unresolved',
    };
  };
}
