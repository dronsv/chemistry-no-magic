import { join } from 'node:path';
import { readJsonFile, writeJsonFile, rebuildIndex, getDataSrcRoot } from './_shared.js';
import type { IndexRef } from '../../../shared/types.js';

interface IonEntry {
  id: string;
  formula: string;
  type: 'cation' | 'anion';
  tags?: string[];
  characteristics?: Record<string, unknown>;
  [key: string]: unknown;
}

interface AddIonArgs {
  id: string;
  formula: string;
  type: 'cation' | 'anion';
  tags?: string[];
  characteristics?: Record<string, unknown>;
}

interface UpdateIonArgs {
  id: string;
  formula?: string;
  type?: 'cation' | 'anion';
  tags?: string[];
  characteristics?: Record<string, unknown>;
}

interface AddIonResult {
  ref?: string;
  status?: 'created';
  warnings?: string[];
  error?: boolean;
  code?: string;
  message?: string;
}

interface UpdateIonResult {
  ref?: string;
  status?: 'updated';
  updated_fields?: string[];
  warnings?: string[];
  error?: boolean;
  code?: string;
  message?: string;
}

export async function addIon(
  indexRef: IndexRef,
  args: AddIonArgs,
  dataSrcOverride?: string,
): Promise<AddIonResult> {
  // Validate id prefix
  if (!args.id.startsWith('ion:')) {
    return {
      error: true,
      code: 'VALIDATION_FAILED',
      message: `Ion id "${args.id}" must start with "ion:"`,
    };
  }

  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'ions.json');

  let entries: IonEntry[];
  try {
    entries = (await readJsonFile(filePath)) as IonEntry[];
  } catch {
    entries = [];
  }

  if (entries.some(e => e.id === args.id)) {
    return {
      error: true,
      code: 'ENTITY_EXISTS',
      message: `Ion "${args.id}" already exists`,
    };
  }

  const entry: IonEntry = {
    id: args.id,
    formula: args.formula,
    type: args.type,
  };

  if (args.tags !== undefined) entry.tags = args.tags;
  if (args.characteristics !== undefined) entry.characteristics = args.characteristics;

  entries.push(entry);

  await writeJsonFile(filePath, entries);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    ref: args.id,
    status: 'created',
  };
}

export async function updateIon(
  indexRef: IndexRef,
  args: UpdateIonArgs,
  dataSrcOverride?: string,
): Promise<UpdateIonResult> {
  if (!args.id.startsWith('ion:')) {
    return {
      error: true,
      code: 'VALIDATION_FAILED',
      message: `Ion id "${args.id}" must start with "ion:"`,
    };
  }

  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'ions.json');

  let entries: IonEntry[];
  try {
    entries = (await readJsonFile(filePath)) as IonEntry[];
  } catch {
    return {
      error: true,
      code: 'NOT_FOUND',
      message: `ions.json not found at ${filePath}`,
    };
  }

  const idx = entries.findIndex(e => e.id === args.id);

  if (idx === -1) {
    return {
      error: true,
      code: 'NOT_FOUND',
      message: `Ion "${args.id}" not found`,
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
    ref: args.id,
    status: 'updated',
    updated_fields: updated,
  };
}
