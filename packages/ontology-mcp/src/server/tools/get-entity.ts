import type { OntologyIndex, OntologyEntity } from '../../shared/types.js';

export function getEntity(
  index: OntologyIndex,
  args: { ref: string }
): { entity: OntologyEntity | null } {
  const entity = index.entitiesByRef.get(args.ref) ?? null;
  return { entity };
}
