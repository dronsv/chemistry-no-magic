import { describe, it, expect } from 'vitest';
import {
  getTargets,
  getSources,
  filterByKnowledgeLevel,
  terminalConjugateBase,
  getAtStep,
} from '../relations';
import type { Relation } from '../../types/relation';

const RELATIONS: Relation[] = [
  // HCl → Cl⁻ (step 1)
  { subject: 'sub:hcl', predicate: 'has_conjugate_base', object: 'ion:Cl_minus', step: 1, knowledge_level: 'strict_chemistry' },
  { subject: 'ion:Cl_minus', predicate: 'has_conjugate_acid', object: 'sub:hcl', step: 1, knowledge_level: 'strict_chemistry' },
  // H₂SO₄ → HSO₄⁻ → SO₄²⁻ (diprotic)
  { subject: 'sub:h2so4', predicate: 'has_conjugate_base', object: 'ion:HSO4_minus', step: 1, knowledge_level: 'strict_chemistry' },
  { subject: 'ion:HSO4_minus', predicate: 'has_conjugate_base', object: 'ion:SO4_2minus', step: 2, knowledge_level: 'strict_chemistry' },
  // ion roles
  { subject: 'ion:SO4_2minus', predicate: 'has_role', object: 'acid_residue', knowledge_level: 'school_convention' },
  { subject: 'ion:Cl_minus', predicate: 'has_role', object: 'acid_residue', knowledge_level: 'school_convention' },
];

describe('getTargets', () => {
  it('returns targets for given subject + predicate', () => {
    expect(getTargets(RELATIONS, 'sub:hcl', 'has_conjugate_base')).toEqual(['ion:Cl_minus']);
  });

  it('returns all objects when predicate omitted', () => {
    const results = getTargets(RELATIONS, 'sub:hcl');
    expect(results).toContain('ion:Cl_minus');
  });

  it('returns empty array when subject not found', () => {
    expect(getTargets(RELATIONS, 'sub:unknown', 'has_conjugate_base')).toEqual([]);
  });
});

describe('getSources', () => {
  it('returns subjects pointing to objectId via predicate', () => {
    expect(getSources(RELATIONS, 'acid_residue', 'has_role')).toEqual(
      expect.arrayContaining(['ion:SO4_2minus', 'ion:Cl_minus']),
    );
  });

  it('returns empty array when no match', () => {
    expect(getSources(RELATIONS, 'nonexistent', 'has_role')).toEqual([]);
  });
});

describe('filterByKnowledgeLevel', () => {
  it('filters to strict_chemistry', () => {
    const result = filterByKnowledgeLevel(RELATIONS, 'strict_chemistry');
    expect(result.every(r => r.knowledge_level === 'strict_chemistry')).toBe(true);
  });

  it('filters to school_convention', () => {
    const result = filterByKnowledgeLevel(RELATIONS, 'school_convention');
    expect(result.every(r => r.knowledge_level === 'school_convention')).toBe(true);
  });
});

describe('terminalConjugateBase', () => {
  it('finds terminal base for monoprotic acid', () => {
    expect(terminalConjugateBase(RELATIONS, 'sub:hcl')).toBe('ion:Cl_minus');
  });

  it('follows chain to terminal for diprotic acid', () => {
    expect(terminalConjugateBase(RELATIONS, 'sub:h2so4')).toBe('ion:SO4_2minus');
  });

  it('returns null for non-acid subject', () => {
    expect(terminalConjugateBase(RELATIONS, 'ion:Cl_minus')).toBeNull();
  });
});

describe('getAtStep', () => {
  it('returns targets at given step', () => {
    expect(getAtStep(RELATIONS, 'sub:h2so4', 'has_conjugate_base', 1)).toEqual(['ion:HSO4_minus']);
  });

  it('returns step-2 targets from intermediate', () => {
    expect(getAtStep(RELATIONS, 'ion:HSO4_minus', 'has_conjugate_base', 2)).toEqual(['ion:SO4_2minus']);
  });

  it('returns empty when step not found', () => {
    expect(getAtStep(RELATIONS, 'sub:hcl', 'has_conjugate_base', 99)).toEqual([]);
  });
});
