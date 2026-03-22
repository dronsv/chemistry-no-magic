import { join } from 'node:path';
import { access } from 'node:fs/promises';
import { readJsonFile, writeJsonFile, rebuildIndex, getDataSrcRoot } from './_shared.js';
import type { IndexRef } from '../../../shared/types.js';

interface SubstanceData {
  id: string;
  formula: string;
  class: string;
  subclass?: string;
  ions?: string[];
  tags?: string[];
  phase_standard?: 'g' | 'l' | 's' | 'aq';
  characteristics?: Record<string, unknown>;
  [key: string]: unknown;
}

interface AddSubstanceArgs {
  id: string;
  formula: string;
  class: string;
  subclass?: string;
  ions?: string[];
  tags?: string[];
  phase_standard?: 'g' | 'l' | 's' | 'aq';
  characteristics?: Record<string, unknown>;
}

interface UpdateSubstanceArgs {
  id: string;
  formula?: string;
  class?: string;
  subclass?: string;
  ions?: string[];
  tags?: string[];
  phase_standard?: 'g' | 'l' | 's' | 'aq';
  characteristics?: Record<string, unknown>;
}

interface AddSubstanceResult {
  ref?: string;
  path?: string;
  status?: 'created';
  warnings?: string[];
  error?: boolean;
  code?: string;
  message?: string;
}

interface UpdateSubstanceResult {
  ref?: string;
  path?: string;
  status?: 'updated';
  updated_fields?: string[];
  warnings?: string[];
  error?: boolean;
  code?: string;
  message?: string;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function addSubstance(
  indexRef: IndexRef,
  args: AddSubstanceArgs,
  dataSrcOverride?: string,
): Promise<AddSubstanceResult> {
  // Validate id format
  if (!/^[a-z][a-z0-9_]*$/.test(args.id)) {
    return {
      error: true,
      code: 'VALIDATION_FAILED',
      message: `Substance id "${args.id}" must start with a lowercase letter and contain only lowercase alphanumeric characters and underscores`,
    };
  }

  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'substances', `${args.id}.json`);

  if (await fileExists(filePath)) {
    return {
      error: true,
      code: 'ENTITY_EXISTS',
      message: `Substance "${args.id}" already exists at ${filePath}`,
    };
  }

  const warnings: string[] = [];

  if (args.ions) {
    for (const ionRef of args.ions) {
      if (!indexRef.current.entitiesByRef.has(ionRef)) {
        warnings.push(`Ion ref "${ionRef}" not found in index`);
      }
    }
  }

  const substance: SubstanceData = {
    id: `sub:${args.id}`,
    formula: args.formula,
    class: args.class,
  };

  if (args.subclass !== undefined) substance.subclass = args.subclass;
  if (args.ions !== undefined) substance.ions = args.ions;
  if (args.tags !== undefined) substance.tags = args.tags;
  if (args.phase_standard !== undefined) substance.phase_standard = args.phase_standard;
  if (args.characteristics !== undefined) substance.characteristics = args.characteristics;

  await writeJsonFile(filePath, substance);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    ref: `sub:${args.id}`,
    path: filePath,
    status: 'created',
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

export async function updateSubstance(
  indexRef: IndexRef,
  args: UpdateSubstanceArgs,
  dataSrcOverride?: string,
): Promise<UpdateSubstanceResult> {
  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'substances', `${args.id}.json`);

  if (!(await fileExists(filePath))) {
    return {
      error: true,
      code: 'NOT_FOUND',
      message: `Substance "${args.id}" not found at ${filePath}`,
    };
  }

  const existing = (await readJsonFile(filePath)) as SubstanceData;

  const { id: _id, ...updateFields } = args;
  void _id;

  const updatedFieldNames: string[] = [];

  for (const [key, value] of Object.entries(updateFields)) {
    if (value !== undefined) {
      existing[key] = value;
      updatedFieldNames.push(key);
    }
  }

  await writeJsonFile(filePath, existing);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    ref: `sub:${args.id}`,
    path: filePath,
    status: 'updated',
    updated_fields: updatedFieldNames,
  };
}
