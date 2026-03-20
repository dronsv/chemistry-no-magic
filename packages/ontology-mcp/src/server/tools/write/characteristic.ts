import { join } from 'node:path';
import { access } from 'node:fs/promises';
import { readJsonFile, writeJsonFile, rebuildIndex, getDataSrcRoot } from './_shared.js';
import type { IndexRef } from '../../../shared/types.js';

interface CharacteristicEntry {
  value: number | string;
  unit: string;
  conditions?: Record<string, unknown>;
  source?: string;
  explanation?: string;
}

interface SubstanceData {
  id: string;
  formula: string;
  class: string;
  characteristics?: Record<string, CharacteristicEntry>;
  [key: string]: unknown;
}

interface AddCharacteristicArgs {
  substance_id: string;
  concept_ref: string;
  value: number | string;
  unit: string;
  conditions?: Record<string, unknown>;
  source?: string;
  explanation?: string;
}

interface UpdateCharacteristicArgs {
  substance_id: string;
  concept_ref: string;
  value: number | string;
  unit: string;
  conditions?: Record<string, unknown>;
  source?: string;
  explanation?: string;
}

interface CharacteristicResult {
  ref?: string;
  concept_ref?: string;
  path?: string;
  status?: 'added' | 'updated';
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

export async function addCharacteristic(
  indexRef: IndexRef,
  args: AddCharacteristicArgs,
  dataSrcOverride?: string,
): Promise<CharacteristicResult> {
  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'substances', `${args.substance_id}.json`);

  if (!(await fileExists(filePath))) {
    return {
      error: true,
      code: 'NOT_FOUND',
      message: `Substance "${args.substance_id}" not found at ${filePath}`,
    };
  }

  const substance = (await readJsonFile(filePath)) as SubstanceData;

  if (!substance.characteristics) {
    substance.characteristics = {};
  }

  if (args.concept_ref in substance.characteristics) {
    return {
      error: true,
      code: 'ENTITY_EXISTS',
      message: `Characteristic "${args.concept_ref}" already exists on substance "${args.substance_id}"`,
    };
  }

  const entry: CharacteristicEntry = {
    value: args.value,
    unit: args.unit,
  };
  if (args.conditions !== undefined) entry.conditions = args.conditions;
  if (args.source !== undefined) entry.source = args.source;
  if (args.explanation !== undefined) entry.explanation = args.explanation;

  substance.characteristics[args.concept_ref] = entry;

  await writeJsonFile(filePath, substance);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    ref: `sub:${args.substance_id}`,
    concept_ref: args.concept_ref,
    path: filePath,
    status: 'added',
  };
}

export async function updateCharacteristic(
  indexRef: IndexRef,
  args: UpdateCharacteristicArgs,
  dataSrcOverride?: string,
): Promise<CharacteristicResult> {
  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'substances', `${args.substance_id}.json`);

  if (!(await fileExists(filePath))) {
    return {
      error: true,
      code: 'NOT_FOUND',
      message: `Substance "${args.substance_id}" not found at ${filePath}`,
    };
  }

  const substance = (await readJsonFile(filePath)) as SubstanceData;

  if (!substance.characteristics || !(args.concept_ref in substance.characteristics)) {
    return {
      error: true,
      code: 'NOT_FOUND',
      message: `Characteristic "${args.concept_ref}" not found on substance "${args.substance_id}"`,
    };
  }

  const entry: CharacteristicEntry = {
    value: args.value,
    unit: args.unit,
  };
  if (args.conditions !== undefined) entry.conditions = args.conditions;
  if (args.source !== undefined) entry.source = args.source;
  if (args.explanation !== undefined) entry.explanation = args.explanation;

  substance.characteristics[args.concept_ref] = entry;

  await writeJsonFile(filePath, substance);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    ref: `sub:${args.substance_id}`,
    concept_ref: args.concept_ref,
    path: filePath,
    status: 'updated',
  };
}
