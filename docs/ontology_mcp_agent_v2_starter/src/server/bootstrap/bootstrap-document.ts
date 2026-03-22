import type { AnnotationResult } from '../../shared/types';
import type { OntologyIndex } from '../indexing/build-index';
import { createResolveMentionTool } from '../tools/resolve-mention';

const TOKEN_RE = /[A-Za-zА-Яа-яЁё0-9_+-]+/g;

export async function bootstrapDocument(args: {
  docId: string;
  materialLanguage: string;
  text: string;
  index: OntologyIndex;
}): Promise<AnnotationResult> {
  const resolveMention = createResolveMentionTool(args.index);
  const annotations: AnnotationResult['annotations'] = [];
  const unresolvedMentions: AnnotationResult['unresolvedMentions'] = [];

  for (const match of args.text.matchAll(TOKEN_RE)) {
    const mention = match[0];
    const start = match.index ?? 0;
    const end = start + mention.length;
    const resolved = await resolveMention({
      mention,
      material_language: args.materialLanguage,
    });

    if (resolved.best_candidate) {
      annotations.push({
        text: mention,
        start,
        end,
        kind: 'concept',
        chosenRef: resolved.best_candidate.ref,
        confidence: resolved.best_candidate.score,
        candidates: resolved.candidates.map((c) => ({
          ref: c.ref,
          kind: 'concept',
          score: c.score,
          matchReason: c.reason,
        })),
      });
    } else if (resolved.candidates.length > 1) {
      annotations.push({
        text: mention,
        start,
        end,
        kind: 'concept',
        candidates: resolved.candidates.map((c) => ({
          ref: c.ref,
          kind: 'concept',
          score: c.score,
          matchReason: c.reason,
        })),
      });
    } else {
      unresolvedMentions.push({
        text: mention,
        start,
        end,
        reason: 'no deterministic match',
      });
    }
  }

  return {
    docId: args.docId,
    materialLanguage: args.materialLanguage,
    annotations,
    unresolvedMentions,
    valid: true,
    errors: [],
    warnings: [],
  };
}
