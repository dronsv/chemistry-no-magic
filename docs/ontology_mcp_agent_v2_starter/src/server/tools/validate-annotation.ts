import type { AnnotationResult } from '../../shared/types';
import type { OntologyIndex } from '../indexing/build-index';

export function createValidateAnnotationTool(_index: OntologyIndex) {
  return async function validateAnnotation(args: {
    doc_id: string;
    material_language: string;
    annotations: AnnotationResult['annotations'];
  }): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const annotation of args.annotations) {
      if (!annotation.chosenRef && annotation.candidates.length === 1) {
        warnings.push(`Annotation '${annotation.text}' has a single candidate but no chosenRef.`);
      }
      if (annotation.chosenRef && annotation.candidates.length === 0) {
        errors.push(`Annotation '${annotation.text}' has chosenRef without candidates.`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  };
}
