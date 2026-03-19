import { describe, it, expect, beforeAll } from 'vitest';
import { buildOntologyIndex } from '../server/indexing/build-index.js';
import { getNeighbors } from '../server/tools/get-neighbors.js';
import type { OntologyIndex } from '../shared/types.js';

let index: OntologyIndex;
beforeAll(async () => { index = await buildOntologyIndex(); });

describe('getNeighbors', () => {
  it('returns incoming instance_of relations for cls:acid', () => {
    const r = getNeighbors(index, { ref: 'cls:acid' });
    expect(r.incoming.some(rel => rel.predicate === 'instance_of')).toBe(true);
  });

  it('filters by relation_types', () => {
    const r = getNeighbors(index, { ref: 'cls:acid', relation_types: ['instance_of'] });
    const all = [...r.outgoing, ...r.incoming];
    expect(all.every(rel => rel.predicate === 'instance_of')).toBe(true);
  });

  it('respects limit', () => {
    const r = getNeighbors(index, { ref: 'cls:acid', limit: 2 });
    expect(r.outgoing.length).toBeLessThanOrEqual(2);
    expect(r.incoming.length).toBeLessThanOrEqual(2);
  });

  it('returns empty for unknown ref', () => {
    const r = getNeighbors(index, { ref: 'el:Unobtanium' });
    expect(r.outgoing).toEqual([]);
    expect(r.incoming).toEqual([]);
  });
});
