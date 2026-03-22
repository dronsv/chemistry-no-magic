export interface BuildOntologyIndexOptions {
  ontologyDir: string;
  localesDir: string;
  searchOverlaysDir: string;
}

export interface OntologyEntityRecord {
  ref: string;
  kind: string;
  label?: string;
  aliases?: string[];
  formulas?: string[];
  symbols?: string[];
}

export interface OntologyIndex {
  entitiesByRef: Map<string, OntologyEntityRecord>;
  aliasesToRefs: Map<string, string[]>;
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

export async function buildOntologyIndex(
  _options: BuildOntologyIndexOptions,
): Promise<OntologyIndex> {
  // Replace this placeholder with real file loading.
  const entitiesByRef = new Map<string, OntologyEntityRecord>();
  const aliasesToRefs = new Map<string, string[]>();

  const seed: OntologyEntityRecord[] = [
    { ref: 'cls:acid', kind: 'substance_class', label: 'acid', aliases: ['кислота'] },
    {
      ref: 'concept:acid_dissociation',
      kind: 'concept',
      label: 'acid dissociation',
      aliases: ['кислотная диссоциация', 'диссоциация кислоты'],
    },
  ];

  for (const entity of seed) {
    entitiesByRef.set(entity.ref, entity);
    for (const alias of [entity.label, ...(entity.aliases ?? [])].filter(Boolean) as string[]) {
      const key = normalize(alias);
      const current = aliasesToRefs.get(key) ?? [];
      current.push(entity.ref);
      aliasesToRefs.set(key, current);
    }
  }

  return { entitiesByRef, aliasesToRefs };
}

export function searchAlias(index: OntologyIndex, query: string): string[] {
  return index.aliasesToRefs.get(normalize(query)) ?? [];
}
