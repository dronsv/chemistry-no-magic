import type { OntologyIndex, SearchCandidate } from '../../shared/types.js';
import { searchEntities } from './search-entities.js';

interface ResolveMentionResult {
  best_candidate?: { ref: string; kind: string; label: string; score: number; reason: string };
  candidates: Array<{ ref: string; kind: string; label: string; score: number; reason: string }>;
  ambiguity?: string;
  proposed_action: string;
}

export function resolveMention(
  index: OntologyIndex,
  args: { mention: string; material_language?: string; context?: string }
): ResolveMentionResult {
  const { candidates } = searchEntities(index, {
    query: args.mention,
    limit: 5,
  });

  const mapped = candidates.map((c: SearchCandidate) => ({
    ref: c.ref,
    kind: c.kind,
    label: c.label,
    score: c.score,
    reason: c.matchReason,
  }));

  if (mapped.length === 0) {
    return {
      candidates: [],
      proposed_action: 'classify_addition_or_leave_unresolved',
    };
  }

  // Single candidate or first candidate has clearly dominant score
  const top = mapped[0];
  const second = mapped[1];
  const clearWinner =
    mapped.length === 1 ||
    (second && top.score - second.score >= 0.1);

  if (clearWinner) {
    return {
      best_candidate: top,
      candidates: mapped,
      proposed_action: 'bind_existing_ref',
    };
  }

  return {
    candidates: mapped,
    ambiguity: 'multiple plausible candidates with similar scores',
    proposed_action: 'require_review',
  };
}
