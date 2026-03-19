import { describe, it, expect, beforeAll } from 'vitest';
import { buildOntologyIndex } from '../server/indexing/build-index.js';
import { validateAnnotation } from '../server/tools/validate-annotation.js';
import type { OntologyIndex, Annotation } from '../shared/types.js';

let index: OntologyIndex;
beforeAll(async () => { index = await buildOntologyIndex(); });

describe('validateAnnotation', () => {
  it('validates correct annotation', () => {
    const annotations: Annotation[] = [{
      text: 'кислота', start: 0, end: 7, kind: 'substance_class',
      chosen_ref: 'cls:acid', confidence: 0.98,
      candidates: [{ ref: 'cls:acid', kind: 'substance_class', label: 'acid', score: 0.98, matchReason: 'exact' }],
    }];
    const r = validateAnnotation(index, {
      doc_id: 'test', material_language: 'ru', annotations,
    });
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('errors on chosen_ref not in ontology', () => {
    const annotations: Annotation[] = [{
      text: 'foo', start: 0, end: 3, kind: 'concept',
      chosen_ref: 'concept:nonexistent', confidence: 0.9,
      candidates: [{ ref: 'concept:nonexistent', kind: 'concept', label: 'foo', score: 0.9, matchReason: 'alias' }],
    }];
    const r = validateAnnotation(index, {
      doc_id: 'test', material_language: 'ru', annotations,
    });
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('warns on single candidate without chosen_ref', () => {
    const annotations: Annotation[] = [{
      text: 'кислота', start: 0, end: 7, kind: 'substance_class',
      candidates: [{ ref: 'cls:acid', kind: 'substance_class', label: 'acid', score: 0.95, matchReason: 'alias' }],
    }];
    const r = validateAnnotation(index, {
      doc_id: 'test', material_language: 'ru', annotations,
    });
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('errors on overlapping spans', () => {
    const annotations: Annotation[] = [
      { text: 'соляная кислота', start: 0, end: 15, kind: 'substance', candidates: [] },
      { text: 'кислота', start: 8, end: 15, kind: 'substance_class', candidates: [] },
    ];
    const r = validateAnnotation(index, {
      doc_id: 'test', material_language: 'ru', annotations,
    });
    expect(r.errors.some(e => e.includes('overlap') || e.includes('Overlap'))).toBe(true);
  });
});
