import { join } from 'node:path';
import { readJsonFile, writeJsonFile, rebuildIndex, getDataSrcRoot } from './_shared.js';
import type { IndexRef } from '../../../shared/types.js';

const VALID_LOCALES = ['ru', 'en', 'pl', 'es'];

interface AddTranslationResult {
  locale?: string;
  data_key?: string;
  entity_id?: string;
  merged_fields?: string[];
  status?: 'created' | 'updated';
  warnings?: string[];
  error?: boolean;
  code?: string;
  message?: string;
}

export async function addTranslation(
  indexRef: IndexRef,
  args: {
    locale: string;
    data_key: string;
    entity_id: string;
    fields: Record<string, unknown>;
  },
  dataSrcOverride?: string,
): Promise<AddTranslationResult> {
  if (!VALID_LOCALES.includes(args.locale)) {
    return {
      error: true,
      code: 'VALIDATION_FAILED',
      message: `Invalid locale "${args.locale}". Must be one of: ${VALID_LOCALES.join(', ')}`,
    };
  }

  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'translations', args.locale, `${args.data_key}.json`);

  let overlay: Record<string, unknown>;
  try {
    overlay = (await readJsonFile(filePath)) as Record<string, unknown>;
  } catch {
    overlay = {};
  }

  const existing = (overlay[args.entity_id] ?? {}) as Record<string, unknown>;
  const merged = { ...existing, ...args.fields };
  overlay[args.entity_id] = merged;

  await writeJsonFile(filePath, overlay);

  const warnings: string[] = [];
  const entityExists =
    indexRef.current.entitiesByRef.has(args.entity_id) ||
    Array.from(indexRef.current.entitiesByRef.keys()).some((ref) =>
      ref.endsWith(`:${args.entity_id}`),
    );
  if (!entityExists) {
    warnings.push(`Entity "${args.entity_id}" not found in index — may not exist yet`);
  }

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    locale: args.locale,
    data_key: args.data_key,
    entity_id: args.entity_id,
    merged_fields: Object.keys(args.fields),
    status: Object.keys(existing).length > 0 ? 'updated' : 'created',
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
