import { createHash } from 'node:crypto';
import type { OntologyIndex, ProposalDraft } from '../../shared/types.js';
import { classifyAddition } from './classify-addition.js';
import { searchEntities } from './search-entities.js';

interface CreateProposalResult {
  proposal: ProposalDraft;
}

export function createProposalDraft(
  index: OntologyIndex,
  args: {
    candidate_text: string;
    material_language: string;
    nearest_refs?: string[];
    evidence_text?: string;
    source_doc_id?: string;
    context?: string;
  }
): CreateProposalResult {
  const { candidate_text, material_language, nearest_refs, evidence_text, source_doc_id } = args;

  const classification = classifyAddition(index, {
    candidate_text,
    material_language,
    nearest_refs,
    context: args.context,
  });

  const searchResult = searchEntities(index, { query: candidate_text, limit: 5 });
  const nearestRefs = searchResult.candidates.map(c => ({
    ref: c.ref,
    reason: c.matchReason,
    score: c.score,
  }));

  // Deterministic proposal ID
  const proposalId = createHash('sha256')
    .update(`${candidate_text}:${material_language}`)
    .digest('hex')
    .slice(0, 12);

  const isAlias = classification.addition_type === 'alias_addition';
  const isOverlay = classification.addition_type === 'overlay_addition';

  const proposal: ProposalDraft = {
    proposal_id: proposalId,
    proposal_type: classification.addition_type,
    candidate_text,
    language: material_language,
    target_ref: nearestRefs[0]?.ref,
    rationale: classification.rationale,
    evidence_spans: evidence_text
      ? [{ source_doc_id, text: evidence_text }]
      : [],
    nearest_existing_refs: nearestRefs,
    admission_checks: {
      is_alias_only: isAlias,
      is_overlay_only: isOverlay,
      is_reusable: !isAlias && !isOverlay,
      is_language_independent: classification.addition_type === 'new_core_entity',
      is_non_redundant: classification.confidence < 0.9,
      has_structural_value: classification.addition_type === 'new_core_entity' ||
        classification.addition_type === 'relation_addition',
    },
    status: 'draft',
  };

  return { proposal };
}
