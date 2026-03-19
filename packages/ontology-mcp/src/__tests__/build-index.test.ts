import { describe, it, expect } from 'vitest';
import { buildOntologyIndex } from '../server/indexing/build-index.js';
import { loadRelations } from '../server/indexing/load-relations.js';

describe('buildOntologyIndex', () => {
  it('loads all entity types from data-src', async () => {
    const index = await buildOntologyIndex();
    expect(index.entitiesByRef.size).toBeGreaterThanOrEqual(400);
  });

  it('indexes elements by symbol', async () => {
    const index = await buildOntologyIndex();
    expect(index.symbolIndex.get('Na')).toBe('el:Na');
    expect(index.symbolIndex.get('H')).toBe('el:H');
  });

  it('merges locale overlays into entity labels', async () => {
    const index = await buildOntologyIndex();
    const sodium = index.entitiesByRef.get('el:Na');
    expect(sodium?.labels['ru']).toBeDefined();
    expect(sodium?.labels['en']).toBeDefined();
  });

  it('builds alias index from all sources', async () => {
    const index = await buildOntologyIndex();
    expect(index.aliasIndex.size).toBeGreaterThan(2000);
  });

  it('includes relations index', async () => {
    const index = await buildOntologyIndex();
    expect(index.relations).toBeDefined();
    expect(index.relations.bySubject.size).toBeGreaterThan(0);
  });
});

describe('loadRelations', () => {
  it('loads relation files from data-src/relations/', async () => {
    const relations = await loadRelations();
    expect(relations.bySubject.size).toBeGreaterThan(0);
    expect(relations.byPredicate.size).toBeGreaterThan(0);
  });

  it('indexes acid_base_relations by predicate', async () => {
    const relations = await loadRelations();
    const hasAcidBase = [...relations.byPredicate.keys()].some(
      p => p === 'has_conjugate_base' || p === 'has_conjugate_acid'
    );
    expect(hasAcidBase).toBe(true);
  });

  it('indexes concept hierarchy from parent_id', async () => {
    const relations = await loadRelations();
    const parentOf = relations.byPredicate.get('has_parent') ?? [];
    expect(parentOf.length).toBeGreaterThan(0);
  });

  it('indexes substance → class instance_of relations', async () => {
    const relations = await loadRelations();
    const instanceOf = relations.byPredicate.get('instance_of') ?? [];
    expect(instanceOf.length).toBeGreaterThan(0);
  });
});
