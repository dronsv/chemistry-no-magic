import { describe, it, expect, beforeAll } from 'vitest';
import { buildOntologyIndex } from '../server/indexing/build-index.js';
import { bootstrapDocument } from '../server/tools/bootstrap-document.js';
import type { OntologyIndex } from '../shared/types.js';

let index: OntologyIndex;
beforeAll(async () => { index = await buildOntologyIndex(); });

describe('bootstrapDocument', () => {
  it('produces annotation result for Russian chemistry text', () => {
    const r = bootstrapDocument(index, {
      doc_id: 'test-acids',
      material_language: 'ru',
      text: 'Кислота HCl диссоциирует в воде H₂O.',
      mode: 'didactic',
    });
    expect(r.annotation_result.doc_id).toBe('test-acids');
    expect(r.annotation_result.annotations.length).toBeGreaterThan(0);
    expect(r.coverage.mention_count).toBeGreaterThan(0);
  });

  it('returns valid coverage metrics', () => {
    const r = bootstrapDocument(index, {
      doc_id: 'test-metrics',
      material_language: 'ru',
      text: 'Na и Cl образуют NaCl — поваренную соль.',
      mode: 'didactic',
    });
    expect(typeof r.coverage.mention_count).toBe('number');
    expect(typeof r.coverage.resolved_count).toBe('number');
    expect(typeof r.coverage.ambiguous_count).toBe('number');
    expect(typeof r.coverage.unresolved_count).toBe('number');
    expect(typeof r.coverage.proposal_count).toBe('number');
  });

  it('resolves element symbols with high confidence', () => {
    const r = bootstrapDocument(index, {
      doc_id: 'test-elements',
      material_language: 'ru',
      text: 'Элементы Fe, Cu и Au — металлы.',
      mode: 'didactic',
    });
    const resolvedRefs = r.annotation_result.annotations
      .filter(a => a.chosen_ref)
      .map(a => a.chosen_ref);
    expect(resolvedRefs).toContain('el:Fe');
    expect(resolvedRefs).toContain('el:Cu');
    expect(resolvedRefs).toContain('el:Au');
  });
});
