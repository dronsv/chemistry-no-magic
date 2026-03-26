import { join } from 'node:path';
import { readJsonFile, writeJsonFile, rebuildIndex, getDataSrcRoot } from './_shared.js';
import type { IndexRef } from '../../../shared/types.js';

type ProcessKind = 'chemical' | 'physical' | 'driving_force' | 'operation' | 'constraint';

interface ProcessParam {
  key: string;
  kind: string;
  ref?: string;
  unit?: string;
}

interface ProcessEffect {
  id: string;
  when: string;
}

interface ProcessEntry {
  id: string;
  kind: ProcessKind;
  params?: Array<string | ProcessParam>;
  parent?: string;
  effects?: Array<string | ProcessEffect>;
  concept_ref?: string;
  [key: string]: unknown;
}

interface AddProcessArgs {
  id: string;
  kind: ProcessKind;
  params?: Array<string | ProcessParam>;
  parent?: string;
  effects?: Array<string | ProcessEffect>;
  concept_ref?: string;
}

interface UpdateProcessArgs {
  id: string;
  kind?: ProcessKind;
  params?: Array<string | ProcessParam>;
  parent?: string;
  effects?: Array<string | ProcessEffect>;
  concept_ref?: string;
}

interface AddProcessResult {
  ref?: string;
  status?: 'created';
  warnings?: string[];
  error?: boolean;
  code?: string;
  message?: string;
}

interface UpdateProcessResult {
  ref?: string;
  status?: 'updated';
  updated_fields?: string[];
  warnings?: string[];
  error?: boolean;
  code?: string;
  message?: string;
}

export async function addProcess(
  indexRef: IndexRef,
  args: AddProcessArgs,
  dataSrcOverride?: string,
): Promise<AddProcessResult> {
  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'process_vocab.json');

  let entries: ProcessEntry[];
  try {
    entries = (await readJsonFile(filePath)) as ProcessEntry[];
  } catch {
    entries = [];
  }

  if (entries.some(e => e.id === args.id)) {
    return {
      error: true,
      code: 'ENTITY_EXISTS',
      message: `Process "${args.id}" already exists`,
    };
  }

  const entry: ProcessEntry = {
    id: args.id,
    kind: args.kind,
  };

  if (args.params !== undefined) entry.params = args.params;
  if (args.parent !== undefined) entry.parent = args.parent;
  if (args.effects !== undefined) entry.effects = args.effects;
  if (args.concept_ref !== undefined) entry.concept_ref = args.concept_ref;

  entries.push(entry);

  await writeJsonFile(filePath, entries);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    ref: `process:${args.id}`,
    status: 'created',
  };
}

export async function updateProcess(
  indexRef: IndexRef,
  args: UpdateProcessArgs,
  dataSrcOverride?: string,
): Promise<UpdateProcessResult> {
  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'process_vocab.json');

  let entries: ProcessEntry[];
  try {
    entries = (await readJsonFile(filePath)) as ProcessEntry[];
  } catch {
    return {
      error: true,
      code: 'NOT_FOUND',
      message: `process_vocab.json not found at ${filePath}`,
    };
  }

  const idx = entries.findIndex(e => e.id === args.id);

  if (idx === -1) {
    return {
      error: true,
      code: 'NOT_FOUND',
      message: `Process "${args.id}" not found`,
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
    ref: `process:${args.id}`,
    status: 'updated',
    updated_fields: updated,
  };
}
