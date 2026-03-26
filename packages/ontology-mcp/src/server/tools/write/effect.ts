import { join } from 'node:path';
import { readJsonFile, writeJsonFile, rebuildIndex, getDataSrcRoot } from './_shared.js';
import type { IndexRef } from '../../../shared/types.js';

type EffectCategory = 'kinetic' | 'thermodynamic' | 'mass_transfer' | 'phase';

interface EffectEntry {
  id: string;
  category: EffectCategory;
  [key: string]: unknown;
}

interface AddEffectArgs {
  id: string;
  category: EffectCategory;
}

interface UpdateEffectArgs {
  id: string;
  category?: EffectCategory;
}

interface AddEffectResult {
  ref?: string;
  status?: 'created';
  warnings?: string[];
  error?: boolean;
  code?: string;
  message?: string;
}

interface UpdateEffectResult {
  ref?: string;
  status?: 'updated';
  updated_fields?: string[];
  warnings?: string[];
  error?: boolean;
  code?: string;
  message?: string;
}

export async function addEffect(
  indexRef: IndexRef,
  args: AddEffectArgs,
  dataSrcOverride?: string,
): Promise<AddEffectResult> {
  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'effects_vocab.json');

  let entries: EffectEntry[];
  try {
    entries = (await readJsonFile(filePath)) as EffectEntry[];
  } catch {
    entries = [];
  }

  if (entries.some(e => e.id === args.id)) {
    return {
      error: true,
      code: 'ENTITY_EXISTS',
      message: `Effect "${args.id}" already exists`,
    };
  }

  const entry: EffectEntry = {
    id: args.id,
    category: args.category,
  };

  entries.push(entry);

  await writeJsonFile(filePath, entries);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    ref: `effect:${args.id}`,
    status: 'created',
  };
}

export async function updateEffect(
  indexRef: IndexRef,
  args: UpdateEffectArgs,
  dataSrcOverride?: string,
): Promise<UpdateEffectResult> {
  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'effects_vocab.json');

  let entries: EffectEntry[];
  try {
    entries = (await readJsonFile(filePath)) as EffectEntry[];
  } catch {
    return {
      error: true,
      code: 'NOT_FOUND',
      message: `effects_vocab.json not found at ${filePath}`,
    };
  }

  const idx = entries.findIndex(e => e.id === args.id);

  if (idx === -1) {
    return {
      error: true,
      code: 'NOT_FOUND',
      message: `Effect "${args.id}" not found`,
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
    ref: `effect:${args.id}`,
    status: 'updated',
    updated_fields: updated,
  };
}
