import { describe, it, expect } from 'vitest';
import type { ProcessVocabEntry, EffectsVocabEntry } from '../../types/process-vocab';

describe('process-vocab types', () => {
  it('ProcessVocabEntry supports concept_ref', () => {
    const entry: ProcessVocabEntry = {
      id: 'test', kind: 'chemical', name: 'test', description: 'test',
      concept_ref: 'concept:chemical_reaction',
    };
    expect(entry.concept_ref).toBe('concept:chemical_reaction');
  });

  it('EffectsVocabEntry supports concept_ref', () => {
    const entry: EffectsVocabEntry = {
      id: 'test', category: 'kinetic', name: 'test', description: 'test',
      concept_ref: 'concept:speed_increase',
    };
    expect(entry.concept_ref).toBe('concept:speed_increase');
  });

  it('description can be RichText array', () => {
    const entry: ProcessVocabEntry = {
      id: 'test', kind: 'chemical', name: 'test',
      description: [{ t: 'text', v: 'A reaction with ' }, { t: 'ref', id: 'concept:metals' }],
    };
    expect(Array.isArray(entry.description)).toBe(true);
  });
});
