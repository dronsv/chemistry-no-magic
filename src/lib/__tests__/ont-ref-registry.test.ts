import { describe, it, expect } from 'vitest';
import { resolveRefKind, extractRefId, buildCanonicalHref } from '../ont-ref-registry';

describe('resolveRefKind', () => {
  it('resolves element refs', () => expect(resolveRefKind('el:Na')).toBe('element'));
  it('resolves substance refs', () => expect(resolveRefKind('sub:hcl')).toBe('substance'));
  it('resolves ion refs', () => expect(resolveRefKind('ion:H_plus')).toBe('ion'));
  it('resolves concept refs', () => expect(resolveRefKind('concept:pKa')).toBe('domain_concept'));
  it('resolves class refs', () => expect(resolveRefKind('cls:acid')).toBe('substance_class'));
  it('resolves reaction type refs', () => expect(resolveRefKind('rxtype:acid_metal')).toBe('reaction_type'));
  it('resolves formula refs', () => expect(resolveRefKind('formula:molar_mass')).toBe('formula'));
  it('returns unknown for unrecognized prefix', () => expect(resolveRefKind('xyz:foo')).toBe('unknown'));
  it('returns unknown for string without colon', () => expect(resolveRefKind('bare')).toBe('unknown'));
});

describe('extractRefId', () => {
  it('extracts element id', () => expect(extractRefId('el:Na')).toBe('Na'));
  it('extracts substance id', () => expect(extractRefId('sub:hcl')).toBe('hcl'));
  it('handles colon in id', () => expect(extractRefId('concept:acid:special')).toBe('acid:special'));
  it('handles bare string', () => expect(extractRefId('bare')).toBe('bare'));
});

describe('buildCanonicalHref', () => {
  it('builds element href with locale', () => {
    expect(buildCanonicalHref('el:Na', 'ru')).toBe('/ru/periodic-table/Na/');
  });
  it('builds substance href', () => {
    expect(buildCanonicalHref('sub:hcl', 'en')).toBe('/en/substances/hcl/');
  });
  it('returns null for ion (no per-ion page in v1)', () => {
    expect(buildCanonicalHref('ion:H_plus', 'ru')).toBeNull();
  });
  // v1 policy: concepts have preview-only, no canonical page
  it('returns null for domain_concept (no page)', () => {
    expect(buildCanonicalHref('concept:pKa', 'ru')).toBeNull();
  });
  it('returns null for substance_class (needs overlay)', () => {
    expect(buildCanonicalHref('cls:acid', 'ru')).toBeNull();
  });
  it('returns null for unknown ref', () => {
    expect(buildCanonicalHref('xyz:foo', 'ru')).toBeNull();
  });
});
