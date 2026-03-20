import type { OntologyIndex, OntRefKind } from '../../../shared/types.js';

interface ListEntityItem {
  ref: string;
  kind: OntRefKind;
  formula?: string;
  labels: Record<string, string>;
}

interface ListEntitiesResult {
  kind: string;
  total: number;
  items: ListEntityItem[];
}

export function listEntities(
  index: OntologyIndex,
  args: { kind: string; limit?: number; offset?: number },
): ListEntitiesResult {
  const limit = Math.min(args.limit ?? 100, 500);
  const offset = args.offset ?? 0;

  let entries = Array.from(index.entitiesByRef.values());

  if (args.kind !== 'all') {
    entries = entries.filter(e => e.kind === args.kind);
  }

  entries.sort((a, b) => a.ref.localeCompare(b.ref));

  const total = entries.length;
  const page = entries.slice(offset, offset + limit);

  const items: ListEntityItem[] = page.map(e => ({
    ref: e.ref,
    kind: e.kind,
    ...(e.formula ? { formula: e.formula } : {}),
    labels: e.labels,
  }));

  return { kind: args.kind, total, items };
}
