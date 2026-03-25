import { describe, it, expect } from 'vitest';
import type { ProcessVocabEntry, EffectsVocabEntry, TypedParam } from '../../types/process-vocab';

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

  it('TypedParam substance with ref', () => {
    const param: TypedParam = { key: 'acid_substance_id', kind: 'substance', ref: 'cls:acid' };
    expect(param.kind).toBe('substance');
    expect(param.ref).toBe('cls:acid');
  });

  it('TypedParam quantity with unit', () => {
    const param: TypedParam = { key: 'T_K', kind: 'quantity', ref: 'q:temperature', unit: 'unit:K' };
    expect(param.kind).toBe('quantity');
    expect(param.unit).toBe('unit:K');
  });

  it('TypedParam categorical without ref', () => {
    const param: TypedParam = { key: 'mode', kind: 'categorical' };
    expect(param.kind).toBe('categorical');
    expect(param.ref).toBeUndefined();
  });
});
