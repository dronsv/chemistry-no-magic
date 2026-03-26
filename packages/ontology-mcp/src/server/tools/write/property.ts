import { join } from 'node:path';
import { readJsonFile, writeJsonFile, rebuildIndex, getDataSrcRoot } from './_shared.js';
import type { IndexRef } from '../../../shared/types.js';

interface PropertyEntry {
  id: string;
  value_field: string | null;
  object: 'element' | 'substance' | 'ion';
  unit: string | null;
  concept_ref: string;
  trend_hint?: { period: string | null; group: string | null } | null;
  filter?: Record<string, unknown> | null;
  i18n: Record<string, Record<string, string>>;
  explanation_concept_ref?: string;
  conditions_schema?: string[];
  [key: string]: unknown;
}

interface AddPropertyArgs {
  id: string;
  value_field: string | null;
  object: 'element' | 'substance' | 'ion';
  unit: string | null;
  concept_ref: string;
  trend_hint?: { period: string | null; group: string | null } | null;
  filter?: Record<string, unknown> | null;
  i18n: Record<string, Record<string, string>>;
  explanation_concept_ref?: string;
  conditions_schema?: string[];
}

interface UpdatePropertyArgs {
  id: string;
  value_field?: string | null;
  object?: 'element' | 'substance' | 'ion';
  unit?: string | null;
  concept_ref?: string;
  trend_hint?: { period: string | null; group: string | null } | null;
  filter?: Record<string, unknown> | null;
  i18n?: Record<string, Record<string, string>>;
  explanation_concept_ref?: string;
  conditions_schema?: string[];
}

interface AddPropertyResult {
  ref?: string;
  status?: 'created';
  warnings?: string[];
  error?: boolean;
  code?: string;
  message?: string;
}

interface UpdatePropertyResult {
  ref?: string;
  status?: 'updated';
  updated_fields?: string[];
  warnings?: string[];
  error?: boolean;
  code?: string;
  message?: string;
}

export async function addProperty(
  indexRef: IndexRef,
  args: AddPropertyArgs,
  dataSrcOverride?: string,
): Promise<AddPropertyResult> {
  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'rules', 'properties.json');

  let entries: PropertyEntry[];
  try {
    entries = (await readJsonFile(filePath)) as PropertyEntry[];
  } catch {
    entries = [];
  }

  if (entries.some(e => e.id === args.id)) {
    return {
      error: true,
      code: 'ENTITY_EXISTS',
      message: `Property "${args.id}" already exists`,
    };
  }

  const entry: PropertyEntry = {
    id: args.id,
    value_field: args.value_field,
    object: args.object,
    unit: args.unit,
    concept_ref: args.concept_ref,
    trend_hint: args.trend_hint ?? null,
    filter: args.filter ?? null,
    i18n: args.i18n,
  };

  if (args.explanation_concept_ref !== undefined) entry.explanation_concept_ref = args.explanation_concept_ref;
  if (args.conditions_schema !== undefined) entry.conditions_schema = args.conditions_schema;

  entries.push(entry);

  await writeJsonFile(filePath, entries);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    ref: `prop:${args.id}`,
    status: 'created',
  };
}

export async function updateProperty(
  indexRef: IndexRef,
  args: UpdatePropertyArgs,
  dataSrcOverride?: string,
): Promise<UpdatePropertyResult> {
  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'rules', 'properties.json');

  let entries: PropertyEntry[];
  try {
    entries = (await readJsonFile(filePath)) as PropertyEntry[];
  } catch {
    return {
      error: true,
      code: 'NOT_FOUND',
      message: `properties.json not found at ${filePath}`,
    };
  }

  const idx = entries.findIndex(e => e.id === args.id);

  if (idx === -1) {
    return {
      error: true,
      code: 'NOT_FOUND',
      message: `Property "${args.id}" not found`,
    };
  }

  const { id: _id, ...fields } = args;
  void _id;

  const updated: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) {
      (entries[idx] as any)[k] = v;
      updated.push(k);
    }
  }

  await writeJsonFile(filePath, entries);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    ref: `prop:${args.id}`,
    status: 'updated',
    updated_fields: updated,
  };
}
