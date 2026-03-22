import type { OntologyIndex } from '../indexing/build-index';

export function createGetEntityTool(index: OntologyIndex) {
  return async function getEntity(args: { ref: string }): Promise<{ entity: unknown | null }> {
    return { entity: index.entitiesByRef.get(args.ref) ?? null };
  };
}
