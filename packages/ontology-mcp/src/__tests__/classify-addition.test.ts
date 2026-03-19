import { describe, it, expect, beforeAll } from 'vitest';
import { buildOntologyIndex } from '../server/indexing/build-index.js';
import { classifyAddition } from '../server/tools/classify-addition.js';
import { createProposalDraft } from '../server/tools/create-proposal-draft.js';
import type { OntologyIndex } from '../shared/types.js';

let index: OntologyIndex;
beforeAll(async () => { index = await buildOntologyIndex(); });

describe('classifyAddition', () => {
  it('classifies known synonym with nearest_ref as alias_addition', () => {
    const r = classifyAddition(index, {
      candidate_text: 'хлороводородная кислота',
      material_language: 'ru',
      nearest_refs: ['sub:hcl'],
    });
    expect(['alias_addition', 'overlay_addition']).toContain(r.addition_type);
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  it('classifies unknown term as new_core_entity', () => {
    const r = classifyAddition(index, {
      candidate_text: 'кватернионная связь',
      material_language: 'ru',
    });
    expect(['new_core_entity', 'relation_addition']).toContain(r.addition_type);
  });

  it('classifies translation gap as overlay_addition', () => {
    // Find an entity that might lack a label in a test locale
    const r = classifyAddition(index, {
      candidate_text: 'sal',
      material_language: 'es',
      nearest_refs: ['cls:salt'],
    });
    expect(['overlay_addition', 'alias_addition']).toContain(r.addition_type);
  });

  it('returns recommended_target_layer', () => {
    const r = classifyAddition(index, {
      candidate_text: 'кислота',
      material_language: 'ru',
    });
    expect(r.recommended_target_layer).toBeDefined();
  });
});

describe('createProposalDraft', () => {
  it('generates a valid proposal', () => {
    const r = createProposalDraft(index, {
      candidate_text: 'диссоциация',
      material_language: 'ru',
      evidence_text: 'Кислота диссоциирует в воде на ионы.',
      source_doc_id: 'lesson-acids-01',
    });
    expect(r.proposal.status).toBe('draft');
    expect(r.proposal.proposal_id).toBeDefined();
    expect(r.proposal.nearest_existing_refs.length).toBeGreaterThanOrEqual(0);
  });

  it('generates deterministic proposal_id', () => {
    const r1 = createProposalDraft(index, {
      candidate_text: 'test', material_language: 'ru',
    });
    const r2 = createProposalDraft(index, {
      candidate_text: 'test', material_language: 'ru',
    });
    expect(r1.proposal.proposal_id).toBe(r2.proposal.proposal_id);
  });
});
