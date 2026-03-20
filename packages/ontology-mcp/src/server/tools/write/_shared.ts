import { readFile, writeFile } from 'node:fs/promises';
import { buildOntologyIndex, getDataSrcRoot } from '../../indexing/build-index.js';
import type { IndexRef } from '../../../shared/types.js';

export async function readJsonFile(path: string): Promise<unknown> {
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw);
}

export async function writeJsonFile(path: string, data: unknown): Promise<void> {
  const json = JSON.stringify(data, null, 2) + '\n';
  await writeFile(path, json, 'utf-8');
}

export function validateRef(
  ref: string,
  expectedPrefix: string,
): { valid: boolean; id: string; error?: string } {
  const colonIdx = ref.indexOf(':');
  if (colonIdx === -1) {
    return { valid: false, id: '', error: `Invalid ref "${ref}" — must contain ":"` };
  }
  const prefix = ref.slice(0, colonIdx);
  const id = ref.slice(colonIdx + 1);
  if (prefix !== expectedPrefix) {
    return {
      valid: false,
      id,
      error: `Expected prefix "${expectedPrefix}" but got "${prefix}" in "${ref}"`,
    };
  }
  if (!id) {
    return { valid: false, id: '', error: `Empty id in ref "${ref}"` };
  }
  return { valid: true, id };
}

/**
 * Rebuild the in-memory index from data-src/ files.
 * In tests, callers pass `dataSrcOverride` to redirect file I/O to a temp dir
 * AND skip this rebuild (since rebuild always reads from the real data-src/).
 */
export async function rebuildIndex(indexRef: IndexRef): Promise<void> {
  indexRef.current = await buildOntologyIndex();
}

export { getDataSrcRoot };
