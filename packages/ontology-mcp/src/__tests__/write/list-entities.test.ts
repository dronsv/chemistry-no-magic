import { describe, it, expect, beforeAll } from 'vitest';
import { buildOntologyIndex } from '../../server/indexing/build-index.js';
import { listEntities } from '../../server/tools/write/list-entities.js';
import type { OntologyIndex } from '../../shared/types.js';

let index: OntologyIndex;
beforeAll(async () => { index = await buildOntologyIndex(); });

describe('listEntities', () => {
  it('lists all elements', () => {
    const r = listEntities(index, { kind: 'element' });
    expect(r.total).toBeGreaterThanOrEqual(118);
    expect(r.items[0]).toHaveProperty('ref');
    expect(r.items[0]).toHaveProperty('kind', 'element');
    expect(r.items[0]).toHaveProperty('labels');
  });

  it('respects limit and offset', () => {
    const r1 = listEntities(index, { kind: 'element', limit: 5 });
    expect(r1.items).toHaveLength(5);

    const r2 = listEntities(index, { kind: 'element', limit: 5, offset: 5 });
    expect(r2.items).toHaveLength(5);
    expect(r2.items[0].ref).not.toBe(r1.items[0].ref);
  });

  it('lists all kinds with kind="all"', () => {
    const r = listEntities(index, { kind: 'all', limit: 500 });
    expect(r.total).toBeGreaterThan(200);
    const kinds = new Set(r.items.map(e => e.kind));
    expect(kinds.size).toBeGreaterThan(3);
  });

  it('returns lightweight summaries without aliases or description', () => {
    const r = listEntities(index, { kind: 'substance', limit: 1 });
    const item = r.items[0];
    expect(item).toHaveProperty('ref');
    expect(item).toHaveProperty('kind');
    expect(item).toHaveProperty('labels');
    expect(item).not.toHaveProperty('aliases');
    expect(item).not.toHaveProperty('description');
  });
});
