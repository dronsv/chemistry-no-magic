import { join } from 'node:path';
import { readJsonFile, writeJsonFile, rebuildIndex, getDataSrcRoot } from './_shared.js';
import type { IndexRef } from '../../../shared/types.js';

interface Triple {
  subject: string;
  predicate: string;
  object: string;
  step?: number;
  knowledge_level?: string;
  source_kind?: string;
  condition?: string;
}

interface AddRelationResult {
  file: string;
  added: number;
  skipped_duplicates: number;
  status: 'updated';
  warnings?: string[];
}

export async function addRelation(
  indexRef: IndexRef,
  args: { file: string; triples: Triple[] },
  dataSrcOverride?: string,
): Promise<AddRelationResult> {
  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'relations', `${args.file}.json`);

  let existing: Triple[];
  try {
    const raw = await readJsonFile(filePath);
    if (Array.isArray(raw)) {
      existing = raw;
    } else if (raw && typeof raw === 'object' && 'triples' in raw) {
      existing = (raw as { triples: Triple[] }).triples;
    } else if (raw && typeof raw === 'object' && 'relations' in raw) {
      existing = (raw as { relations: Triple[] }).relations;
    } else {
      existing = [];
    }
  } catch {
    existing = [];
  }

  const warnings: string[] = [];
  let added = 0;
  let skippedDuplicates = 0;

  for (const triple of args.triples) {
    const isDuplicate = existing.some(
      t => t.subject === triple.subject && t.predicate === triple.predicate && t.object === triple.object,
    );

    if (isDuplicate) {
      skippedDuplicates++;
      continue;
    }

    if (!indexRef.current.entitiesByRef.has(triple.subject)) {
      warnings.push(`Subject "${triple.subject}" not found in index`);
    }
    if (!indexRef.current.entitiesByRef.has(triple.object)) {
      warnings.push(`Object "${triple.object}" not found in index`);
    }

    existing.push(triple);
    added++;
  }

  await writeJsonFile(filePath, existing);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    file: args.file,
    added,
    skipped_duplicates: skippedDuplicates,
    status: 'updated',
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
