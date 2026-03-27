import type { OntologyIndex, OntologyEntity, Relation } from '../../shared/types.js';

export interface SuggestedRelation {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  rule: string;
  reason: string;
}

function hasRelation(index: OntologyIndex, subject: string, predicate: string, object: string): boolean {
  const rels = index.relations.bySubject.get(subject) ?? [];
  return rels.some(r => r.predicate === predicate && r.object === object);
}

export function suggestRelations(
  index: OntologyIndex,
  args: { ref: string; limit?: number },
): { ref: string; suggestions: SuggestedRelation[] } | { error: boolean; code: string; message: string } {
  const { ref, limit = 20 } = args;

  const entity = index.entitiesByRef.get(ref);
  if (!entity) {
    return { error: true, code: 'NOT_FOUND', message: `Entity "${ref}" not found` };
  }

  const suggestions: SuggestedRelation[] = [];

  // Rule 1: Concept hierarchy — parent_ref → is_a relation
  if (entity.parent_ref) {
    if (!hasRelation(index, ref, 'is_a', entity.parent_ref) && !hasRelation(index, ref, 'child_of', entity.parent_ref)) {
      suggestions.push({
        subject: ref,
        predicate: 'is_a',
        object: entity.parent_ref,
        confidence: 0.9,
        rule: 'parent_hierarchy',
        reason: `${ref} has parent_ref ${entity.parent_ref} but no is_a/child_of relation`,
      });
    }
  }

  // Rule 2: Symmetric relations — if A related_to B, suggest B related_to A
  const outRels = index.relations.bySubject.get(ref) ?? [];
  for (const rel of outRels) {
    if (rel.predicate === 'related_to') {
      if (!hasRelation(index, rel.object, 'related_to', ref)) {
        suggestions.push({
          subject: rel.object,
          predicate: 'related_to',
          object: ref,
          confidence: 0.85,
          rule: 'symmetric_relation',
          reason: `${ref} related_to ${rel.object} exists, but reverse does not`,
        });
      }
    }
  }

  // Rule 3: Sibling similarity — siblings with relations the target lacks
  if (entity.parent_ref) {
    for (const [sibRef, sib] of index.entitiesByRef) {
      if (sibRef === ref) continue;
      if (sib.parent_ref !== entity.parent_ref) continue;
      if (sib.kind !== entity.kind) continue;

      const sibRels = index.relations.bySubject.get(sibRef) ?? [];
      for (const sibRel of sibRels) {
        // Skip hierarchy predicates — those are entity-specific
        if (sibRel.predicate === 'is_a' || sibRel.predicate === 'child_of') continue;
        if (!hasRelation(index, ref, sibRel.predicate, sibRel.object)) {
          suggestions.push({
            subject: ref,
            predicate: sibRel.predicate,
            object: sibRel.object,
            confidence: 0.6,
            rule: 'sibling_pattern',
            reason: `Sibling ${sibRef} has ${sibRel.predicate} -> ${sibRel.object}; ${ref} does not`,
          });
        }
      }
    }
  }

  // Rule 4: Substance → ions (tags starting with "ion:")
  if (entity.kind === 'substance' && entity.tags) {
    for (const tag of entity.tags) {
      if (tag.startsWith('ion:')) {
        if (!hasRelation(index, ref, 'has_ion', tag) && !hasRelation(index, ref, 'contains', tag)) {
          suggestions.push({
            subject: ref,
            predicate: 'has_ion',
            object: tag,
            confidence: 0.95,
            rule: 'substance_ion',
            reason: `Substance ${ref} lists ion ${tag} in tags but has no has_ion relation`,
          });
        }
      }
    }
  }

  // Rule 5: Inverse predicates — check incoming relations for missing inverses
  const inRels = index.relations.byObject.get(ref) ?? [];
  for (const rel of inRels) {
    if (rel.predicate === 'described_by') {
      if (!hasRelation(index, ref, 'describes', rel.subject)) {
        suggestions.push({
          subject: ref,
          predicate: 'describes',
          object: rel.subject,
          confidence: 0.7,
          rule: 'inverse_predicate',
          reason: `${rel.subject} described_by ${ref} exists; inverse describes relation missing`,
        });
      }
    }
    if (rel.predicate === 'instance_of') {
      if (!hasRelation(index, ref, 'has_instance', rel.subject)) {
        suggestions.push({
          subject: ref,
          predicate: 'has_instance',
          object: rel.subject,
          confidence: 0.5,
          rule: 'inverse_predicate',
          reason: `${rel.subject} instance_of ${ref}; inverse has_instance missing`,
        });
      }
    }
  }

  // Rule 6: Conjugate pairs — acid without conjugate_base
  if (entity.kind === 'substance' && entity.tags?.includes('acid')) {
    if (!outRels.some(r => r.predicate === 'has_conjugate_base')) {
      suggestions.push({
        subject: ref,
        predicate: 'has_conjugate_base',
        object: '?',
        confidence: 0.4,
        rule: 'conjugate_pair',
        reason: `Substance ${ref} is tagged as acid but has no has_conjugate_base relation`,
      });
    }
  }

  // Deduplicate by subject|predicate|object
  const seen = new Set<string>();
  const deduped = suggestions.filter(s => {
    const key = `${s.subject}|${s.predicate}|${s.object}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => b.confidence - a.confidence);
  return { ref, suggestions: deduped.slice(0, limit) };
}
