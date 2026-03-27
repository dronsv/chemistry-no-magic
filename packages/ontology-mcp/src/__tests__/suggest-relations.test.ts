import { describe, it, expect } from 'vitest';
import { suggestRelations } from '../server/tools/suggest-relations.js';
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

/** Helper to build a RelationsIndex from an array of relations. */
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

describe('suggestRelations', () => {
  it('returns error for unknown ref', () => {
    const index = mockIndex([]);
    const result = suggestRelations(index, { ref: 'cls:nonexistent' });
    expect(result).toHaveProperty('error', true);
    expect(result).toHaveProperty('code', 'NOT_FOUND');
  });

  it('suggests is_a for entity with parent_ref but no hierarchy relation', () => {
    const child = entity('cls:acid', 'substance_class', { en: 'acid' }, {
      parent_ref: 'cls:compound',
    });
    const parent = entity('cls:compound', 'substance_class', { en: 'compound' });
    const index = mockIndex([child, parent]);

    const result = suggestRelations(index, { ref: 'cls:acid' });
    expect('suggestions' in result).toBe(true);
    if (!('suggestions' in result)) return;

    const isA = result.suggestions.find(s => s.predicate === 'is_a');
    expect(isA).toBeDefined();
    expect(isA!.subject).toBe('cls:acid');
    expect(isA!.object).toBe('cls:compound');
    expect(isA!.rule).toBe('parent_hierarchy');
    expect(isA!.confidence).toBe(0.9);
  });

  it('does NOT suggest is_a if child_of already exists', () => {
    const child = entity('cls:acid', 'substance_class', { en: 'acid' }, {
      parent_ref: 'cls:compound',
    });
    const parent = entity('cls:compound', 'substance_class', { en: 'compound' });
    const relations: Relation[] = [
      { subject: 'cls:acid', predicate: 'child_of', object: 'cls:compound' },
    ];
    const index = mockIndex([child, parent], relations);

    const result = suggestRelations(index, { ref: 'cls:acid' });
    expect('suggestions' in result).toBe(true);
    if (!('suggestions' in result)) return;

    const isA = result.suggestions.find(s => s.predicate === 'is_a' && s.object === 'cls:compound');
    expect(isA).toBeUndefined();
  });

  it('suggests reverse for symmetric related_to relation', () => {
    const a = entity('concept:cathode', 'domain_concept', { en: 'cathode' });
    const b = entity('concept:anode', 'domain_concept', { en: 'anode' });
    const relations: Relation[] = [
      { subject: 'concept:cathode', predicate: 'related_to', object: 'concept:anode' },
    ];
    const index = mockIndex([a, b], relations);

    const result = suggestRelations(index, { ref: 'concept:cathode' });
    expect('suggestions' in result).toBe(true);
    if (!('suggestions' in result)) return;

    const reverse = result.suggestions.find(
      s => s.subject === 'concept:anode' && s.predicate === 'related_to' && s.object === 'concept:cathode',
    );
    expect(reverse).toBeDefined();
    expect(reverse!.rule).toBe('symmetric_relation');
    expect(reverse!.confidence).toBe(0.85);
  });

  it('does NOT suggest reverse if symmetric relation already exists', () => {
    const a = entity('concept:cathode', 'domain_concept', { en: 'cathode' });
    const b = entity('concept:anode', 'domain_concept', { en: 'anode' });
    const relations: Relation[] = [
      { subject: 'concept:cathode', predicate: 'related_to', object: 'concept:anode' },
      { subject: 'concept:anode', predicate: 'related_to', object: 'concept:cathode' },
    ];
    const index = mockIndex([a, b], relations);

    const result = suggestRelations(index, { ref: 'concept:cathode' });
    expect('suggestions' in result).toBe(true);
    if (!('suggestions' in result)) return;

    const reverse = result.suggestions.find(s => s.rule === 'symmetric_relation');
    expect(reverse).toBeUndefined();
  });

  it('suggests missing relation from sibling pattern', () => {
    const parent = entity('concept:electrode', 'domain_concept', { en: 'electrode' });
    const cathode = entity('concept:cathode', 'domain_concept', { en: 'cathode' }, {
      parent_ref: 'concept:electrode',
    });
    const anode = entity('concept:anode', 'domain_concept', { en: 'anode' }, {
      parent_ref: 'concept:electrode',
    });
    const cell = entity('concept:electrolytic_cell', 'domain_concept', { en: 'electrolytic cell' });

    // cathode has part_of → cell, anode doesn't
    const relations: Relation[] = [
      { subject: 'concept:cathode', predicate: 'part_of', object: 'concept:electrolytic_cell' },
    ];
    const index = mockIndex([parent, cathode, anode, cell], relations);

    const result = suggestRelations(index, { ref: 'concept:anode' });
    expect('suggestions' in result).toBe(true);
    if (!('suggestions' in result)) return;

    const sibSuggestion = result.suggestions.find(
      s => s.rule === 'sibling_pattern' && s.predicate === 'part_of',
    );
    expect(sibSuggestion).toBeDefined();
    expect(sibSuggestion!.subject).toBe('concept:anode');
    expect(sibSuggestion!.object).toBe('concept:electrolytic_cell');
    expect(sibSuggestion!.confidence).toBe(0.6);
  });

  it('does NOT suggest sibling patterns across different kinds', () => {
    const parent = entity('concept:electrode', 'domain_concept', { en: 'electrode' });
    const cathode = entity('concept:cathode', 'domain_concept', { en: 'cathode' }, {
      parent_ref: 'concept:electrode',
    });
    // Different kind: element instead of domain_concept
    const weirdSibling = entity('el:X', 'element', { en: 'element X' }, {
      parent_ref: 'concept:electrode',
    });
    const relations: Relation[] = [
      { subject: 'el:X', predicate: 'part_of', object: 'concept:something' },
    ];
    const index = mockIndex([parent, cathode, weirdSibling], relations);

    const result = suggestRelations(index, { ref: 'concept:cathode' });
    expect('suggestions' in result).toBe(true);
    if (!('suggestions' in result)) return;

    const sibSuggestion = result.suggestions.find(s => s.rule === 'sibling_pattern');
    expect(sibSuggestion).toBeUndefined();
  });

  it('suggests has_ion for substance with ion tags', () => {
    const sub = entity('sub:nacl', 'substance', { en: 'sodium chloride' }, {
      tags: ['ion:Na_plus', 'ion:Cl_minus', 'salt'],
    });
    const index = mockIndex([sub]);

    const result = suggestRelations(index, { ref: 'sub:nacl' });
    expect('suggestions' in result).toBe(true);
    if (!('suggestions' in result)) return;

    const ionSuggestions = result.suggestions.filter(s => s.rule === 'substance_ion');
    expect(ionSuggestions).toHaveLength(2);
    expect(ionSuggestions[0].predicate).toBe('has_ion');
    expect(ionSuggestions[0].confidence).toBe(0.95);

    const ionObjects = ionSuggestions.map(s => s.object).sort();
    expect(ionObjects).toEqual(['ion:Cl_minus', 'ion:Na_plus']);
  });

  it('does NOT suggest has_ion when relation already exists', () => {
    const sub = entity('sub:nacl', 'substance', { en: 'sodium chloride' }, {
      tags: ['ion:Na_plus'],
    });
    const relations: Relation[] = [
      { subject: 'sub:nacl', predicate: 'has_ion', object: 'ion:Na_plus' },
    ];
    const index = mockIndex([sub], relations);

    const result = suggestRelations(index, { ref: 'sub:nacl' });
    expect('suggestions' in result).toBe(true);
    if (!('suggestions' in result)) return;

    const ionSuggestion = result.suggestions.find(s => s.rule === 'substance_ion');
    expect(ionSuggestion).toBeUndefined();
  });

  it('suggests inverse describes for incoming described_by', () => {
    const concept = entity('concept:ph', 'domain_concept', { en: 'pH' });
    const prop = entity('prop:acidity', 'property', { en: 'acidity' });
    const relations: Relation[] = [
      { subject: 'concept:ph', predicate: 'described_by', object: 'prop:acidity' },
    ];
    const index = mockIndex([concept, prop], relations);

    const result = suggestRelations(index, { ref: 'prop:acidity' });
    expect('suggestions' in result).toBe(true);
    if (!('suggestions' in result)) return;

    const inv = result.suggestions.find(s => s.rule === 'inverse_predicate' && s.predicate === 'describes');
    expect(inv).toBeDefined();
    expect(inv!.subject).toBe('prop:acidity');
    expect(inv!.object).toBe('concept:ph');
    expect(inv!.confidence).toBe(0.7);
  });

  it('suggests has_instance for incoming instance_of', () => {
    const cls = entity('cls:acid', 'substance_class', { en: 'acid' });
    const sub = entity('sub:hcl', 'substance', { en: 'hydrochloric acid' });
    const relations: Relation[] = [
      { subject: 'sub:hcl', predicate: 'instance_of', object: 'cls:acid' },
    ];
    const index = mockIndex([cls, sub], relations);

    const result = suggestRelations(index, { ref: 'cls:acid' });
    expect('suggestions' in result).toBe(true);
    if (!('suggestions' in result)) return;

    const inv = result.suggestions.find(s => s.predicate === 'has_instance');
    expect(inv).toBeDefined();
    expect(inv!.subject).toBe('cls:acid');
    expect(inv!.object).toBe('sub:hcl');
    expect(inv!.confidence).toBe(0.5);
  });

  it('flags acid without conjugate_base', () => {
    const acid = entity('sub:hcl', 'substance', { en: 'hydrochloric acid' }, {
      tags: ['acid'],
    });
    const index = mockIndex([acid]);

    const result = suggestRelations(index, { ref: 'sub:hcl' });
    expect('suggestions' in result).toBe(true);
    if (!('suggestions' in result)) return;

    const conj = result.suggestions.find(s => s.rule === 'conjugate_pair');
    expect(conj).toBeDefined();
    expect(conj!.predicate).toBe('has_conjugate_base');
    expect(conj!.confidence).toBe(0.4);
  });

  it('does NOT flag acid if conjugate_base relation exists', () => {
    const acid = entity('sub:hcl', 'substance', { en: 'hydrochloric acid' }, {
      tags: ['acid'],
    });
    const relations: Relation[] = [
      { subject: 'sub:hcl', predicate: 'has_conjugate_base', object: 'ion:Cl_minus' },
    ];
    const index = mockIndex([acid], relations);

    const result = suggestRelations(index, { ref: 'sub:hcl' });
    expect('suggestions' in result).toBe(true);
    if (!('suggestions' in result)) return;

    const conj = result.suggestions.find(s => s.rule === 'conjugate_pair');
    expect(conj).toBeUndefined();
  });

  it('deduplicates suggestions with same subject|predicate|object', () => {
    // Two siblings with the same relation — should produce only one suggestion
    const parent = entity('concept:root', 'domain_concept', { en: 'root' });
    const a = entity('concept:a', 'domain_concept', { en: 'A' }, { parent_ref: 'concept:root' });
    const b = entity('concept:b', 'domain_concept', { en: 'B' }, { parent_ref: 'concept:root' });
    const c = entity('concept:c', 'domain_concept', { en: 'C' }, { parent_ref: 'concept:root' });
    const target = entity('concept:target', 'domain_concept', { en: 'target' });

    // Both b and c have "part_of -> target"; a has neither
    const relations: Relation[] = [
      { subject: 'concept:b', predicate: 'part_of', object: 'concept:target' },
      { subject: 'concept:c', predicate: 'part_of', object: 'concept:target' },
    ];
    const index = mockIndex([parent, a, b, c, target], relations);

    const result = suggestRelations(index, { ref: 'concept:a' });
    expect('suggestions' in result).toBe(true);
    if (!('suggestions' in result)) return;

    const partOfSuggestions = result.suggestions.filter(
      s => s.predicate === 'part_of' && s.object === 'concept:target',
    );
    expect(partOfSuggestions).toHaveLength(1);
  });

  it('limit caps the number of suggestions', () => {
    // Create many siblings with different relations to generate many suggestions
    const parent = entity('concept:root', 'domain_concept', { en: 'root' });
    const target = entity('concept:target', 'domain_concept', { en: 'target' }, {
      parent_ref: 'concept:root',
    });

    const entities: OntologyEntity[] = [parent, target];
    const relations: Relation[] = [];

    // Create 25 siblings, each with a unique relation
    for (let i = 0; i < 25; i++) {
      const sib = entity(`concept:sib${i}`, 'domain_concept', { en: `sib${i}` }, {
        parent_ref: 'concept:root',
      });
      entities.push(sib);
      const obj = entity(`concept:obj${i}`, 'domain_concept', { en: `obj${i}` });
      entities.push(obj);
      relations.push({ subject: `concept:sib${i}`, predicate: 'part_of', object: `concept:obj${i}` });
    }

    const index = mockIndex(entities, relations);
    const result = suggestRelations(index, { ref: 'concept:target', limit: 5 });
    expect('suggestions' in result).toBe(true);
    if (!('suggestions' in result)) return;

    expect(result.suggestions.length).toBeLessThanOrEqual(5);
  });

  it('returns empty suggestions for entity with no applicable patterns', () => {
    const lonely = entity('el:X', 'element', { en: 'element X' });
    const index = mockIndex([lonely]);

    const result = suggestRelations(index, { ref: 'el:X' });
    expect('suggestions' in result).toBe(true);
    if (!('suggestions' in result)) return;

    expect(result.suggestions).toHaveLength(0);
  });

  it('results are sorted by confidence descending', () => {
    // Set up entity that triggers multiple rules at different confidence levels
    const parent = entity('cls:compound', 'substance_class', { en: 'compound' });
    const acid = entity('sub:hcl', 'substance', { en: 'HCl' }, {
      parent_ref: 'cls:compound',
      tags: ['acid', 'ion:Cl_minus'],
    });
    const other = entity('concept:x', 'domain_concept', { en: 'x' });
    const relations: Relation[] = [
      { subject: 'sub:hcl', predicate: 'related_to', object: 'concept:x' },
    ];
    const index = mockIndex([parent, acid, other], relations);

    const result = suggestRelations(index, { ref: 'sub:hcl' });
    expect('suggestions' in result).toBe(true);
    if (!('suggestions' in result)) return;

    for (let i = 1; i < result.suggestions.length; i++) {
      expect(result.suggestions[i - 1].confidence).toBeGreaterThanOrEqual(result.suggestions[i].confidence);
    }
  });

  it('returns ref in output', () => {
    const e = entity('cls:acid', 'substance_class', { en: 'acid' });
    const index = mockIndex([e]);
    const result = suggestRelations(index, { ref: 'cls:acid' });
    expect('ref' in result && result.ref).toBe('cls:acid');
  });
});
