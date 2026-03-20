import { join } from 'node:path';
import { readJsonFile, writeJsonFile, rebuildIndex, getDataSrcRoot } from './_shared.js';
import type { IndexRef } from '../../../shared/types.js';

const VALID_PREFIXES = ['cls', 'concept', 'prop', 'rxtype', 'rxfacet'] as const;

interface ConceptExample {
  kind: string;
  id: string;
}

interface ClassificationFacet {
  facet_ref: string;
  children: string[];
}

interface ConceptEntry {
  kind: string;
  parent_id?: string | null;
  order?: number;
  filters?: Record<string, unknown>;
  examples?: ConceptExample[];
  children_order?: string[];
  classification_facets?: ClassificationFacet[];
  [key: string]: unknown;
}

type ConceptsFile = Record<string, ConceptEntry>;

interface AdmissionBlock {
  reason: string;
  nearest_existing_refs?: string[];
  non_redundancy_note?: string;
}

interface AddConceptArgs {
  ref: string;
  kind: string;
  parent_id?: string | null;
  order?: number;
  filters?: Record<string, unknown>;
  examples?: ConceptExample[];
  children_order?: string[];
  classification_facets?: ClassificationFacet[];
  admission?: AdmissionBlock;
}

interface UpdateConceptArgs {
  ref: string;
  kind?: string;
  parent_id?: string | null;
  order?: number;
  filters?: Record<string, unknown>;
  examples?: ConceptExample[];
  children_order?: string[];
  classification_facets?: ClassificationFacet[];
}

interface AddConceptResult {
  ref?: string;
  status?: 'created';
  warnings?: string[];
  error?: boolean;
  code?: string;
  message?: string;
}

interface UpdateConceptResult {
  ref?: string;
  status?: 'updated';
  updated_fields?: string[];
  warnings?: string[];
  error?: boolean;
  code?: string;
  message?: string;
}

function validateConceptRef(ref: string): { valid: boolean; prefix: string; error?: string } {
  const colonIdx = ref.indexOf(':');
  if (colonIdx === -1) {
    return { valid: false, prefix: '', error: `Invalid ref "${ref}" — must contain ":"` };
  }
  const prefix = ref.slice(0, colonIdx);
  const id = ref.slice(colonIdx + 1);
  if (!id) {
    return { valid: false, prefix, error: `Empty id in ref "${ref}"` };
  }
  if (!(VALID_PREFIXES as readonly string[]).includes(prefix)) {
    return {
      valid: false,
      prefix,
      error: `Invalid ref prefix "${prefix}" in "${ref}". Valid prefixes: ${VALID_PREFIXES.join(', ')}`,
    };
  }
  return { valid: true, prefix };
}

export async function addConcept(
  indexRef: IndexRef,
  args: AddConceptArgs,
  dataSrcOverride?: string,
): Promise<AddConceptResult> {
  const validation = validateConceptRef(args.ref);
  if (!validation.valid) {
    return {
      error: true,
      code: 'INVALID_REF',
      message: validation.error,
    };
  }

  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'concepts.json');

  let concepts: ConceptsFile;
  try {
    concepts = (await readJsonFile(filePath)) as ConceptsFile;
  } catch {
    concepts = {};
  }

  if (Object.prototype.hasOwnProperty.call(concepts, args.ref)) {
    return {
      error: true,
      code: 'ENTITY_EXISTS',
      message: `Concept "${args.ref}" already exists in concepts.json`,
    };
  }

  const warnings: string[] = [];

  if (!args.admission) {
    warnings.push('concept created without admission metadata');
  }

  if (args.parent_id != null && !Object.prototype.hasOwnProperty.call(concepts, args.parent_id)) {
    warnings.push(`parent_id "${args.parent_id}" not found in concepts.json`);
  }

  // Build entry without admission (admission is ephemeral)
  const entry: ConceptEntry = {
    kind: args.kind,
  };

  if (args.parent_id !== undefined) entry.parent_id = args.parent_id;
  if (args.order !== undefined) entry.order = args.order;
  if (args.filters !== undefined) entry.filters = args.filters;
  if (args.examples !== undefined) entry.examples = args.examples;
  if (args.children_order !== undefined) entry.children_order = args.children_order;
  if (args.classification_facets !== undefined) entry.classification_facets = args.classification_facets;

  concepts[args.ref] = entry;

  await writeJsonFile(filePath, concepts);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    ref: args.ref,
    status: 'created',
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

export async function updateConcept(
  indexRef: IndexRef,
  args: UpdateConceptArgs,
  dataSrcOverride?: string,
): Promise<UpdateConceptResult> {
  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'concepts.json');

  let concepts: ConceptsFile;
  try {
    concepts = (await readJsonFile(filePath)) as ConceptsFile;
  } catch {
    return {
      error: true,
      code: 'NOT_FOUND',
      message: `concepts.json not found at ${filePath}`,
    };
  }

  if (!Object.prototype.hasOwnProperty.call(concepts, args.ref)) {
    return {
      error: true,
      code: 'NOT_FOUND',
      message: `Concept "${args.ref}" not found in concepts.json`,
    };
  }

  const existing = concepts[args.ref];
  const updatedFieldNames: string[] = [];

  // Exclude ref and admission from updates
  const { ref: _ref, ...updateFields } = args as UpdateConceptArgs & { admission?: unknown };
  void _ref;

  for (const [key, value] of Object.entries(updateFields)) {
    if (value !== undefined) {
      existing[key] = value;
      updatedFieldNames.push(key);
    }
  }

  await writeJsonFile(filePath, concepts);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    ref: args.ref,
    status: 'updated',
    updated_fields: updatedFieldNames,
  };
}
