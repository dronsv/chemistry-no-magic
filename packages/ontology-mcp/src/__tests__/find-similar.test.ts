import { describe, it, expect } from 'vitest';
import { findSimilar } from '../server/tools/find-similar.js';
import type { OntologyIndex, OntologyEntity, Relation, RelationsIndex } from '../shared/types.js';

/** Helper to build a minimal OntologyEntity. */
function entity(
  ref: string,
  kind: OntologyEntity['kind'],
  labels: Record<string, string>,
  opts: Partial<OntologyEntity> = {},
): OntologyEntity {
  return { ref, kind, labels, aliases: {}, ...opts };
}

/** Helper to build a minimal RelationsIndex. */
function buildRelationsIndex(relations: Relation[]): RelationsIndex {
  const bySubject = new Map<string, Relation[]>();
  const byObject = new Map<string, Relation[]>();
  const byPredicate = new Map<string, Relation[]>();
  for (const r of relations) {
    bySubject.set(r.subject, [...(bySubject.get(r.subject) ?? []), r]);
    byObject.set(r.object, [...(byObject.get(r.object) ?? []), r]);
    byPredicate.set(r.predicate, [...(byPredicate.get(r.predicate) ?? []), r]);
  }
  return { bySubject, byObject, byPredicate };
}

/** Build a mock OntologyIndex from entities and optional relations. */
function mockIndex(entities: OntologyEntity[], relations: Relation[] = []): OntologyIndex {
  const entitiesByRef = new Map<string, OntologyEntity>();
  for (const e of entities) entitiesByRef.set(e.ref, e);
  return {
    entitiesByRef,
    aliasIndex: new Map(),
    formulaIndex: new Map(),
    symbolIndex: new Map(),
    relations: buildRelationsIndex(relations),
  };
}

// ---- Shared test fixtures ----

const acidClass = entity('cls:acid', 'substance_class', { en: 'acid', ru: 'kislota' }, {
  parent_ref: 'cls:compound',
  tags: ['inorganic', 'school'],
  description: { en: 'A substance that donates protons' },
});

const baseClass = entity('cls:base', 'substance_class', { en: 'base', ru: 'osnovaniye' }, {
  parent_ref: 'cls:compound',
  tags: ['inorganic', 'school'],
  description: { en: 'A substance that accepts protons' },
});

const saltClass = entity('cls:salt', 'substance_class', { en: 'salt', ru: 'sol' }, {
  parent_ref: 'cls:compound',
  tags: ['inorganic', 'school'],
  description: { en: 'An ionic compound from acid-base reaction' },
});

const oxideClass = entity('cls:oxide', 'substance_class', { en: 'oxide', ru: 'oksid' }, {
  parent_ref: 'cls:compound',
  tags: ['inorganic'],
  description: { en: 'A compound containing oxygen' },
});

const hydrogen = entity('el:H', 'element', { en: 'hydrogen', ru: 'vodorod' }, {
  tags: ['nonmetal', 'gas'],
  description: { en: 'The lightest element' },
});

const dissolution = entity('concept:dissolution', 'domain_concept', { en: 'dissolution', ru: 'rastvoreniye' }, {
  tags: ['process', 'school'],
  description: { en: 'Process of dissolving a substance in water solution' },
});

const dilution = entity('concept:dilution', 'domain_concept', { en: 'dilution', ru: 'razbaleniye' }, {
  tags: ['process', 'school'],
  description: { en: 'Process of dissolving a substance further in water solution' },
});

