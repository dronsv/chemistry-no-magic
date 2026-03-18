// src/lib/ont-preview/resolve-ont-preview.ts
import type { OntPreviewRequest, ResolvedOntPreview } from '../../types/ont-preview';
import { resolveRefKind } from '../ont-ref-registry';

/**
 * Main dispatcher for ont-preview resolution.
 * Dispatches by subjectKind and ref prefix to the appropriate adapter.
 * Always returns a ResolvedOntPreview — never throws to the caller.
 */
export async function resolveOntPreview(
  request: OntPreviewRequest,
): Promise<ResolvedOntPreview> {
  try {
    if (request.subjectKind === 'formula_variable') {
      const { resolveFormulaVariablePreview } = await import('./adapters/formula-variable-preview');
      return resolveFormulaVariablePreview(request.variable, request.formulaId, request.locale);
    }

    if (request.subjectKind === 'formula') {
      const { resolveFormulaPreview } = await import('./adapters/formula-preview');
      return resolveFormulaPreview(request.ref, request.locale, request.context);
    }

    // subjectKind === 'entity'
    const { ref, locale, context } = request;

    // Validate: entity refs cannot be formula:* refs
    if (ref.startsWith('formula:')) {
      if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
        console.warn(
          `[ont-preview] subjectKind='entity' is invalid for formula ref "${ref}". Use subjectKind='formula' instead.`,
        );
      }
      return makeFallback(ref, 'entity');
    }

    const kind = resolveRefKind(ref);

    switch (kind) {
      case 'element': {
        const { resolveElementPreview } = await import('./adapters/element-preview');
        return resolveElementPreview(ref, locale, context);
      }
      case 'substance': {
        const { resolveSubstancePreview } = await import('./adapters/substance-preview');
        return resolveSubstancePreview(ref, locale, context);
      }
      case 'ion': {
        const { resolveIonPreview } = await import('./adapters/ion-preview');
        return resolveIonPreview(ref, locale, context);
      }
      case 'domain_concept':
      case 'substance_class':
      case 'reaction_type': {
        const { resolveConceptPreview } = await import('./adapters/concept-preview');
        return resolveConceptPreview(ref, locale, context);
      }
      default:
        return makeFallback(ref, 'entity');
    }
  } catch (err) {
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
      console.error('[ont-preview] resolver error:', err);
    }
    const ref = request.subjectKind === 'formula_variable'
      ? `formula_var:${request.formulaId}:${request.variable.symbol}`
      : request.ref;
    return makeFallback(ref, request.subjectKind === 'formula' ? 'formula' : 'entity');
  }
}

function makeFallback(
  ref: string,
  subjectKind: 'entity' | 'formula' | 'formula_variable',
): ResolvedOntPreview {
  // Extract human-readable label from tail of ref (after last ":" or "-")
  const colonIdx = ref.lastIndexOf(':');
  const tail = colonIdx >= 0 ? ref.slice(colonIdx + 1) : ref;
  return {
    target: { ref, subjectKind },
    data: { title: tail },
  };
}
