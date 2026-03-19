import type { OntologyIndex, Annotation } from '../../shared/types.js';

interface ValidateResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  repair_suggestions: string[];
}

export function validateAnnotation(
  index: OntologyIndex,
  args: { doc_id: string; material_language: string; annotations: Annotation[] }
): ValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const repair_suggestions: string[] = [];

  for (const ann of args.annotations) {
    // chosen_ref must exist in ontology
    if (ann.chosen_ref && !index.entitiesByRef.has(ann.chosen_ref)) {
      errors.push(`Annotation '${ann.text}' has chosen_ref '${ann.chosen_ref}' not found in ontology.`);
    }

    // Single candidate without chosen_ref → warn
    if (!ann.chosen_ref && ann.candidates.length === 1) {
      warnings.push(
        `Annotation '${ann.text}' has one candidate (${ann.candidates[0].ref}) but no chosen_ref.`
      );
      repair_suggestions.push(`Set chosen_ref to '${ann.candidates[0].ref}' for '${ann.text}'.`);
    }

    // chosen_ref without candidates → error
    if (ann.chosen_ref && ann.candidates.length === 0) {
      errors.push(`Annotation '${ann.text}' has chosen_ref '${ann.chosen_ref}' but no candidates.`);
    }

    // Low confidence warning
    if (ann.confidence !== undefined && ann.confidence < 0.7) {
      warnings.push(`Annotation '${ann.text}' has low confidence (${ann.confidence}).`);
    }
  }

  // Check for overlapping spans
  const sorted = [...args.annotations].sort((a, b) => a.start - b.start);
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].end > sorted[i + 1].start) {
      errors.push(
        `Overlapping annotations: '${sorted[i].text}' [${sorted[i].start}-${sorted[i].end}] ` +
        `and '${sorted[i + 1].text}' [${sorted[i + 1].start}-${sorted[i + 1].end}] overlap.`
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings, repair_suggestions };
}