describe('findSimilar', () => {
  it('returns error for unknown ref', () => {
    const index = mockIndex([acidClass]);
    const result = findSimilar(index, { ref: 'cls:nonexistent' });
    expect(result).toHaveProperty('error', true);
    expect(result).toHaveProperty('code', 'NOT_FOUND');
  });

  it('excludes the source entity from results', () => {
    const index = mockIndex([acidClass, baseClass]);
    const result = findSimilar(index, { ref: 'cls:acid', min_score: 0 });
    expect('similar' in result && result.similar.every(s => s.ref !== 'cls:acid')).toBe(true);
  });

  it('same-kind entities score higher than different-kind', () => {
    const index = mockIndex([acidClass, baseClass, hydrogen]);
    const result = findSimilar(index, { ref: 'cls:acid', min_score: 0 });
    if (!('similar' in result)) throw new Error('Expected similar results');

    const baseScore = result.similar.find(s => s.ref === 'cls:base')!.score;
    const hydrogenScore = result.similar.find(s => s.ref === 'el:H')!.score;
    expect(baseScore).toBeGreaterThan(hydrogenScore);
  });

  it('entities with same parent score higher', () => {
    // acid and base share parent cls:compound, hydrogen has no parent
    const index = mockIndex([acidClass, baseClass, hydrogen]);
    const result = findSimilar(index, { ref: 'cls:acid', min_score: 0 });
    if (!('similar' in result)) throw new Error('Expected similar results');

    const baseEntry = result.similar.find(s => s.ref === 'cls:base')!;
    expect(baseEntry.signals.parentMatch).toBe(true);

    const hydrogenEntry = result.similar.find(s => s.ref === 'el:H')!;
    expect(hydrogenEntry.signals.parentMatch).toBe(false);
  });

  it('results are sorted by score descending', () => {
    const index = mockIndex([acidClass, baseClass, saltClass, oxideClass, hydrogen]);
    const result = findSimilar(index, { ref: 'cls:acid', min_score: 0 });
    if (!('similar' in result)) throw new Error('Expected similar results');

    for (let i = 1; i < result.similar.length; i++) {
      expect(result.similar[i - 1].score).toBeGreaterThanOrEqual(result.similar[i].score);
    }
  });

  it('min_score filters low-scoring results', () => {
    const index = mockIndex([acidClass, baseClass, hydrogen]);
    // Use a high min_score — hydrogen (different kind, no parent, no tag overlap) should be filtered
    const result = findSimilar(index, { ref: 'cls:acid', min_score: 0.4 });
    if (!('similar' in result)) throw new Error('Expected similar results');

    expect(result.similar.every(s => s.score >= 0.4)).toBe(true);
    expect(result.similar.find(s => s.ref === 'el:H')).toBeUndefined();
  });

  it('limit caps result count', () => {
    const index = mockIndex([acidClass, baseClass, saltClass, oxideClass, hydrogen]);
    const result = findSimilar(index, { ref: 'cls:acid', limit: 2, min_score: 0 });
    if (!('similar' in result)) throw new Error('Expected similar results');

    expect(result.similar.length).toBeLessThanOrEqual(2);
  });

  it('shared relations boost similarity', () => {
    // acid and base both relate to the same ion
    const relations: Relation[] = [
      { subject: 'cls:acid', predicate: 'produces', object: 'ion:H_plus' },
      { subject: 'cls:base', predicate: 'produces', object: 'ion:H_plus' },
    ];
    // Give oxide no relations so we can compare
    const index = mockIndex([acidClass, baseClass, oxideClass], relations);
    const result = findSimilar(index, { ref: 'cls:acid', min_score: 0 });
    if (!('similar' in result)) throw new Error('Expected similar results');

    const baseEntry = result.similar.find(s => s.ref === 'cls:base')!;
    const oxideEntry = result.similar.find(s => s.ref === 'cls:oxide')!;
    expect(baseEntry.signals.sharedRelations).toBeGreaterThan(0);
    expect(baseEntry.score).toBeGreaterThan(oxideEntry.score);
  });

  it('tag Jaccard is computed correctly', () => {
    const index = mockIndex([acidClass, baseClass, oxideClass]);
    const result = findSimilar(index, { ref: 'cls:acid', min_score: 0 });
    if (!('similar' in result)) throw new Error('Expected similar results');

    // acid tags: ['inorganic', 'school'], base tags: ['inorganic', 'school'] -> Jaccard = 1.0
    const baseEntry = result.similar.find(s => s.ref === 'cls:base')!;
    expect(baseEntry.signals.tagOverlap).toBe(1);

    // acid tags: ['inorganic', 'school'], oxide tags: ['inorganic'] -> Jaccard = 1/2 = 0.5
    const oxideEntry = result.similar.find(s => s.ref === 'cls:oxide')!;
    expect(oxideEntry.signals.tagOverlap).toBe(0.5);
  });

  it('description similarity is detected for similar descriptions', () => {
    const index = mockIndex([dissolution, dilution]);
    const result = findSimilar(index, { ref: 'concept:dissolution', min_score: 0 });
    if (!('similar' in result)) throw new Error('Expected similar results');

    const entry = result.similar.find(s => s.ref === 'concept:dilution')!;
    // Both descriptions share most words — should have high trigram overlap
    expect(entry.signals.descriptionSim).toBeGreaterThan(0);
  });

  it('returns ref in output', () => {
    const index = mockIndex([acidClass, baseClass]);
    const result = findSimilar(index, { ref: 'cls:acid' });
    expect('ref' in result && result.ref).toBe('cls:acid');
  });
});
