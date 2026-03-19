import type { OntologyIndex, Relation } from '../../shared/types.js';

interface GetNeighborsResult {
  ref: string;
  outgoing: Relation[];
  incoming: Relation[];
}

export function getNeighbors(
  index: OntologyIndex,
  args: { ref: string; relation_types?: string[]; limit?: number }
): GetNeighborsResult {
  const { ref, relation_types, limit = 50 } = args;

  let outgoing = index.relations.bySubject.get(ref) ?? [];
  let incoming = index.relations.byObject.get(ref) ?? [];

  if (relation_types?.length) {
    const allowed = new Set(relation_types);
    outgoing = outgoing.filter(r => allowed.has(r.predicate));
    incoming = incoming.filter(r => allowed.has(r.predicate));
  }

  return {
    ref,
    outgoing: outgoing.slice(0, limit),
    incoming: incoming.slice(0, limit),
  };
}
