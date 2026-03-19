import type { OntologyIndex, AnnotationResult, Annotation, ProposalDraft } from '../../shared/types.js';
import { suggestRefsForText } from './suggest-refs-for-text.js';
import { validateAnnotation } from './validate-annotation.js';
import { createProposalDraft } from './create-proposal-draft.js';

interface CoverageMetrics {
  mention_count: number;
  resolved_count: number;
  ambiguous_count: number;
  unresolved_count: number;
  proposal_count: number;
}

interface BootstrapResult {
  annotation_result: AnnotationResult;
  proposals: ProposalDraft[];
  coverage: CoverageMetrics;
}

export function bootstrapDocument(
  index: OntologyIndex,
  args: { doc_id: string; material_language: string; text: string; mode: string }
): BootstrapResult {
  const { doc_id, material_language, text, mode } = args;

  // Step 1: Suggest refs for entire text
  const suggestions = suggestRefsForText(index, { text, material_language, mode });

  // Step 2: Convert mentions to annotations
  const annotations: Annotation[] = suggestions.mentions.map(m => {
    const top = m.candidates[0];
    const isConfident = top && top.score >= 0.9;
    return {
      text: m.text,
      start: m.start,
      end: m.end,
      kind: top?.kind ?? 'concept',
      chosen_ref: isConfident ? top.ref : undefined,
      confidence: top?.score,
      candidates: m.candidates,
    };
  });

  // Step 3: Validate
  const validation = validateAnnotation(index, { doc_id, material_language, annotations });

  // Step 4: Proposals for unresolved spans
  const proposals: ProposalDraft[] = [];
  for (const span of suggestions.unresolved_spans) {
    const result = createProposalDraft(index, {
      candidate_text: span.text,
      material_language,
      evidence_text: text.slice(
        Math.max(0, span.start - 30),
        Math.min(text.length, span.end + 30)
      ),
      source_doc_id: doc_id,
    });
    proposals.push(result.proposal);
  }

  // Step 5: Coverage metrics
  const resolved_count = annotations.filter(a => a.chosen_ref).length;
  const ambiguous_count = annotations.filter(
    a => !a.chosen_ref && a.candidates.length > 1
  ).length;

  return {
    annotation_result: {
      doc_id,
      material_language,
      annotations,
      unresolved_mentions: suggestions.unresolved_spans.map(s => ({
        text: s.text, start: s.start, end: s.end,
        reason: 'no confident match found',
      })),
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    },
    proposals,
    coverage: {
      mention_count: annotations.length,
      resolved_count,
      ambiguous_count,
      unresolved_count: suggestions.unresolved_spans.length,
      proposal_count: proposals.length,
    },
  };
}
