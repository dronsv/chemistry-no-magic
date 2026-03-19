import { describe, it, expect, beforeAll } from 'vitest';
import { buildOntologyIndex } from '../server/indexing/build-index.js';
import { searchEntities } from '../server/tools/search-entities.js';
import { getEntity } from '../server/tools/get-entity.js';
import type { OntologyIndex } from '../shared/types.js';

let index: OntologyIndex;
beforeAll(async () => { index = await buildOntologyIndex(); });

describe('searchEntities', () => {
  it('finds element by exact ref', () => {
    const r = searchEntities(index, { query: 'el:Na' });
    expect(r.candidates[0]?.ref).toBe('el:Na');
    expect(r.candidates[0]?.score).toBe(1.0);
  });

  it('finds element by symbol', () => {
    const r = searchEntities(index, { query: 'Na' });
    expect(r.candidates.some(c => c.ref === 'el:Na')).toBe(true);
  });

  it('finds substance by formula', () => {
    const r = searchEntities(index, { query: 'HCl' });
    expect(r.candidates.some(c => c.ref === 'sub:hcl')).toBe(true);
  });

  it('finds concept by Russian alias', () => {
    const r = searchEntities(index, { query: 'кислота' });
    expect(r.candidates.some(c => c.ref === 'cls:acid')).toBe(true);
  });

  it('filters by kind', () => {
    const r = searchEntities(index, { query: 'Na', kinds: ['element'] });
    expect(r.candidates.every(c => c.kind === 'element')).toBe(true);
  });

  it('respects limit', () => {
    const r = searchEntities(index, { query: 'a', limit: 3 });
    expect(r.candidates.length).toBeLessThanOrEqual(3);
  });
});

describe('getEntity', () => {
  it('returns entity for valid ref', () => {
    const r = getEntity(index, { ref: 'el:Na' });
    expect(r.entity).not.toBeNull();
    expect(r.entity?.kind).toBe('element');
    expect(r.entity?.symbol).toBe('Na');
  });

  it('returns locale labels', () => {
    const r = getEntity(index, { ref: 'el:Na' });
    expect(r.entity?.labels['ru']).toBeDefined();
    expect(r.entity?.labels['en']).toBeDefined();
  });

  it('returns null for unknown ref', () => {
    const r = getEntity(index, { ref: 'el:Unobtanium' });
    expect(r.entity).toBeNull();
  });
});
